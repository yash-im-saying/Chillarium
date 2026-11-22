import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type {
  BiomePreset,
  CameraPreset,
  GpuRenderInfo,
  QualityTier,
  SpecimenInfo,
  TerrariumSettings,
  VesselStyle,
} from '../types/terrarium';
import { createProceduralTextures, type ProceduralTextureSet } from './textures';
import { createTerrariumMaterials, type TerrariumMaterialLibrary } from './materials';
import { buildTerrariumVessel, type BuiltVessel } from './vessel';
import { buildTerrariumFlora, type BuiltFlora } from './flora';
import { createWeatherSystem, type WeatherSystem } from './weather';
import { createLightingRig, type LightingRig } from './lighting';

const CAMERA_PRESETS: Record<CameraPreset, { pos: [number, number, number]; target: [number, number, number] }> = {
  overview: { pos: [4.6, 3.1, 4.9], target: [0, 1.55, 0] },
  canopy: { pos: [2.85, 2.55, 3.05], target: [-0.2, 1.35, -0.15] },
  moss_floor: { pos: [2.45, 1.38, 2.75], target: [0.18, 0.72, 0.2] },
};

const _targetPos = new THREE.Vector3();
const _targetLook = new THREE.Vector3();
const _pointer = new THREE.Vector2();

export interface TerrariumCallbacks {
  onSelectSpecimen: (info: SpecimenInfo | null) => void;
  onTimeAdvance: (newTime: number) => void;
  onContextLost: (lost: boolean) => void;
  onNightFactorChange?: (nightFactor: number) => void;
  onGpuInfoChange?: (info: GpuRenderInfo) => void;
}

export class TerrariumEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private isSoftwareGl: boolean;
  private gpuName: string;
  private maxAnisotropy: number;

  private textures: ProceduralTextureSet;
  private materials: TerrariumMaterialLibrary;
  private lighting: LightingRig;
  private weatherSystem: WeatherSystem;
  private envRenderTarget: THREE.WebGLRenderTarget;

  private currentVessel: BuiltVessel | null = null;
  private currentFlora: BuiltFlora | null = null;
  private loadedVesselStyle: VesselStyle;
  private loadedBiome: BiomePreset;
  private loadedLushness: number;
  private loadedSeed: number;
  private loadedGraphicsQuality: QualityTier;
  private loadedResolutionQuality: QualityTier;

  private settings: TerrariumSettings;
  private callbacks: TerrariumCallbacks;

  private raycaster = new THREE.Raycaster();
  private pulseTarget: THREE.Object3D | null = null;
  private pulseAge = 10;

  private camTransitionActive = false;
  private desiredCamPos = new THREE.Vector3(...CAMERA_PRESETS.overview.pos);
  private desiredCamTarget = new THREE.Vector3(...CAMERA_PRESETS.overview.target);

  private clock = new THREE.Clock();
  private elapsed = 0;
  private frameId = 0;
  private isDisposed = false;
  private lastHoverCheck = 0;
  private pointerDownPos = { x: 0, y: 0 };
  private lastTimeReport = 0;
  private resizeObserver: ResizeObserver;

  constructor(
    container: HTMLElement,
    initialSettings: TerrariumSettings,
    callbacks: TerrariumCallbacks
  ) {
    this.container = container;
    this.settings = { ...initialSettings };
    this.callbacks = callbacks;

    this.loadedVesselStyle = initialSettings.vesselStyle;
    this.loadedBiome = initialSettings.biome;
    this.loadedLushness = initialSettings.lushness;
    this.loadedSeed = initialSettings.seed;
    this.loadedGraphicsQuality = initialSettings.graphicsQuality;
    this.loadedResolutionQuality = initialSettings.resolutionQuality;

    // Probe Software WebGL & GPU adapter string via WebGL2 (never user agent)
    const probe = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return { software: true, name: 'Software WebGL' };
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const raw = String(gl.getParameter(param) || 'WebGL2 GPU');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      const software = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(raw);
      const angleMatch = raw.match(/ANGLE\s*\((?:[^,]+,\s*)?([^,)]+)/i);
      const cleanName = angleMatch ? angleMatch[1].trim() : raw.replace(/Direct3D.*|OpenGL.*/i, '').trim();
      return { software, name: cleanName || raw };
    })();
    this.isSoftwareGl = probe.software;
    this.gpuName = probe.name;

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 80);
    this.camera.position.set(...CAMERA_PRESETS[initialSettings.cameraPreset].pos);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(...CAMERA_PRESETS[initialSettings.cameraPreset].target);
    this.controls.enableDamping = !this.isSoftwareGl;
    this.controls.dampingFactor = 0.055;
    this.controls.minDistance = 2.9;
    this.controls.maxDistance = 11.0;
    this.controls.minPolarAngle = 0.16;
    this.controls.maxPolarAngle = Math.PI * 0.485;
    this.controls.enablePan = false;
    this.controls.autoRotate = initialSettings.autoOrbit && !this.isSoftwareGl;
    this.controls.autoRotateSpeed = 0.55;
    this.controls.update();

    // Cancel scripted camera transition immediately when user interacts
    this.controls.addEventListener('start', () => {
      this.camTransitionActive = false;
    });

    // Procedural Studio Reflection Map (always generated on every device)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRenderTarget = pmremGenerator.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRenderTarget.texture;
    roomEnv.dispose();
    pmremGenerator.dispose();

    this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(this.maxAnisotropy);
    this.materials = createTerrariumMaterials(this.textures, this.isSoftwareGl);
    this.lighting = createLightingRig(this.scene, this.isSoftwareGl);
    this.weatherSystem = createWeatherSystem(this.textures);
    this.scene.add(this.weatherSystem.root);

    // Build initial vessel + flora
    this.rebuildVessel();
    this.rebuildFlora();

    // Apply initial GPU quality & resolution settings
    this.applyGraphicsQuality(initialSettings.graphicsQuality);
    this.applyResolutionQuality(initialSettings.resolutionQuality);

    // Configure raycaster for layer 1 interactables
    this.raycaster.layers.set(1);

    // Pre-warm shaders on GPU
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Event bindings
    this.bindEvents();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    // Start render loop
    this.clock.start();
    this.tick();
  }

  private rebuildVessel() {
    if (this.currentVessel) {
      this.scene.remove(this.currentVessel.root);
      this.currentVessel.dispose();
    }
    this.currentVessel = buildTerrariumVessel(this.settings.vesselStyle, this.materials);
    this.scene.add(this.currentVessel.root);
    this.loadedVesselStyle = this.settings.vesselStyle;
  }

  private rebuildFlora() {
    if (this.currentFlora) {
      this.scene.remove(this.currentFlora.root);
      this.currentFlora.dispose();
      this.pulseTarget = null;
    }
    this.currentFlora = buildTerrariumFlora(
      this.settings.biome,
      this.settings.lushness,
      this.settings.seed,
      this.materials
    );
    this.scene.add(this.currentFlora.root);
    this.loadedBiome = this.settings.biome;
    this.loadedLushness = this.settings.lushness;
    this.loadedSeed = this.settings.seed;
  }

  private applyGraphicsQuality(tier: QualityTier) {
    this.loadedGraphicsQuality = tier;
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && tier !== 'low';
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.transmissionResolutionScale =
      tier === 'ultra' ? 1.0 : tier === 'high' ? 0.75 : 0.5;

    this.lighting.setShadowQuality(tier, this.isSoftwareGl);
    this.materials.setGraphicsQuality(tier);

    const targetAniso =
      tier === 'ultra'
        ? this.maxAnisotropy
        : tier === 'high'
          ? Math.min(8, this.maxAnisotropy)
          : tier === 'medium'
            ? Math.min(4, this.maxAnisotropy)
            : 1;
    this.textures.setAnisotropy(targetAniso);
  }

  private applyResolutionQuality(tier: QualityTier) {
    this.loadedResolutionQuality = tier;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const dpr = window.devicePixelRatio || 1;

    let targetRatio = 1.0;
    if (tier === 'low') {
      targetRatio = 0.55;
    } else if (tier === 'medium') {
      targetRatio = 1.0;
    } else if (tier === 'high') {
      targetRatio = Math.min(Math.max(dpr, 1.25), 1.65);
    } else {
      targetRatio = Math.min(Math.max(dpr, 1.75), 2.25);
    }

    const effectiveRatio = this.isSoftwareGl ? Math.min(targetRatio, 1.0) : targetRatio;
    this.renderer.setPixelRatio(effectiveRatio);
    this.renderer.setSize(width, height);

    this.callbacks.onGpuInfoChange?.({
      rendererName: this.gpuName,
      isSoftwareGl: this.isSoftwareGl,
      pixelRatio: effectiveRatio,
      renderWidth: Math.round(width * effectiveRatio),
      renderHeight: Math.round(height * effectiveRatio),
    });
  }

  public updateSettings(next: TerrariumSettings) {
    const prevPreset = this.settings.cameraPreset;
    this.settings = { ...next };

    if (next.vesselStyle !== this.loadedVesselStyle) {
      this.rebuildVessel();
    }
    if (
      next.biome !== this.loadedBiome ||
      Math.abs(next.lushness - this.loadedLushness) > 0.01 ||
      next.seed !== this.loadedSeed
    ) {
      this.rebuildFlora();
    }
    if (next.graphicsQuality !== this.loadedGraphicsQuality) {
      this.applyGraphicsQuality(next.graphicsQuality);
    }
    if (next.resolutionQuality !== this.loadedResolutionQuality) {
      this.applyResolutionQuality(next.resolutionQuality);
    }

    if (next.cameraPreset !== prevPreset) {
      const preset = CAMERA_PRESETS[next.cameraPreset];
      this.desiredCamPos.set(...preset.pos);
      this.desiredCamTarget.set(...preset.target);
      this.camTransitionActive = true;
    }

    this.controls.autoRotate = next.autoOrbit && !this.isSoftwareGl;
  }

  public triggerCameraPreset(presetName: CameraPreset) {
    const preset = CAMERA_PRESETS[presetName];
    this.desiredCamPos.set(...preset.pos);
    this.desiredCamTarget.set(...preset.target);
    this.camTransitionActive = true;
    this.settings.cameraPreset = presetName;
  }

  private onPointerDown = (e: PointerEvent) => {
    this.pointerDownPos.x = e.clientX;
    this.pointerDownPos.y = e.clientY;
  };

  private onPointerMove = (e: PointerEvent) => {
    const now = performance.now();
    if (now - this.lastHoverCheck < 55) return;
    this.lastHoverCheck = now;

    if (!this.currentFlora) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(_pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.currentFlora.interactables, true);
    this.renderer.domElement.style.cursor = hits.length > 0 ? 'pointer' : 'grab';
  };

  private onPointerUp = (e: PointerEvent) => {
    const dx = e.clientX - this.pointerDownPos.x;
    const dy = e.clientY - this.pointerDownPos.y;
    if (dx * dx + dy * dy > 36) return; // Dragged orbit, not click

    if (!this.currentFlora) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    _pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(_pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.currentFlora.interactables, true);

    if (hits.length > 0) {
      const rootObj = hits[0].object.userData.specimenRoot as THREE.Object3D | undefined;
      const specimen = rootObj?.userData?.specimen as SpecimenInfo | undefined;
      if (rootObj && specimen) {
        if (this.pulseTarget && this.pulseTarget !== rootObj) {
          this.pulseTarget.scale.setScalar(1);
        }
        this.pulseTarget = rootObj;
        this.pulseAge = 0;
        this.callbacks.onSelectSpecimen(specimen);
        return;
      }
    }
    this.callbacks.onSelectSpecimen(null);
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.callbacks.onContextLost(true);
  };

  private onContextRestored = () => {
    this.callbacks.onContextLost(false);
  };

  private bindEvents() {
    const dom = this.renderer.domElement;
    dom.style.cursor = 'grab';
    dom.addEventListener('pointerdown', this.onPointerDown);
    dom.addEventListener('pointermove', this.onPointerMove);
    dom.addEventListener('pointerup', this.onPointerUp);
    dom.addEventListener('webglcontextlost', this.onContextLost);
    dom.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  private handleResize() {
    if (this.isDisposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.applyResolutionQuality(this.settings.resolutionQuality);
  }

  private afterDraw(cb: () => void) {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.isDisposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick = () => {
    if (this.isDisposed) return;

    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.elapsed += dt;
    this.pulseAge += dt;

    // Optional slow ambient day/night cycle (1 full day every ~90s)
    if (this.settings.autoCycle) {
      this.settings.timeOfDay = (this.settings.timeOfDay + dt * 0.26) % 24;
      if (this.elapsed - this.lastTimeReport > 0.15) {
        this.lastTimeReport = this.elapsed;
        this.callbacks.onTimeAdvance(this.settings.timeOfDay);
      }
    }

    // Damped camera preset transitions
    if (this.camTransitionActive) {
      const alpha = 1 - Math.exp(-4.5 * dt);
      _targetPos.copy(this.camera.position).lerp(this.desiredCamPos, alpha);
      _targetLook.copy(this.controls.target).lerp(this.desiredCamTarget, alpha);
      this.camera.position.copy(_targetPos);
      this.controls.target.copy(_targetLook);
      if (
        this.camera.position.distanceToSquared(this.desiredCamPos) < 0.0008 &&
        this.controls.target.distanceToSquared(this.desiredCamTarget) < 0.0008
      ) {
        this.camera.position.copy(this.desiredCamPos);
        this.controls.target.copy(this.desiredCamTarget);
        this.camTransitionActive = false;
      }
    }

    this.controls.update();

    const lanternPos = this.currentFlora
      ? this.currentFlora.lanternPosition
      : _targetPos.set(0.12, 0.9, 0.86);
    const mushroomPos =
      this.currentFlora && this.currentFlora.mushroomGlowPositions.length > 0
        ? this.currentFlora.mushroomGlowPositions[0]
        : null;

    const nightFactor = this.lighting.update(
      this.settings.timeOfDay,
      this.settings.weather,
      this.settings.rainIntensity,
      this.settings.mistIntensity,
      this.settings.condensationIntensity,
      lanternPos,
      mushroomPos,
      this.materials,
      this.scene,
      this.elapsed
    );
    this.callbacks.onNightFactorChange?.(nightFactor);

    if (this.currentFlora) {
      this.currentFlora.updateSway(
        this.elapsed,
        this.settings.breeze,
        this.pulseTarget,
        this.pulseAge
      );
    }

    this.weatherSystem.update(
      dt,
      this.elapsed,
      this.settings.weather,
      this.settings.rainIntensity,
      this.settings.mistIntensity,
      this.settings.condensationIntensity,
      nightFactor,
      this.settings.breeze
    );

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  public dispose() {
    this.isDisposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    this.resizeObserver.disconnect();

    const dom = this.renderer.domElement;
    dom.removeEventListener('pointerdown', this.onPointerDown);
    dom.removeEventListener('pointermove', this.onPointerMove);
    dom.removeEventListener('pointerup', this.onPointerUp);
    dom.removeEventListener('webglcontextlost', this.onContextLost);
    dom.removeEventListener('webglcontextrestored', this.onContextRestored);

    this.controls.dispose();
    this.currentVessel?.dispose();
    this.currentFlora?.dispose();
    this.weatherSystem.dispose();
    this.lighting.dispose();
    this.materials.dispose();
    this.textures.dispose();
    this.envRenderTarget.dispose();
    this.renderer.dispose();

    if (dom.parentNode === this.container) {
      this.container.removeChild(dom);
    }
  }
}

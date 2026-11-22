import * as THREE from 'three';
import type { QualityTier, WeatherMode } from '../types/terrarium';
import type { TerrariumMaterialLibrary } from './materials';

export interface LightingRig {
  keyLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  rimLight: THREE.DirectionalLight;
  lanternLight: THREE.PointLight;
  mushroomLight: THREE.PointLight;
  microclimateLight: THREE.PointLight;
  update: (
    timeOfDay: number,
    weather: WeatherMode,
    rainIntensity: number,
    mistIntensity: number,
    condensationIntensity: number,
    lanternPos: THREE.Vector3,
    mushroomPos: THREE.Vector3 | null,
    materials: TerrariumMaterialLibrary,
    scene: THREE.Scene,
    elapsed: number
  ) => number; // returns nightFactor 0..1
  setShadowQuality: (tier: QualityTier, isSoftwareGl: boolean) => void;
  dispose: () => void;
}

const _bgColor = new THREE.Color();
const _fogColor = new THREE.Color();
const _sunColor = new THREE.Color();
const _skyColor = new THREE.Color();
const _groundColor = new THREE.Color();
const _rimColor = new THREE.Color();

interface TimeKeyframe {
  hour: number;
  bg: number;
  sun: number;
  sunInt: number;
  sky: number;
  ground: number;
  hemiInt: number;
  rim: number;
}

const KEYFRAMES: TimeKeyframe[] = [
  { hour: 0, bg: 0x0d131a, sun: 0x89a9d6, sunInt: 0.65, sky: 0x243652, ground: 0x0d1112, hemiInt: 0.5, rim: 0x5c80b3 },
  { hour: 5.5, bg: 0x1e252c, sun: 0xf09d6e, sunInt: 1.05, sky: 0x7c8ca8, ground: 0x1b1f1c, hemiInt: 0.65, rim: 0xd99b7a },
  { hour: 7.5, bg: 0x2b332d, sun: 0xffd59e, sunInt: 2.0, sky: 0xb7d1da, ground: 0x2b2922, hemiInt: 0.85, rim: 0xe8d5b7 },
  { hour: 12.5, bg: 0x2f3834, sun: 0xfff5e0, sunInt: 2.35, sky: 0xcbe3ee, ground: 0x333028, hemiInt: 0.95, rim: 0xddebf2 },
  { hour: 17.5, bg: 0x2c2623, sun: 0xffaa5c, sunInt: 2.1, sky: 0xd6b094, ground: 0x28211b, hemiInt: 0.8, rim: 0xffb878 },
  { hour: 19.8, bg: 0x171b24, sun: 0x9987bd, sunInt: 0.85, sky: 0x454e73, ground: 0x14151a, hemiInt: 0.55, rim: 0x7c87b8 },
  { hour: 24, bg: 0x0d131a, sun: 0x89a9d6, sunInt: 0.65, sky: 0x243652, ground: 0x0d1112, hemiInt: 0.5, rim: 0x5c80b3 },
];

const _cA = new THREE.Color();
const _cB = new THREE.Color();

function lerpHex(out: THREE.Color, hexA: number, hexB: number, t: number) {
  _cA.setHex(hexA);
  _cB.setHex(hexB);
  out.copy(_cA).lerp(_cB, t);
}

export function createLightingRig(scene: THREE.Scene, isSoftwareGl: boolean): LightingRig {
  const keyLight = new THREE.DirectionalLight(0xfff2db, 2.2);
  keyLight.position.set(4.5, 6.5, 3.8);
  keyLight.castShadow = !isSoftwareGl;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 1.0;
  keyLight.shadow.camera.far = 20;
  const d = 3.8;
  keyLight.shadow.camera.left = -d;
  keyLight.shadow.camera.right = d;
  keyLight.shadow.camera.top = d;
  keyLight.shadow.camera.bottom = -d;
  keyLight.shadow.bias = -0.0005;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  const hemiLight = new THREE.HemisphereLight(0xcbe3ee, 0x333028, 0.9);
  scene.add(hemiLight);

  const rimLight = new THREE.DirectionalLight(0xddebf2, 0.85);
  rimLight.position.set(-4.5, 4.2, -5.0);
  scene.add(rimLight);

  // Interior warm lantern glow (nighttime focal warmth)
  const lanternLight = new THREE.PointLight(0xffaa4f, 0.0, 3.6, 1.8);
  scene.add(lanternLight);

  // Interior subtle emerald bioluminescence near mushroom cluster
  const mushroomLight = new THREE.PointLight(0x4ae6b8, 0.0, 2.2, 2.0);
  scene.add(mushroomLight);

  // Short-range interior microclimate scatter light (strictly inside dome)
  const microclimateLight = new THREE.PointLight(0xd9efe8, 0.0, 2.55, 2.0);
  microclimateLight.position.set(0, 2.55, 0);
  scene.add(microclimateLight);

  scene.background = new THREE.Color(0x2b332d);
  scene.fog = new THREE.FogExp2(0x2b332d, 0.032);

  return {
    keyLight,
    hemiLight,
    rimLight,
    lanternLight,
    mushroomLight,
    microclimateLight,
    update: (
      timeOfDay,
      weather,
      rainIntensity,
      mistIntensity,
      condensationIntensity,
      lanternPos,
      mushroomPos,
      materials,
      targetScene,
      elapsed
    ) => {
      const h = ((timeOfDay % 24) + 24) % 24;
      let k0 = KEYFRAMES[0];
      let k1 = KEYFRAMES[1];
      for (let i = 0; i < KEYFRAMES.length - 1; i++) {
        if (h >= KEYFRAMES[i].hour && h <= KEYFRAMES[i + 1].hour) {
          k0 = KEYFRAMES[i];
          k1 = KEYFRAMES[i + 1];
          break;
        }
      }
      const span = Math.max(0.001, k1.hour - k0.hour);
      const t = THREE.MathUtils.smoothstep((h - k0.hour) / span, 0, 1);

      lerpHex(_bgColor, k0.bg, k1.bg, t);
      lerpHex(_sunColor, k0.sun, k1.sun, t);
      lerpHex(_skyColor, k0.sky, k1.sky, t);
      lerpHex(_groundColor, k0.ground, k1.ground, t);
      lerpHex(_rimColor, k0.rim, k1.rim, t);

      const sunInt = THREE.MathUtils.lerp(k0.sunInt, k1.sunInt, t);
      const hemiInt = THREE.MathUtils.lerp(k0.hemiInt, k1.hemiInt, t);
      const fogDensity = 0.026;

      // Sun / moon orbital trajectory
      const isNight = h < 5.5 || h > 19.5;
      const nightFactor =
        h >= 19.5
          ? THREE.MathUtils.smoothstep((h - 19.5) / 1.8, 0, 1)
          : h <= 6.0
            ? 1 - THREE.MathUtils.smoothstep((h - 4.5) / 1.5, 0, 1)
            : 0;

      const solarAngle = ((h - 6) / 12) * Math.PI; // 0 at 6am, PI at 6pm
      const orbitAngle = isNight ? solarAngle + Math.PI : solarAngle;
      const elev = Math.max(0.28, Math.sin(Math.max(0.15, Math.min(Math.PI - 0.15, orbitAngle))));
      const azimuth = (h / 24) * Math.PI * 2 - Math.PI * 0.65;
      const dist = 8.2;
      keyLight.position.set(
        Math.cos(azimuth) * dist * 0.85,
        2.2 + elev * 6.5,
        Math.sin(azimuth) * dist * 0.7 + 1.5
      );
      keyLight.color.copy(_sunColor);
      keyLight.intensity = sunInt;

      hemiLight.color.copy(_skyColor);
      hemiLight.groundColor.copy(_groundColor);
      hemiLight.intensity = hemiInt;

      rimLight.color.copy(_rimColor);
      rimLight.intensity = 0.65 + (1 - nightFactor) * 0.35;

      // Update background + matching FogExp2
      if (targetScene.background instanceof THREE.Color) {
        targetScene.background.copy(_bgColor);
      }
      if (targetScene.fog instanceof THREE.FogExp2) {
        _fogColor.copy(_bgColor);
        targetScene.fog.color.copy(_fogColor);
        targetScene.fog.density = fogDensity;
      }

      // Interior night lantern & bioluminescence
      lanternLight.position.copy(lanternPos);
      const flicker = 1 + Math.sin(elapsed * 5.2) * 0.04 + Math.cos(elapsed * 8.7) * 0.025;
      lanternLight.intensity = (0.05 + nightFactor * 2.1) * flicker;

      if (mushroomPos) {
        mushroomLight.position.copy(mushroomPos);
        mushroomLight.intensity = nightFactor * 0.85 * (0.92 + Math.sin(elapsed * 1.8) * 0.08);
      } else {
        mushroomLight.intensity = 0;
      }

      if (weather === 'sunshower') {
        microclimateLight.color.setHex(0xffdfa8);
        microclimateLight.intensity = (0.35 + rainIntensity * 0.9) * (1 - nightFactor * 0.6);
      } else if (mistIntensity > 0.05 || rainIntensity > 0.05) {
        const mix = Math.min(1, mistIntensity * 0.85 + rainIntensity * 0.65);
        microclimateLight.color.setHex(rainIntensity > mistIntensity ? 0x9ec4d8 : 0xd6eae6);
        microclimateLight.intensity = mix * 0.8 * (1 - nightFactor * 0.55);
      } else {
        microclimateLight.intensity = 0;
      }

      materials.setNightGlow(nightFactor);
      materials.setCondensationLevel(condensationIntensity);

      return nightFactor;
    },
    setShadowQuality: (tier: QualityTier, softwareGl: boolean) => {
      if (softwareGl || tier === 'low') {
        keyLight.castShadow = false;
        return;
      }
      keyLight.castShadow = true;
      const targetSize = tier === 'ultra' ? 4096 : tier === 'high' ? 2048 : 1024;
      keyLight.shadow.radius = tier === 'ultra' ? 4 : tier === 'high' ? 3 : 2;
      if (keyLight.shadow.mapSize.width !== targetSize) {
        keyLight.shadow.mapSize.set(targetSize, targetSize);
        if (keyLight.shadow.map) {
          keyLight.shadow.map.dispose();
          keyLight.shadow.map = null;
        }
      }
    },
    dispose: () => {
      keyLight.dispose();
      hemiLight.dispose();
      rimLight.dispose();
      lanternLight.dispose();
      mushroomLight.dispose();
      microclimateLight.dispose();
    },
  };
}

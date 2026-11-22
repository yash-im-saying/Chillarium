import * as THREE from 'three';
import type { WeatherMode } from '../types/terrarium';
import type { ProceduralTextureSet } from './textures';
import { groundHeightAt, WATER_LEVEL } from './vessel';

const _dummy = new THREE.Object3D();

export interface WeatherSystem {
  root: THREE.Group;
  update: (
    dt: number,
    elapsed: number,
    weather: WeatherMode,
    rainIntensity: number,
    mistIntensity: number,
    condensationIntensity: number,
    nightFactor: number,
    breeze: number
  ) => void;
  dispose: () => void;
}

/**
 * Conservative inner ceiling envelope shared across Bell, Geodesic, and Prism vessels
 * so interior rain and mist never protrude outside the glass walls.
 */
function innerDomeCeilingAt(r: number): number {
  const norm = Math.min(1, r / 1.82);
  return 3.58 - norm * norm * 1.15;
}

export function createWeatherSystem(textures: ProceduralTextureSet): WeatherSystem {
  const root = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  // 1. Interior Rain Streaks (InstancedMesh, 180 fine droplets confined strictly inside the glass dome)
  const rainCount = 180;
  const rainGeo = new THREE.CylinderGeometry(0.0028, 0.0045, 0.19, 5);
  geometries.push(rainGeo);
  const rainMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#cce6ef'),
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  materials.push(rainMat);
  const rainMesh = new THREE.InstancedMesh(rainGeo, rainMat, rainCount);
  rainMesh.frustumCulled = false;
  rainMesh.renderOrder = 8;

  const rainX = new Float32Array(rainCount);
  const rainY = new Float32Array(rainCount);
  const rainZ = new Float32Array(rainCount);
  const rainMinY = new Float32Array(rainCount);
  const rainMaxY = new Float32Array(rainCount);
  const rainSpeed = new Float32Array(rainCount);

  for (let i = 0; i < rainCount; i++) {
    const a = (i / rainCount) * Math.PI * 2 + (i % 11) * 0.57;
    const rad = Math.sqrt(((i * 37 + 13) % 100) / 100) * 1.72;
    const x = Math.cos(a) * rad;
    const z = Math.sin(a) * rad;
    const minY = Math.max(WATER_LEVEL, groundHeightAt(x, z)) + 0.08;
    const maxY = innerDomeCeilingAt(rad);
    rainX[i] = x;
    rainZ[i] = z;
    rainMinY[i] = minY;
    rainMaxY[i] = maxY;
    rainY[i] = minY + (((i * 53) % 100) / 100) * Math.max(0.4, maxY - minY);
    rainSpeed[i] = 3.2 + (((i * 19) % 100) / 100) * 1.8;
  }
  root.add(rainMesh);

  // 2. Interior Pond Rain Ripples (subtle expanding rings on the rainwater pool during rain)
  const rippleCount = 6;
  const rippleGeo = new THREE.RingGeometry(0.04, 0.055, 24);
  rippleGeo.rotateX(-Math.PI / 2);
  geometries.push(rippleGeo);
  const rippleMeshes: THREE.Mesh[] = [];
  const rippleMats: THREE.MeshBasicMaterial[] = [];
  const ripplePhase = new Float32Array(rippleCount);
  for (let i = 0; i < rippleCount; i++) {
    const rMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color('#cbe6e2'),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    materials.push(rMat);
    rippleMats.push(rMat);
    const mesh = new THREE.Mesh(rippleGeo, rMat);
    const a = (i / rippleCount) * Math.PI * 2;
    const dist = 0.08 + ((i * 29) % 100) / 100 * 0.34;
    mesh.position.set(0.68 + Math.cos(a) * dist, WATER_LEVEL + 0.004, 0.56 + Math.sin(a) * dist);
    mesh.renderOrder = 3;
    ripplePhase[i] = i / rippleCount;
    rippleMeshes.push(mesh);
    root.add(mesh);
  }

  // 3. Inner Glass Condensation Droplets (140 beads clinging to the interior wall of the vessel)
  const dropCount = 140;
  const dropGeo = new THREE.SphereGeometry(0.018, 8, 8);
  dropGeo.scale(0.8, 1.3, 0.5);
  geometries.push(dropGeo);
  const dropMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#e8f6f2'),
    roughness: 0.05,
    metalness: 0.0,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  materials.push(dropMat);
  const dropMesh = new THREE.InstancedMesh(dropGeo, dropMat, dropCount);
  dropMesh.frustumCulled = false;
  dropMesh.renderOrder = 9;

  const dropTheta = new Float32Array(dropCount);
  const dropY = new Float32Array(dropCount);
  const dropSpeed = new Float32Array(dropCount);
  const dropSize = new Float32Array(dropCount);

  for (let i = 0; i < dropCount; i++) {
    dropTheta[i] = ((i * 137.5) % 360) * (Math.PI / 180);
    dropY[i] = 0.5 + (((i * 41) % 100) / 100) * 1.3;
    dropSpeed[i] = 0.025 + (((i * 29) % 100) / 100) * 0.07;
    dropSize[i] = 0.5 + (((i * 61) % 100) / 100) * 0.75;
  }
  root.add(dropMesh);

  // 4. Low-Lying Interior Mist Wisps (36 soft drifting sprites strictly inside the vessel)
  const mistCount = 36;
  const mistPos = new Float32Array(mistCount * 3);
  const mistBaseX = new Float32Array(mistCount);
  const mistBaseY = new Float32Array(mistCount);
  const mistBaseZ = new Float32Array(mistCount);
  const mistPhase = new Float32Array(mistCount);

  for (let i = 0; i < mistCount; i++) {
    const a = (i / mistCount) * Math.PI * 2 + i * 0.37;
    const r = 0.15 + (((i * 23) % 100) / 100) * 1.1;
    mistBaseX[i] = Math.cos(a) * r;
    mistBaseZ[i] = Math.sin(a) * r;
    mistBaseY[i] = 0.88 + (((i * 47) % 100) / 100) * 0.78;
    mistPhase[i] = i * 0.91;
    mistPos[i * 3] = mistBaseX[i];
    mistPos[i * 3 + 1] = mistBaseY[i];
    mistPos[i * 3 + 2] = mistBaseZ[i];
  }
  const mistGeo = new THREE.BufferGeometry();
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistPos, 3));
  geometries.push(mistGeo);
  const mistMat = new THREE.PointsMaterial({
    map: textures.mistPuffMap,
    size: 0.82,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
  materials.push(mistMat);
  const mistPoints = new THREE.Points(mistGeo, mistMat);
  mistPoints.renderOrder = 6;
  root.add(mistPoints);

  // 5. Fireflies (Night) & Sunlit Pollen Motes (Day) — 42 interior particles
  const moteCount = 42;
  const motePos = new Float32Array(moteCount * 3);
  const moteRadius = new Float32Array(moteCount);
  const moteHeight = new Float32Array(moteCount);
  const motePhase = new Float32Array(moteCount);
  const moteSpeed = new Float32Array(moteCount);

  for (let i = 0; i < moteCount; i++) {
    moteRadius[i] = 0.2 + (((i * 31) % 100) / 100) * 1.25;
    moteHeight[i] = 0.95 + (((i * 59) % 100) / 100) * 1.65;
    motePhase[i] = i * 1.37;
    moteSpeed[i] = 0.28 + (((i * 17) % 100) / 100) * 0.42;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  geometries.push(moteGeo);
  const moteMat = new THREE.PointsMaterial({
    map: textures.softGlowMap,
    color: new THREE.Color('#e8f4b2'),
    size: 0.14,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  materials.push(moteMat);
  const motePoints = new THREE.Points(moteGeo, moteMat);
  motePoints.renderOrder = 7;
  root.add(motePoints);

  let currentRainAlpha = 0;
  let currentMistAlpha = 0;
  let currentDropAlpha = 0;

  return {
    root,
    update: (
      dt: number,
      elapsed: number,
      weather: WeatherMode,
      rainIntensity: number,
      mistIntensity: number,
      condensationIntensity: number,
      nightFactor: number,
      breeze: number
    ) => {
      const clampDt = Math.min(dt, 0.05);
      const damp = 1 - Math.exp(-4.5 * clampDt);

      const targetRain = THREE.MathUtils.clamp(rainIntensity, 0, 1) * 0.72;
      const targetMist = THREE.MathUtils.clamp(mistIntensity, 0, 1) * 0.68;
      const targetDrops = THREE.MathUtils.clamp(condensationIntensity, 0, 1) * 0.85;

      currentRainAlpha += (targetRain - currentRainAlpha) * damp;
      currentMistAlpha += (targetMist - currentMistAlpha) * damp;
      currentDropAlpha += (targetDrops - currentDropAlpha) * damp;

      // Interior Rain Streaks (confined inside dome)
      rainMat.opacity = currentRainAlpha;
      const activeRainCount = Math.max(
        0,
        Math.min(rainCount, Math.round(rainCount * (0.2 + rainIntensity * 0.8)))
      );
      rainMesh.count = activeRainCount;
      rainMesh.visible = currentRainAlpha > 0.01 && activeRainCount > 0;
      if (rainMesh.visible) {
        const gentleDrift = (0.015 + breeze * 0.03) * (weather === 'sunshower' ? 0.6 : 1.0);
        const speedMult = 0.75 + rainIntensity * 0.45;
        for (let i = 0; i < activeRainCount; i++) {
          rainY[i] -= rainSpeed[i] * speedMult * clampDt;
          if (rainY[i] < rainMinY[i]) {
            rainY[i] = rainMaxY[i];
          }
          _dummy.position.set(rainX[i], rainY[i], rainZ[i]);
          _dummy.rotation.set(0, 0, -gentleDrift);
          _dummy.scale.setScalar(1);
          _dummy.updateMatrix();
          rainMesh.setMatrixAt(i, _dummy.matrix);
        }
        rainMesh.instanceMatrix.needsUpdate = true;
      }

      // Pond rain ripples
      const showRipples = currentRainAlpha > 0.025;
      for (let i = 0; i < rippleCount; i++) {
        const mesh = rippleMeshes[i];
        mesh.visible = showRipples;
        if (!showRipples) continue;
        ripplePhase[i] = (ripplePhase[i] + clampDt * (0.65 + rainIntensity * 0.55)) % 1;
        const p = ripplePhase[i];
        mesh.scale.setScalar(0.5 + p * 2.4);
        rippleMats[i].opacity = currentRainAlpha * (1 - p) * 0.58;
      }

      // Inner Glass Condensation Droplets
      dropMat.opacity = currentDropAlpha;
      const activeDropCount = Math.max(
        0,
        Math.min(dropCount, Math.round(dropCount * (0.15 + condensationIntensity * 0.85)))
      );
      dropMesh.count = activeDropCount;
      dropMesh.visible = currentDropAlpha > 0.01 && activeDropCount > 0;
      if (dropMesh.visible) {
        const trickleMul = 0.2 + rainIntensity * 1.6 + condensationIntensity * 0.35;
        for (let i = 0; i < activeDropCount; i++) {
          dropY[i] -= dropSpeed[i] * trickleMul * clampDt;
          if (dropY[i] < 0.46) {
            dropY[i] = 1.82;
          }
          const th = dropTheta[i];
          const r = 2.065; // strictly inside the inner glass surface (2.11)
          _dummy.position.set(Math.cos(th) * r, dropY[i], Math.sin(th) * r);
          _dummy.rotation.set(0, -th + Math.PI / 2, 0);
          _dummy.scale.setScalar(dropSize[i] * (0.45 + currentDropAlpha * 0.75));
          _dummy.updateMatrix();
          dropMesh.setMatrixAt(i, _dummy.matrix);
        }
        dropMesh.instanceMatrix.needsUpdate = true;
      }

      // Interior Mist Wisps
      mistMat.opacity = currentMistAlpha;
      mistPoints.visible = currentMistAlpha > 0.01;
      if (mistPoints.visible) {
        const mPosAttr = mistGeo.attributes.position as THREE.BufferAttribute;
        const speed = 0.22 + breeze * 0.35;
        for (let i = 0; i < mistCount; i++) {
          const ph = mistPhase[i];
          const nx = mistBaseX[i] + Math.sin(elapsed * speed + ph) * 0.12;
          const nz = mistBaseZ[i] + Math.cos(elapsed * speed * 0.8 + ph) * 0.12;
          const ny = mistBaseY[i] + Math.sin(elapsed * 0.4 + ph) * 0.06;
          mPosAttr.setXYZ(i, nx, ny, nz);
        }
        mPosAttr.needsUpdate = true;
      }

      // Fireflies at night vs sunlit pollen motes during day
      const mPosAttr = moteGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < moteCount; i++) {
        const ph = motePhase[i];
        const sp = moteSpeed[i];
        const r = moteRadius[i] + Math.sin(elapsed * 0.5 + ph) * 0.08;
        const ang = ph + elapsed * sp * (0.35 + breeze * 0.45);
        const y = moteHeight[i] + Math.sin(elapsed * 0.85 + ph * 1.4) * 0.18;
        mPosAttr.setXYZ(i, Math.cos(ang) * r, y, Math.sin(ang) * r);
      }
      mPosAttr.needsUpdate = true;

      if (nightFactor > 0.2) {
        moteMat.color.setHex(0xd4ff9a);
        moteMat.size = 0.15 + Math.sin(elapsed * 2.2) * 0.025;
        moteMat.opacity = 0.25 + nightFactor * 0.65;
      } else {
        moteMat.color.setHex(0xfff1c4);
        moteMat.size = 0.07;
        moteMat.opacity = weather === 'rain' ? 0.18 : 0.36;
      }
    },
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}

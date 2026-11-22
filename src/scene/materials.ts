import * as THREE from 'three';
import type { QualityTier } from '../types/terrarium';
import type { ProceduralTextureSet } from './textures';

export interface TerrariumMaterialLibrary {
  woodPedestal: THREE.MeshStandardMaterial;
  tableTop: THREE.MeshStandardMaterial;
  brushedBrass: THREE.MeshPhysicalMaterial;
  patinaBronze: THREE.MeshStandardMaterial;
  vesselGlass: THREE.MeshPhysicalMaterial;
  glassRim: THREE.MeshPhysicalMaterial;
  soil: THREE.MeshStandardMaterial;
  strata: THREE.MeshStandardMaterial;
  waterPool: THREE.MeshPhysicalMaterial;
  fernFrond: THREE.MeshStandardMaterial;
  fernStem: THREE.MeshStandardMaterial;
  mossCushion: THREE.MeshStandardMaterial;
  driftwood: THREE.MeshStandardMaterial;
  stone: THREE.MeshStandardMaterial;
  succulent: THREE.MeshStandardMaterial;
  succulentAccent: THREE.MeshStandardMaterial;
  mushroomStem: THREE.MeshStandardMaterial;
  mushroomCap: THREE.MeshStandardMaterial;
  lanternFilament: THREE.MeshStandardMaterial;
  contactShadow: THREE.MeshBasicMaterial;
  setCondensationLevel: (level: number) => void;
  setNightGlow: (nightFactor: number) => void;
  setGraphicsQuality: (tier: QualityTier) => void;
  dispose: () => void;
}

export function createTerrariumMaterials(
  textures: ProceduralTextureSet,
  isSoftwareGl: boolean
): TerrariumMaterialLibrary {
  const materials: THREE.Material[] = [];
  const reg = <T extends THREE.Material>(m: T): T => {
    materials.push(m);
    return m;
  };

  const woodPedestal = reg(
    new THREE.MeshStandardMaterial({
      map: textures.woodMap,
      roughnessMap: textures.woodRoughnessMap,
      roughness: 0.62,
      metalness: 0.04,
    })
  );

  const tableTop = reg(
    new THREE.MeshStandardMaterial({
      map: textures.tableMap,
      roughnessMap: textures.tableRoughnessMap,
      roughness: 0.85,
      metalness: 0.05,
    })
  );

  const brushedBrass = reg(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#c89f5d'),
      metalness: 0.92,
      roughness: 0.22,
      anisotropy: 0.8,
      anisotropyRotation: 0.35,
      clearcoat: 0.35,
      clearcoatRoughness: 0.2,
    })
  );

  const patinaBronze = reg(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#4a4337'),
      metalness: 0.78,
      roughness: 0.48,
    })
  );

  // Optical glass vessel: real transmission on GPU, clean translucent fallback on Software WebGL
  const vesselGlass = reg(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f4faf6'),
      metalness: 0.0,
      roughness: 0.05,
      roughnessMap: textures.condensationRoughnessMap,
      transmission: isSoftwareGl ? 0 : 0.94,
      transparent: true,
      opacity: isSoftwareGl ? 0.22 : 1.0,
      ior: 1.52,
      thickness: 0.35,
      attenuationColor: new THREE.Color('#e3f2eb'),
      attenuationDistance: 4.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.35,
      depthWrite: false,
      side: THREE.FrontSide,
    })
  );

  const glassRim = reg(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#d8ebe2'),
      metalness: 0.05,
      roughness: 0.14,
      transparent: true,
      opacity: 0.55,
      clearcoat: 1.0,
    })
  );

  const soil = reg(
    new THREE.MeshStandardMaterial({
      map: textures.soilMap,
      bumpMap: textures.soilBumpMap,
      bumpScale: 0.035,
      roughness: 0.94,
      metalness: 0.0,
    })
  );

  const strata = reg(
    new THREE.MeshStandardMaterial({
      map: textures.strataMap,
      bumpMap: textures.soilBumpMap,
      bumpScale: 0.02,
      roughness: 0.88,
      metalness: 0.02,
    })
  );

  const waterPool = reg(
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#274742'),
      roughness: 0.06,
      metalness: 0.08,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      transparent: true,
      opacity: 0.86,
      envMapIntensity: 1.5,
    })
  );

  const fernFrond = reg(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#477d42'),
      bumpMap: textures.leafBumpMap,
      bumpScale: 0.015,
      roughness: 0.56,
      metalness: 0.02,
      side: THREE.DoubleSide,
    })
  );

  const fernStem = reg(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#345229'),
      roughness: 0.78,
      metalness: 0.0,
    })
  );

  const mossCushion = reg(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'), // Tinted per instance via InstancedMesh.setColorAt
      bumpMap: textures.mossBumpMap,
      bumpScale: 0.04,
      roughness: 0.92,
      metalness: 0.0,
    })
  );

  const driftwood = reg(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#5a4636'),
      bumpMap: textures.woodRoughnessMap,
      bumpScale: 0.025,
      roughness: 0.88,
      metalness: 0.0,
    })
  );

  const stone = reg(
    new THREE.MeshStandardMaterial({
      map: textures.stoneMap,
      bumpMap: textures.stoneBumpMap,
      bumpScale: 0.03,
      roughness: 0.76,
      metalness: 0.04,
      flatShading: false,
    })
  );

  const succulent = reg(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#5e8f76'),
      roughness: 0.42,
      metalness: 0.04,
    })
  );

  const succulentAccent = reg(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#9c616a'),
      roughness: 0.48,
      metalness: 0.02,
    })
  );

  const mushroomStem = reg(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#d8d2c3'),
      roughness: 0.65,
      metalness: 0.0,
    })
  );

  const mushroomCap = reg(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#7cb8a4'),
      emissive: new THREE.Color('#47d8b5'),
      emissiveIntensity: 0.08,
      roughness: 0.32,
      metalness: 0.05,
    })
  );

  const lanternFilament = reg(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffe0a6'),
      emissive: new THREE.Color('#ffaa44'),
      emissiveIntensity: 0.25,
      roughness: 0.2,
    })
  );

  const contactShadow = reg(
    new THREE.MeshBasicMaterial({
      map: textures.contactShadowMap,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
    })
  );

  return {
    woodPedestal,
    tableTop,
    brushedBrass,
    patinaBronze,
    vesselGlass,
    glassRim,
    soil,
    strata,
    waterPool,
    fernFrond,
    fernStem,
    mossCushion,
    driftwood,
    stone,
    succulent,
    succulentAccent,
    mushroomStem,
    mushroomCap,
    lanternFilament,
    contactShadow,
    setCondensationLevel: (level: number) => {
      // Smoothly increase glass roughness & clearcoat haze during mist/rain
      const clamped = THREE.MathUtils.clamp(level, 0, 1);
      vesselGlass.roughness = 0.04 + clamped * 0.24;
      vesselGlass.clearcoatRoughness = 0.05 + clamped * 0.25;
      if (isSoftwareGl) {
        vesselGlass.opacity = 0.2 + clamped * 0.14;
      }
    },
    setNightGlow: (nightFactor: number) => {
      const n = THREE.MathUtils.clamp(nightFactor, 0, 1);
      mushroomCap.emissiveIntensity = 0.06 + n * 1.35;
      lanternFilament.emissiveIntensity = 0.15 + n * 3.2;
    },
    setGraphicsQuality: (tier: QualityTier) => {
      if (isSoftwareGl) {
        vesselGlass.transmission = 0;
        vesselGlass.opacity = 0.22;
        return;
      }

      const prevTransmissive = vesselGlass.transmission > 0;
      let nextTransmission = 0.94;
      let nextOpacity = 1.0;
      let nextClearcoat = 1.0;
      let nextAnisotropy = 0.8;
      let nextEnv = 1.35;

      if (tier === 'low') {
        nextTransmission = 0;
        nextOpacity = 0.24;
        nextClearcoat = 0.2;
        nextAnisotropy = 0;
        nextEnv = 0.8;
      } else if (tier === 'medium') {
        nextTransmission = 0.88;
        nextClearcoat = 0.75;
        nextAnisotropy = 0.4;
        nextEnv = 1.1;
      } else if (tier === 'ultra') {
        nextTransmission = 0.96;
        nextClearcoat = 1.0;
        nextAnisotropy = 1.0;
        nextEnv = 1.55;
      }

      vesselGlass.transmission = nextTransmission;
      vesselGlass.opacity = nextOpacity;
      vesselGlass.clearcoat = nextClearcoat;
      vesselGlass.envMapIntensity = nextEnv;
      waterPool.clearcoat = nextClearcoat;
      waterPool.envMapIntensity = nextEnv * 1.1;
      brushedBrass.anisotropy = nextAnisotropy;

      if ((nextTransmission > 0) !== prevTransmissive) {
        vesselGlass.needsUpdate = true;
      }
    },
    dispose: () => {
      for (const m of materials) {
        m.dispose();
      }
    },
  };
}

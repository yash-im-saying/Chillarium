import * as THREE from 'three';
import type { BiomePreset, SpecimenInfo } from '../types/terrarium';
import type { TerrariumMaterialLibrary } from './materials';
import { groundHeightAt, TERRARIUM_RADIUS, WATER_LEVEL } from './vessel';

export interface AnimatedFloraItem {
  group: THREE.Object3D;
  baseRotX: number;
  baseRotZ: number;
  phase: number;
  swayAmount: number;
}

export interface BuiltFlora {
  root: THREE.Group;
  animatedItems: AnimatedFloraItem[];
  interactables: THREE.Object3D[];
  lanternPosition: THREE.Vector3;
  mushroomGlowPositions: THREE.Vector3[];
  updateSway: (elapsed: number, breeze: number, pulseTarget: THREE.Object3D | null, pulseAge: number) => void;
  dispose: () => void;
}

class SeededRng {
  private s: number;
  constructor(seed: number) {
    this.s = seed % 2147483647;
    if (this.s <= 0) this.s += 2147483646;
  }
  next(): number {
    this.s = (this.s * 16807) % 2147483647;
    return (this.s - 1) / 2147483646;
  }
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

function registerInteractable(group: THREE.Object3D, info: SpecimenInfo, interactables: THREE.Object3D[]) {
  group.userData.specimen = info;
  group.traverse((obj) => {
    obj.layers.enable(1);
    obj.userData.specimenRoot = group;
  });
  interactables.push(group);
}

function isInPond(x: number, z: number, margin = 0.08): boolean {
  const dx = x - 0.68;
  const dz = z - 0.56;
  return Math.sqrt(dx * dx + dz * dz) < 0.62 + margin;
}

function createSculptedRockGeometry(
  radius: number,
  detail: number,
  seed: number,
  squashY = 0.68
): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(radius, detail);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const vz = pos.getZ(i);
    const n1 = Math.sin(vx * 3.8 + seed) * Math.cos(vy * 3.1 - seed * 0.5) * Math.sin(vz * 4.2 + seed * 1.3);
    const n2 = Math.cos(vx * 7.5 - vz * 6.2 + seed * 2.1) * 0.35;
    const disp = 1 + n1 * 0.22 + n2 * 0.09;
    pos.setXYZ(i, vx * disp, vy * disp * squashY, vz * disp);
  }
  geo.computeVertexNormals();
  return geo;
}

export function buildTerrariumFlora(
  biome: BiomePreset,
  lushness: number,
  seed: number,
  materials: TerrariumMaterialLibrary
): BuiltFlora {
  const rng = new SeededRng(seed);
  const root = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const localMaterials: THREE.Material[] = [];
  const animatedItems: AnimatedFloraItem[] = [];
  const interactables: THREE.Object3D[] = [];
  const mushroomGlowPositions: THREE.Vector3[] = [];

  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const trackMat = <T extends THREE.Material>(m: T): T => {
    localMaterials.push(m);
    return m;
  };

  // Shared reusable leaflet blade shape (ExtrudeGeometry with tiny bevel for crisp edge highlights)
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.055, 0.05, 0.018, 0.16);
  leafShape.lineTo(0, 0.19);
  leafShape.lineTo(-0.018, 0.16);
  leafShape.quadraticCurveTo(-0.055, 0.05, 0, 0);
  const leafletGeo = trackGeo(
    new THREE.ExtrudeGeometry(leafShape, {
      depth: 0.005,
      bevelEnabled: true,
      bevelThickness: 0.002,
      bevelSize: 0.002,
      bevelSegments: 1,
    })
  );

  // Shared succulent petal geometry
  const petalShape = new THREE.Shape();
  petalShape.moveTo(0, 0);
  petalShape.quadraticCurveTo(0.085, 0.08, 0.052, 0.21);
  petalShape.quadraticCurveTo(0, 0.26, -0.052, 0.21);
  petalShape.quadraticCurveTo(-0.085, 0.08, 0, 0);
  const petalGeo = trackGeo(
    new THREE.ExtrudeGeometry(petalShape, {
      depth: 0.018,
      bevelEnabled: true,
      bevelThickness: 0.006,
      bevelSize: 0.006,
      bevelSegments: 2,
    })
  );

  // Shared mushroom cap LatheGeometry
  const capPoints = [
    new THREE.Vector2(0.0, 0.068),
    new THREE.Vector2(0.032, 0.062),
    new THREE.Vector2(0.065, 0.042),
    new THREE.Vector2(0.085, 0.012),
    new THREE.Vector2(0.08, 0.0),
    new THREE.Vector2(0.025, 0.018),
    new THREE.Vector2(0.0, 0.022),
  ];
  const mushroomCapGeo = trackGeo(new THREE.LatheGeometry(capPoints, 18));

  // Helper: Build composite Sword Fern (rhizome crown + 7-10 multi-leaflet fronds)
  const buildFern = (x: number, z: number, scale: number, frondCount: number, idx: number) => {
    const y = groundHeightAt(x, z);
    const fernGroup = new THREE.Group();
    fernGroup.position.set(x, y - 0.015, z);

    // 1. Central rhizome crown
    const crownGeo = trackGeo(new THREE.CylinderGeometry(0.05 * scale, 0.08 * scale, 0.08 * scale, 10));
    const crown = new THREE.Mesh(crownGeo, materials.fernStem);
    crown.position.y = 0.03 * scale;
    crown.castShadow = true;
    fernGroup.add(crown);

    // 2. Arching fronds arranged in golden-angle phyllotaxis
    for (let f = 0; f < frondCount; f++) {
      const angle = f * 2.39996 + rng.range(-0.12, 0.12);
      const tier = f / frondCount; // 0 = inner upright, 1 = outer spreading
      const len = (0.42 + (1 - tier * 0.35) * 0.34) * scale;
      const archOut = (0.28 + tier * 0.44) * scale;
      const archUp = (0.58 - tier * 0.24) * scale;

      const frondHolder = new THREE.Group();
      frondHolder.rotation.y = angle;

      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.02 * scale, 0),
        new THREE.Vector3(archOut * 0.35, archUp * 0.72, 0),
        new THREE.Vector3(archOut * 0.78, archUp, 0),
        new THREE.Vector3(archOut * 1.15, archUp * 0.78, 0),
      ]);
      const stemGeo = trackGeo(new THREE.TubeGeometry(curve, 12, 0.011 * scale, 5, false));
      const stemMesh = new THREE.Mesh(stemGeo, materials.fernStem);
      stemMesh.castShadow = true;
      frondHolder.add(stemMesh);

      // Pinnae leaflets paired along the frond curve
      const pairs = 7;
      for (let p = 1; p <= pairs; p++) {
        const t = 0.22 + (p / (pairs + 1)) * 0.74;
        const pt = curve.getPoint(t);
        const tangent = curve.getTangent(t);
        const leafScale = (1 - Math.abs(t - 0.55) * 0.85) * scale * (0.68 + len * 0.35);

        for (const side of [-1, 1]) {
          const leaf = new THREE.Mesh(leafletGeo, materials.fernFrond);
          leaf.position.copy(pt);
          leaf.scale.set(leafScale * 0.75, leafScale * 0.85, leafScale);
          // Orient outward from rachis
          leaf.rotation.order = 'YXZ';
          leaf.rotation.y = side * (Math.PI / 2 - 0.35);
          leaf.rotation.x = Math.PI / 2 - Math.atan2(tangent.y, tangent.x) * 0.55 - 0.25;
          leaf.rotation.z = side * 0.18;
          leaf.castShadow = true;
          leaf.receiveShadow = true;
          frondHolder.add(leaf);
        }
      }

      fernGroup.add(frondHolder);
      animatedItems.push({
        group: frondHolder,
        baseRotX: frondHolder.rotation.x,
        baseRotZ: frondHolder.rotation.z,
        phase: rng.range(0, Math.PI * 2),
        swayAmount: 0.032 + tier * 0.02,
      });
    }

    registerInteractable(
      fernGroup,
      {
        id: `fern-${idx}`,
        commonName: 'Boston Sword Fern',
        scientificName: 'Nephrolepis exaltata',
        category: 'Flora',
        note: 'Arching pinnate fronds thrive in high glasshouse humidity and diffuse canopy light.',
      },
      interactables
    );
    root.add(fernGroup);
  };

  // Helper: Build composite Mossy Driftwood Branch (5-8 parts: main bough, 2 forks, knots, epiphyte)
  const buildDriftwood = (x: number, z: number, rotY: number) => {
    const y = groundHeightAt(x, z);
    const woodGroup = new THREE.Group();
    woodGroup.position.set(x, y - 0.04, z);
    woodGroup.rotation.y = rotY;

    const mainCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.65, 0.0, 0.18),
      new THREE.Vector3(-0.2, 0.36, 0.06),
      new THREE.Vector3(0.28, 0.72, -0.08),
      new THREE.Vector3(0.68, 0.94, -0.14),
    ]);
    const mainGeo = trackGeo(new THREE.TubeGeometry(mainCurve, 22, 0.085, 9, false));
    const mainMesh = new THREE.Mesh(mainGeo, materials.driftwood);
    mainMesh.castShadow = true;
    mainMesh.receiveShadow = true;
    woodGroup.add(mainMesh);

    const fork1Curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.08, 0.44, 0.02),
      new THREE.Vector3(0.08, 0.78, 0.25),
      new THREE.Vector3(0.24, 1.05, 0.36),
    ]);
    const fork1Geo = trackGeo(new THREE.TubeGeometry(fork1Curve, 14, 0.048, 8, false));
    const fork1Mesh = new THREE.Mesh(fork1Geo, materials.driftwood);
    fork1Mesh.castShadow = true;
    woodGroup.add(fork1Mesh);

    const fork2Curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.24, 0.68, -0.06),
      new THREE.Vector3(0.05, 0.88, -0.32),
      new THREE.Vector3(-0.14, 0.96, -0.44),
    ]);
    const fork2Geo = trackGeo(new THREE.TubeGeometry(fork2Curve, 12, 0.036, 7, false));
    const fork2Mesh = new THREE.Mesh(fork2Geo, materials.driftwood);
    fork2Mesh.castShadow = true;
    woodGroup.add(fork2Mesh);

    // Epiphyte moss pads clinging to upper bark
    const mossPadMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#4a7a3e'),
        bumpMap: materials.mossCushion.bumpMap,
        bumpScale: 0.03,
        roughness: 0.92,
      })
    );
    const padPositions = [
      new THREE.Vector3(-0.15, 0.44, 0.05),
      new THREE.Vector3(0.28, 0.78, -0.07),
      new THREE.Vector3(0.08, 0.82, 0.24),
    ];
    for (const p of padPositions) {
      const padGeo = trackGeo(createSculptedRockGeometry(0.095, 1, rng.range(1, 50), 0.45));
      const pad = new THREE.Mesh(padGeo, mossPadMat);
      pad.position.copy(p);
      pad.castShadow = true;
      woodGroup.add(pad);
    }

    registerInteractable(
      woodGroup,
      {
        id: 'driftwood-arch',
        commonName: 'Weathered Bogwood Bough',
        scientificName: 'Quercus suber (aged)',
        category: 'Mineral',
        note: 'Tannin-rich hardwood branch anchoring epiphytic cushion moss above the damp loam.',
      },
      interactables
    );
    root.add(woodGroup);
  };

  // Helper: Build composite Bioluminescent Mushroom Cluster (4-6 mushrooms, each stem+cap+gills)
  const buildMushroomCluster = (x: number, z: number, count: number, scale: number, idx: number) => {
    const y = groundHeightAt(x, z);
    const cluster = new THREE.Group();
    cluster.position.set(x, y - 0.01, z);

    const gillMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#b6e0d0'),
        emissive: new THREE.Color('#35c9a4'),
        emissiveIntensity: 0.2,
        roughness: 0.5,
      })
    );

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const dist = i === 0 ? 0 : rng.range(0.04, 0.14) * scale;
      const mScale = (i === 0 ? 1.15 : rng.range(0.55, 0.95)) * scale;
      const height = rng.range(0.16, 0.3) * mScale;
      const leanX = Math.cos(angle) * rng.range(0.03, 0.09) * mScale;
      const leanZ = Math.sin(angle) * rng.range(0.03, 0.09) * mScale;

      const mGroup = new THREE.Group();
      mGroup.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);

      const stemCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(leanX * 0.4, height * 0.52, leanZ * 0.4),
        new THREE.Vector3(leanX, height, leanZ),
      ]);
      const stemGeo = trackGeo(new THREE.TubeGeometry(stemCurve, 8, 0.013 * mScale, 6, false));
      const stem = new THREE.Mesh(stemGeo, materials.mushroomStem);
      stem.castShadow = true;
      mGroup.add(stem);

      const cap = new THREE.Mesh(mushroomCapGeo, materials.mushroomCap);
      cap.position.set(leanX, height - 0.01 * mScale, leanZ);
      cap.scale.setScalar(mScale * 1.1);
      cap.rotation.set(leanZ * 2.2, rng.range(0, Math.PI), -leanX * 2.2);
      cap.castShadow = true;
      mGroup.add(cap);

      const gillGeo = trackGeo(new THREE.CylinderGeometry(0.065 * mScale, 0.018 * mScale, 0.016 * mScale, 12));
      const gills = new THREE.Mesh(gillGeo, gillMat);
      gills.position.set(leanX, height - 0.008 * mScale, leanZ);
      gills.rotation.copy(cap.rotation);
      mGroup.add(gills);

      cluster.add(mGroup);
    }

    mushroomGlowPositions.push(new THREE.Vector3(x, y + 0.24 * scale, z));

    registerInteractable(
      cluster,
      {
        id: `mushrooms-${idx}`,
        commonName: 'Luminous Fairy Bonnets',
        scientificName: 'Mycena chlorophos',
        category: 'Fungi',
        note: 'Saprotrophic woodland fungi emitting a soft emerald bioluminescence after dusk.',
      },
      interactables
    );
    root.add(cluster);
  };

  // Helper: Build composite Rosette Succulent (3 whorls of sculpted fleshy leaves)
  const buildSucculent = (x: number, z: number, scale: number, roseTint: boolean, idx: number) => {
    const y = groundHeightAt(x, z);
    const group = new THREE.Group();
    group.position.set(x, y - 0.01, z);

    const baseMat = roseTint ? materials.succulentAccent : materials.succulent;
    const innerMat = roseTint ? materials.succulent : materials.succulentAccent;

    // Basal stem collar
    const baseGeo = trackGeo(new THREE.CylinderGeometry(0.06 * scale, 0.04 * scale, 0.05 * scale, 10));
    const base = new THREE.Mesh(baseGeo, materials.fernStem);
    base.position.y = 0.02 * scale;
    group.add(base);

    const whorls = [
      { count: 9, radius: 0.045, tilt: 1.05, yOff: 0.04, pScale: 1.05, mat: baseMat },
      { count: 7, radius: 0.028, tilt: 0.72, yOff: 0.075, pScale: 0.82, mat: baseMat },
      { count: 5, radius: 0.012, tilt: 0.38, yOff: 0.1, pScale: 0.56, mat: innerMat },
    ];

    whorls.forEach((w, wIdx) => {
      for (let i = 0; i < w.count; i++) {
        const a = (i / w.count) * Math.PI * 2 + wIdx * 0.45;
        const pHolder = new THREE.Group();
        pHolder.rotation.y = a;
        pHolder.position.y = w.yOff * scale;

        const petal = new THREE.Mesh(petalGeo, w.mat);
        petal.position.set(0, 0, w.radius * scale);
        petal.rotation.x = w.tilt;
        petal.scale.setScalar(scale * w.pScale);
        petal.castShadow = true;
        petal.receiveShadow = true;
        pHolder.add(petal);
        group.add(pHolder);
      }
    });

    registerInteractable(
      group,
      {
        id: `succulent-${idx}`,
        commonName: roseTint ? 'Dusky Rose Echeveria' : 'Jade Rosette',
        scientificName: 'Echeveria elegans',
        category: 'Flora',
        note: 'Architectural spiral rosette storing morning condensation inside waxy leaves.',
      },
      interactables
    );
    root.add(group);
  };

  // Helper: Build composite Weathered Slate Stone Cairn (3-5 parts + moss cap)
  const buildStoneCairn = (x: number, z: number, scale: number, idx: number) => {
    const y = groundHeightAt(x, z);
    const cairn = new THREE.Group();
    cairn.position.set(x, y - 0.03, z);

    const b1Geo = trackGeo(createSculptedRockGeometry(0.24 * scale, 2, idx * 17 + 3, 0.58));
    const b1 = new THREE.Mesh(b1Geo, materials.stone);
    b1.position.set(0, 0.11 * scale, 0);
    b1.rotation.y = rng.range(0, Math.PI);
    b1.castShadow = true;
    b1.receiveShadow = true;
    cairn.add(b1);

    const b2Geo = trackGeo(createSculptedRockGeometry(0.16 * scale, 2, idx * 29 + 7, 0.62));
    const b2 = new THREE.Mesh(b2Geo, materials.stone);
    b2.position.set(0.03 * scale, 0.27 * scale, -0.02 * scale);
    b2.rotation.set(0.1, rng.range(0, Math.PI), -0.08);
    b2.castShadow = true;
    b2.receiveShadow = true;
    cairn.add(b2);

    const b3Geo = trackGeo(createSculptedRockGeometry(0.1 * scale, 1, idx * 41 + 11, 0.65));
    const b3 = new THREE.Mesh(b3Geo, materials.stone);
    b3.position.set(-0.02 * scale, 0.39 * scale, 0.02 * scale);
    b3.castShadow = true;
    cairn.add(b3);

    // Moss crown cap on base boulder
    const mossMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#3f6b35'),
        bumpMap: materials.mossCushion.bumpMap,
        bumpScale: 0.03,
        roughness: 0.94,
      })
    );
    const mossGeo = trackGeo(createSculptedRockGeometry(0.14 * scale, 1, idx * 11, 0.32));
    const moss = new THREE.Mesh(mossGeo, mossMat);
    moss.position.set(-0.11 * scale, 0.19 * scale, 0.08 * scale);
    cairn.add(moss);

    registerInteractable(
      cairn,
      {
        id: `stone-cairn-${idx}`,
        commonName: 'Weathered Slate Cairn',
        scientificName: 'Metamorphic phyllite',
        category: 'Mineral',
        note: 'Stacked mineral stones anchoring moisture retention and anchoring velvet moss colonies.',
      },
      interactables
    );
    root.add(cairn);
  };

  // Helper: Build Miniature Brass Conservatory Lantern (7-part composite prop)
  const buildBrassLantern = (x: number, z: number): THREE.Vector3 => {
    const y = groundHeightAt(x, z);
    const lantern = new THREE.Group();
    lantern.position.set(x, y - 0.01, z);

    // 1. Stone pad
    const padGeo = trackGeo(createSculptedRockGeometry(0.14, 1, 99, 0.32));
    const pad = new THREE.Mesh(padGeo, materials.stone);
    pad.position.y = 0.025;
    pad.receiveShadow = true;
    lantern.add(pad);

    // 2. Turned brass post
    const postGeo = trackGeo(new THREE.CylinderGeometry(0.024, 0.038, 0.24, 12));
    const post = new THREE.Mesh(postGeo, materials.patinaBronze);
    post.position.y = 0.14;
    post.castShadow = true;
    lantern.add(post);

    // 3. Lantern floor plate
    const floorGeo = trackGeo(new THREE.CylinderGeometry(0.085, 0.075, 0.02, 8));
    const floor = new THREE.Mesh(floorGeo, materials.brushedBrass);
    floor.position.y = 0.26;
    lantern.add(floor);

    // 4. Glowing warm filament bulb
    const bulbGeo = trackGeo(new THREE.SphereGeometry(0.035, 14, 14));
    const bulb = new THREE.Mesh(bulbGeo, materials.lanternFilament);
    bulb.position.y = 0.34;
    lantern.add(bulb);

    // 5. 4 Corner struts
    const strutGeo = trackGeo(new THREE.CylinderGeometry(0.007, 0.007, 0.14, 6));
    for (let s = 0; s < 4; s++) {
      const a = (s / 4) * Math.PI * 2 + Math.PI / 4;
      const strut = new THREE.Mesh(strutGeo, materials.patinaBronze);
      strut.position.set(Math.cos(a) * 0.068, 0.34, Math.sin(a) * 0.068);
      lantern.add(strut);
    }

    // 6. Conical brass hood
    const hoodGeo = trackGeo(new THREE.ConeGeometry(0.11, 0.08, 8));
    const hood = new THREE.Mesh(hoodGeo, materials.brushedBrass);
    hood.position.y = 0.44;
    hood.castShadow = true;
    lantern.add(hood);

    // 7. Tiny top loop
    const loopGeo = trackGeo(new THREE.TorusGeometry(0.022, 0.005, 8, 16));
    const loop = new THREE.Mesh(loopGeo, materials.brushedBrass);
    loop.position.y = 0.49;
    lantern.add(loop);

    registerInteractable(
      lantern,
      {
        id: 'brass-lantern',
        commonName: 'Conservatory Micro-Lantern',
        scientificName: 'Hand-spun brass fixture',
        category: 'Fixture',
        note: 'Miniature warm-filament garden beacon that automatically illuminates after sunset.',
      },
      interactables
    );
    root.add(lantern);

    return new THREE.Vector3(x, y + 0.35, z);
  };

  // --- Populate Biome Composition ---
  const lushScale = 0.75 + lushness * 0.32;

  // Always place the weathered driftwood centerpiece & brass lantern near pond edge
  buildDriftwood(-0.22, -0.32, biome === 'arid_rosette' ? 0.55 : 0.18);
  const lanternPosition = buildBrassLantern(0.12, 0.86);

  if (biome === 'fern_gully') {
    buildFern(-0.82, -0.68, 1.12 * lushScale, 10, 1);
    buildFern(-1.12, 0.18, 0.92 * lushScale, 8, 2);
    buildFern(0.28, -1.04, 1.0 * lushScale, 9, 3);
    buildFern(-0.24, 0.58, 0.78 * lushScale, 7, 4);
    if (lushness > 0.6) {
      buildFern(0.95, -0.42, 0.85 * lushScale, 8, 5);
    }
    buildStoneCairn(1.18, -0.18, 0.95, 1);
    buildStoneCairn(-0.62, 0.92, 0.78, 2);
    buildMushroomCluster(-0.48, 0.12, 5, 0.95, 1);
    buildMushroomCluster(0.45, -0.52, 4, 0.8, 2);
    buildSucculent(1.15, 0.88, 0.88, false, 1);
  } else if (biome === 'twilight_moss') {
    buildFern(-0.92, -0.52, 1.04 * lushScale, 9, 1);
    buildFern(0.32, -0.98, 0.9 * lushScale, 8, 2);
    buildFern(-0.95, 0.45, 0.8 * lushScale, 7, 3);
    buildMushroomCluster(-0.42, 0.08, 6, 1.22 * lushScale, 1);
    buildMushroomCluster(0.42, -0.46, 5, 1.08 * lushScale, 2);
    buildMushroomCluster(-0.78, 0.82, 4, 0.95 * lushScale, 3);
    if (lushness > 0.65) {
      buildMushroomCluster(1.06, -0.22, 4, 0.9, 4);
    }
    buildStoneCairn(-0.18, -0.92, 0.9, 1);
    buildStoneCairn(1.18, 0.14, 0.84, 2);
  } else {
    // 'arid_rosette'
    buildSucculent(-0.65, -0.55, 1.32 * lushScale, true, 1);
    buildSucculent(-0.98, 0.22, 1.08 * lushScale, false, 2);
    buildSucculent(0.24, -0.88, 1.15 * lushScale, false, 3);
    buildSucculent(-0.28, 0.66, 0.95 * lushScale, true, 4);
    buildSucculent(1.1, -0.42, 1.0 * lushScale, true, 5);
    if (lushness > 0.65) {
      buildSucculent(1.22, 0.78, 0.82 * lushScale, false, 6);
    }
    buildFern(-1.05, -0.68, 0.75 * lushScale, 7, 1);
    buildStoneCairn(0.75, -0.78, 1.12, 1);
    buildStoneCairn(-0.68, 0.95, 0.95, 2);
    buildStoneCairn(1.28, 0.08, 0.82, 3);
    buildMushroomCluster(-0.15, -0.2, 3, 0.72, 1);
  }

  // --- InstancedMesh Groundcover (> 20 repeated items) ---
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  // 1. Velvet Moss Cushions (~240 instances)
  const mossCount = Math.floor(130 + lushness * 140);
  const mossTuftGeo = trackGeo(new THREE.IcosahedronGeometry(0.11, 1));
  mossTuftGeo.scale(1.25, 0.58, 1.25);
  const mossInstanced = new THREE.InstancedMesh(mossTuftGeo, materials.mossCushion, mossCount);
  mossInstanced.receiveShadow = true;
  mossInstanced.castShadow = false;

  const mossPalette =
    biome === 'twilight_moss'
      ? ['#2c5942', '#356c4b', '#417d56', '#284d3a']
      : biome === 'arid_rosette'
        ? ['#566d3c', '#687d44', '#4a6035', '#74854d']
        : ['#36662f', '#447a37', '#548c3d', '#2e5729'];

  let mossPlaced = 0;
  for (let attempt = 0; attempt < mossCount * 3 && mossPlaced < mossCount; attempt++) {
    const angle = rng.range(0, Math.PI * 2);
    const rad = Math.sqrt(rng.next()) * (TERRARIUM_RADIUS - 0.14);
    const mx = Math.cos(angle) * rad;
    const mz = Math.sin(angle) * rad;
    if (isInPond(mx, mz, 0.03)) continue;
    const my = groundHeightAt(mx, mz);
    if (my < WATER_LEVEL + 0.01) continue;

    dummy.position.set(mx, my - 0.012, mz);
    dummy.rotation.set(rng.range(-0.18, 0.18), rng.range(0, Math.PI * 2), rng.range(-0.18, 0.18));
    const s = rng.range(0.65, 1.45); // ±15%+ organic cushion variety
    dummy.scale.set(s * rng.range(0.85, 1.15), s * rng.range(0.75, 1.25), s * rng.range(0.85, 1.15));
    dummy.updateMatrix();
    mossInstanced.setMatrixAt(mossPlaced, dummy.matrix);

    const hex = mossPalette[Math.floor(rng.next() * mossPalette.length)];
    color.set(hex).offsetHSL(rng.range(-0.02, 0.02), rng.range(-0.05, 0.05), rng.range(-0.04, 0.04));
    mossInstanced.setColorAt(mossPlaced, color);
    mossPlaced++;
  }
  mossInstanced.count = mossPlaced;
  mossInstanced.instanceMatrix.needsUpdate = true;
  if (mossInstanced.instanceColor) mossInstanced.instanceColor.needsUpdate = true;
  mossInstanced.computeBoundingSphere();
  root.add(mossInstanced);

  // 2. River Pebbles along pond rim & dry hollows (~150 instances)
  const pebbleCount = 150;
  const pebbleGeo = trackGeo(createSculptedRockGeometry(0.055, 1, 77, 0.52));
  const pebbleMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.46,
      metalness: 0.05,
    })
  );
  const pebbleInstanced = new THREE.InstancedMesh(pebbleGeo, pebbleMat, pebbleCount);
  pebbleInstanced.castShadow = true;
  pebbleInstanced.receiveShadow = true;

  const pebblePalette = ['#686b66', '#838075', '#515452', '#958e7e', '#434849'];
  for (let i = 0; i < pebbleCount; i++) {
    let px: number;
    let pz: number;
    if (i < 85) {
      // Ring around rainwater pond bank & shallow shore
      const a = (i / 85) * Math.PI * 2 + rng.range(-0.15, 0.15);
      const r = rng.range(0.42, 0.74);
      px = 0.68 + Math.cos(a) * r;
      pz = 0.56 + Math.sin(a) * r;
    } else {
      const a = rng.range(0, Math.PI * 2);
      const r = Math.sqrt(rng.next()) * (TERRARIUM_RADIUS - 0.15);
      px = Math.cos(a) * r;
      pz = Math.sin(a) * r;
    }
    const py = groundHeightAt(px, pz);
    dummy.position.set(px, py - 0.006, pz);
    dummy.rotation.set(rng.range(-0.25, 0.25), rng.range(0, Math.PI * 2), rng.range(-0.25, 0.25));
    const ps = rng.range(0.65, 1.35);
    dummy.scale.set(ps, ps * rng.range(0.8, 1.1), ps * rng.range(0.85, 1.15));
    dummy.updateMatrix();
    pebbleInstanced.setMatrixAt(i, dummy.matrix);

    const pHex = pebblePalette[Math.floor(rng.next() * pebblePalette.length)];
    color.set(pHex).offsetHSL(0, 0, rng.range(-0.05, 0.05));
    pebbleInstanced.setColorAt(i, color);
  }
  pebbleInstanced.instanceMatrix.needsUpdate = true;
  if (pebbleInstanced.instanceColor) pebbleInstanced.instanceColor.needsUpdate = true;
  pebbleInstanced.computeBoundingSphere();
  root.add(pebbleInstanced);

  // 3. Delicate Micro-Clover / Baby's Tears Leaves (~140 instances)
  const cloverCount = Math.floor(70 + lushness * 80);
  const cloverGeo = trackGeo(new THREE.CircleGeometry(0.032, 7));
  cloverGeo.rotateX(-Math.PI / 2);
  const cloverMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color('#ffffff'),
      roughness: 0.48,
      metalness: 0.02,
      side: THREE.DoubleSide,
    })
  );
  const cloverInstanced = new THREE.InstancedMesh(cloverGeo, cloverMat, cloverCount);
  let cloverPlaced = 0;
  for (let attempt = 0; attempt < cloverCount * 3 && cloverPlaced < cloverCount; attempt++) {
    const a = rng.range(0, Math.PI * 2);
    const r = Math.sqrt(rng.next()) * (TERRARIUM_RADIUS - 0.18);
    const cx = Math.cos(a) * r;
    const cz = Math.sin(a) * r;
    if (isInPond(cx, cz, 0.08)) continue;
    const cy = groundHeightAt(cx, cz);

    dummy.position.set(cx, cy + 0.032 + rng.range(0, 0.035), cz);
    dummy.rotation.set(rng.range(-0.45, 0.45), rng.range(0, Math.PI * 2), rng.range(-0.45, 0.45));
    const cs = rng.range(0.75, 1.3);
    dummy.scale.set(cs, cs, cs);
    dummy.updateMatrix();
    cloverInstanced.setMatrixAt(cloverPlaced, dummy.matrix);

    color.set('#6ca853').offsetHSL(rng.range(-0.04, 0.04), rng.range(-0.08, 0.08), rng.range(-0.06, 0.08));
    cloverInstanced.setColorAt(cloverPlaced, color);
    cloverPlaced++;
  }
  cloverInstanced.count = cloverPlaced;
  cloverInstanced.instanceMatrix.needsUpdate = true;
  if (cloverInstanced.instanceColor) cloverInstanced.instanceColor.needsUpdate = true;
  cloverInstanced.computeBoundingSphere();
  root.add(cloverInstanced);

  return {
    root,
    animatedItems,
    interactables,
    lanternPosition,
    mushroomGlowPositions,
    updateSway: (elapsed: number, breeze: number, pulseTarget: THREE.Object3D | null, pulseAge: number) => {
      const breezeScale = 0.25 + breeze * 1.35;
      for (const item of animatedItems) {
        const wave1 = Math.sin(elapsed * 1.45 + item.phase);
        const wave2 = Math.cos(elapsed * 0.9 + item.phase * 1.7);
        item.group.rotation.x = item.baseRotX + wave1 * item.swayAmount * breezeScale;
        item.group.rotation.z = item.baseRotZ + wave2 * item.swayAmount * 0.7 * breezeScale;
      }
      if (pulseTarget && pulseAge < 1.2) {
        const spring = Math.exp(-pulseAge * 4.2) * Math.sin(pulseAge * 16) * 0.07;
        pulseTarget.scale.setScalar(1 + spring);
      } else if (pulseTarget) {
        pulseTarget.scale.setScalar(1);
      }
    },
    dispose: () => {
      for (const g of geometries) g.dispose();
      for (const m of localMaterials) m.dispose();
    },
  };
}

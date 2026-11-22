import * as THREE from 'three';
import type { VesselStyle } from '../types/terrarium';
import type { TerrariumMaterialLibrary } from './materials';

export const TERRARIUM_RADIUS = 2.04;
export const WATER_LEVEL = 0.545;

/**
 * Deterministic sculpted terrain height inside the terrarium (world Y).
 * Rear-left rises into a mossy ridge; front-right dips into a shallow rainwater pool.
 */
export function groundHeightAt(x: number, z: number): number {
  const r2 = x * x + z * z;
  const normR = Math.min(1, Math.sqrt(r2) / TERRARIUM_RADIUS);

  // Rear-left organic ridge
  const dxHill = x + 0.45;
  const dzHill = z + 0.48;
  const hill = 0.38 * Math.exp(-(dxHill * dxHill + dzHill * dzHill) / 1.15);

  // Secondary gentle rise on right-back
  const dxKnoll = x - 0.85;
  const dzKnoll = z + 0.55;
  const knoll = 0.16 * Math.exp(-(dxKnoll * dxKnoll + dzKnoll * dzKnoll) / 0.65);

  // Front-right shallow pond basin
  const dxPool = x - 0.68;
  const dzPool = z - 0.56;
  const poolDip = -0.22 * Math.exp(-(dxPool * dxPool + dzPool * dzPool) / 0.36);

  // Micro-undulations
  const ripple =
    0.03 * Math.sin(x * 3.1 + z * 1.9) + 0.02 * Math.cos(z * 4.2 - x * 2.4);

  // Taper cleanly near the outer glass perimeter
  const edgeTaper = 1 - Math.pow(normR, 4) * 0.35;

  return 0.6 + (hill + knoll + poolDip + ripple) * edgeTaper;
}

export interface BuiltVessel {
  root: THREE.Group;
  glassGroup: THREE.Group;
  dispose: () => void;
}

export function buildTerrariumVessel(
  style: VesselStyle,
  materials: TerrariumMaterialLibrary
): BuiltVessel {
  const root = new THREE.Group();
  const glassGroup = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };

  // 1. Studio Tabletop Plane (grounded beneath everything)
  const tableGeo = trackGeo(new THREE.CircleGeometry(18, 64));
  tableGeo.rotateX(-Math.PI / 2);
  const tableMesh = new THREE.Mesh(tableGeo, materials.tableTop);
  tableMesh.position.y = 0;
  tableMesh.receiveShadow = true;
  root.add(tableMesh);

  // Soft radial contact shadow directly beneath the pedestal
  const shadowGeo = trackGeo(new THREE.PlaneGeometry(6.2, 6.2));
  shadowGeo.rotateX(-Math.PI / 2);
  const contactShadow = new THREE.Mesh(shadowGeo, materials.contactShadow);
  contactShadow.position.y = 0.004;
  contactShadow.renderOrder = 1;
  root.add(contactShadow);

  // 2. Turned Walnut Pedestal Base (LatheGeometry with stepped molding, bottom-center at y=0)
  const radialSegs = style === 'bell' ? 64 : style === 'geodesic' ? 10 : 8;
  const pedestalPoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(2.36, 0.0),
    new THREE.Vector2(2.4, 0.05),
    new THREE.Vector2(2.34, 0.12),
    new THREE.Vector2(2.26, 0.16),
    new THREE.Vector2(2.28, 0.25),
    new THREE.Vector2(2.18, 0.31),
    new THREE.Vector2(2.14, 0.35),
    new THREE.Vector2(0.0, 0.35),
  ];
  const pedestalGeo = trackGeo(new THREE.LatheGeometry(pedestalPoints, radialSegs));
  const pedestalMesh = new THREE.Mesh(pedestalGeo, materials.woodPedestal);
  pedestalMesh.castShadow = true;
  pedestalMesh.receiveShadow = true;
  root.add(pedestalMesh);

  // Brass alignment feet (4 small turned pads under base rim)
  const footGeo = trackGeo(new THREE.CylinderGeometry(0.11, 0.14, 0.04, 16));
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const foot = new THREE.Mesh(footGeo, materials.brushedBrass);
    foot.position.set(Math.cos(angle) * 2.1, 0.02, Math.sin(angle) * 2.1);
    foot.castShadow = true;
    root.add(foot);
  }

  // 3. Beveled Brass Collar Ring around glass seating groove
  const collarPoints = [
    new THREE.Vector2(2.04, 0.32),
    new THREE.Vector2(2.19, 0.32),
    new THREE.Vector2(2.21, 0.37),
    new THREE.Vector2(2.16, 0.42),
    new THREE.Vector2(2.06, 0.42),
    new THREE.Vector2(2.04, 0.37),
  ];
  const collarGeo = trackGeo(new THREE.LatheGeometry(collarPoints, radialSegs));
  const collarMesh = new THREE.Mesh(collarGeo, materials.brushedBrass);
  collarMesh.castShadow = true;
  collarMesh.receiveShadow = true;
  root.add(collarMesh);

  // 4. Stratified Geological Substrate Wall (visible through lower glass)
  const strataGeo = trackGeo(
    new THREE.CylinderGeometry(TERRARIUM_RADIUS, TERRARIUM_RADIUS - 0.02, 0.34, 64, 1, true)
  );
  const strataMesh = new THREE.Mesh(strataGeo, materials.strata);
  strataMesh.position.y = 0.49;
  strataMesh.receiveShadow = true;
  root.add(strataMesh);

  // Bottom seal disc
  const baseSoilGeo = trackGeo(new THREE.CircleGeometry(TERRARIUM_RADIUS - 0.01, 48));
  baseSoilGeo.rotateX(Math.PI / 2);
  const baseSoil = new THREE.Mesh(baseSoilGeo, materials.strata);
  baseSoil.position.y = 0.33;
  root.add(baseSoil);

  // 5. Sculpted Organic Loam Terrain Top Surface
  const terrainGeo = trackGeo(new THREE.CircleGeometry(TERRARIUM_RADIUS, 64));
  // Subdivide via Ring-style radial vertices using Plane or Disc grid?
  // CircleGeometry only has 1 ring! Let's build a clean radial-grid BufferGeometry for high-res terrain!
  const rings = 28;
  const sectors = 64;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Center vertex
  positions.push(0, groundHeightAt(0, 0), 0);
  uvs.push(0.5, 0.5);

  for (let r = 1; r <= rings; r++) {
    const rad = (r / rings) * TERRARIUM_RADIUS;
    for (let s = 0; s < sectors; s++) {
      const theta = (s / sectors) * Math.PI * 2;
      const x = Math.cos(theta) * rad;
      const z = Math.sin(theta) * rad;
      const y = groundHeightAt(x, z);
      positions.push(x, y, z);
      uvs.push(0.5 + (x / TERRARIUM_RADIUS) * 0.5, 0.5 + (z / TERRARIUM_RADIUS) * 0.5);
    }
  }

  // Center fan
  for (let s = 0; s < sectors; s++) {
    const next = (s + 1) % sectors;
    indices.push(0, 1 + next, 1 + s);
  }
  // Outer rings
  for (let r = 1; r < rings; r++) {
    const ringStart = 1 + (r - 1) * sectors;
    const nextRingStart = 1 + r * sectors;
    for (let s = 0; s < sectors; s++) {
      const next = (s + 1) % sectors;
      const a = ringStart + s;
      const b = ringStart + next;
      const c = nextRingStart + s;
      const d = nextRingStart + next;
      indices.push(a, b, d);
      indices.push(a, d, c);
    }
  }

  const sculptedTerrainGeo = trackGeo(new THREE.BufferGeometry());
  sculptedTerrainGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  sculptedTerrainGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  sculptedTerrainGeo.setIndex(indices);
  sculptedTerrainGeo.computeVertexNormals();
  terrainGeo.dispose(); // unused placeholder

  const soilMesh = new THREE.Mesh(sculptedTerrainGeo, materials.soil);
  soilMesh.receiveShadow = true;
  soilMesh.castShadow = false;
  root.add(soilMesh);

  // 6. Miniature Rainwater Pond in Front-Right Basin
  const poolGeo = trackGeo(new THREE.CircleGeometry(0.62, 40));
  poolGeo.rotateX(-Math.PI / 2);
  const poolMesh = new THREE.Mesh(poolGeo, materials.waterPool);
  poolMesh.position.set(0.68, WATER_LEVEL, 0.56);
  poolMesh.receiveShadow = true;
  poolMesh.renderOrder = 2;
  root.add(poolMesh);

  // 7. Glass Enclosure + Brass Architectural Frame (varies by VesselStyle)
  if (style === 'bell') {
    // Classic Wardian Bell Cloche with curved glass dome & turned brass finial
    const glassProfile = [
      new THREE.Vector2(2.11, 0.4),
      new THREE.Vector2(2.11, 2.35),
      new THREE.Vector2(2.06, 2.85),
      new THREE.Vector2(1.86, 3.35),
      new THREE.Vector2(1.48, 3.78),
      new THREE.Vector2(0.95, 4.08),
      new THREE.Vector2(0.38, 4.22),
    ];
    const domeGeo = trackGeo(new THREE.LatheGeometry(glassProfile, 64));
    const domeMesh = new THREE.Mesh(domeGeo, materials.vesselGlass);
    domeMesh.renderOrder = 10;
    glassGroup.add(domeMesh);

    // Lower thickened glass lip ring
    const lipGeo = trackGeo(new THREE.TorusGeometry(2.11, 0.025, 12, 64));
    lipGeo.rotateX(Math.PI / 2);
    const lipMesh = new THREE.Mesh(lipGeo, materials.glassRim);
    lipMesh.position.y = 0.42;
    lipMesh.renderOrder = 11;
    glassGroup.add(lipMesh);

    // Top brass ventilation collar & finial handle
    const ventPoints = [
      new THREE.Vector2(0.0, 4.2),
      new THREE.Vector2(0.42, 4.2),
      new THREE.Vector2(0.45, 4.25),
      new THREE.Vector2(0.36, 4.31),
      new THREE.Vector2(0.22, 4.33),
      new THREE.Vector2(0.18, 4.44),
      new THREE.Vector2(0.28, 4.54),
      new THREE.Vector2(0.22, 4.64),
      new THREE.Vector2(0.08, 4.7),
      new THREE.Vector2(0.0, 4.72),
    ];
    const ventGeo = trackGeo(new THREE.LatheGeometry(ventPoints, 32));
    const ventMesh = new THREE.Mesh(ventGeo, materials.brushedBrass);
    ventMesh.castShadow = true;
    root.add(ventMesh);

    // Brass ring handle atop finial
    const handleGeo = trackGeo(new THREE.TorusGeometry(0.14, 0.022, 12, 32));
    const handleMesh = new THREE.Mesh(handleGeo, materials.brushedBrass);
    handleMesh.position.y = 4.82;
    handleMesh.castShadow = true;
    root.add(handleMesh);
  } else if (style === 'geodesic') {
    // 10-sided Faceted Geodesic Conservatory Dome with brass mullions
    const sides = 10;
    const glassProfile = [
      new THREE.Vector2(2.12, 0.4),
      new THREE.Vector2(2.12, 1.85),
      new THREE.Vector2(1.88, 2.95),
      new THREE.Vector2(1.24, 3.78),
      new THREE.Vector2(0.36, 4.18),
    ];
    const domeGeo = trackGeo(new THREE.LatheGeometry(glassProfile, sides));
    const domeMesh = new THREE.Mesh(domeGeo, materials.vesselGlass);
    domeMesh.renderOrder = 10;
    glassGroup.add(domeMesh);

    // Horizontal brass structural rings at tier transitions
    const tierHeights = [1.85, 2.95, 3.78];
    const tierRadii = [2.12, 1.88, 1.24];
    tierHeights.forEach((h, idx) => {
      const ringGeo = trackGeo(new THREE.TorusGeometry(tierRadii[idx], 0.022, 8, sides));
      ringGeo.rotateX(Math.PI / 2);
      ringGeo.rotateY(Math.PI / sides);
      const ring = new THREE.Mesh(ringGeo, materials.patinaBronze);
      ring.position.y = h;
      ring.castShadow = true;
      root.add(ring);
    });

    // Vertical & angled brass ribs connecting tiers
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const pts = glassProfile.map((p) => new THREE.Vector3(Math.cos(a) * p.x, p.y, Math.sin(a) * p.x));
      const ribCurve = new THREE.CatmullRomCurve3(pts);
      const ribGeo = trackGeo(new THREE.TubeGeometry(ribCurve, 20, 0.018, 6, false));
      const rib = new THREE.Mesh(ribGeo, materials.brushedBrass);
      rib.castShadow = true;
      root.add(rib);
    }

    // Apex brass cupola cap
    const capGeo = trackGeo(new THREE.CylinderGeometry(0.14, 0.39, 0.24, sides));
    const capMesh = new THREE.Mesh(capGeo, materials.brushedBrass);
    capMesh.position.y = 4.28;
    capMesh.castShadow = true;
    root.add(capMesh);
  } else {
    // 'prism' — Tall Victorian Octagonal Brass & Glass Wardian Case
    const sides = 8;
    const glassProfile = [
      new THREE.Vector2(2.11, 0.4),
      new THREE.Vector2(2.11, 2.75),
      new THREE.Vector2(1.42, 3.65),
      new THREE.Vector2(0.3, 4.35),
    ];
    const prismGeo = trackGeo(new THREE.LatheGeometry(glassProfile, sides));
    const prismMesh = new THREE.Mesh(prismGeo, materials.vesselGlass);
    prismMesh.renderOrder = 10;
    glassGroup.add(prismMesh);

    // Corner mullions + eave ring
    const eaveGeo = trackGeo(new THREE.TorusGeometry(2.11, 0.028, 8, sides));
    eaveGeo.rotateX(Math.PI / 2);
    const eaveMesh = new THREE.Mesh(eaveGeo, materials.brushedBrass);
    eaveMesh.position.y = 2.75;
    eaveMesh.castShadow = true;
    root.add(eaveMesh);

    const upperEaveGeo = trackGeo(new THREE.TorusGeometry(1.42, 0.022, 8, sides));
    upperEaveGeo.rotateX(Math.PI / 2);
    const upperEave = new THREE.Mesh(upperEaveGeo, materials.patinaBronze);
    upperEave.position.y = 3.65;
    root.add(upperEave);

    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const pts = glassProfile.map((p) => new THREE.Vector3(Math.cos(a) * p.x, p.y, Math.sin(a) * p.x));
      const curve = new THREE.CatmullRomCurve3(pts);
      const mullionGeo = trackGeo(new THREE.TubeGeometry(curve, 16, 0.022, 6, false));
      const mullion = new THREE.Mesh(mullionGeo, materials.brushedBrass);
      mullion.castShadow = true;
      root.add(mullion);
    }

    // Ornate spire finial
    const spirePoints = [
      new THREE.Vector2(0.0, 4.32),
      new THREE.Vector2(0.32, 4.32),
      new THREE.Vector2(0.28, 4.42),
      new THREE.Vector2(0.12, 4.55),
      new THREE.Vector2(0.16, 4.65),
      new THREE.Vector2(0.04, 4.88),
      new THREE.Vector2(0.0, 4.94),
    ];
    const spireGeo = trackGeo(new THREE.LatheGeometry(spirePoints, sides));
    const spireMesh = new THREE.Mesh(spireGeo, materials.brushedBrass);
    spireMesh.castShadow = true;
    root.add(spireMesh);
  }

  root.add(glassGroup);

  return {
    root,
    glassGroup,
    dispose: () => {
      for (const g of geometries) {
        g.dispose();
      }
    },
  };
}

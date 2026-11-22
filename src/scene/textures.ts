import * as THREE from 'three';

export interface ProceduralTextureSet {
  woodMap: THREE.CanvasTexture;
  woodRoughnessMap: THREE.CanvasTexture;
  tableMap: THREE.CanvasTexture;
  tableRoughnessMap: THREE.CanvasTexture;
  soilMap: THREE.CanvasTexture;
  soilBumpMap: THREE.CanvasTexture;
  strataMap: THREE.CanvasTexture;
  leafBumpMap: THREE.CanvasTexture;
  mossBumpMap: THREE.CanvasTexture;
  stoneMap: THREE.CanvasTexture;
  stoneBumpMap: THREE.CanvasTexture;
  condensationRoughnessMap: THREE.CanvasTexture;
  contactShadowMap: THREE.CanvasTexture;
  softGlowMap: THREE.CanvasTexture;
  mistPuffMap: THREE.CanvasTexture;
  setAnisotropy: (anisotropy: number) => void;
  dispose: () => void;
}

function seededNoise(x: number, y: number, seed = 1337): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function configureTexture(
  tex: THREE.CanvasTexture,
  isColor: boolean,
  maxAnisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.anisotropy = maxAnisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const allTextures: THREE.Texture[] = [];
  const track = <T extends THREE.Texture>(t: T): T => {
    allTextures.push(t);
    return t;
  };

  // 1. Turned Walnut Wood (Pedestal)
  const woodCanvas = document.createElement('canvas');
  woodCanvas.width = 512;
  woodCanvas.height = 512;
  const wCtx = woodCanvas.getContext('2d')!;
  const woodRoughCanvas = document.createElement('canvas');
  woodRoughCanvas.width = 512;
  woodRoughCanvas.height = 512;
  const wrCtx = woodRoughCanvas.getContext('2d')!;

  wCtx.fillStyle = '#3d281c';
  wCtx.fillRect(0, 0, 512, 512);
  wrCtx.fillStyle = '#888888';
  wrCtx.fillRect(0, 0, 512, 512);

  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x += 2) {
      const wave =
        Math.sin(y * 0.06 + Math.sin(x * 0.018) * 3.5) * 0.5 +
        Math.sin(y * 0.21 + x * 0.01) * 0.25 +
        seededNoise(x * 0.2, y * 0.5, 11) * 0.25;
      const tone = Math.max(0, Math.min(1, wave * 0.5 + 0.5));
      const r = Math.floor(44 + tone * 46);
      const g = Math.floor(28 + tone * 30);
      const b = Math.floor(19 + tone * 20);
      wCtx.fillStyle = `rgb(${r},${g},${b})`;
      wCtx.fillRect(x, y, 2, 1);

      const roughVal = Math.floor(110 + (1 - tone) * 90);
      wrCtx.fillStyle = `rgb(${roughVal},${roughVal},${roughVal})`;
      wrCtx.fillRect(x, y, 2, 1);
    }
  }
  const woodMap = track(configureTexture(new THREE.CanvasTexture(woodCanvas), true, maxAnisotropy, 2, 1));
  const woodRoughnessMap = track(configureTexture(new THREE.CanvasTexture(woodRoughCanvas), false, maxAnisotropy, 2, 1));

  // 2. Studio Tabletop (Muted dark honed slate/ash oak surface)
  const tableCanvas = document.createElement('canvas');
  tableCanvas.width = 512;
  tableCanvas.height = 512;
  const tCtx = tableCanvas.getContext('2d')!;
  const tableRoughCanvas = document.createElement('canvas');
  tableRoughCanvas.width = 512;
  tableRoughCanvas.height = 512;
  const trCtx = tableRoughCanvas.getContext('2d')!;

  tCtx.fillStyle = '#262b27';
  tCtx.fillRect(0, 0, 512, 512);
  trCtx.fillStyle = '#b4b4b4';
  trCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 4800; i++) {
    const x = seededNoise(i, 1, 21) * 512;
    const y = seededNoise(i, 2, 22) * 512;
    const w = 12 + seededNoise(i, 3, 23) * 60;
    const h = 1 + seededNoise(i, 4, 24) * 2;
    const v = seededNoise(i, 5, 25);
    const base = 32 + Math.floor(v * 20);
    tCtx.fillStyle = `rgba(${base}, ${base + 4}, ${base + 1}, 0.22)`;
    tCtx.fillRect(x, y, w, h);

    const rv = 155 + Math.floor(v * 55);
    trCtx.fillStyle = `rgba(${rv}, ${rv}, ${rv}, 0.25)`;
    trCtx.fillRect(x, y, w, h);
  }
  const tableMap = track(configureTexture(new THREE.CanvasTexture(tableCanvas), true, maxAnisotropy, 4, 4));
  const tableRoughnessMap = track(configureTexture(new THREE.CanvasTexture(tableRoughCanvas), false, maxAnisotropy, 4, 4));

  // 3. Organic Loam Soil (Color + Bump)
  const soilCanvas = document.createElement('canvas');
  soilCanvas.width = 512;
  soilCanvas.height = 512;
  const sCtx = soilCanvas.getContext('2d')!;
  const soilBumpCanvas = document.createElement('canvas');
  soilBumpCanvas.width = 512;
  soilBumpCanvas.height = 512;
  const sbCtx = soilBumpCanvas.getContext('2d')!;

  sCtx.fillStyle = '#241b14';
  sCtx.fillRect(0, 0, 512, 512);
  sbCtx.fillStyle = '#808080';
  sbCtx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 7500; i++) {
    const x = seededNoise(i, 10, 31) * 512;
    const y = seededNoise(i, 11, 32) * 512;
    const r = 1 + seededNoise(i, 12, 33) * 4.2;
    const shade = seededNoise(i, 13, 34);
    const cr = Math.floor(24 + shade * 42);
    const cg = Math.floor(18 + shade * 31);
    const cb = Math.floor(12 + shade * 20);
    sCtx.fillStyle = `rgb(${cr},${cg},${cb})`;
    sCtx.beginPath();
    sCtx.arc(x, y, r, 0, Math.PI * 2);
    sCtx.fill();

    const bv = Math.floor(60 + shade * 185);
    sbCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
    sbCtx.beginPath();
    sbCtx.arc(x, y, r, 0, Math.PI * 2);
    sbCtx.fill();
  }
  const soilMap = track(configureTexture(new THREE.CanvasTexture(soilCanvas), true, maxAnisotropy, 3, 3));
  const soilBumpMap = track(configureTexture(new THREE.CanvasTexture(soilBumpCanvas), false, maxAnisotropy, 3, 3));

  // 4. Stratified Terrarium Cross-Section (drainage pebbles -> charcoal -> dark peat)
  const strataCanvas = document.createElement('canvas');
  strataCanvas.width = 512;
  strataCanvas.height = 256;
  const stCtx = strataCanvas.getContext('2d')!;
  const grad = stCtx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.0, '#2a1f16'); // Top rich humus
  grad.addColorStop(0.55, '#201812');
  grad.addColorStop(0.62, '#141516'); // Activated charcoal band
  grad.addColorStop(0.72, '#181a1b');
  grad.addColorStop(0.78, '#534f48'); // River grit / drainage pebbles
  grad.addColorStop(1.0, '#3e3a34');
  stCtx.fillStyle = grad;
  stCtx.fillRect(0, 0, 512, 256);

  // Add granular flecks per layer
  for (let i = 0; i < 2400; i++) {
    const x = seededNoise(i, 1, 41) * 512;
    const y = seededNoise(i, 2, 42) * 256;
    const rad = y > 190 ? 2.5 + seededNoise(i, 3, 43) * 4.5 : 1 + seededNoise(i, 3, 43) * 2.2;
    const n = seededNoise(i, 4, 44);
    if (y > 192) {
      const c = Math.floor(65 + n * 75);
      stCtx.fillStyle = `rgba(${c}, ${c - 4}, ${c - 10}, 0.75)`;
    } else if (y > 158) {
      const c = Math.floor(14 + n * 24);
      stCtx.fillStyle = `rgba(${c}, ${c}, ${c + 2}, 0.85)`;
    } else {
      const c = Math.floor(28 + n * 35);
      stCtx.fillStyle = `rgba(${c + 10}, ${c + 2}, ${c - 6}, 0.65)`;
    }
    stCtx.beginPath();
    stCtx.arc(x, y, rad, 0, Math.PI * 2);
    stCtx.fill();
  }
  const strataMap = track(configureTexture(new THREE.CanvasTexture(strataCanvas), true, maxAnisotropy, 3, 1));

  // 5. Leaf Vein Bump Map
  const leafCanvas = document.createElement('canvas');
  leafCanvas.width = 256;
  leafCanvas.height = 256;
  const lCtx = leafCanvas.getContext('2d')!;
  lCtx.fillStyle = '#808080';
  lCtx.fillRect(0, 0, 256, 256);
  // Central midrib
  lCtx.strokeStyle = '#d8d8d8';
  lCtx.lineWidth = 4;
  lCtx.beginPath();
  lCtx.moveTo(128, 256);
  lCtx.lineTo(128, 0);
  lCtx.stroke();
  // Pinnate lateral veins
  lCtx.lineWidth = 1.6;
  for (let y = 16; y < 248; y += 16) {
    lCtx.strokeStyle = 'rgba(210,210,210,0.65)';
    lCtx.beginPath();
    lCtx.moveTo(128, y);
    lCtx.quadraticCurveTo(78, y - 10, 20, y - 28);
    lCtx.stroke();
    lCtx.beginPath();
    lCtx.moveTo(128, y);
    lCtx.quadraticCurveTo(178, y - 10, 236, y - 28);
    lCtx.stroke();
  }
  const leafBumpMap = track(configureTexture(new THREE.CanvasTexture(leafCanvas), false, maxAnisotropy, 1, 1));

  // 6. Moss Velvety Bump Map
  const mossCanvas = document.createElement('canvas');
  mossCanvas.width = 256;
  mossCanvas.height = 256;
  const mCtx = mossCanvas.getContext('2d')!;
  mCtx.fillStyle = '#686868';
  mCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4200; i++) {
    const x = seededNoise(i, 1, 51) * 256;
    const y = seededNoise(i, 2, 52) * 256;
    const v = Math.floor(85 + seededNoise(i, 3, 53) * 165);
    mCtx.fillStyle = `rgb(${v},${v},${v})`;
    mCtx.fillRect(x, y, 2, 2);
  }
  const mossBumpMap = track(configureTexture(new THREE.CanvasTexture(mossCanvas), false, maxAnisotropy, 2, 2));

  // 7. Weathered Mineral Stone (Color + Bump)
  const stoneCanvas = document.createElement('canvas');
  stoneCanvas.width = 256;
  stoneCanvas.height = 256;
  const stnCtx = stoneCanvas.getContext('2d')!;
  const stoneBumpCanvas = document.createElement('canvas');
  stoneBumpCanvas.width = 256;
  stoneBumpCanvas.height = 256;
  const stnbCtx = stoneBumpCanvas.getContext('2d')!;
  stnCtx.fillStyle = '#5c605c';
  stnCtx.fillRect(0, 0, 256, 256);
  stnbCtx.fillStyle = '#808080';
  stnbCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 3000; i++) {
    const x = seededNoise(i, 1, 61) * 256;
    const y = seededNoise(i, 2, 62) * 256;
    const r = 1 + seededNoise(i, 3, 63) * 7;
    const v = seededNoise(i, 4, 64);
    const c = Math.floor(68 + v * 58);
    stnCtx.fillStyle = `rgba(${c}, ${c + 2}, ${c - 2}, 0.28)`;
    stnCtx.beginPath();
    stnCtx.arc(x, y, r, 0, Math.PI * 2);
    stnCtx.fill();

    const bv = Math.floor(70 + v * 150);
    stnbCtx.fillStyle = `rgba(${bv},${bv},${bv},0.35)`;
    stnbCtx.beginPath();
    stnbCtx.arc(x, y, r, 0, Math.PI * 2);
    stnbCtx.fill();
  }
  const stoneMap = track(configureTexture(new THREE.CanvasTexture(stoneCanvas), true, maxAnisotropy, 1, 1));
  const stoneBumpMap = track(configureTexture(new THREE.CanvasTexture(stoneBumpCanvas), false, maxAnisotropy, 1, 1));

  // 8. Glass Condensation Roughness Map
  const condCanvas = document.createElement('canvas');
  condCanvas.width = 512;
  condCanvas.height = 512;
  const cCtx = condCanvas.getContext('2d')!;
  cCtx.fillStyle = '#080808'; // smooth glass baseline
  cCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 1600; i++) {
    const x = seededNoise(i, 1, 71) * 512;
    const y = seededNoise(i, 2, 72) * 512;
    const r = 0.8 + seededNoise(i, 3, 73) * 3.8;
    const g = cCtx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(195,195,195,0.8)');
    g.addColorStop(0.7, 'rgba(130,130,130,0.45)');
    g.addColorStop(1, 'rgba(12,12,12,0)');
    cCtx.fillStyle = g;
    cCtx.beginPath();
    cCtx.arc(x, y, r, 0, Math.PI * 2);
    cCtx.fill();
  }
  const condensationRoughnessMap = track(
    configureTexture(new THREE.CanvasTexture(condCanvas), false, maxAnisotropy, 3, 2)
  );

  // 9. Soft Radial Contact Shadow
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const shCtx = shadowCanvas.getContext('2d')!;
  const shGrad = shCtx.createRadialGradient(128, 128, 12, 128, 128, 128);
  shGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.85)');
  shGrad.addColorStop(0.45, 'rgba(0, 0, 0, 0.55)');
  shGrad.addColorStop(0.78, 'rgba(0, 0, 0, 0.16)');
  shGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  shCtx.fillStyle = shGrad;
  shCtx.fillRect(0, 0, 256, 256);
  const contactShadowMap = track(new THREE.CanvasTexture(shadowCanvas));
  contactShadowMap.needsUpdate = true;

  // 10. Soft Particle Glow (Fireflies / Pollen)
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 64;
  glowCanvas.height = 64;
  const gCtx = glowCanvas.getContext('2d')!;
  const glGrad = gCtx.createRadialGradient(32, 32, 1, 32, 32, 32);
  glGrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
  glGrad.addColorStop(0.28, 'rgba(255, 250, 210, 0.85)');
  glGrad.addColorStop(0.65, 'rgba(255, 240, 180, 0.2)');
  glGrad.addColorStop(1.0, 'rgba(255, 240, 180, 0.0)');
  gCtx.fillStyle = glGrad;
  gCtx.fillRect(0, 0, 64, 64);
  const softGlowMap = track(new THREE.CanvasTexture(glowCanvas));
  softGlowMap.colorSpace = THREE.SRGBColorSpace;
  softGlowMap.needsUpdate = true;

  // 11. Mist Puff Sprite
  const mistCanvas = document.createElement('canvas');
  mistCanvas.width = 128;
  mistCanvas.height = 128;
  const miCtx = mistCanvas.getContext('2d')!;
  const miGrad = miCtx.createRadialGradient(64, 64, 4, 64, 64, 64);
  miGrad.addColorStop(0.0, 'rgba(235, 245, 242, 0.45)');
  miGrad.addColorStop(0.45, 'rgba(220, 236, 232, 0.22)');
  miGrad.addColorStop(1.0, 'rgba(210, 228, 224, 0.0)');
  miCtx.fillStyle = miGrad;
  miCtx.fillRect(0, 0, 128, 128);
  const mistPuffMap = track(new THREE.CanvasTexture(mistCanvas));
  mistPuffMap.colorSpace = THREE.SRGBColorSpace;
  mistPuffMap.needsUpdate = true;

  return {
    woodMap,
    woodRoughnessMap,
    tableMap,
    tableRoughnessMap,
    soilMap,
    soilBumpMap,
    strataMap,
    leafBumpMap,
    mossBumpMap,
    stoneMap,
    stoneBumpMap,
    condensationRoughnessMap,
    contactShadowMap,
    softGlowMap,
    mistPuffMap,
    setAnisotropy: (anisotropy: number) => {
      const clamped = Math.max(1, Math.min(maxAnisotropy, anisotropy));
      for (const tex of allTextures) {
        if (tex !== contactShadowMap && tex !== softGlowMap && tex !== mistPuffMap) {
          tex.anisotropy = clamped;
          tex.needsUpdate = true;
        }
      }
    },
    dispose: () => {
      for (const tex of allTextures) {
        tex.dispose();
      }
    },
  };
}

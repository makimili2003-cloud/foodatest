// Obrada 3D modela (GLB) U BROWSERU, da dobro izgleda i brzo se učitava na Androidu i iPhone-u.
// Izvorni kod; gotov fajl za admin je admin/vendor/optimize.js (vidi admin/README.md kako se pravi).
//  - teksture najviše 2048x2048 (veće Android/Scene Viewer zamuti ili odbije)
//  - glatke normale ako ih model nema (bez njih jelo izgleda ravno i "kockasto")
//  - pojednostavljivanje mreže iznad 100.000 trouglova
//  - model se centrira i spusti na sto (dno na y = 0)
//  - opciono: skaliranje na stvarnu širinu u cm
import { WebIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, weld, simplify, getBounds } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';

const MAX_TRIANGLES = 100_000;
const MAX_TEXTURE = 2048;

const io = new WebIO().registerExtensions(ALL_EXTENSIONS);

function countTriangles(doc) {
  let n = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      const pos = prim.getAttribute('POSITION');
      n += (idx ? idx.getCount() : pos ? pos.getCount() : 0) / 3;
    }
  }
  return Math.round(n);
}

function textureInfo(doc) {
  return doc.getRoot().listTextures().map(t => {
    const size = t.getSize() || [0, 0];
    return { width: size[0], height: size[1], mime: t.getMimeType(), bytes: t.getImage()?.byteLength || 0 };
  });
}

function dimensions(doc) {
  const scene = doc.getRoot().getDefaultScene() || doc.getRoot().listScenes()[0];
  const { min, max } = getBounds(scene);
  return { x: max[0] - min[0], y: max[1] - min[1], z: max[2] - min[2], min, max };
}

// Smanjivanje tekstura u browseru (canvas): najviše MAX_TEXTURE, JPEG ako nema providnosti
async function resizeTextures(doc, keepAlpha) {
  for (const tex of doc.getRoot().listTextures()) {
    const img = tex.getImage(); if (!img) continue;
    const mime = tex.getMimeType() || 'image/png';
    const bmp = await createImageBitmap(new Blob([img], { type: mime }));
    const scale = Math.min(1, MAX_TEXTURE / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale)), h = Math.max(1, Math.round(bmp.height * scale));
    const toJpeg = !keepAlpha;
    if (scale === 1 && (mime === 'image/jpeg' || !toJpeg)) { bmp.close?.(); continue; }
    const canvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : Object.assign(document.createElement('canvas'), { width: w, height: h });
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, w, h); bmp.close?.();
    const type = toJpeg ? 'image/jpeg' : 'image/png';
    const blob = canvas.convertToBlob ? await canvas.convertToBlob({ type, quality: 0.88 }) : await new Promise(r => canvas.toBlob(r, type, 0.88));
    tex.setImage(new Uint8Array(await blob.arrayBuffer())).setMimeType(type);
    const uri = tex.getURI(); if (uri) tex.setURI(uri.replace(/\.(png|jpe?g|webp)$/i, toJpeg ? '.jpg' : '.png'));
  }
}

// Glatke normale: susedni trouglovi dele normalu po poziciji temena (i preko UV šavova)
function addSmoothNormals(doc) {
  let added = 0;
  const buffer = doc.getRoot().listBuffers()[0];
  for (const prim of doc.getRoot().listMeshes().flatMap(m => m.listPrimitives())) {
    if (prim.getAttribute('NORMAL') || prim.getMode() !== 4 /* TRIANGLES */) continue;
    const pos = prim.getAttribute('POSITION').getArray();
    const n = pos.length / 3;
    const idx = prim.getIndices()?.getArray() || Uint32Array.from({ length: n }, (_, i) => i);
    const keyOf = new Map();
    const group = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      const k = pos[3 * i].toFixed(6) + ',' + pos[3 * i + 1].toFixed(6) + ',' + pos[3 * i + 2].toFixed(6);
      if (!keyOf.has(k)) keyOf.set(k, keyOf.size);
      group[i] = keyOf.get(k);
    }
    const acc = new Float64Array(keyOf.size * 3);
    for (let t = 0; t < idx.length; t += 3) {
      const a = idx[t], b = idx[t + 1], c = idx[t + 2];
      const ux = pos[3 * b] - pos[3 * a], uy = pos[3 * b + 1] - pos[3 * a + 1], uz = pos[3 * b + 2] - pos[3 * a + 2];
      const vx = pos[3 * c] - pos[3 * a], vy = pos[3 * c + 1] - pos[3 * a + 1], vz = pos[3 * c + 2] - pos[3 * a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const v of [a, b, c]) { const g = group[v] * 3; acc[g] += nx; acc[g + 1] += ny; acc[g + 2] += nz; }
    }
    const out = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const g = group[i] * 3;
      const len = Math.hypot(acc[g], acc[g + 1], acc[g + 2]) || 1;
      out[3 * i] = acc[g] / len; out[3 * i + 1] = acc[g + 1] / len; out[3 * i + 2] = acc[g + 2] / len;
    }
    prim.setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(out).setBuffer(buffer));
    added++;
  }
  return added;
}

// Centriraj model, spusti ga na sto i (opciono) skaliraj
function placeOnTable(doc, scale) {
  const root = doc.getRoot();
  const scene = root.getDefaultScene() || root.listScenes()[0];
  const { min, max } = getBounds(scene);
  const cx = (min[0] + max[0]) / 2, cz = (min[2] + max[2]) / 2;
  const wrapper = doc.createNode('FoodAR')
    .setScale([scale, scale, scale])
    .setTranslation([-cx * scale, -min[1] * scale, -cz * scale]);
  for (const child of scene.listChildren()) {
    scene.removeChild(child);
    wrapper.addChild(child);
  }
  scene.addChild(wrapper);
}

/**
 * @param {Uint8Array} input  sadržaj .glb fajla
 * @param {{ realWidthCm?: number, onStep?: (text: string) => void }} opts
 * @returns {Promise<{ glb: Uint8Array, report: object }>}
 */
export async function optimizeGlb(input, opts = {}) {
  const step = opts.onStep || (() => {});
  let doc;
  try {
    step('Čitam model…');
    doc = await io.readBinary(input);
  } catch (e) {
    throw new Error('Fajl nije ispravan GLB 3D model. Izvezi model kao .glb (glTF Binary).');
  }
  const root = doc.getRoot();
  if (!root.listMeshes().length) throw new Error('Model nema 3D mrežu (prazan fajl?).');

  const before = {
    triangles: countTriangles(doc),
    textures: textureInfo(doc),
    hadNormals: root.listMeshes().flatMap(m => m.listPrimitives()).every(p => p.getAttribute('NORMAL')),
    dims: dimensions(doc)
  };

  step('Spajam i čistim mrežu…');
  await doc.transform(dedup(), weld());

  if (countTriangles(doc) > MAX_TRIANGLES) {
    step('Pojednostavljujem mrežu…');
    await MeshoptSimplifier.ready;
    await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: MAX_TRIANGLES / countTriangles(doc), error: 0.0005 }));
  }

  step('Računam normale…');
  const normalsAdded = addSmoothNormals(doc);

  // Prozirne teksture ostaju PNG, ostale JPEG
  step('Smanjujem teksture…');
  const usesAlpha = root.listMaterials().some(m => m.getAlphaMode() !== 'OPAQUE');
  await resizeTextures(doc, usesAlpha);
  await doc.transform(prune());

  // Skaliranje na stvarnu širinu (najduža vodoravna strana)
  const d0 = dimensions(doc);
  const longest = Math.max(d0.x, d0.z);
  const realWidthCm = Number(opts.realWidthCm) || 0;
  const scale = realWidthCm > 0 && longest > 0 ? (realWidthCm / 100) / longest : 1;
  placeOnTable(doc, scale);

  step('Pakujem model…');
  const glb = await io.writeBinary(doc);

  const after = { triangles: countTriangles(doc), textures: textureInfo(doc), dims: dimensions(doc) };
  const cm = v => Math.round(v * 1000) / 10;
  const size = { width: cm(Math.max(after.dims.x, after.dims.z)), depth: cm(Math.min(after.dims.x, after.dims.z)), height: cm(after.dims.y) };

  const warnings = [];
  if (scale === 1 && (size.width > 60 || size.width < 3)) {
    warnings.push(`Model je širok ${size.width} cm, što verovatno nije stvarna veličina jela. Upiši stvarnu širinu u cm i obradi ponovo.`);
  }
  if (!before.hadNormals) warnings.push('Model nije imao normale; dodate su glatke normale (zato je ranije izgledao loše na Androidu).');

  return { glb, report: {
    before: { triangles: before.triangles, textures: before.textures.map(t => `${t.width}×${t.height}`), hadNormals: before.hadNormals },
    after: { triangles: after.triangles, textures: after.textures.map(t => `${t.width}×${t.height}`) },
    normalsAdded,
    scale,
    size,
    warnings
  } };
}

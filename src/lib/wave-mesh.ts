import * as THREE from "three";
import { amplitudeScaleAt, heightAt, type WaveParams } from "./wave-presets";

export type MeshData = {
  positions: Float32Array; // top surface only, for preview/export
  indices: Uint32Array;
  resX: number;
  resY: number;
  /** Normalized u ∈ [-1,1] per column i (length resX) — drives top X and bottom front/back rings. */
  uLin: Float32Array;
  /** Normalized v ∈ [-1,1] per row j (length resY) — drives top Y and bottom left/right rings. */
  vLin: Float32Array;
};

/** Samples per axis used for the heightfield mesh (sculpt applies sculptMeshMultiplier). */
export function heightfieldSampleCount(p: WaveParams): number {
  const base = Math.max(8, Math.min(800, Math.floor(p.resolution)));
  if (p.preset !== "sculpt") return base;
  const mult = Math.max(1, Math.min(4, p.sculptMeshMultiplier || 1));
  return Math.max(8, Math.min(800, Math.floor(base * mult)));
}

/** Place n knots in [-1,1] so arc length in (horizontal mm, z mm) is roughly uniform (1D slice). */
function equalArcLengthKnots1D(
  n: number,
  zAt: (t: number) => number,
  horizontalScaleMm: number,
  fineSteps: number,
): Float32Array {
  const knots = new Float32Array(n);
  knots[0] = -1;
  knots[n - 1] = 1;
  if (n <= 2) return knots;

  const ts = new Float64Array(fineSteps + 1);
  const zs = new Float64Array(fineSteps + 1);
  const cum = new Float64Array(fineSteps + 1);
  for (let i = 0; i <= fineSteps; i++) {
    ts[i] = -1 + (2 * i) / fineSteps;
    zs[i] = zAt(ts[i]);
  }
  cum[0] = 0;
  for (let i = 0; i < fineSteps; i++) {
    const dxMm = horizontalScaleMm * (ts[i + 1] - ts[i]);
    const dzMm = zs[i + 1] - zs[i];
    cum[i + 1] = cum[i] + Math.sqrt(dxMm * dxMm + dzMm * dzMm);
  }
  const total = cum[fineSteps];
  if (total < 1e-9) {
    for (let k = 1; k < n - 1; k++) knots[k] = -1 + (2 * k) / (n - 1);
    return knots;
  }

  for (let k = 1; k < n - 1; k++) {
    const target = (k / (n - 1)) * total;
    let lo = 0;
    let hi = fineSteps;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= target) lo = mid;
      else hi = mid;
    }
    const c0 = cum[lo];
    const c1 = cum[lo + 1];
    const f = (target - c0) / Math.max(1e-12, c1 - c0);
    knots[k] = ts[lo] + f * (ts[lo + 1] - ts[lo]);
  }
  return knots;
}

function buildKnotVectors(
  p: WaveParams,
  resX: number,
  resY: number,
): { uLin: Float32Array; vLin: Float32Array } {
  const uLin = new Float32Array(resX);
  const vLin = new Float32Array(resY);
  if (!p.adaptiveMeshing) {
    for (let i = 0; i < resX; i++) uLin[i] = (i / (resX - 1)) * 2 - 1;
    for (let j = 0; j < resY; j++) vLin[j] = (j / (resY - 1)) * 2 - 1;
    return { uLin, vLin };
  }

  const hx = p.stockX / 2;
  const hy = p.stockY / 2;
  const fineU = Math.min(8192, Math.max(512, resX * 16));
  const fineV = Math.min(8192, Math.max(512, resY * 16));
  const zSliceU = (u: number) =>
    p.baseThickness + heightAt(u, 0, p) * p.amplitude * amplitudeScaleAt(u, 0, p);
  const zSliceV = (v: number) =>
    p.baseThickness + heightAt(0, v, p) * p.amplitude * amplitudeScaleAt(0, v, p);

  const uTmp = equalArcLengthKnots1D(resX, zSliceU, hx, fineU);
  const vTmp = equalArcLengthKnots1D(resY, zSliceV, hy, fineV);
  uLin.set(uTmp);
  vLin.set(vTmp);
  return { uLin, vLin };
}

/** Build a top-surface heightfield in stock coordinates (mm). Centered on origin, +Z up. */
export function buildHeightfield(p: WaveParams): MeshData {
  const resX = heightfieldSampleCount(p);
  const resY = resX;
  const hx = p.stockX / 2;
  const hy = p.stockY / 2;
  const { uLin, vLin } = buildKnotVectors(p, resX, resY);
  const positions = new Float32Array(resX * resY * 3);
  const indices = new Uint32Array((resX - 1) * (resY - 1) * 6);
  const baseZ = p.baseThickness;

  for (let j = 0; j < resY; j++) {
    const v = vLin[j];
    const y = v * hy;
    for (let i = 0; i < resX; i++) {
      const u = uLin[i];
      const x = u * hx;
      const h = heightAt(u, v, p);
      const ampScale = amplitudeScaleAt(u, v, p);
      const localAmp = p.amplitude * ampScale;
      const z = baseZ + h * localAmp;
      const o = (j * resX + i) * 3;
      positions[o] = x;
      positions[o + 1] = y;
      positions[o + 2] = z;
    }
  }

  let k = 0;
  for (let j = 0; j < resY - 1; j++) {
    for (let i = 0; i < resX - 1; i++) {
      const a = j * resX + i;
      const b = a + 1;
      const c = a + resX;
      const d = c + 1;
      // CCW from +Z → normals +Z (match buildSolidGeometry top)
      indices[k++] = a;
      indices[k++] = b;
      indices[k++] = c;
      indices[k++] = b;
      indices[k++] = d;
      indices[k++] = c;
    }
  }
  return { positions, indices, resX, resY, uLin, vLin };
}

/** Build a closed solid (top wave + base box) THREE.BufferGeometry. */
export function buildSolidGeometry(p: WaveParams): THREE.BufferGeometry {
  const top = buildHeightfield(p);
  const { resX, resY, positions: topPos, uLin, vLin } = top;

  const hx = p.stockX / 2;
  const hy = p.stockY / 2;

  const topCount = resX * resY;
  // Bottom ring at z=0: one vertex per top boundary sample so each wall strip is a proper quad
  // (avoids fanning every segment to the same bottom corner pair).
  const ringVerts = 2 * resX + 2 * resY;
  const totalVerts = topCount + ringVerts;
  const positions = new Float32Array(totalVerts * 3);
  positions.set(topPos, 0);

  let w = topCount * 3;
  const idxFront = topCount;
  for (let i = 0; i < resX; i++) {
    const x = uLin[i] * hx;
    positions[w++] = x;
    positions[w++] = -hy;
    positions[w++] = 0;
  }
  const idxBack = topCount + resX;
  for (let i = 0; i < resX; i++) {
    const x = uLin[i] * hx;
    positions[w++] = x;
    positions[w++] = hy;
    positions[w++] = 0;
  }
  const idxLeft = topCount + 2 * resX;
  for (let j = 0; j < resY; j++) {
    const y = vLin[j] * hy;
    positions[w++] = -hx;
    positions[w++] = y;
    positions[w++] = 0;
  }
  const idxRight = topCount + 2 * resX + resY;
  for (let j = 0; j < resY; j++) {
    const y = vLin[j] * hy;
    positions[w++] = hx;
    positions[w++] = y;
    positions[w++] = 0;
  }

  const BL = idxFront + 0;
  const BR = idxFront + (resX - 1);
  const TL = idxBack + 0;
  const TR = idxBack + (resX - 1);

  const topFaceCount = (resX - 1) * (resY - 1) * 2;
  const sideTri = (resX - 1) * 2 * 2 + (resY - 1) * 2 * 2;
  const totalIdx = (topFaceCount + 2 + sideTri) * 3;
  const indices = new Uint32Array(totalIdx);
  let k = 0;

  // Top surface — CCW viewed from +Z
  for (let j = 0; j < resY - 1; j++) {
    for (let i = 0; i < resX - 1; i++) {
      const a = j * resX + i;
      const b = a + 1;
      const c = a + resX;
      const d = c + 1;
      indices[k++] = a;
      indices[k++] = b;
      indices[k++] = c;
      indices[k++] = b;
      indices[k++] = d;
      indices[k++] = c;
    }
  }
  // Bottom face — CCW viewed from -Z (so CW from above)
  indices[k++] = BL;
  indices[k++] = TR;
  indices[k++] = BR;
  indices[k++] = BL;
  indices[k++] = TL;
  indices[k++] = TR;

  // Side at y = -hy (front), outward -Y — CCW seen from outside (-Y)
  for (let i = 0; i < resX - 1; i++) {
    const t0 = i;
    const t1 = i + 1;
    const f0 = idxFront + i;
    const f1 = idxFront + i + 1;
    indices[k++] = t0;
    indices[k++] = t1;
    indices[k++] = f1;
    indices[k++] = t0;
    indices[k++] = f1;
    indices[k++] = f0;
  }
  // Side at y = +hy (back), outward +Y — CCW seen from outside (+Y)
  for (let i = 0; i < resX - 1; i++) {
    const t0 = (resY - 1) * resX + i;
    const t1 = (resY - 1) * resX + (i + 1);
    const b0 = idxBack + i;
    const b1 = idxBack + (i + 1);
    indices[k++] = t0;
    indices[k++] = t1;
    indices[k++] = b0;
    indices[k++] = t1;
    indices[k++] = b0;
    indices[k++] = b1;
  }
  // Side at x = -hx (left), outward -X — CCW seen from outside (-X)
  for (let j = 0; j < resY - 1; j++) {
    const t0 = j * resX;
    const t1 = (j + 1) * resX;
    const l0 = idxLeft + j;
    const l1 = idxLeft + (j + 1);
    indices[k++] = t0;
    indices[k++] = t1;
    indices[k++] = l0;
    indices[k++] = t1;
    indices[k++] = l1;
    indices[k++] = l0;
  }
  // Side at x = +hx (right), outward +X — CCW seen from outside (+X)
  for (let j = 0; j < resY - 1; j++) {
    const t0 = j * resX + (resX - 1);
    const t1 = (j + 1) * resX + (resX - 1);
    const r0 = idxRight + j;
    const r1 = idxRight + (j + 1);
    indices[k++] = t0;
    indices[k++] = r0;
    indices[k++] = t1;
    indices[k++] = t1;
    indices[k++] = r0;
    indices[k++] = r1;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setIndex(new THREE.BufferAttribute(indices, 1));
  geom.computeVertexNormals();
  return geom;
}

/** Export a BufferGeometry as binary STL (Uint8Array). */
export function geometryToBinarySTL(geom: THREE.BufferGeometry): Uint8Array {
  const pos = geom.getAttribute("position") as THREE.BufferAttribute;
  const idx = geom.getIndex();
  if (!idx) throw new Error("Geometry must be indexed");
  const triCount = idx.count / 3;
  const buffer = new ArrayBuffer(84 + triCount * 50);
  const view = new DataView(buffer);
  view.setUint32(80, triCount, true);
  let offset = 84;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let t = 0; t < triCount; t++) {
    const i0 = idx.getX(t * 3);
    const i1 = idx.getX(t * 3 + 1);
    const i2 = idx.getX(t * 3 + 2);
    a.fromBufferAttribute(pos, i0);
    b.fromBufferAttribute(pos, i1);
    c.fromBufferAttribute(pos, i2);
    ab.subVectors(b, a);
    ac.subVectors(c, a);
    n.crossVectors(ab, ac).normalize();
    view.setFloat32(offset, n.x, true);
    offset += 4;
    view.setFloat32(offset, n.y, true);
    offset += 4;
    view.setFloat32(offset, n.z, true);
    offset += 4;
    view.setFloat32(offset, a.x, true);
    offset += 4;
    view.setFloat32(offset, a.y, true);
    offset += 4;
    view.setFloat32(offset, a.z, true);
    offset += 4;
    view.setFloat32(offset, b.x, true);
    offset += 4;
    view.setFloat32(offset, b.y, true);
    offset += 4;
    view.setFloat32(offset, b.z, true);
    offset += 4;
    view.setFloat32(offset, c.x, true);
    offset += 4;
    view.setFloat32(offset, c.y, true);
    offset += 4;
    view.setFloat32(offset, c.z, true);
    offset += 4;
    view.setUint16(offset, 0, true);
    offset += 2;
  }
  return new Uint8Array(buffer);
}

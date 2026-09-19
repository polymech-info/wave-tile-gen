export type WaveParams = {
  preset: string;
  // Stock (mm)
  stockX: number;
  stockY: number;
  stockZ: number;
  // Mesh resolution
  resolution: number; // samples per axis
  /** Sculpt-only: multiplies grid density for smoother “falling” edges (mesh plugin path). */
  sculptMeshMultiplier: number;
  /**
   * When true, normalized u/v sample positions are warped by equal arc-length along the center
   * cross-section so steep slopes get more segments (preview + STL). Experimental.
   */
  adaptiveMeshing: boolean;
  baseThickness: number; // mm — solid base under wave
  amplitude: number; // mm — peak height above base
  // Generic shape params
  freqX: number;
  freqY: number;
  phase: number;
  warp: number;
  ridges: number;
  seed: number;
  heightVariance: number; // >=0 — multiplicative amplitude variation (smooth noise, always >0 scale)
  layers: number; // number of stepped terraces (used by sculpt/topo-style presets)
  layerSharpness: number; // 0..1 — 0 = smooth, 1 = sharp creases between layers
  /** Preview base tint (#rrggbb). */
  surfaceColorHex: string;
  /** Preview material preset id (see surface-presets). */
  surfaceTexturePreset: string;
};

export type Preset = {
  id: string;
  name: string;
  description: string;
  heightFn: string; // identifier; resolved by generator
  defaults: Partial<WaveParams>;
};

export const PRESETS: Preset[] = [
  {
    id: "dunes",
    name: "Dunes",
    description: "Soft flowing wood-grain dunes",
    heightFn: "dunes",
    defaults: {
      resolution: 200,
      sculptMeshMultiplier: 1,
      stockX: 500,
      stockY: 500,
      stockZ: 60,
      baseThickness: 8,
      amplitude: 18,
      freqX: 2.2,
      freqY: 1.3,
      phase: 0.4,
      warp: 0.6,
      ridges: 3,
      surfaceColorHex: "#9b3a1f",
      surfaceTexturePreset: "wood",
    },
  },
  {
    id: "ripples",
    name: "Ripples",
    description: "Concentric radial ripples",
    heightFn: "ripples",
    defaults: {
      resolution: 220,
      sculptMeshMultiplier: 1,
      stockX: 500,
      stockY: 500,
      stockZ: 50,
      baseThickness: 6,
      amplitude: 12,
      freqX: 6,
      freqY: 6,
      phase: 0,
      warp: 0.1,
      ridges: 8,
      surfaceColorHex: "#2a6b9b",
      surfaceTexturePreset: "polished",
    },
  },
  {
    id: "topo",
    name: "Topographic",
    description: "Layered terrain with stepped contours",
    heightFn: "topo",
    defaults: {
      resolution: 240,
      sculptMeshMultiplier: 1,
      stockX: 500,
      stockY: 500,
      stockZ: 55,
      baseThickness: 7,
      amplitude: 22,
      freqX: 1.6,
      freqY: 1.8,
      phase: 0.7,
      warp: 0.9,
      ridges: 5,
      surfaceColorHex: "#3d7d4a",
      surfaceTexturePreset: "matte",
    },
  },
  {
    id: "weave",
    name: "Weave",
    description: "Crossing sinusoids — woven texture",
    heightFn: "weave",
    defaults: {
      resolution: 200,
      sculptMeshMultiplier: 1,
      stockX: 500,
      stockY: 500,
      stockZ: 45,
      baseThickness: 6,
      amplitude: 10,
      freqX: 5,
      freqY: 5,
      phase: 0,
      warp: 0.2,
      ridges: 2,
      surfaceColorHex: "#6b4a8f",
      surfaceTexturePreset: "plastic",
    },
  },
  {
    id: "flow",
    name: "Flow Field",
    description: "Curl-noise inspired streamlines",
    heightFn: "flow",
    defaults: {
      resolution: 220,
      sculptMeshMultiplier: 1,
      stockX: 500,
      stockY: 500,
      stockZ: 58,
      baseThickness: 8,
      amplitude: 16,
      freqX: 2.4,
      freqY: 2.4,
      phase: 1.1,
      warp: 1.2,
      ridges: 4,
      surfaceColorHex: "#8b4514",
      surfaceTexturePreset: "wood",
    },
  },
  {
    id: "spiral",
    name: "Spiral",
    description: "Logarithmic spiral ridges",
    heightFn: "spiral",
    defaults: {
      resolution: 220,
      sculptMeshMultiplier: 1,
      stockX: 500,
      stockY: 500,
      stockZ: 52,
      baseThickness: 7,
      amplitude: 14,
      freqX: 4,
      freqY: 4,
      phase: 0.3,
      warp: 0.5,
      ridges: 6,
      surfaceColorHex: "#c45c2a",
      surfaceTexturePreset: "polished",
    },
  },
  {
    id: "sculpt",
    name: "Sculpt",
    description: "Carved organic ridges with deep valleys",
    heightFn: "sculpt",
    defaults: {
      resolution: 280,
      sculptMeshMultiplier: 2,
      stockX: 500,
      stockY: 500,
      stockZ: 60,
      baseThickness: 1,
      amplitude: 59,
      freqX: 1.4,
      freqY: 1.1,
      phase: 0.6,
      warp: 1.4,
      ridges: 3,
      heightVariance: 0.2,
      layers: 7,
      layerSharpness: 0.85,
      surfaceColorHex: "#7a2418",
      surfaceTexturePreset: "matte",
    },
  },
];

export const DEFAULT_PARAMS: WaveParams = {
  preset: "dunes",
  stockX: 500,
  stockY: 500,
  stockZ: 60,
  resolution: 200,
  sculptMeshMultiplier: 1,
  adaptiveMeshing: false,
  baseThickness: 8,
  amplitude: 18,
  freqX: 2.2,
  freqY: 1.3,
  phase: 0.4,
  warp: 0.6,
  ridges: 3,
  seed: 1,
  heightVariance: 0,
  layers: 6,
  layerSharpness: 0.7,
  surfaceColorHex: "#9b3a1f",
  surfaceTexturePreset: "wood",
};

// smooth pseudo-noise in [0,1] using hashed bilinear interpolation
function smoothNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x),
    yi = Math.floor(y);
  const xf = x - xi,
    yf = y - yi;
  const h = (i: number, j: number) => {
    const s = Math.sin(i * 127.1 + j * 311.7 + seed * 17.13) * 43758.5453;
    return s - Math.floor(s);
  };
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi),
    b = h(xi + 1, yi);
  const c = h(xi, yi + 1),
    d = h(xi + 1, yi + 1);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

// Pure height function: returns 0..1 normalized height for normalized (u,v) in [-1,1]
export function heightAt(u: number, v: number, p: WaveParams): number {
  const TAU = Math.PI * 2;
  const s = p.seed * 0.137;
  const fx = p.freqX;
  const fy = p.freqY;
  const ph = p.phase * TAU;
  const w = p.warp;
  const r = Math.max(1, p.ridges);

  // warp coordinates
  const wu = u + w * 0.3 * Math.sin(v * fy + ph + s);
  const wv = v + w * 0.3 * Math.cos(u * fx - ph + s);

  let h = 0;
  switch (p.preset) {
    case "ripples": {
      const d = Math.sqrt(wu * wu + wv * wv);
      h = 0.5 + 0.5 * Math.cos(d * fx * Math.PI + ph);
      h *= Math.exp(-d * 0.6);
      break;
    }
    case "topo": {
      const a = Math.sin(wu * fx + ph) + Math.cos(wv * fy - ph * 0.5);
      const stepped = Math.round(a * r) / r;
      h = 0.5 + 0.25 * stepped + 0.15 * Math.sin(wu * wv * 2 + s);
      break;
    }
    case "weave": {
      const a = Math.sin(wu * fx * Math.PI) * Math.cos(wv * fy * Math.PI);
      h = 0.5 + 0.5 * a;
      break;
    }
    case "flow": {
      let acc = 0;
      let amp = 1;
      let frq = 1;
      for (let i = 0; i < r; i++) {
        acc +=
          amp * Math.sin(wu * fx * frq + ph + i * 1.7 + s) * Math.cos(wv * fy * frq - ph + i * 0.9);
        amp *= 0.55;
        frq *= 1.9;
      }
      h = 0.5 + 0.5 * Math.tanh(acc * 0.8);
      break;
    }
    case "spiral": {
      const ang = Math.atan2(wv, wu);
      const rad = Math.sqrt(wu * wu + wv * wv);
      h = 0.5 + 0.5 * Math.sin(rad * fx * Math.PI - ang * r + ph);
      break;
    }
    case "sculpt": {
      // Smooth flowing scalar field (warped low-frequency sines = continuous "hills")
      const field =
        Math.sin(wu * fx + ph + s) * 0.55 +
        Math.sin((wu * 0.7 + wv * 1.2) * fy - ph * 0.6 + s * 1.3) * 0.35 +
        Math.sin(wv * fy * 0.8 + ph * 0.3 - s) * 0.25 +
        smoothNoise(wu * 1.2 + 5, wv * 1.2 - 3, p.seed) * 0.4 -
        0.2;
      // Normalize to 0..1
      const f = 0.5 + 0.5 * Math.tanh(field * 0.9);
      // Quantize into N stepped layers (like a sliced wood-relief panel)
      const L = Math.max(1, Math.floor(p.layers));
      const scaled = f * L;
      const layerIdx = Math.floor(scaled);
      const frac = scaled - layerIdx;
      // Rounded-top terrace: each layer rises with a half-cosine bulge then plateaus
      // sharpness: 0 → linear (smooth), 1 → near-step with rounded crown
      const k = 1 + p.layerSharpness * 8; // steepness of step transition
      const stepUp = 1 / (1 + Math.exp(-k * (frac - 0.25))); // sigmoid rise inside layer
      const crown =
        Math.sin(Math.min(1, Math.max(0, (frac - 0.25) / 0.75)) * Math.PI) *
        0.15 *
        (1 - p.layerSharpness * 0.5);
      h = (layerIdx + stepUp) / L + crown / L;
      break;
    }
    case "dunes":
    default: {
      const a =
        Math.sin(wu * fx + ph + s) * 0.6 +
        Math.sin((wu * 0.7 + wv * 1.3) * fy - ph * 0.4) * 0.4 +
        Math.sin(wv * fy * 0.6 + s * 2) * 0.3;
      const ridge = 1 - Math.abs(Math.sin(a * r * 0.6));
      h = 0.5 + 0.5 * (a * 0.5 + ridge * 0.5);
      break;
    }
  }
  // clamp
  if (h < 0) h = 0;
  if (h > 1) h = 1;
  return h;
}

/**
 * Per-position amplitude multiplier; smooth noise in (0, ∞), never 0 (avoids planar “dead” patches).
 * At heightVariance 0 returns 1. Uses 2^(centeredNoise * variance) so peaks can exceed stock Z.
 */
export function amplitudeScaleAt(u: number, v: number, p: WaveParams): number {
  if (p.heightVariance <= 0) return 1;
  const n = smoothNoise(u * 1.5 + 7.3, v * 1.5 - 3.1, p.seed);
  const centered = (n - 0.5) * 2; // [-1, 1]
  return Math.pow(2, centered * p.heightVariance);
}

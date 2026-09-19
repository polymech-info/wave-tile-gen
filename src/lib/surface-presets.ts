/** Preview-only material bundles (STL export ignores these). */

export type SurfaceTexturePreset = {
  id: string;
  name: string;
  roughness: number;
  metalness: number;
  /** When true, WavePreview blends height-based gradient with base color. */
  useHeightGradient: boolean;
  /** Multiplier on roughness from 0..1 slider (optional polish). */
  envMapIntensity?: number;
};

export const SURFACE_TEXTURE_PRESETS: SurfaceTexturePreset[] = [
  {
    id: "matte",
    name: "Matte clay",
    roughness: 0.92,
    metalness: 0,
    useHeightGradient: true,
  },
  {
    id: "wood",
    name: "Warm wood",
    roughness: 0.58,
    metalness: 0.04,
    useHeightGradient: true,
  },
  {
    id: "polished",
    name: "Polished",
    roughness: 0.28,
    metalness: 0.12,
    useHeightGradient: true,
    envMapIntensity: 0.35,
  },
  {
    id: "metal",
    name: "Brushed metal",
    roughness: 0.45,
    metalness: 0.85,
    useHeightGradient: false,
  },
  {
    id: "plastic",
    name: "Satin plastic",
    roughness: 0.5,
    metalness: 0,
    useHeightGradient: false,
  },
  {
    id: "marble",
    name: "Marble",
    roughness: 0.22,
    metalness: 0.02,
    useHeightGradient: true,
  },
];

export function getSurfacePreset(id: string): SurfaceTexturePreset {
  return SURFACE_TEXTURE_PRESETS.find((p) => p.id === id) ?? SURFACE_TEXTURE_PRESETS[0];
}

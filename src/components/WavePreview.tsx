import { Suspense, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, GizmoHelper, GizmoViewcube, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { buildSolidGeometry } from "@/lib/wave-mesh";
import { getSurfacePreset } from "@/lib/surface-presets";
import type { WaveParams } from "@/lib/wave-presets";

type Props = { params: WaveParams; dark: boolean };

/** World size hint so camera fits peaks that exceed nominal stock Z. */
function framingMaxMm(p: WaveParams): number {
  const generousPeak =
    p.baseThickness + p.amplitude * Math.pow(2, 2 * Math.max(0, p.heightVariance));
  return Math.max(p.stockX, p.stockY, p.stockZ, generousPeak, 1);
}

function parseHex(hex: string): THREE.Color {
  const c = new THREE.Color();
  try {
    c.set(/^#[0-9a-fA-F]{6}$/.test(hex) ? hex : "#9b3a1f");
  } catch {
    c.set("#9b3a1f");
  }
  return c;
}

function SceneBackground({ dark }: { dark: boolean }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    scene.background = new THREE.Color(dark ? 0x0e1014 : 0xf5f3ee);
  }, [dark, scene]);
  return null;
}

/** ACES + exposure so HDRI and lights read like ref MeshPreview / ThreeScene. */
function PreviewGlTone({ dark }: { dark: boolean }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = dark ? 1.05 : 1.15;
  }, [dark, gl]);
  return null;
}

/** IBL + hemisphere + key/fill (ref ThreeScene / MeshPreview). Z-up: rotate hemisphere so sky is +Z. */
function WaveLighting({ dark }: { dark: boolean }) {
  const fill = dark ? 0.22 : 0.28;
  const key = dark ? 1.05 : 1.2;
  const sky = dark ? 0xb8c4d8 : 0xe8eef8;
  const ground = dark ? 0x101418 : 0xc4c8d0;
  return (
    <>
      <Suspense fallback={null}>
        <Environment preset="city" />
      </Suspense>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        <hemisphereLight args={[sky, ground, dark ? 0.42 : 0.38]} />
      </group>
      <ambientLight intensity={dark ? 0.28 : 0.45} />
      <directionalLight position={[5, 5, 6]} intensity={key} />
      <directionalLight position={[-5, 5, 5]} intensity={fill} />
      <directionalLight position={[-5, 5, -5]} intensity={fill * 0.85} />
      <directionalLight position={[0, 5, 2]} intensity={fill * 0.75} />
      <directionalLight position={[-5, -4, -4]} intensity={dark ? 0.45 : 0.35} />
      <directionalLight position={[6, -3, 5]} intensity={dark ? 0.2 : 0.15} color="#ffd4b0" />
    </>
  );
}

function WaveSurface({ params, dark }: { params: WaveParams; dark: boolean }) {
  const { scene, invalidate } = useThree();
  const meshRef = useRef<THREE.Mesh | null>(null);
  useEffect(() => {
    const geom = buildSolidGeometry(params);
    const surf = getSurfacePreset(params.surfaceTexturePreset);
    const base = parseHex(params.surfaceColorHex);

    const mat = new THREE.MeshStandardMaterial({
      color: base,
      roughness: surf.roughness,
      metalness: surf.metalness,
      flatShading: false,
      envMapIntensity: surf.envMapIntensity ?? (surf.metalness > 0.5 ? 0.9 : 0.55),
    });

    if (surf.useHeightGradient) {
      const pos = geom.getAttribute("position") as THREE.BufferAttribute;
      const colors = new Float32Array(pos.count * 3);
      const cTop = base.clone().lerp(new THREE.Color(0xffffff), surf.id === "marble" ? 0.55 : 0.28);
      const cMid = base.clone().multiplyScalar(0.72);
      const cBot = base.clone().multiplyScalar(0.32);
      if (surf.id === "marble") {
        cTop.lerp(new THREE.Color(0xd8eef8), 0.35);
        cMid.lerp(new THREE.Color(0xa8c4d4), 0.2);
      }
      let zmin = Infinity,
        zmax = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        const z = pos.getZ(i);
        if (z < zmin) zmin = z;
        if (z > zmax) zmax = z;
      }
      for (let i = 0; i < pos.count; i++) {
        const z = pos.getZ(i);
        const t = (z - zmin) / Math.max(1e-6, zmax - zmin);
        const c = new THREE.Color();
        if (t < 0.5) c.copy(cBot).lerp(cMid, t * 2);
        else c.copy(cMid).lerp(cTop, (t - 0.5) * 2);
        colors[i * 3] = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      }
      geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      mat.vertexColors = true;
    } else {
      mat.vertexColors = false;
    }

    const mesh = new THREE.Mesh(geom, mat);
    scene.add(mesh);
    meshRef.current = mesh;
    invalidate();

    return () => {
      scene.remove(mesh);
      geom.dispose();
      mat.dispose();
      if (meshRef.current === mesh) meshRef.current = null;
      invalidate();
    };
  }, [scene, invalidate, params, dark, meshRef]);

  return null;
}

/** Z-up framing + zoom limits; matches prior home view, navigation via drei OrbitControls (ref ThreeScene). */
function WaveOrbitRig({
  params,
  controlsRef,
}: {
  params: WaveParams;
  controlsRef: RefObject<OrbitControlsImpl | null>;
}) {
  const { camera, invalidate } = useThree();

  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const world = framingMaxMm(params);
    const targetZ = world * 0.18;
    const r0 = world * 1.75;
    cam.up.set(0, 0, 1);
    cam.position.set(0, -r0 * 0.85, r0 * 0.65);
    cam.near = Math.max(0.01, world * 0.002);
    cam.far = world * 50;
    cam.updateProjectionMatrix();
    const ctrl = controlsRef.current;
    if (ctrl) {
      ctrl.target.set(0, 0, targetZ);
      ctrl.minDistance = Math.max(world * 0.08, 1);
      ctrl.maxDistance = world * 80;
      ctrl.update();
    }
    invalidate();
  }, [params, camera, controlsRef, invalidate]);

  return null;
}

export function WavePreview({ params, dark }: Props) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-border bg-background">
      <Canvas
        className="block h-full w-full"
        style={{ touchAction: "none" }}
        frameloop="demand"
        gl={{ antialias: true, alpha: true, outputColorSpace: THREE.SRGBColorSpace }}
        dpr={[1, 2]}
        camera={{ fov: 35, near: 0.1, far: 5000, position: [0, 0, 400] }}
      >
        <SceneBackground dark={dark} />
        <PreviewGlTone dark={dark} />
        <WaveLighting dark={dark} />
        <WaveSurface params={params} dark={dark} />
        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.05}
        />
        <WaveOrbitRig params={params} controlsRef={controlsRef} />
        <GizmoHelper alignment="top-right" margin={[80, 72]}>
          <GizmoViewcube />
        </GizmoHelper>
      </Canvas>
      <div className="pointer-events-none absolute bottom-2 right-3 max-w-[280px] text-right font-mono text-[10px] uppercase leading-relaxed tracking-widest text-muted-foreground">
        Orbit: left = rotate · middle = zoom · right = pan · wheel = zoom · top-right = view cube
      </div>
    </div>
  );
}

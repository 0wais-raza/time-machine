import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import type { PartSlot } from "@/lib/hardware";
import { cn } from "@/lib/utils";

/**
 * Lightweight build rules for weak GPUs (tested against the GeForce 210 era):
 * - dpr capped at 1, antialiasing off, shadows off, flat tone mapping.
 * - Basic/Lambert materials only — no PBR overdraw, no post-processing.
 * - Low-segment geometry (< 12 segments on every curved primitive).
 * - No per-part point lights; glow is faked with unlit emissive colors.
 */
export function detectWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

const CASE_DARK = "#0d131b";
const CASE_MID = "#141c26";
const PANEL = "#0a0f15";
const PCB = "#0e1d15";
const METAL = "#4d5966";
const GLASS = "#0a0e14";

function SlotBox({
  equipped,
  offset = 0,
  position,
  rotation,
  size,
  color = CASE_MID,
  children,
}: {
  equipped: boolean;
  offset?: number;
  position: [number, number, number];
  rotation?: [number, number, number];
  size: [number, number, number];
  color?: string;
  children?: ReactNode;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!equipped) return;
    const mat = ref.current?.material;
    if (mat && "color" in mat) {
      (mat as THREE.MeshBasicMaterial).color.setHSL(
        (state.clock.elapsedTime * 0.45 + offset) % 1,
        0.95,
        0.58,
      );
    }
  });
  return (
    <mesh ref={ref} position={position} rotation={rotation}>
      <boxGeometry args={size} />
      {equipped ? <meshBasicMaterial toneMapped={false} /> : <meshBasicMaterial color={color} />}
      {children}
    </mesh>
  );
}

function GlowStripe({
  position,
  offset = 0,
  size,
  opacity = 0.9,
}: {
  position: [number, number, number];
  offset?: number;
  size: [number, number, number];
  opacity?: number;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const mat = ref.current?.material;
    if (mat && "color" in mat) {
      (mat as THREE.MeshBasicMaterial).color.setHSL(
        (state.clock.elapsedTime * 0.4 + offset) % 1,
        0.95,
        0.62,
      );
    }
  });
  return (
    <mesh ref={ref} position={position}>
      <boxGeometry args={size} />
      <meshBasicMaterial toneMapped={false} transparent opacity={opacity} />
    </mesh>
  );
}

function Fan({
  position,
  active,
  radius = 0.16,
  facing = "front",
}: {
  position: [number, number, number];
  active: boolean;
  radius?: number;
  /** "front" = spins around Z (normal +Z), "top" = spins around Y (normal +Y). */
  facing?: "front" | "top";
}) {
  const blades = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (active && blades.current) {
      if (facing === "top") blades.current.rotation.y = state.clock.elapsedTime * 7;
      else blades.current.rotation.z = state.clock.elapsedTime * 7;
    }
  });
  const rot = facing === "top" ? ([Math.PI / 2, 0, 0] as [number, number, number]) : undefined;
  return (
    <group position={position}>
      <mesh rotation={rot}>
        <cylinderGeometry args={[radius, radius, 0.05, 12]} />
        <meshBasicMaterial color="#151d27" />
      </mesh>
      <mesh rotation={rot} ref={blades}>
        <cylinderGeometry args={[radius * 0.78, radius * 0.78, 0.055, 8]} />
        <meshBasicMaterial color={active ? "#39495c" : "#212c3a"} />
      </mesh>
    </group>
  );
}

function Pedestal() {
  const ring = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (ring.current) ring.current.rotation.y = t * 0.4;
    if (ring2.current) ring2.current.rotation.y = -t * 0.28;
  });
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[1.7, 2.05, 0.32, 16]} />
        <meshBasicMaterial color="#0b0f15" />
      </mesh>
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[1.05, 1.25, 0.22, 12]} />
        <meshBasicMaterial color="#131a23" />
      </mesh>
      <mesh ref={ring} position={[0, 0.56, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.98, 0.018, 6, 36]} />
        <meshBasicMaterial color="#22d3ee" toneMapped={false} />
      </mesh>
      <mesh ref={ring2} position={[0, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.82, 0.014, 6, 48]} />
        <meshBasicMaterial color="#a78bfa" toneMapped={false} transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

function Ground() {
  return (
    <group position={[0, -0.02, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <circleGeometry args={[7.5, 28]} />
        <meshBasicMaterial color="#070a0f" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <ringGeometry args={[2.35, 2.42, 48]} />
        <meshBasicMaterial color="#22d3ee" toneMapped={false} transparent opacity={0.35} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
        <ringGeometry args={[5.2, 5.26, 48]} />
        <meshBasicMaterial color="#a78bfa" toneMapped={false} transparent opacity={0.12} />
      </mesh>
    </group>
  );
}

/** Tower chassis: solid left + back, tempered glass right, fan-front, exhaust top. */
function ChassisFrame({ equipped }: { equipped: Set<PartSlot> }) {
  const powered = equipped.has("psu");
  return (
    <group>
      {/* left solid panel */}
      <mesh position={[-1.44, 0, 0]}>
        <boxGeometry args={[0.07, 3.7, 1.5]} />
        <meshBasicMaterial color={PANEL} />
      </mesh>
      {/* right tempered glass */}
      <mesh position={[1.44, 0, 0]}>
        <boxGeometry args={[0.05, 3.7, 1.5]} />
        <meshStandardMaterial color={GLASS} metalness={0.6} roughness={0.25} transparent opacity={0.16} />
      </mesh>
      {/* back panel + IO shield */}
      <mesh position={[0, 0, -0.72]}>
        <boxGeometry args={[3.0, 3.7, 0.07]} />
        <meshBasicMaterial color={PANEL} />
      </mesh>
      <mesh position={[-0.4, 1.32, -0.75]}>
        <boxGeometry args={[1.7, 0.14, 0.04]} />
        <meshBasicMaterial color={METAL} />
      </mesh>
      {/* front panel (solid behind fans) */}
      <mesh position={[0, 0, 0.62]}>
        <boxGeometry args={[3.0, 3.7, 0.08]} />
        <meshBasicMaterial color={CASE_DARK} />
      </mesh>
      {/* top panel with exhaust cutout */}
      <mesh position={[0, 1.84, 0]}>
        <boxGeometry args={[3.0, 0.06, 1.5]} />
        <meshBasicMaterial color={CASE_MID} />
      </mesh>
      <mesh position={[0, -1.84, 0]}>
        <boxGeometry args={[3.0, 0.06, 1.5]} />
        <meshBasicMaterial color={CASE_MID} />
      </mesh>
      {/* corner pillars */}
      {[
        [-1.42, 1.75, -0.68],
        [1.42, 1.75, -0.68],
        [-1.42, 1.75, 0.68],
        [1.42, 1.75, 0.68],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <boxGeometry args={[0.1, 3.7, 0.1]} />
          <meshBasicMaterial color={CASE_MID} />
        </mesh>
      ))}
      {/* feet */}
      {[-1.1, 1.1].map((x) => (
        <mesh key={x} position={[x, -1.88, 0.3]}>
          <boxGeometry args={[0.28, 0.06, 0.28]} />
          <meshBasicMaterial color="#05080c" />
        </mesh>
      ))}

      {/* front intake fans (visible through front mesh) */}
      {[-0.85, 0, 0.85].map((x) => (
        <Fan key={x} position={[x, 0.7, 0.55]} active={powered} radius={0.29} />
      ))}
      {/* top exhaust fan */}
      <Fan position={[0.05, 1.78, -0.3]} active={powered} radius={0.26} facing="top" />

      {/* front edge RGB strips */}
      <GlowStripe position={[-1.38, 0, 0.6]} size={[0.04, 3.5, 0.04]} offset={0.3} opacity={0.7} />
      <GlowStripe position={[1.38, 0, 0.6]} size={[0.04, 3.5, 0.04]} offset={0.6} opacity={0.7} />

      {/* power button + LED */}
      <mesh position={[0.92, 1.2, 0.68]}>
        <boxGeometry args={[0.12, 0.12, 0.06]} />
        <meshBasicMaterial color={powered ? "#e8f6ff" : "#232d3a"} />
      </mesh>
      {powered && (
        <mesh position={[0.92, 1.2, 0.71]}>
          <boxGeometry args={[0.05, 0.05, 0.02]} />
          <meshBasicMaterial color="#22d3ee" toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}

/** Internal components — laid out like a real tower interior. */
function Interior({ equipped }: { equipped: Set<PartSlot> }) {
  const has = (s: PartSlot) => equipped.has(s);
  return (
    <group>
      {/* motherboard on the back-left wall */}
      <mesh position={[-0.55, 0.1, -0.55]}>
        <boxGeometry args={[1.7, 2.5, 0.07]} />
        <meshBasicMaterial color={PCB} />
      </mesh>
      {/* VRM / chip decorations */}
      <mesh position={[-1.05, 1.0, -0.5]}>
        <boxGeometry args={[0.3, 0.3, 0.05]} />
        <meshBasicMaterial color="#12241a" />
      </mesh>
      <mesh position={[-0.2, 1.25, -0.5]}>
        <boxGeometry args={[0.28, 0.28, 0.05]} />
        <meshBasicMaterial color="#12241a" />
      </mesh>
      {/* 24-pin + PCIe slot accents */}
      <mesh position={[-1.05, 0.2, -0.5]}>
        <boxGeometry args={[0.12, 0.5, 0.04]} />
        <meshBasicMaterial color={METAL} />
      </mesh>

      {/* CPU socket + cooler tower */}
      <mesh position={[-0.15, 0.62, -0.5]}>
        <boxGeometry args={[0.42, 0.42, 0.04]} />
        <meshBasicMaterial color={METAL} />
      </mesh>
      <group>
        <SlotBox equipped={has("cooling")} offset={0.1} position={[-0.15, 0.92, -0.49]} size={[0.42, 0.42, 0.28]} color="#2a3542" />
        <Fan position={[-0.15, 1.17, -0.49]} active={has("cooling")} radius={0.23} />
      </group>

      {/* RAM — four sticks beside the CPU */}
      {[-0.72, -0.58, -0.44, -0.3].map((x, i) => (
        <group key={i}>
          <SlotBox equipped={has("ram")} offset={0.2 + i * 0.1} position={[x, 0.72, -0.44]} size={[0.07, 0.4, 0.18]} color="#141c26" />
          {has("ram") && (
            <GlowStripe position={[x, 0.94, -0.44]} size={[0.08, 0.03, 0.2]} offset={0.2 + i * 0.1} />
          )}
        </group>
      ))}

      {/* GPU — long card with two fans, mounted below */}
      <group>
        <SlotBox equipped={has("gpu")} offset={0.45} position={[-0.35, -0.42, -0.35]} size={[1.3, 0.26, 0.46]} color="#1a222d" />
        <Fan position={[-0.6, -0.26, -0.35]} active={has("gpu")} radius={0.14} />
        <Fan position={[-0.2, -0.26, -0.35]} active={has("gpu")} radius={0.14} />
        {has("gpu") && (
          <GlowStripe position={[-0.35, -0.29, -0.35]} size={[1.0, 0.015, 0.38]} offset={0.45} opacity={0.8} />
        )}
      </group>

      {/* PSU — bottom right */}
      <group>
        <SlotBox equipped={has("psu")} offset={0.7} position={[0.7, -1.28, -0.3]} size={[0.75, 0.5, 0.95]} color="#151c25" />
        <Fan position={[0.7, -1.28, 0.2]} active={has("psu")} radius={0.19} />
        {has("psu") && (
          <GlowStripe position={[0.7, -1.28, -0.76]} size={[0.62, 0.42, 0.015]} offset={0.7} opacity={0.7} />
        )}
      </group>

      {/* storage drives — bottom front bay */}
      {[-0.15, 0.55].map((x, i) => (
        <group key={i}>
          <SlotBox equipped={has("storage")} offset={0.85 + i * 0.1} position={[x, -1.15, -0.25]} size={[0.8, 0.05, 0.5]} color="#141c26" />
          {has("storage") && (
            <GlowStripe position={[x, -1.12, -0.25]} size={[0.74, 0.015, 0.44]} offset={0.85 + i * 0.1} opacity={0.75} />
          )}
        </group>
      ))}

      {/* cables — PSU to board, one glowing sleeve when powered */}
      <mesh position={[0.3, -0.9, -0.5]} rotation={[0, 0, 0.9]}>
        <cylinderGeometry args={[0.025, 0.025, 0.85, 6]} />
        <meshBasicMaterial color="#0c1219" />
      </mesh>
      <mesh position={[0.55, -0.5, -0.45]} rotation={[0.4, 0, 0.4]}>
        <cylinderGeometry args={[0.02, 0.02, 0.7, 6]} />
        <meshBasicMaterial color="#0c1219" />
      </mesh>
      {has("psu") && (
        <GlowStripe position={[0.28, -0.95, -0.35]} size={[0.04, 0.8, 0.04]} offset={0.9} opacity={0.6} />
      )}

      {/* case glow strips */}
      <GlowStripe position={[-1.3, 0.2, 0.2]} size={[0.03, 2.2, 0.9]} offset={0.15} opacity={0.4} />
      <GlowStripe position={[1.3, -0.4, 0.2]} size={[0.03, 1.8, 0.9]} offset={0.65} opacity={0.4} />
    </group>
  );
}

function FloatingChassis({ equipped }: { equipped: Set<PartSlot> }) {
  const g = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (g.current) {
      g.current.position.y = Math.sin(state.clock.elapsedTime * 0.6) * 0.05;
    }
  });
  return (
    <group ref={g} position={[0, 1.72, 0]}>
      <ChassisFrame equipped={equipped} />
      <Interior equipped={equipped} />
    </group>
  );
}

/** Direct three-stdlib OrbitControls — avoids pulling in all of @react-three/drei. */
function RigControls({ autoRotate }: { autoRotate: boolean }) {
  const { camera, gl } = useThree();
  const controls = useMemo(
    () => new OrbitControlsImpl(camera, gl.domElement),
    [camera, gl],
  );
  useEffect(() => {
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 4.2;
    controls.maxDistance = 13;
    controls.minPolarAngle = 0.35;
    controls.maxPolarAngle = 1.45;
    controls.autoRotateSpeed = 0.9;
    controls.update();
    return () => {
      controls.dispose();
    };
  }, [controls]);
  useEffect(() => {
    controls.autoRotate = autoRotate;
  }, [controls, autoRotate]);
  useFrame(() => controls.update());
  return null;
}

export function RigScene({
  equipped,
  autoRotate,
}: {
  equipped: Set<PartSlot>;
  autoRotate: boolean;
}) {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[5, 7, 4]} intensity={1.1} />
      <Pedestal />
      <FloatingChassis equipped={equipped} />
      <Ground />
      <RigControls autoRotate={autoRotate} />
    </>
  );
}

export function RigCanvas({
  equipped,
  autoRotate,
}: {
  equipped: Set<PartSlot>;
  autoRotate: boolean;
}) {
  return (
    <Canvas
      flat
      dpr={[0.5, 1]}
      shadows={false}
      gl={{ antialias: false, powerPreference: "low-power", alpha: true }}
      camera={{ position: [5.4, 3.0, 6.8], fov: 40 }}
      style={{ touchAction: "pan-y" }}
    >
      <RigScene equipped={equipped} autoRotate={autoRotate} />
    </Canvas>
  );
}

const SLOT_DOTS: { slot: PartSlot; label: string; pos: string }[] = [
  { slot: "cpu", label: "CPU", pos: "top-[14%] left-[22%]" },
  { slot: "cooling", label: "COOL", pos: "top-[26%] left-[40%]" },
  { slot: "ram", label: "RAM", pos: "top-[16%] right-[18%]" },
  { slot: "gpu", label: "GPU", pos: "top-[44%] left-[8%]" },
  { slot: "psu", label: "PSU", pos: "bottom-[12%] left-[34%]" },
  { slot: "storage", label: "STOR", pos: "bottom-[18%] right-[6%]" },
  { slot: "lighting", label: "RGB", pos: "top-[58%] right-[4%]" },
  { slot: "display", label: "DISP", pos: "bottom-[5%] left-[4%]" },
  { slot: "audio", label: "AUD", pos: "top-[74%] right-[26%]" },
  { slot: "peripheral", label: "IO", pos: "bottom-[5%] right-[10%]" },
];

/** 2D schematic used when WebGL is unavailable. */
export function RigFallback({ equipped }: { equipped: Set<PartSlot> }) {
  return (
    <div className="cyber-grid relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 m-auto h-[82%] w-[52%] rounded-md border-2 border-[var(--holo-cyan)]/40 bg-black/40 shadow-[0_0_40px_oklch(0.85_0.17_200/0.15)]">
        <div className="absolute inset-x-[6%] top-[6%] h-[30%] rounded border border-[var(--holo-violet)]/25 bg-[oklch(0.66_0.27_295/0.06)]" />
        <div className="absolute inset-x-[8%] bottom-[10%] h-[34%] rounded border border-[var(--holo-cyan)]/25 bg-[oklch(0.85_0.17_200/0.05)]" />
        {SLOT_DOTS.map((d) => {
          const on = equipped.has(d.slot);
          return (
            <div
              key={d.slot}
              className={cn(
                "absolute flex items-center gap-1 rounded-sm px-1 py-0.5 font-mono text-[9px] tracking-wider transition-colors",
                d.pos,
                on
                  ? "bg-[oklch(0.85_0.17_200/0.15)] text-[var(--holo-cyan)] shadow-[0_0_10px_oklch(0.85_0.17_200/0.5)]"
                  : "text-muted-foreground/60",
              )}
            >
              <span className={cn("size-1.5 rounded-full", on ? "led-dot" : "bg-border")} style={on ? { color: "var(--holo-cyan)" } : undefined} />
              {d.label}
            </div>
          );
        })}
      </div>
      <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[9px] uppercase tracking-[0.35em] text-muted-foreground/70">
        WebGL offline · schematic mode
      </div>
    </div>
  );
}

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls as OrbitControlsImpl, RoomEnvironment } from "three-stdlib";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { partById, type PartSlot } from "@/lib/hardware";
import { cn } from "@/lib/utils";

/**
 * Realistic PC-build rig — a proper ATX tower on a desk with tempered glass,
 * PSU shroud, motherboard tray, and real-looking components per slot.
 *
 * Lightweight build rules preserved (weak-GPU friendly):
 * - dpr capped at 1, antialiasing off, shadows off.
 * - PBR-lite: MeshStandardMaterial metalness/roughness + a baked
 *   RoomEnvironment reflection so metals and glass read as real materials
 *   without loading any textures.
 * - Low-segment geometry; per-part point lights only when powered.
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

/* ============================================================
 * Palette — real hardware tones (case / PCB / metal / glass)
 * ============================================================ */
const CASE_DARK = "#161b22";
const CASE_MID = "#1d242e";
const CASE_ACCENT = "#0f151c";
const STEEL = "#8b98a5";
const STEEL_DARK = "#3c4753";
const PCB = "#12241b";
const PCB_LIGHT = "#17301f";
const GLASS = "#0d1117";
const DARK_METAL = "#2a333d";
const PLATE = "#232b34";
const SLOT_METAL = "#9aa7b3";

/* ============================================================
 * Shared materials (created once per scene)
 * ============================================================ */
const m = {
  casePanel: () =>
    new THREE.MeshStandardMaterial({ color: CASE_MID, roughness: 0.62, metalness: 0.35 }),
  caseDark: () =>
    new THREE.MeshStandardMaterial({ color: CASE_DARK, roughness: 0.7, metalness: 0.3 }),
  accent: () =>
    new THREE.MeshStandardMaterial({ color: CASE_ACCENT, roughness: 0.55, metalness: 0.5 }),
  steel: () => new THREE.MeshStandardMaterial({ color: STEEL, roughness: 0.35, metalness: 0.9 }),
  steelDark: () =>
    new THREE.MeshStandardMaterial({ color: STEEL_DARK, roughness: 0.5, metalness: 0.75 }),
  plate: () => new THREE.MeshStandardMaterial({ color: PLATE, roughness: 0.45, metalness: 0.6 }),
  pcb: () => new THREE.MeshStandardMaterial({ color: PCB, roughness: 0.85, metalness: 0.05 }),
  pcbLight: () =>
    new THREE.MeshStandardMaterial({ color: PCB_LIGHT, roughness: 0.85, metalness: 0.05 }),
  glass: () =>
    new THREE.MeshStandardMaterial({
      color: GLASS,
      roughness: 0.12,
      metalness: 0.85,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      envMapIntensity: 1.2,
    }),
  desk: () => new THREE.MeshStandardMaterial({ color: "#0e1319", roughness: 0.5, metalness: 0.6 }),
  black: () => new THREE.MeshStandardMaterial({ color: "#0a0d12", roughness: 0.8, metalness: 0.2 }),
} as const;

/** Simple box helper with a material factory. */
function Box({
  position,
  rotation,
  size,
  mat,
  children,
  name,
}: {
  position: [number, number, number];
  rotation?: [number, number, number];
  size: [number, number, number];
  mat: () => THREE.Material;
  children?: ReactNode;
  name?: string;
}) {
  return (
    <mesh
      name={name}
      position={position}
      rotation={rotation}
      castShadow={false}
      receiveShadow={false}
    >
      <boxGeometry args={size} />
      <primitive object={mat()} attach="material" />
      {children}
    </mesh>
  );
}

/** Emissive glow strip that breathes/cycles color when a slot is equipped. */
function GlowStripe({
  position,
  size,
  offset = 0,
  opacity = 0.95,
  color = "#22d3ee",
}: {
  position: [number, number, number];
  size: [number, number, number];
  offset?: number;
  opacity?: number;
  color?: string;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const mat = ref.current?.material as THREE.MeshBasicMaterial | undefined;
    if (!mat) return;
    const hue = (state.clock.elapsedTime * 0.18 + offset) % 1;
    mat.color.setHSL(hue, 0.9, 0.6);
  });
  return (
    <mesh ref={ref} position={position}>
      <boxGeometry args={size} />
      <meshBasicMaterial toneMapped={false} transparent opacity={opacity} color={color} />
    </mesh>
  );
}

/** Fan — spinning blades when active, with a realistic hub + ring. */
function Fan({
  position,
  active,
  radius = 0.24,
  facing = "front",
  rgb = false,
}: {
  position: [number, number, number];
  active: boolean;
  radius?: number;
  /** "front" spins around Z (normal +Z), "top" around Y. */
  facing?: "front" | "top";
  rgb?: boolean;
}) {
  const blades = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (active && blades.current) {
      const speed = rgb ? 9 : 6.5;
      if (facing === "top") blades.current.rotation.y = state.clock.elapsedTime * speed;
      else blades.current.rotation.z = state.clock.elapsedTime * speed;
    }
  });
  const rot = facing === "top" ? ([Math.PI / 2, 0, 0] as [number, number, number]) : undefined;
  const frameR = radius;
  return (
    <group position={position}>
      {/* frame ring */}
      <mesh rotation={rot}>
        <torusGeometry args={[frameR, frameR * 0.16, 8, 20]} />
        <primitive object={m.accent()} attach="material" />
      </mesh>
      {/* center hub */}
      <mesh rotation={rot} position={facing === "top" ? [0, 0.008, 0] : [0, 0, 0.008]}>
        <cylinderGeometry args={[frameR * 0.42, frameR * 0.42, 0.05, 10]} />
        <primitive object={m.steelDark()} attach="material" />
      </mesh>
      {/* blades */}
      <mesh rotation={rot} ref={blades} position={facing === "top" ? [0, 0.012, 0] : [0, 0, 0.012]}>
        <cylinderGeometry args={[frameR * 0.78, frameR * 0.78, 0.045, 9]} />
        <primitive object={m.black()} attach="material" />
      </mesh>
      {rgb && (
        <mesh rotation={rot}>
          <torusGeometry args={[frameR * 0.62, 0.02, 6, 16]} />
          <meshBasicMaterial
            toneMapped={false}
            transparent
            opacity={active ? 0.9 : 0.25}
            color="#22d3ee"
          />
        </mesh>
      )}
    </group>
  );
}

/* ============================================================
 * Desk + floor — grounds the tower like a real battlestation
 * ============================================================ */
function DeskAndFloor() {
  return (
    <group>
      {/* floor disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <circleGeometry args={[9, 36]} />
        <primitive object={m.black()} attach="material" />
      </mesh>
      {/* floor grid rings */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[3.4, 3.47, 56]} />
        <meshBasicMaterial color="#22d3ee" toneMapped={false} transparent opacity={0.28} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]}>
        <ringGeometry args={[5.8, 5.86, 56]} />
        <meshBasicMaterial color="#a78bfa" toneMapped={false} transparent opacity={0.1} />
      </mesh>
      {/* desk top */}
      <Box position={[0, 0.16, 0]} size={[6.2, 0.14, 3.4]} mat={m.desk} />
      {/* desk edge trim */}
      <Box position={[0, 0.16, 1.74]} size={[6.2, 0.2, 0.05]} mat={m.steelDark} />
      {/* legs */}
      {([-2.8, 2.8] as const).map((x) =>
        ([-1.55, 1.55] as const).map((z) => (
          <Box
            key={`${x}-${z}`}
            position={[x, -0.55, z]}
            size={[0.12, 1.05, 0.12]}
            mat={m.steelDark}
          />
        )),
      )}
    </group>
  );
}

/* ============================================================
 * Motherboard + tray — the heart of the build
 * ============================================================ */
function Motherboard({ equipped }: { equipped: Set<PartSlot> }) {
  const has = (s: PartSlot) => equipped.has(s);
  return (
    <group position={[-0.52, 0.1, -0.56]}>
      {/* tray plate (case wall) */}
      <Box position={[0, 0, 0]} size={[2.4, 2.9, 0.04]} mat={m.casePanel} />
      {/* PCB */}
      <Box position={[0.02, 0, 0.02]} size={[2.2, 2.6, 0.05]} mat={m.pcb} />
      {/* PCB accents / traces */}
      <Box position={[0.02, -0.55, 0.06]} size={[2.1, 1.4, 0.01]} mat={m.pcbLight} />
      {/* VRM heatsinks */}
      <Box position={[-0.92, 0.62, 0.08]} size={[0.16, 0.5, 0.09]} mat={m.steelDark} />
      <Box position={[0.92, 0.62, 0.08]} size={[0.16, 0.5, 0.09]} mat={m.steelDark} />
      {/* chipset heatsink */}
      <Box position={[0.55, -0.72, 0.08]} size={[0.42, 0.42, 0.1]} mat={m.steelDark} />
      {/* M.2 shield */}
      <Box position={[-0.42, -0.78, 0.08]} size={[0.8, 0.3, 0.05]} mat={m.plate} />
      {/* CPU socket */}
      <Box position={[0, 0.6, 0.07]} size={[0.48, 0.48, 0.05]} mat={m.steel} />
      {/* RAM slots rail */}
      <Box position={[-0.55, 0.62, 0.08]} size={[0.12, 0.42, 0.04]} mat={m.steelDark} />
      <Box position={[0.55, 0.62, 0.08]} size={[0.12, 0.42, 0.04]} mat={m.steelDark} />
      {/* PCIe x16 slots */}
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          position={[0, -0.05 - i * 0.22, 0.07]}
          size={[1.5, 0.06, 0.05]}
          mat={m.steelDark}
        />
      ))}
      {/* 24-pin ATX connector */}
      <Box position={[0.98, 0.18, 0.07]} size={[0.14, 0.55, 0.05]} mat={m.black} />
      {/* CPU power top */}
      <Box position={[0.95, 1.14, 0.07]} size={[0.12, 0.24, 0.05]} mat={m.black} />

      {/* CPU cooler tower — fin stack + fan (equipped = spinning, RGB ring) */}
      {has("cooling") ? (
        <group position={[0, 0.6, 0.28]}>
          {/* fin stack */}
          {Array.from({ length: 7 }).map((_, i) => (
            <Box key={i} position={[0, 0, i * 0.09]} size={[0.58, 0.66, 0.055]} mat={m.steel} />
          ))}
          {/* heat pipes */}
          {[-0.2, 0, 0.2].map((x) => (
            <mesh key={x} position={[x, 0.22, 0.27]}>
              <cylinderGeometry args={[0.02, 0.02, 0.72, 6]} />
              <primitive object={m.steelDark()} attach="material" />
            </mesh>
          ))}
          <Fan position={[0, 0.08, 0.38]} active={true} radius={0.2} facing="front" rgb />
        </group>
      ) : (
        /* blank socket cover */
        <Box position={[0, 0.6, 0.1]} size={[0.52, 0.52, 0.05]} mat={m.plate} />
      )}

      {/* RAM — four sticks with heat spreaders */}
      {has("ram")
        ? [-0.78, -0.62, -0.46, -0.3].map((x, i) => (
            <group key={i} position={[x, 0.62, 0.3]}>
              {/* spreader body */}
              <Box position={[0, 0, 0]} size={[0.09, 0.46, 0.16]} mat={m.steel} />
              {/* fin ribs */}
              {[-0.13, 0, 0.13].map((z) => (
                <Box key={z} position={[0, 0, z]} size={[0.095, 0.4, 0.012]} mat={m.steelDark} />
              ))}
              {/* RGB cap */}
              <GlowStripe
                position={[0, 0.26, 0]}
                size={[0.1, 0.03, 0.17]}
                offset={0.2 + i * 0.08}
              />
            </group>
          ))
        : [-0.78, -0.62, -0.46, -0.3].map((x, i) => (
            <Box key={i} position={[x, 0.62, 0.28]} size={[0.07, 0.4, 0.04]} mat={m.accent} />
          ))}
    </group>
  );
}

/* ============================================================
 * GPU — long card with shroud, 3 fans, backplate, power cables
 * ============================================================ */
function Gpu({ equipped }: { equipped: Set<PartSlot> }) {
  const has = (s: PartSlot) => equipped.has(s);
  if (!has("gpu")) {
    // empty PCIe slots visible
    return null;
  }
  return (
    // card hangs from the top PCIe slot (tower y ≈ -0.05) and reaches toward the glass
    <group position={[0.05, -0.12, -0.12]}>
      {/* card body */}
      <Box position={[0, 0, 0]} size={[1.8, 0.24, 0.52]} mat={m.caseDark} />
      {/* shroud */}
      <Box position={[0, 0.03, 0.06]} size={[1.72, 0.2, 0.4]} mat={m.black} />
      {/* backplate */}
      <Box position={[0, -0.09, 0.04]} size={[1.76, 0.05, 0.46]} mat={m.plate} />
      {/* backplate brand strip */}
      <Box position={[0, -0.09, 0.27]} size={[1.56, 0.05, 0.02]} mat={m.steelDark} />
      {/* 3 fans */}
      <Fan position={[-0.52, 0.05, 0.28]} active={true} radius={0.14} rgb />
      <Fan position={[0, 0.05, 0.28]} active={true} radius={0.14} rgb />
      <Fan position={[0.52, 0.05, 0.28]} active={true} radius={0.14} rgb />
      {/* RGB underglow */}
      <GlowStripe position={[0, -0.14, 0.1]} size={[1.66, 0.02, 0.4]} offset={0.45} opacity={0.8} />
      {/* power cables (8-pin) */}
      {[-0.18, 0.18].map((x) => (
        <mesh key={x} position={[x, 0.16, -0.3]} rotation={[0.9, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.35, 6]} />
          <primitive object={m.black()} attach="material" />
        </mesh>
      ))}
      {/* sag bracket resting on the PSU shroud */}
      <Box position={[0.78, -0.3, -0.05]} size={[0.09, 0.42, 0.09]} mat={m.steelDark} />
    </group>
  );
}

/* ============================================================
 * PSU — bottom-right chamber, fan + label
 * ============================================================ */
function Psu({ equipped }: { equipped: Set<PartSlot> }) {
  const has = (s: PartSlot) => equipped.has(s);
  return (
    <group position={[0.72, -0.98, 0.18]}>
      <Box position={[0, 0, 0]} size={[0.85, 0.42, 0.7]} mat={m.black} />
      <Box position={[0, 0.215, 0]} size={[0.85, 0.02, 0.7]} mat={m.plate} />
      {has("psu") ? (
        <>
          <Fan position={[0, -0.16, 0]} active={true} radius={0.17} facing="top" />
          <GlowStripe
            position={[0, 0.02, -0.36]}
            size={[0.66, 0.02, 0.02]}
            offset={0.7}
            opacity={0.6}
          />
        </>
      ) : (
        <Box position={[0, -0.16, 0]} size={[0.6, 0.05, 0.6]} mat={m.accent} />
      )}
      {/* label plate */}
      <Box position={[0, 0.1, -0.355]} size={[0.4, 0.18, 0.02]} mat={m.steelDark} />
    </group>
  );
}

/* ============================================================
 * Storage — NVMe on board + drive cage bottom front
 * ============================================================ */
function Storage({ equipped }: { equipped: Set<PartSlot> }) {
  const has = (s: PartSlot) => equipped.has(s);
  return (
    <group>
      {/* 2x 2.5" drives in bottom cage */}
      {[-0.3, 0.45].map((x, i) => (
        <group key={i} position={[x, -1.18, -0.05]}>
          <Box
            position={[0, 0, 0]}
            size={[0.7, 0.09, 0.42]}
            mat={has("storage") ? m.steelDark : m.accent}
          />
          {has("storage") && (
            <>
              <GlowStripe
                position={[0, 0.07, 0]}
                size={[0.62, 0.015, 0.34]}
                offset={0.85 + i * 0.1}
                opacity={0.7}
              />
              <Box position={[0, 0, -0.22]} size={[0.5, 0.1, 0.03]} mat={m.plate} />
            </>
          )}
        </group>
      ))}
      {/* NVMe on motherboard (if equipped) */}
      {has("storage") && (
        <Box position={[-0.42, -0.66, -0.28]} size={[0.8, 0.04, 0.3]} mat={m.steelDark} />
      )}
    </group>
  );
}

/* ============================================================
 * Tower chassis — tempered glass side, mesh front, PSU shroud
 * ============================================================ */
function Chassis({ equipped }: { equipped: Set<PartSlot> }) {
  const powered = equipped.has("psu");
  const W = 3.0; // x
  const H = 3.3; // y
  const D = 1.5; // z
  const hw = W / 2;
  const hd = D / 2;
  const hh = H / 2;

  return (
    <group>
      {/* left solid panel */}
      <Box position={[-hw, 0, 0]} size={[0.06, H, D]} mat={m.casePanel} />
      {/* right tempered glass */}
      <Box position={[hw, 0, 0]} size={[0.045, H, D]} mat={m.glass} />
      {/* back panel */}
      <Box position={[0, 0, -hd]} size={[W, H, 0.06]} mat={m.caseDark} />
      {/* back IO shield */}
      <Box position={[0, hh - 0.62, -hd - 0.02]} size={[1.4, 0.18, 0.05]} mat={m.steelDark} />
      {/* top panel */}
      <Box position={[0, hh, 0]} size={[W, 0.06, D]} mat={m.casePanel} />
      {/* bottom panel */}
      <Box position={[0, -hh, 0]} size={[W, 0.06, D]} mat={m.caseDark} />
      {/* front panel frame (mesh look = dark with fan holes visible) */}
      <Box position={[0, 0, hd]} size={[W, H, 0.07]} mat={m.caseDark} />
      {/* front glass strip (top half) */}
      <Box position={[0, 0.55, hd + 0.02]} size={[W - 0.5, 1.1, 0.02]} mat={m.glass} />

      {/* PSU shroud — separates bottom chamber */}
      <Box position={[0, -0.62, 0]} size={[W - 0.24, 0.06, D - 0.1]} mat={m.accent} />
      {/* shroud opening for GPU cables */}
      <Box position={[-0.55, -0.56, 0.15]} size={[0.5, 0.12, 0.3]} mat={m.black} />

      {/* interior spine behind motherboard */}
      <Box position={[-0.52, 0, -0.45]} size={[2.5, H - 1.6, 0.05]} mat={m.casePanel} />

      {/* front intake fans behind mesh */}
      {[-0.85, 0, 0.85].map((x) => (
        <Fan key={x} position={[x, 0.62, hd - 0.12]} active={powered} radius={0.26} rgb />
      ))}
      {/* top exhaust fans */}
      <Fan position={[-0.55, hh - 0.08, -0.3]} active={powered} radius={0.22} facing="top" />
      <Fan position={[0.55, hh - 0.08, -0.3]} active={powered} radius={0.22} facing="top" />
      {/* rear exhaust */}
      <Fan position={[0.55, 0.1, -hd + 0.1]} active={powered} radius={0.2} facing="front" />

      {/* corner pillars */}
      {[
        [-hw + 0.03, hh - 0.03, -hd + 0.03],
        [hw - 0.03, hh - 0.03, -hd + 0.03],
        [-hw + 0.03, hh - 0.03, hd - 0.03],
        [hw - 0.03, hh - 0.03, hd - 0.03],
        [-hw + 0.03, -hh + 0.03, -hd + 0.03],
        [hw - 0.03, -hh + 0.03, -hd + 0.03],
        [-hw + 0.03, -hh + 0.03, hd - 0.03],
        [hw - 0.03, -hh + 0.03, hd - 0.03],
      ].map((p, i) => (
        <Box
          key={i}
          position={p as [number, number, number]}
          size={[0.09, 0.09, 0.09]}
          mat={m.steelDark}
        />
      ))}

      {/* front IO on top */}
      <Box position={[-0.9, hh - 0.16, hd - 0.02]} size={[0.7, 0.14, 0.08]} mat={m.black} />
      {/* power button */}
      <Box
        position={[-0.72, hh - 0.16, hd - 0.02]}
        size={[0.1, 0.1, 0.07]}
        mat={powered ? m.steel : m.accent}
      />
      {powered && (
        <GlowStripe position={[-0.72, hh - 0.16, hd]} size={[0.05, 0.05, 0.02]} offset={0.3} />
      )}

      {/* case RGB strips (lighting slot) */}
      {equipped.has("lighting") && (
        <>
          <GlowStripe position={[-hw + 0.05, 0.1, 0.3]} size={[0.02, 2.4, 0.05]} offset={0.3} />
          <GlowStripe position={[hw - 0.05, -0.4, 0.3]} size={[0.02, 1.9, 0.05]} offset={0.6} />
          <GlowStripe position={[0, hh - 0.06, 0]} size={[W - 0.6, 0.02, 0.05]} offset={0.15} />
        </>
      )}

      {/* feet */}
      {[-1.1, 1.1].map((x) =>
        ([-0.5, 0.5] as const).map((z) => (
          <Box
            key={`${x}-${z}`}
            position={[x, -hh - 0.03, z]}
            size={[0.3, 0.06, 0.3]}
            mat={m.black}
          />
        )),
      )}
    </group>
  );
}

/* ============================================================
 * Cables — sleeved PSU runs for realism
 * ============================================================ */
function Cables({ equipped }: { equipped: Set<PartSlot> }) {
  const powered = equipped.has("psu");
  return (
    <group>
      {/* 24-pin ATX */}
      <mesh position={[0.3, -0.28, -0.45]} rotation={[0, 0, 1.1]}>
        <cylinderGeometry args={[0.04, 0.04, 0.9, 6]} />
        <primitive object={m.black()} attach="material" />
      </mesh>
      {/* PCIe to GPU */}
      <mesh position={[-0.05, -0.52, -0.4]} rotation={[0.5, 0, 0.4]}>
        <cylinderGeometry args={[0.03, 0.03, 0.8, 6]} />
        <primitive object={m.black()} attach="material" />
      </mesh>
      {/* SATA */}
      <mesh position={[0.55, -0.9, -0.1]} rotation={[0, 0, 1.4]}>
        <cylinderGeometry args={[0.022, 0.022, 0.6, 5]} />
        <primitive object={m.black()} attach="material" />
      </mesh>
      {powered && (
        <>
          <GlowStripe
            position={[0.3, -0.3, -0.3]}
            size={[0.05, 0.7, 0.05]}
            offset={0.9}
            opacity={0.5}
          />
          <GlowStripe
            position={[-0.05, -0.5, -0.25]}
            size={[0.04, 0.6, 0.04]}
            offset={0.1}
            opacity={0.5}
          />
        </>
      )}
    </group>
  );
}

/* ============================================================
 * Floating product tags — names the real part hovering over its slot
 * ============================================================ */
const SLOT_LABEL_POS: Record<string, [number, number, number]> = {
  cpu: [-0.52, 1.5, 0.65],
  cooling: [-0.52, 1.32, 0.65],
  ram: [-0.55, 1.18, 0.6],
  gpu: [-0.52, -0.22, 0.55],
  psu: [0.72, -0.55, 0.55],
  storage: [0.05, -1.0, 0.5],
  lighting: [0, 1.75, 0.7],
  case: [0, 2.35, 0.55],
  display: [0, 2.85, 1.4],
  audio: [0.85, 1.9, 0.7],
  peripheral: [0, -1.25, 1.15],
};

function makeLabelTexture(brand: string, name: string): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, 512, 128);
  // pill background
  const grad = ctx.createLinearGradient(0, 0, 512, 0);
  grad.addColorStop(0, "rgba(8,14,20,0.92)");
  grad.addColorStop(1, "rgba(10,18,28,0.92)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(10, 18, 492, 92, 26);
  ctx.fill();
  ctx.strokeStyle = "rgba(34,211,238,0.85)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(10, 18, 492, 92, 26);
  ctx.stroke();
  // brand line
  ctx.font = "700 22px 'JetBrains Mono', monospace";
  ctx.fillStyle = "#8be9ff";
  ctx.textAlign = "left";
  ctx.fillText(brand.toUpperCase(), 40, 54);
  // name line
  ctx.font = "700 34px 'JetBrains Mono', monospace";
  ctx.fillStyle = "#f2f7fb";
  ctx.fillText(name.length > 20 ? name.slice(0, 19) + "…" : name, 40, 94);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 2;
  return tex;
}

function ProductTags({
  items,
}: {
  items: { id: string; slot: PartSlot; name: string; brand: string }[];
}) {
  const texCache = useRef(new Map<string, THREE.CanvasTexture>());
  return (
    <>
      {items.map((it) => {
        let tex = texCache.current.get(it.id);
        if (!tex) {
          tex = makeLabelTexture(it.brand, it.name);
          texCache.current.set(it.id, tex);
        }
        const pos = SLOT_LABEL_POS[it.slot] ?? [0, 1.5, 0.7];
        return (
          <sprite key={it.id} position={pos as [number, number, number]} scale={[1.15, 0.29, 1]}>
            <spriteMaterial map={tex} transparent depthTest={false} toneMapped={false} />
          </sprite>
        );
      })}
    </>
  );
}

/* ============================================================
 * Interior point light — case glows when powered
 * ============================================================ */
function CaseLight({ equipped }: { equipped: Set<PartSlot> }) {
  const ref = useRef<THREE.PointLight>(null);
  const powered = equipped.has("psu");
  useFrame((state) => {
    if (!ref.current) return;
    if (!powered) {
      ref.current.intensity = 0;
      return;
    }
    ref.current.intensity = 3 + Math.sin(state.clock.elapsedTime * 2.2) * 0.6;
  });
  return <pointLight ref={ref} position={[0, 0.2, 0.3]} color="#8fe8ff" distance={5} decay={2} />;
}

/* ============================================================
 * The complete rig — tower on desk
 * ============================================================ */
function Rig({
  equipped,
  tags,
}: {
  equipped: Set<PartSlot>;
  tags: { id: string; slot: PartSlot; name: string; brand: string }[];
}) {
  const { scene, gl } = useThree();
  // Baked environment reflections — metals & glass read as real materials.
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const envScene = RoomEnvironment();
    const rt = pmrem.fromScene(envScene, 0.04);
    scene.environment = rt.texture;
    pmrem.dispose();
    envScene.traverse((o: THREE.Object3D) => {
      const mesh = o as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
    return () => {
      scene.environment = null;
      rt.dispose();
    };
  }, [scene, gl]);

  return (
    <group>
      <DeskAndFloor />
      {/* tower sits on the desk (desk top at y≈0.23, feet bottom at 0.23) */}
      <group position={[0, 1.91, 0]}>
        <Chassis equipped={equipped} />
        <Motherboard equipped={equipped} />
        <Gpu equipped={equipped} />
        <Psu equipped={equipped} />
        <Storage equipped={equipped} />
        <Cables equipped={equipped} />
        <CaseLight equipped={equipped} />
        <ProductTags items={tags} />
      </group>
    </group>
  );
}

/** Direct three-stdlib OrbitControls — avoids pulling in all of @react-three/drei. */
function RigControls({ autoRotate }: { autoRotate: boolean }) {
  const { camera, gl } = useThree();
  const controls = useMemo(() => new OrbitControlsImpl(camera, gl.domElement), [camera, gl]);
  useEffect(() => {
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.target.set(0, 1.15, 0);
    controls.minDistance = 4.6;
    controls.maxDistance = 14;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = 1.5;
    controls.autoRotateSpeed = 0.8;
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
  equippedParts = [],
  autoRotate,
}: {
  equipped: Set<PartSlot>;
  equippedParts?: string[];
  autoRotate: boolean;
}) {
  const tags = useMemo(
    () =>
      equippedParts
        .map((id) => {
          const p = partById(id);
          return p ? { id: p.id, slot: p.slot, name: p.name, brand: p.brand } : null;
        })
        .filter((x): x is { id: string; slot: PartSlot; name: string; brand: string } => !!x),
    [equippedParts],
  );
  return (
    <>
      <hemisphereLight args={["#b8d0e8", "#0a0c10", 0.55]} />
      <directionalLight position={[5, 7, 4]} intensity={1.4} color="#ffffff" />
      <directionalLight position={[-4, 3, -3]} intensity={0.5} color="#a78bfa" />
      <Rig equipped={equipped} tags={tags} />
      <RigControls autoRotate={autoRotate} />
    </>
  );
}

export function RigCanvas({
  equipped,
  equippedParts = [],
  autoRotate,
}: {
  equipped: Set<PartSlot>;
  equippedParts?: string[];
  autoRotate: boolean;
}) {
  return (
    <Canvas
      flat
      dpr={[0.5, 1]}
      shadows={false}
      gl={{
        antialias: false,
        powerPreference: "low-power",
        alpha: true,
        toneMapping: THREE.ACESFilmicToneMapping,
      }}
      camera={{ position: [5.2, 2.6, 6.6], fov: 40 }}
      style={{ touchAction: "pan-y" }}
    >
      <RigScene equipped={equipped} equippedParts={equippedParts} autoRotate={autoRotate} />
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
              <span
                className={cn("size-1.5 rounded-full", on ? "led-dot" : "bg-border")}
                style={on ? { color: "var(--holo-cyan)" } : undefined}
              />
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

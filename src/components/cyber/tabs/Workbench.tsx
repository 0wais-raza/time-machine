import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { CATALOG, SLOTS, partById, partImage, type HardwarePart, type PartSlot } from "@/lib/hardware";
import { PanelHeader } from "../PanelHeader";
import { HudLabel } from "../HudLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Coins,
  Cpu,
  Check,
  RotateCw,
  Wrench,
  Box,
  ImageOff,
  Zap,
  ShoppingCart,
  Power,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// three.js (+ R3F) is ~600KB — lazy-load it so it only downloads/parses
// when the RIG ARMORY tab is actually opened. Keeps the command hub snappy
// on low-end machines.
const LazyRigCanvas = lazy(() =>
  import("../rig/PcRig3D").then((m) => ({ default: m.RigCanvas })),
);

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-2.5 rounded-[2px]",
              i < value ? "bg-[var(--holo-cyan)] shadow-[0_0_5px_oklch(0.85_0.17_200/0.5)]" : "bg-border",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function ProductImage({ part }: { part: HardwarePart }) {
  const [err, setErr] = useState(false);
  const src = partImage(part);
  if (!src || err) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-muted-foreground/50">
        <ImageOff className="size-6" />
        <span className="font-mono text-[9px] uppercase tracking-[0.25em]">no feed</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={part.name}
      loading="lazy"
      decoding="async"
      onError={() => setErr(true)}
      className="h-full w-full object-contain p-2 mix-blend-screen transition-transform duration-300 group-hover:scale-105"
    />
  );
}

function StoreCard({
  part,
  owned,
  equipped,
  credits,
  onBuy,
  onEquip,
  onUnequip,
  onSell,
}: {
  part: HardwarePart;
  owned: boolean;
  equipped: boolean;
  credits: number;
  onBuy: (p: HardwarePart) => void;
  onEquip: (p: HardwarePart) => void;
  onUnequip: (p: HardwarePart) => void;
  onSell: (p: HardwarePart) => void;
}) {
  const slot = SLOTS.find((s) => s.slot === part.slot);
  const specEntries = Object.entries(part.specs).slice(0, 3);
  return (
    <article className="holo-panel tilt-card group flex flex-col gap-3 p-3.5 hover:border-[oklch(0.85_0.17_200/0.45)] hover:shadow-[0_0_30px_oklch(0.85_0.17_200/0.14)]">
      {/* image */}
      <div className="corner-brackets relative h-36 overflow-hidden rounded-md border border-[oklch(0.85_0.17_200/0.12)] bg-[oklch(0.05_0.01_270/0.6)]">
        <div className="cyber-grid absolute inset-0 opacity-60" />
        <div className="relative h-full w-full">
          <ProductImage part={part} />
        </div>
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-sm border border-[oklch(0.85_0.17_200/0.25)] bg-black/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--holo-cyan)]">
          <Cpu className="size-2.5" />
          {slot?.label}
        </div>
        {owned && (
          <div
            className={cn(
              "absolute right-2 top-2 flex items-center gap-1 rounded-sm border bg-black/60 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em]",
              equipped
                ? "border-[oklch(0.8_0.16_155/0.5)] text-[var(--holo-green)]"
                : "border-[oklch(0.82_0.16_80/0.4)] text-[var(--holo-amber)]",
            )}
          >
            <Check className="size-2.5" /> {equipped ? "EQUIPPED" : "OWNED"}
          </div>
        )}
      </div>

      {/* identity */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold leading-tight">{part.name}</div>
          <div className="text-[11px] text-muted-foreground">{part.brand}</div>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-md border border-[oklch(0.82_0.16_80/0.35)] bg-[oklch(0.82_0.16_80/0.08)] px-2 py-1">
          <Coins className="size-3 text-[var(--holo-amber)]" />
          <span className="font-mono-tech text-xs font-bold text-[var(--holo-amber)]">{part.price}</span>
        </div>
      </div>

      {/* spec badges */}
      <div className="flex flex-wrap gap-1.5">
        {specEntries.map(([k, v]) => (
          <span
            key={k}
            className="rounded-sm border border-border bg-black/30 px-1.5 py-0.5 font-mono text-[9.5px] text-muted-foreground"
          >
            <span className="text-foreground/80">{k}</span> {v}
          </span>
        ))}
      </div>

      {/* meters + action */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-[oklch(0.85_0.17_200/0.1)] pt-2.5">
        <div className="flex flex-col gap-1">
          <Meter label="Demand" value={part.demand} />
          <Meter label="Value" value={part.value} />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          {!owned ? (
            <Button
              size="sm"
              onClick={() => onBuy(part)}
              disabled={credits < part.price}
              className="clip-angular bg-[oklch(0.85_0.17_200/0.85)] font-semibold tracking-wider text-black hover:bg-[var(--holo-cyan)]"
            >
              <ShoppingCart className="size-3.5" />
              BUY · {part.price} CR
            </Button>
          ) : equipped ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onUnequip(part)}
                className="text-[var(--holo-green)] hover:bg-[oklch(0.8_0.16_155/0.1)]"
              >
                <Power className="size-3.5" />
                EQUIPPED · UNEQUIP
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onSell(part)}
                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-[var(--holo-pink)]"
              >
                Sell · +{Math.round(part.price * 0.6)} CR
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                onClick={() => onEquip(part)}
                className="clip-angular bg-[oklch(0.85_0.17_200/0.85)] font-semibold tracking-wider text-black hover:bg-[var(--holo-cyan)]"
              >
                <Wrench className="size-3.5" />
                EQUIP TO RIG
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onSell(part)}
                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-[var(--holo-pink)]"
              >
                Sell · +{Math.round(part.price * 0.6)} CR
              </Button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function RigPanel({ equipped }: { equipped: Set<PartSlot> }) {
  const [mounted, setMounted] = useState(false);
  const [webgl, setWebgl] = useState<boolean | null>(null);
  const [Fallback, setFallback] = useState<React.ComponentType<{ equipped: Set<PartSlot> }> | null>(null);
  const [autoRotate, setAutoRotate] = useState(false);
  const { ownedParts, equippedParts, equipPart, unequipPart } = useApp();

  useEffect(() => {
    setMounted(true);
    // Detect WebGL support + load the 2D fallback after mount (never during SSR).
    import("../rig/PcRig3D").then((m) => {
      setWebgl(m.detectWebGL());
      setFallback(() => m.RigFallback);
    });
  }, []);

  const owned = useMemo(
    () => ownedParts.map(partById).filter(Boolean) as HardwarePart[],
    [ownedParts],
  );
  const rigValue = owned.reduce((s, p) => s + p.price, 0);
  const powered = equipped.has("psu");
  const equippedIds = new Set(equippedParts);

  return (
    <section className="holo-panel corner-brackets flex flex-col overflow-hidden">
      {/* header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[oklch(0.85_0.17_200/0.12)] px-4 py-3">
        <div className="flex items-center gap-2">
          <Zap className={cn("size-4", powered ? "text-[var(--holo-cyan)]" : "text-muted-foreground")} />
          <HudLabel dot={false} className="tracking-[0.14em]">The Rig // Live Assembly</HudLabel>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Box className="size-3 text-[var(--holo-violet)]" />
            {equipped.size}/{SLOTS.length} bays
          </span>
          <span className="flex items-center gap-1.5">
            <Coins className="size-3 text-[var(--holo-amber)]" />
            {rigValue} CR
          </span>
          <span
            className={cn(
              "hidden items-center gap-1.5 sm:flex",
              powered ? "text-[var(--holo-green)]" : "text-muted-foreground",
            )}
          >
            <span className="led-dot" style={{ color: powered ? "var(--holo-green)" : "#444" }} />
            {powered ? "POWERED" : "UNPOWERED"}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setAutoRotate((v) => !v)}
            className={cn(
              "clip-angular flex items-center gap-1.5 border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition",
              autoRotate
                ? "border-[oklch(0.85_0.17_200/0.5)] bg-[oklch(0.85_0.17_200/0.12)] text-[var(--holo-cyan)]"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
            title="Toggle auto-rotation"
          >
            <RotateCw className={cn("size-3.5", autoRotate && "animate-[holo-spin_2.5s_linear_infinite]")} />
            {autoRotate ? "ROTATING" : "AUTO-ROTATE"}
          </button>
        </div>
      </div>

      {/* canvas */}
      <div className="cyber-grid relative h-[420px] w-full bg-[oklch(0.07_0.015_270/0.5)]">
        {mounted && webgl && (
          <Suspense
            fallback={
              <div className="flex h-full w-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.35em] text-muted-foreground/70">
                Loading 3D core…
              </div>
            }
          >
            <LazyRigCanvas equipped={equipped} autoRotate={autoRotate} />
          </Suspense>
        )}
        {mounted && webgl === false && Fallback && <Fallback equipped={equipped} />}
        {mounted && webgl && (
          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[9px] uppercase tracking-[0.35em] text-muted-foreground/60">
            drag to orbit · scroll to zoom
          </div>
        )}
      </div>

      {/* slot legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[oklch(0.85_0.17_200/0.12)] px-4 py-2.5">
        {SLOTS.filter((s) => s.core).map((s) => {
          const on = equipped.has(s.slot);
          return (
            <span key={s.slot} className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.2em]">
              <span
                className={cn("size-1.5 rounded-full", on && "led-dot")}
                style={on ? { color: "var(--holo-cyan)" } : { background: "#3a4552" }}
              />
              <span className={on ? "text-[var(--holo-cyan)]" : "text-muted-foreground/60"}>
                {s.label}
              </span>
            </span>
          );
        })}
      </div>

      {/* armory inventory — owned parts, equip/unequip */}
      <div className="border-t border-[oklch(0.85_0.17_200/0.12)] px-4 py-3">
        <HudLabel accent="amber" className="mb-2.5">Armory // Inventory</HudLabel>
        {owned.length === 0 ? (
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/60">
            <ShoppingCart className="size-3.5" />
            Empty — purchase parts from the store below, then equip them here.
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {owned.map((p) => {
              const isEq = equippedIds.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => (isEq ? unequipPart(p.id) : equipPart(p.id))}
                  title={isEq ? `Unequip ${p.name}` : `Equip ${p.name}`}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium transition",
                    isEq
                      ? "border-[oklch(0.8_0.16_155/0.5)] bg-[oklch(0.8_0.16_155/0.1)] text-[var(--holo-green)] shadow-[0_0_10px_oklch(0.8_0.16_155/0.2)]"
                      : "border-border bg-black/30 text-muted-foreground hover:border-[oklch(0.85_0.17_200/0.4)] hover:text-foreground",
                  )}
                >
                  <span
                    className={cn("size-1.5 rounded-full", isEq && "led-dot")}
                    style={isEq ? { color: "var(--holo-green)" } : { background: "#3a4552" }}
                  />
                  <span className="max-w-[140px] truncate">{p.name}</span>
                  {isEq && <Power className="size-3" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

export function WorkbenchTab() {
  const { credits, ownedParts, equippedParts, buyPart, sellPart, equipPart, unequipPart } = useApp();
  const [query, setQuery] = useState("");
  const [slotFilter, setSlotFilter] = useState<PartSlot | "all">("all");

  const equipped = useMemo(
    () => new Set(equippedParts.map(partById).filter(Boolean).map((p) => (p as HardwarePart).slot)),
    [equippedParts],
  );
  const equippedIds = useMemo(() => new Set(equippedParts), [equippedParts]);

  const catalog = useMemo(
    () =>
      CATALOG.filter(
        (p) =>
          (slotFilter === "all" || p.slot === slotFilter) &&
          (query.trim() === "" ||
            `${p.name} ${p.brand}`.toLowerCase().includes(query.toLowerCase())),
      ),
    [query, slotFilter],
  );

  const buy = (p: HardwarePart) => {
    const ok = buyPart(p.id, p.price);
    if (ok) {
      toast.success(`${p.name} purchased`, { description: `-${p.price} CR · now in your armory` });
    } else {
      toast.error("Insufficient credits", { description: `${p.name} costs ${p.price} CR.` });
    }
  };

  const equip = (p: HardwarePart) => {
    equipPart(p.id);
    toast.success(`${p.name} equipped`, { description: "Rig updated live." });
  };

  const unequip = (p: HardwarePart) => {
    unequipPart(p.id);
    toast(`${p.name} unequipped`);
  };

  const sell = (p: HardwarePart) => {
    const refund = Math.round(p.price * 0.6);
    sellPart(p.id, refund);
    toast(`${p.name} sold`, { description: `+${refund} credits refunded` });
  };

  return (
    <div>
      <PanelHeader
        eyebrow="Armory // Assembly"
        title="RIG ARMORY & STORE"
        subtitle="Purchase hardware into your armory, then equip parts to light them up inside the live 3D rig."
        right={
          <div className="clip-angular flex items-center gap-2 border border-[oklch(0.82_0.16_80/0.3)] bg-[oklch(0.82_0.16_80/0.08)] px-3.5 py-2">
            <Coins className="size-4 text-[var(--holo-amber)]" />
            <span className="font-mono-tech text-lg font-bold tabular-nums text-[var(--holo-amber)]">
              {credits}
            </span>
            <span className="text-xs text-muted-foreground">Cyber Credits</span>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(380px,440px)_1fr]">
        <RigPanel equipped={equipped} />

        <section className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-bold tracking-[0.14em]">HARDWARE STORE</h2>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search components…"
              className="h-8 w-52 bg-black/40"
            />
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => setSlotFilter("all")}
                className={cn(
                  "clip-angular border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition",
                  slotFilter === "all"
                    ? "border-[oklch(0.85_0.17_200/0.5)] bg-[oklch(0.85_0.17_200/0.12)] text-[var(--holo-cyan)]"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                All
              </button>
              {SLOTS.map((s) => (
                <button
                  key={s.slot}
                  onClick={() => setSlotFilter(s.slot)}
                  className={cn(
                    "clip-angular border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider transition",
                    slotFilter === s.slot
                      ? "border-[oklch(0.66_0.27_295/0.5)] bg-[oklch(0.66_0.27_295/0.12)] text-[var(--holo-violet)]"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {catalog.map((p) => (
              <StoreCard
                key={p.id}
                part={p}
                owned={ownedParts.includes(p.id)}
                equipped={equippedIds.has(p.id)}
                credits={credits}
                onBuy={buy}
                onEquip={equip}
                onUnequip={unequip}
                onSell={sell}
              />
            ))}
            {catalog.length === 0 && (
              <div className="holo-panel col-span-full p-6 text-center text-sm italic text-muted-foreground">
                No components match that search directive.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

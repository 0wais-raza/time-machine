import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { CATALOG, SLOTS, partById, type HardwarePart, type PartSlot } from "@/lib/hardware";
import { PanelHeader } from "../PanelHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Coins, Cpu, Lock, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useGsapReveal } from "@/hooks/useGsapReveal";

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
              i < value ? "bg-primary" : "bg-border",
            )}
          />
        ))}
      </div>
    </div>
  );
}

function RigSlot({ slotLabel, part }: { slotLabel: string; part?: HardwarePart }) {
  if (!part) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/40 p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">{slotLabel}</span>
          <Lock className="size-3.5 text-muted-foreground/60" />
        </div>
        <div className="mt-3 text-sm text-muted-foreground/70">Empty slot</div>
        <div className="mt-1 text-[11px] text-muted-foreground/50">
          Purchase a component to populate this bay.
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-[image:var(--gradient-surface)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-primary">{slotLabel}</span>
        <Check className="size-3.5 text-primary" />
      </div>
      <div className="mt-2 text-sm font-semibold leading-tight">{part.name}</div>
      <div className="text-[11px] text-muted-foreground">{part.brand}</div>
      <dl className="mt-3 space-y-1">
        {Object.entries(part.specs).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2 text-[11px]">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="font-mono-tech">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function WorkbenchTab() {
  const { credits, ownedParts, buyPart, sellPart } = useApp();
  const [query, setQuery] = useState("");
  const [slotFilter, setSlotFilter] = useState<PartSlot | "all">("all");
  const rigRef = useGsapReveal<HTMLDivElement>("rig");

  const owned = useMemo(
    () => ownedParts.map(partById).filter(Boolean) as HardwarePart[],
    [ownedParts],
  );
  const bySlot = useMemo(() => {
    const m: Partial<Record<PartSlot, HardwarePart>> = {};
    for (const p of owned) if (!m[p.slot]) m[p.slot] = p;
    return m;
  }, [owned]);

  const rigValue = owned.reduce((s, p) => s + p.price, 0);

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

  const purchase = (p: HardwarePart) => {
    const ok = buyPart(p.id, p.price);
    if (ok) toast.success(`${p.name} installed`, { description: `-${p.price} credits` });
    else toast.error("Insufficient credits", { description: `${p.name} costs ${p.price} CR.` });
  };

  return (
    <div>
      <PanelHeader
        eyebrow="Armory"
        title="PC Workbench & Store"
        subtitle="Spend earned Cyber Credits on real hardware for your rig."
        right={
          <div className="glass-panel flex items-center gap-2 px-3.5 py-2">
            <Coins className="size-4 text-primary" />
            <span className="font-mono-tech text-lg font-bold tabular-nums">{credits}</span>
            <span className="text-xs text-muted-foreground">credits</span>
          </div>
        }
      />

      <section className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <Cpu className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">The Rig</h2>
          <span className="ml-auto text-xs text-muted-foreground">
            {owned.length}/{SLOTS.length} bays populated · {rigValue} CR invested
          </span>
        </div>
        <div ref={rigRef} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {SLOTS.map((s) => (
            <RigSlot key={s.slot} slotLabel={s.label} part={bySlot[s.slot]} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold">Hardware Store</h2>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search components…"
            className="h-8 w-56"
          />
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setSlotFilter("all")}
              className={cn(
                "rounded-md border px-2.5 py-1 text-[11px] transition",
                slotFilter === "all"
                  ? "border-primary/50 bg-primary/10 text-primary"
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
                  "rounded-md border px-2.5 py-1 text-[11px] transition",
                  slotFilter === s.slot
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {catalog.map((p) => {
            const isOwned = ownedParts.includes(p.id);
            return (
              <div
                key={p.id}
                className="glass-panel flex flex-col gap-3 p-4 transition hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold leading-tight">{p.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {p.brand} · {SLOTS.find((s) => s.slot === p.slot)?.label}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 rounded-md border border-border px-2 py-1">
                    <Coins className="size-3 text-primary" />
                    <span className="font-mono-tech text-xs font-semibold">{p.price}</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {Object.entries(p.specs).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2 text-[11px]">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-mono-tech truncate">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
                  <div className="flex gap-3">
                    <Meter label="Demand" value={p.demand} />
                    <Meter label="Value" value={p.value} />
                  </div>
                  {isOwned ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        sellPart(p.id, Math.round(p.price * 0.6));
                        toast(`${p.name} removed`, {
                          description: `+${Math.round(p.price * 0.6)} credits refunded`,
                        });
                      }}
                    >
                      Owned · Sell
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => purchase(p)} disabled={credits < p.price}>
                      Buy
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          {catalog.length === 0 && (
            <div className="text-sm italic text-muted-foreground">No components match that search.</div>
          )}
        </div>
      </section>
    </div>
  );
}
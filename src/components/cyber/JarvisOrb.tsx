import { Bot } from "lucide-react";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useNow } from "@/lib/clock";

/** Floating J.A.R.V.I.S. orb — one tap opens the Vizier channel. */
export function JarvisOrb() {
  const { activeTab, setActiveTab, tasks } = useApp();
  const now = useNow(1000);
  const open = tasks.filter((t) => !t.done).length;
  const active = activeTab === "vizier";

  return (
    <button
      onClick={() => setActiveTab("vizier")}
      title="Open J.A.R.V.I.S."
      aria-label="Open J.A.R.V.I.S."
      className={cn(
        "group fixed bottom-5 right-5 z-40 flex size-14 items-center justify-center rounded-full border border-[oklch(0.85_0.17_200/0.45)] bg-[oklch(0.1_0.03_270/0.9)] shadow-[0_0_24px_oklch(0.85_0.17_200/0.25)] backdrop-blur-xl transition-all hover:scale-105 hover:shadow-[0_0_36px_oklch(0.85_0.17_200/0.45)]",
        active && "border-[var(--holo-cyan)] bg-[oklch(0.85_0.17_200/0.12)]",
      )}
    >
      {/* arc reactor rings */}
      <span className="pointer-events-none absolute inset-0 animate-[holo-spin_6s_linear_infinite] rounded-full border-2 border-[oklch(0.85_0.17_200/0.35)]" style={{ borderTopColor: "var(--holo-cyan)", borderRightColor: "transparent" }} />
      <span className="pointer-events-none absolute inset-[10%] animate-[holo-spin-rev_4s_linear_infinite] rounded-full border border-[oklch(0.66_0.27_295/0.5)]" style={{ borderBottomColor: "var(--holo-violet)", borderTopColor: "transparent" }} />
      <span className="pointer-events-none absolute inset-[24%] animate-[reactor-core_2.4s_ease-in-out_infinite] rounded-full bg-[var(--holo-cyan)] shadow-[0_0_12px_var(--holo-cyan)]" />
      <Bot className="relative size-6 text-[var(--holo-cyan)] transition-transform group-hover:scale-110" />

      {/* status LED */}
      <span
        className="led-dot absolute -top-0.5 -right-0.5 size-2.5"
        style={{ color: "var(--holo-green)" }}
      />

      {/* open missions badge */}
      {open > 0 && (
        <span className="absolute -bottom-1 -left-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-[oklch(0.82_0.16_80/0.4)] bg-[oklch(0.12_0.02_270/0.95)] px-1 font-mono text-[9px] font-bold text-[var(--holo-amber)]">
          {open}
        </span>
      )}

      {/* tooltip */}
      <span
        className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-md border border-[oklch(0.85_0.17_200/0.3)] bg-[oklch(0.1_0.03_270/0.95)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--holo-cyan)] opacity-0 transition-opacity group-hover:opacity-100 sm:block"
        suppressHydrationWarning
      >
        J.A.R.V.I.S. · {now ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
      </span>
    </button>
  );
}

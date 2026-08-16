import { cn } from "@/lib/utils";

/**
 * Consistent HUD section header — mono uppercase tracking label with a glowing
 * LED dot. Used everywhere a panel needs a header so every tab shares one voice.
 */
export function HudLabel({
  children,
  className,
  accent = "cyan",
  dot = true,
}: {
  children: React.ReactNode;
  className?: string;
  accent?: "cyan" | "violet" | "amber" | "green" | "pink";
  dot?: boolean;
}) {
  const colors: Record<string, string> = {
    cyan: "text-[var(--holo-cyan)]",
    violet: "text-[var(--holo-violet)]",
    amber: "text-[var(--holo-amber)]",
    green: "text-[var(--holo-green)]",
    pink: "text-[var(--holo-pink)]",
  };
  const dotColor: Record<string, string> = {
    cyan: "var(--holo-cyan)",
    violet: "var(--holo-violet)",
    amber: "var(--holo-amber)",
    green: "var(--holo-green)",
    pink: "var(--holo-pink)",
  };
  return (
    <div
      className={cn(
        "flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.28em]",
        colors[accent],
        className,
      )}
    >
      {dot && <span className="led-dot size-1.5" style={{ color: dotColor[accent] }} />}
      <span>{children}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-current/25 to-transparent" />
    </div>
  );
}

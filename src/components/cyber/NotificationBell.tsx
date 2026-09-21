import { useState, useRef, useEffect } from "react";
import { Bell, X, CheckCheck, CalendarCheck, GraduationCap, Moon, Target, Cpu } from "lucide-react";
import { useApp, type AppNotification } from "@/lib/store";
import { cn } from "@/lib/utils";

const kindMeta: Record<
  AppNotification["kind"],
  { color: string; chip: string; label: string; Icon: typeof Bell }
> = {
  milestone: {
    color: "text-[var(--holo-cyan)]",
    chip: "border-[oklch(0.85_0.17_200/0.4)] bg-[oklch(0.85_0.17_200/0.08)] text-[var(--holo-cyan)]",
    label: "Milestone",
    Icon: Target,
  },
  deadline: {
    color: "text-[var(--holo-pink)]",
    chip: "border-[oklch(0.72_0.24_350/0.45)] bg-[oklch(0.72_0.24_350/0.08)] text-[var(--holo-pink)]",
    label: "Deadline",
    Icon: CalendarCheck,
  },
  block: {
    color: "text-[var(--holo-violet)]",
    chip: "border-[oklch(0.66_0.27_295/0.4)] bg-[oklch(0.66_0.27_295/0.08)] text-[var(--holo-violet)]",
    label: "Block",
    Icon: CalendarCheck,
  },
  prayer: {
    color: "text-[var(--holo-green)]",
    chip: "border-[oklch(0.8_0.16_155/0.4)] bg-[oklch(0.8_0.16_155/0.08)] text-[var(--holo-green)]",
    label: "Prayer",
    Icon: Moon,
  },
  system: {
    color: "text-muted-foreground",
    chip: "border-border bg-[oklch(1_1_1/0.03)] text-muted-foreground",
    label: "System",
    Icon: Cpu,
  },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NotificationBell() {
  const { notifications, dismissNotification, clearNotifications, markBlockDone } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const count = notifications.length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "glass-panel relative flex size-9 items-center justify-center transition duration-200 hover:border-[var(--holo-cyan)]/40",
          open && "border-[var(--holo-cyan)]/50",
        )}
        aria-label={`Notifications${count ? ` (${count} unread)` : ""}`}
        aria-expanded={open}
        title="Notifications"
      >
        <Bell className={cn("size-4 transition", count ? "text-[var(--holo-cyan)]" : "text-muted-foreground")} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex min-w-[18px] items-center justify-center rounded-full bg-[var(--holo-pink)] px-1 text-[9px] font-bold text-background shadow-[0_0_10px_var(--holo-pink)]">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      {open && (
        <div className="glass-panel absolute right-0 top-11 z-50 w-[340px] overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-3.5 py-2.5">
            <div className="flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">
              <span className="led-dot size-1.5" style={{ color: "var(--holo-cyan)" }} />
              Alert Feed ({count})
            </div>
            {count > 0 && (
              <button
                onClick={clearNotifications}
                className="flex items-center gap-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground transition hover:text-[var(--holo-cyan)]"
              >
                <CheckCheck className="size-3" /> Clear
              </button>
            )}
          </div>
          <div className="scroll-y-clean max-h-[380px]">
            {count === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="mx-auto mb-2 size-5 text-muted-foreground/40" />
                <div className="text-xs font-medium text-foreground/70">All quiet, Sir.</div>
                <div className="mt-1 text-[11px] italic text-muted-foreground">
                  Deadlines, blocks and prayer alerts will land here.
                </div>
              </div>
            ) : (
              <ul>
                {notifications.map((n) => {
                  const meta = kindMeta[n.kind];
                  const Icon = meta.Icon;
                  return (
                    <li
                      key={n.id}
                      className="group relative border-b border-border/40 px-3.5 py-3 transition last:border-b-0 hover:bg-[oklch(1_1_1/0.03)]"
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={cn(
                            "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border",
                            meta.chip,
                          )}
                        >
                          <Icon className="size-3" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                "rounded border px-1 py-px font-mono text-[7.5px] font-bold uppercase tracking-[0.18em]",
                                meta.chip,
                              )}
                            >
                              {meta.label}
                            </span>
                            <span className="ml-auto shrink-0 font-mono text-[9px] text-muted-foreground/70">
                              {timeAgo(n.createdAt)}
                            </span>
                          </div>
                          <div className={cn("mt-1 text-xs font-bold leading-snug", meta.color)}>
                            {n.title}
                          </div>
                          {n.body && (
                            <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                              {n.body}
                            </div>
                          )}
                          {n.kind === "block" && n.refId && (
                            <button
                              onClick={() => {
                                markBlockDone(n.refId!);
                                dismissNotification(n.id);
                              }}
                              className="mt-1.5 rounded border border-[oklch(0.8_0.16_155/0.4)] bg-[oklch(0.8_0.16_155/0.08)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-widest text-[var(--holo-green)] transition hover:bg-[oklch(0.8_0.16_155/0.16)]"
                            >
                              <CalendarCheck className="mr-1 inline size-2.5" />
                              Mark done +3 CR
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => dismissNotification(n.id)}
                          className="shrink-0 text-muted-foreground opacity-0 transition hover:text-[var(--holo-pink)] group-hover:opacity-100"
                          title="Dismiss"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="border-t border-border px-3.5 py-2 text-center font-mono text-[8px] uppercase tracking-[0.25em] text-muted-foreground/60">
            <GraduationCap className="mr-1 inline size-2.5" />
            Chronos Vizier · Alert Relay
          </div>
        </div>
      )}
    </div>
  );
}

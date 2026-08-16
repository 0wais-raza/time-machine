import { useState, useRef, useEffect } from "react";
import { Bell, X, CheckCheck } from "lucide-react";
import { useApp, type AppNotification } from "@/lib/store";
import { cn } from "@/lib/utils";

const kindColor: Record<AppNotification["kind"], string> = {
  milestone: "text-[var(--holo-cyan)]",
  deadline: "text-[var(--holo-pink)]",
  block: "text-[var(--holo-violet)]",
  prayer: "text-[var(--holo-cyan)]",
  system: "text-muted-foreground",
};

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
          "glass-panel relative flex size-9 items-center justify-center transition",
          open && "border-[var(--holo-cyan)]/50",
        )}
        title="Notifications"
      >
        <Bell className="size-4 text-[var(--holo-cyan)]" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 flex min-w-[18px] items-center justify-center rounded-full bg-[var(--holo-pink)] px-1 text-[9px] font-bold text-background shadow-[0_0_10px_var(--holo-pink)]">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>
      {open && (
        <div className="glass-panel absolute right-0 top-11 z-50 w-80 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Alerts ({count})
            </div>
            {count > 0 && (
              <button
                onClick={clearNotifications}
                className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
              >
                <CheckCheck className="size-3" /> Clear all
              </button>
            )}
          </div>
          <div className="scroll-y-clean max-h-80">
            {count === 0 ? (
              <div className="px-3 py-6 text-center text-xs italic text-muted-foreground">
                No alerts. The line is quiet.
              </div>
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className="group flex items-start gap-2 border-b border-border/40 px-3 py-2 last:border-b-0 hover:bg-secondary/30"
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-1.5 shrink-0 rounded-full",
                        kindColor[n.kind],
                      )}
                      style={{ background: "currentColor" }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className={cn("text-xs font-bold", kindColor[n.kind])}>
                        {n.title}
                      </div>
                      {n.body && (
                        <div className="text-[11px] text-muted-foreground">{n.body}</div>
                      )}
                      <div className="mt-0.5 font-mono text-[9px] text-muted-foreground/70">
                        {new Date(n.createdAt).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (n.kind === "block" && n.refId) {
                          markBlockDone(n.refId);
                        }
                        dismissNotification(n.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[var(--holo-pink)]"
                      title="Dismiss"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import { isRinging, stopRingtone } from "@/lib/ringtones";
import { snoozeAlarm } from "@/lib/alarms";
import { cn } from "@/lib/utils";
import { BellRing, X } from "lucide-react";

/**
 * Full-width ringing banner — slides down from the top when the alarm engine
 * fires a ringtone. Shows the alarm title with dismiss + +5min snooze.
 */
export function AlarmRinger() {
  const [alarm, setAlarm] = useState<{ title: string; body: string; key: string } | null>(null);
  const [visible, setVisible] = useState(false);
  const pollRef = useRef<number | null>(null);

  // Poll ringtone engine state (cheap boolean check, 500ms while ringing).
  useEffect(() => {
    const check = () => {
      const ringing = isRinging();
      if (ringing && !alarm) {
        // Find the newest alarm notification to title the banner.
        const s = useApp.getState();
        const latest = s.notifications.find((n) => n.kind === "block" || n.kind === "prayer");
        setAlarm({
          title: latest?.title ?? "Alarm",
          body: latest?.body ?? "",
          key: "active",
        });
        setVisible(true);
      } else if (!ringing && alarm) {
        setVisible(false);
        const t = window.setTimeout(() => setAlarm(null), 350);
        return () => window.clearTimeout(t);
      }
    };
    check();
    pollRef.current = window.setInterval(check, 500);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [alarm]);

  const dismiss = () => {
    stopRingtone();
    setVisible(false);
    window.setTimeout(() => setAlarm(null), 350);
  };

  const snooze = () => {
    stopRingtone();
    setVisible(false);
    window.setTimeout(() => setAlarm(null), 350);
    snoozeAlarm(5);
  };

  if (!alarm) return null;

  return (
    <div
      className={cn(
        "fixed inset-x-0 top-0 z-[95] flex justify-center px-4 transition-all duration-300 ease-out",
        visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0",
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="glass-panel corner-brackets mt-4 flex w-full max-w-xl items-center gap-3 border-[oklch(0.82_0.16_80/0.5)] px-5 py-3.5 shadow-[0_0_40px_oklch(0.82_0.16_80/0.25)]">
        <span className="relative flex size-9 shrink-0 items-center justify-center rounded-full border border-[oklch(0.82_0.16_80/0.5)] bg-[oklch(0.82_0.16_80/0.12)]">
          <BellRing className="size-4 animate-[holo-pulse_1s_ease-in-out_infinite] text-[var(--holo-amber)]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-foreground">{alarm.title}</div>
          {alarm.body && (
            <div className="truncate text-xs text-muted-foreground">{alarm.body}</div>
          )}
        </div>
        <button
          onClick={snooze}
          className="shrink-0 rounded-md border border-border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground transition hover:border-[var(--holo-cyan)]/50 hover:text-[var(--holo-cyan)]"
        >
          Snooze 5m
        </button>
        <button
          onClick={dismiss}
          className="shrink-0 rounded-md border border-[oklch(0.82_0.16_80/0.4)] bg-[oklch(0.82_0.16_80/0.1)] px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-widest text-[var(--holo-amber)] transition hover:bg-[oklch(0.82_0.16_80/0.2)]"
        >
          <X className="mr-1 inline size-3" /> Dismiss
        </button>
      </div>
    </div>
  );
}

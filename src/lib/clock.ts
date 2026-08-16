import { useEffect, useState } from "react";

/** Shared "now" hook. One timer per call site; pass tier interval. */
export function useNow(intervalMs: number = 1000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Format Date as 12-hour `hh:mm:ss AM/PM`. */
export function formatTime12(d: Date, withSeconds = true): string {
  const h24 = d.getHours();
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  const base = `${pad(h12)}:${pad(d.getMinutes())}`;
  return withSeconds ? `${base}:${pad(d.getSeconds())} ${ampm}` : `${base} ${ampm}`;
}

/** Convert internal 24h `HH:mm` to 12h `h:mm AM/PM` for display. */
export function to12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${pad(m ?? 0)} ${ampm}`;
}

export function tzName(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

export function todayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Derived streak: consecutive days back from today with ≥1 completed task
 *  OR all 5 prayers logged. */
export function computeStreak(
  tasks: { done: boolean; createdAt: string }[],
  prayers: Record<string, Partial<Record<string, boolean>>>,
): number {
  // Build set of "qualifying" days.
  const qualifies = (dateStr: string) => {
    const dayP = prayers[dateStr] ?? {};
    const prayerCount = Object.values(dayP).filter(Boolean).length;
    if (prayerCount >= 5) return true;
    // Task counts as completed-today by createdAt date (proxy).
    const t = tasks.some((x) => x.done && x.createdAt.slice(0, 10) === dateStr);
    return t;
  };
  let streak = 0;
  const d = new Date();
  // Allow today to be unqualified — start counting from yesterday if so.
  if (!qualifies(todayKey(d))) {
    d.setDate(d.getDate() - 1);
  }
  for (let i = 0; i < 365; i++) {
    if (qualifies(todayKey(d))) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}
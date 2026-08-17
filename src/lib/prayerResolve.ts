import { PRAYERS, type PrayerName, type PrayerTimes } from "./store";

export type PrayerTimeMap = Partial<Record<PrayerName, string>>;

/**
 * Effective per-prayer times for a date.
 * Precedence: manual custom overrides (Settings) > fetched API times > built-in
 * default fallback (applied at call sites via `?? p.time`).
 */
export function resolveDayTimes(
  prayerTimes: PrayerTimes,
  customPrayerTimes: PrayerTimeMap,
  date: string,
): PrayerTimeMap {
  return { ...(prayerTimes[date] ?? {}), ...customPrayerTimes };
}

/** The default/fallback time for a prayer (used when nothing else is set). */
export function defaultPrayerTime(name: PrayerName): string {
  return PRAYERS.find((p) => p.name === name)?.time ?? "00:00";
}

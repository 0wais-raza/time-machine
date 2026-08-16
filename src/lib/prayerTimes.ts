import type { PrayerName } from "./store";

const NAME_MAP: Record<string, PrayerName> = {
  Fajr: "Fajr",
  Dhuhr: "Dhuhr",
  Asr: "Asr",
  Maghrib: "Maghrib",
  Isha: "Isha",
};

export async function fetchPrayerTimes(
  date: Date,
  lat: number,
  lon: number,
): Promise<Partial<Record<PrayerName, string>>> {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const url = `https://api.aladhan.com/v1/timings/${dd}-${mm}-${yyyy}?latitude=${lat}&longitude=${lon}&method=2`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Prayer API ${res.status}`);
  const data = await res.json();
  const t = data?.data?.timings ?? {};
  const out: Partial<Record<PrayerName, string>> = {};
  for (const k of Object.keys(NAME_MAP)) {
    const v = t[k];
    if (typeof v === "string") {
      // Aladhan returns "HH:mm" possibly with " (TZ)" suffix.
      out[NAME_MAP[k]] = v.slice(0, 5);
    }
  }
  return out;
}

export function requestGeo(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation unavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) => reject(err),
      { timeout: 8000, maximumAge: 3600_000 },
    );
  });
}
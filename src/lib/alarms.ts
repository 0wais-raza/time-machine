import { useApp, todayStr, PRAYERS } from "./store";
import { playRingtone, stopRingtone } from "./ringtones";
import { resolveDayTimes } from "./prayerResolve";

/**
 * Alarm engine — a 10s heartbeat that checks timetable blocks, prayer times,
 * and exam-linked study sessions, ringing the configured ringtone when a
 * trigger fires. Uses the store's `dispatched` ledger so each trigger fires
 * at most once per day.
 */

let timer: number | null = null;
let snoozeTimer: number | null = null;

/** Last fired alarm — kept so Snooze can re-ring it. */
let lastAlarm: { ringtone: Parameters<typeof playRingtone>[0]; volume: number; durationSec: number } | null =
  null;

function minsOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function fire(trigger: string, title: string, body: string) {
  const s = useApp.getState();
  const key = `alarm:${trigger}:${todayStr()}`;
  if (s.dispatched[key]) return;
  s.markDispatched(key);
  const a = s.alarmSettings;
  if (!a.enabled) return;
  playRingtone(a.ringtone, {
    volume: a.volume,
    durationSec: a.durationSec,
    key,
  });
  s.pushNotification({ kind: "block", title, body });
  lastAlarm = { ringtone: a.ringtone, volume: a.volume, durationSec: Math.min(a.durationSec, 20) };
}

function tick() {
  const s = useApp.getState();
  if (!s.alarmSettings.enabled) return;
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  // Fire within the first minute past the trigger time.
  if (now.getSeconds() > 20) return;
  const dow = now.getDay();
  const today = todayStr();

  // 1. Timetable blocks.
  if (s.alarmSettings.onBlockStart) {
    for (const b of s.blocks) {
      const d = typeof b.dayOfWeek === "number" ? b.dayOfWeek : new Date(b.date).getDay();
      if (d !== dow) continue;
      if (minsOf(b.start) === nowMins) {
        const isStudy = b.category === "study" && b.subjectId;
        const subject = isStudy ? s.examSubjects.find((x) => x.id === b.subjectId) : undefined;
        if (isStudy && subject && s.alarmSettings.onExamSession) {
          const days = subject.examDate
            ? Math.ceil((new Date(subject.examDate + "T23:59:59").getTime() - now.getTime()) / 86400000)
            : null;
          fire(
            `block:${b.id}`,
            `Study Alarm // ${subject.name}`,
            days !== null ? `${b.title} — exam in ${days}d. Lock in.` : `${b.title} — session starting now.`,
          );
        } else {
          fire(`block:${b.id}`, `Block Alarm // ${b.title}`, `${b.start} — scheduled block starting.`);
        }
      }
    }
  }

  // 2. Prayer times (exact minute).
  if (s.alarmSettings.onPrayerTime) {
    const dayTimes = resolveDayTimes(s.prayerTimes, s.customPrayerTimes, today);
    for (const p of PRAYERS) {
      const t = dayTimes[p.name] ?? p.time;
      if (minsOf(t) === nowMins) {
        fire(`prayer:${p.name}`, `${p.name} Adhan`, `It's ${t} — prayer window open, Sir.`);
      }
    }
  }
}

/** Start the alarm heartbeat (idempotent). */
export function startAlarmEngine() {
  if (timer !== null || typeof window === "undefined") return;
  timer = window.setInterval(tick, 10_000);
}

export function stopAlarmEngine() {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }
}

/** Dismiss any currently ringing alarm (used by the ringing banner). */
export function dismissAlarm() {
  stopRingtone();
  if (snoozeTimer !== null) {
    window.clearTimeout(snoozeTimer);
    snoozeTimer = null;
  }
}

/** Silence now, re-ring the last alarm after 5 minutes. */
export function snoozeAlarm(minutes = 5) {
  stopRingtone();
  if (snoozeTimer !== null) window.clearTimeout(snoozeTimer);
  if (!lastAlarm) return;
  const { ringtone, volume, durationSec } = lastAlarm;
  snoozeTimer = window.setTimeout(() => {
    snoozeTimer = null;
    playRingtone(ringtone, { volume, durationSec, key: `snooze:${Date.now()}` });
  }, minutes * 60_000);
  useApp.getState().pushNotification({
    kind: "system",
    title: "Alarm snoozed",
    body: `Ringing again in ${minutes} minutes, Sir.`,
  });
}

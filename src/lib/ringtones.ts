/**
 * Web Audio ringtone engine — zero assets, synthesized on the fly.
 * Each ringtone is a short looping pattern built from oscillators; the engine
 * schedules pattern cycles until stopped or the auto-stop deadline hits.
 */

export type RingtoneName = "arc" | "beacon" | "chime" | "pulse" | "radar";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface StopHandle {
  stop: () => void;
}

let active: StopHandle | null = null;
let activeKey = "";

/** Stop whatever is currently ringing (no-op when silent). */
export function stopRingtone() {
  active?.stop();
  active = null;
  activeKey = "";
}

export function isRinging(key?: string): boolean {
  return active !== null && (key === undefined || activeKey === key);
}

/** One master gain so volume can be changed live while ringing. */
let master: GainNode | null = null;

function getMaster(c: AudioContext, volume: number): GainNode {
  if (!master) {
    master = c.createGain();
    master.connect(c.destination);
  }
  master.gain.value = volume;
  return master;
}

/** Soft-clip envelope helper — plucks a gain node with fast attack, exp decay. */
function pluck(c: AudioContext, dest: AudioNode, at: number, freq: number, dur: number, peak: number, type: OscillatorType = "sine") {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(dest);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

/** Schedule one cycle of the chosen ringtone; returns cycle length in seconds. */
function scheduleCycle(c: AudioContext, dest: AudioNode, name: RingtoneName, t0: number): number {
  switch (name) {
    case "arc": {
      // Rising JARVIS sweep — three ascending tones with a shimmer tail.
      const seq = [523.25, 659.25, 783.99, 1046.5];
      seq.forEach((f, i) => pluck(c, dest, t0 + i * 0.16, f, 0.38, 0.22, "triangle"));
      // shimmer
      pluck(c, dest, t0 + 0.68, 2093, 0.5, 0.06, "sine");
      return 1.35;
    }
    case "beacon": {
      // Classic urgent double-beep.
      pluck(c, dest, t0, 880, 0.14, 0.3, "square");
      pluck(c, dest, t0 + 0.22, 880, 0.14, 0.3, "square");
      return 0.85;
    }
    case "chime": {
      // Soft prayer bell — two detuned sines with long decay.
      pluck(c, dest, t0, 783.99, 1.6, 0.2, "sine");
      pluck(c, dest, t0 + 0.02, 786, 1.6, 0.12, "sine");
      pluck(c, dest, t0 + 0.5, 587.33, 1.8, 0.16, "sine");
      return 2.6;
    }
    case "pulse": {
      // Heartbeat sub-thump — low sine with pitch drop.
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(110, t0);
      o.frequency.exponentialRampToValueAtTime(48, t0 + 0.18);
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.5, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.24);
      o.connect(g).connect(dest);
      o.start(t0);
      o.stop(t0 + 0.3);
      // second softer thump
      pluck(c, dest, t0 + 0.32, 80, 0.2, 0.3, "sine");
      return 1.5;
    }
    case "radar": {
      // Sonar ping — sine sweep down with echo repeat.
      for (const [i, dt] of [0, 0.55, 1.1].entries()) {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(1180, t0 + dt);
        o.frequency.exponentialRampToValueAtTime(880, t0 + dt + 0.35);
        const peak = 0.22 / (i + 1);
        g.gain.setValueAtTime(0, t0 + dt);
        g.gain.linearRampToValueAtTime(peak, t0 + dt + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.5);
        o.connect(g).connect(dest);
        o.start(t0 + dt);
        o.stop(t0 + dt + 0.55);
      }
      return 2.0;
    }
  }
}

/**
 * Play a ringtone until stopped or `durationSec` elapses.
 * `key` lets callers check/replace a specific alarm (e.g. "alarm:block:12").
 */
export function playRingtone(
  name: RingtoneName,
  opts: { volume?: number; durationSec?: number; key?: string } = {},
): boolean {
  const c = getCtx();
  if (!c) return false;
  stopRingtone();

  const vol = Math.min(1, Math.max(0, opts.volume ?? 0.7));
  const durSec = Math.min(120, Math.max(3, opts.durationSec ?? 12));
  const m = getMaster(c, vol);
  const key = opts.key ?? `tone:${Date.now()}`;

  let stopped = false;
  const timers: number[] = [];
  const cycles: { osc: OscillatorNode[] } = { osc: [] };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    for (const t of timers) window.clearTimeout(t);
    try {
      m.gain.setTargetAtTime(0, c.currentTime, 0.04);
    } catch {
      /* ignore */
    }
    window.setTimeout(() => {
      try {
        m.disconnect();
      } catch {
        /* ignore */
      }
      if (master === m) master = null;
    }, 300);
    if (activeKey === key) {
      active = null;
      activeKey = "";
    }
  };

  active = { stop };
  activeKey = key;

  // Schedule cycles for the full duration up-front (Web Audio timeline).
  const start = c.currentTime + 0.05;
  let t = start;
  const deadline = start + durSec;
  let guard = 0;
  while (t < deadline && guard < 200) {
    const cycleLen = scheduleCycle(c, m, name, t);
    t += cycleLen;
    guard++;
  }
  void cycles;

  timers.push(window.setTimeout(stop, durSec * 1000));
  return true;
}

/** Short one-shot preview (2.4s) — used by the Settings ringtone picker. */
export function previewRingtone(name: RingtoneName, volume = 0.7): boolean {
  return playRingtone(name, { volume, durationSec: 2.4, key: `preview:${name}` });
}

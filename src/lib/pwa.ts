// Guarded service-worker registration wrapper. Never register an app-shell
// service worker in dev, inside an iframe, or when explicitly disabled.
import type { ScheduledEvent } from "./scheduler";

const APP_SW_PATH = "/sw.js";

function isRefusedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  if (window.top !== window.self) return true;

  const params = new URLSearchParams(window.location.search);
  if (params.get("sw") === "off") return true;
  return false;
}

async function unregisterAppSw() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    for (const reg of regs) {
      const scriptURL =
        reg.active?.scriptURL ?? reg.installing?.scriptURL ?? reg.waiting?.scriptURL;
      if (scriptURL && new URL(scriptURL).pathname === APP_SW_PATH) {
        await reg.unregister();
      }
    }
  } catch {
    /* ignore */
  }
}

export async function registerPwa() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (isRefusedContext()) {
    await unregisterAppSw();
    return;
  }
  try {
    await navigator.serviceWorker.register(APP_SW_PATH, { scope: "/" });
  } catch (err) {
    console.warn("[pwa] sw registration failed", err);
  }
}

/* ------------------------------ permission ---------------------------- */

export function isNotifySupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotifyPermission(): NotificationPermission | "unsupported" {
  if (!isNotifySupported()) return "unsupported";
  return Notification.permission;
}

/** Must be called from a user gesture (button click). */
export async function requestNotifyPermission(): Promise<NotificationPermission> {
  if (!isNotifySupported()) return "denied";
  if (Notification.permission === "default") {
    try {
      return await Notification.requestPermission();
    } catch {
      return "denied";
    }
  }
  return Notification.permission;
}

/* ------------------------------ sending ------------------------------- */

export interface SystemNotificationOptions {
  tag?: string;
  renotify?: boolean;
}

/**
 * Unified Windows/browser notification sender. Prefers the service worker
 * (`showNotification`), falls back to `new Notification`. Requests permission
 * on the fly when the app still has the "default" state.
 */
export async function sendSystemNotification(
  title: string,
  body: string,
  opts: SystemNotificationOptions = {},
): Promise<boolean> {
  if (!isNotifySupported()) return false;
  if (Notification.permission === "default") {
    const res = await requestNotifyPermission();
    if (res !== "granted") return false;
  } else if (Notification.permission !== "granted") {
    return false;
  }
  const icon = "/icons/icon-192.png";

  // Path 1: service worker. If it throws or is unavailable we MUST fall
  // through to the direct API instead of giving up — this was the bug that
  // made "Test Alert" silently fail whenever the SW path hiccuped.
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.showNotification(
          title,
          // `renotify` is a real Notification API option missing from TS lib.
          {
            body,
            icon,
            badge: icon,
            tag: opts.tag,
            renotify: opts.tag ? (opts.renotify ?? true) : undefined,
            data: { url: "/" },
          } as NotificationOptions,
        );
        return true;
      }
    } catch (err) {
      console.warn("[pwa] SW notification path failed, falling back to direct", err);
    }
  }

  // Path 2: direct constructor (works in dev where no SW is registered).
  try {
    const n = new Notification(title, {
      body,
      icon,
      tag: opts.tag,
      data: { url: "/" },
    });
    // Auto-close after 12s so a repeated tag doesn't stack in the Action Center.
    window.setTimeout(() => n.close(), 12000);
    return true;
  } catch (err) {
    console.warn("[pwa] direct notification failed", err);
    return false;
  }
}

/** Legacy name kept for call-site compatibility. */
export function requestNotifyAndShow(
  title: string,
  body: string,
  opts: SystemNotificationOptions = {},
): Promise<boolean> {
  return sendSystemNotification(title, body, opts);
}

/* --------------------- closed-tab schedule arming --------------------- */

/**
 * Hand the next ~25h of events to the service worker so notifications fire
 * even when the app/tab is closed (while the browser process is running).
 * Re-arming replaces the previous schedule (stale events are dropped).
 */
export async function armNotificationSchedule(events: ScheduledEvent[]) {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sw = reg?.active ?? reg?.waiting ?? reg?.installing;
    sw?.postMessage({ type: "ARM_NOTIFICATIONS", events });
  } catch {
    /* ignore */
  }
}

export async function clearNotificationSchedule() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sw = reg?.active ?? reg?.waiting ?? reg?.installing;
    sw?.postMessage({ type: "CLEAR_NOTIFICATIONS" });
  } catch {
    /* ignore */
  }
}

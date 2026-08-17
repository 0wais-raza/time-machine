/// <reference lib="webworker" />
export {};

declare let self: ServiceWorkerGlobalScope;

interface ScheduledEvent {
  id: string;
  title: string;
  body: string;
  at: string;
  tag?: string;
}

/** Simple app-shell + offline caching.
 *  Bump the version when shipping UI changes: the SW serves static assets
 *  cache-first, so without a bump users keep the previous bundle forever. */
const CACHE_HTML = "cv-html-v2";
const CACHE_STATIC = "cv-static-v2";
const CACHE_FONTS = "cv-fonts-v2";
/** Old cache names to purge on activate (one-time migration). */
const STALE_CACHE_NAMES = ["cv-html-v1", "cv-static-v1", "cv-fonts-v1"];
/** Schedule persistence — survives service worker restarts. */
const CACHE_SCHEDULE = "cv-schedule-v1";
const SCHEDULE_KEY = "/schedule.json";
/** Cap the schedule horizon the SW will hold (~25h). */
const MAX_DELAY_MS = 25 * 60 * 60 * 1000;

let timers: number[] = [];

/* ------------------------------ schedule ------------------------------ */

async function readSchedule(): Promise<ScheduledEvent[]> {
  try {
    const cache = await caches.open(CACHE_SCHEDULE);
    const res = await cache.match(SCHEDULE_KEY);
    if (!res) return [];
    const data: unknown = await res.json();
    return Array.isArray(data) ? (data as ScheduledEvent[]) : [];
  } catch {
    return [];
  }
}

async function writeSchedule(list: ScheduledEvent[]) {
  try {
    const cache = await caches.open(CACHE_SCHEDULE);
    await cache.put(
      SCHEDULE_KEY,
      new Response(JSON.stringify(list), {
        headers: { "content-type": "application/json" },
      }),
    );
  } catch {
    /* ignore */
  }
}

function clearTimers() {
  for (const t of timers) self.clearTimeout(t);
  timers = [];
}

/** Replace the armed schedule: clear old timers, persist, arm new ones. */
async function armSchedule(list: ScheduledEvent[]) {
  clearTimers();
  await writeSchedule(list);
  const now = Date.now();
  for (const ev of list) {
    const at = new Date(ev.at).getTime();
    const delay = at - now;
    if (delay <= 0 || delay > MAX_DELAY_MS) continue;
    timers.push(self.setTimeout(() => fireEvent(ev), delay));
  }
}

async function fireEvent(ev: ScheduledEvent) {
  const list = await readSchedule();
  await writeSchedule(list.filter((e) => e.id !== ev.id));
  try {
    await self.registration.showNotification(
      ev.title,
      // `renotify` is a real Notification API option missing from TS lib.
      {
        body: ev.body,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: ev.tag,
        renotify: ev.tag ? true : undefined,
        data: { url: "/" },
      } as NotificationOptions,
    );
  } catch {
    /* ignore */
  }
}

/* ------------------------------- lifecycle ---------------------------- */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      // Purge superseded caches so updated bundles are never served stale.
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => STALE_CACHE_NAMES.includes(k)).map((k) => caches.delete(k)),
      );
      // Re-arm from persisted schedule after any restart.
      const list = await readSchedule();
      await armSchedule(list);
      // Periodic background sync (Android) keeps the schedule fresh.
      const reg = self.registration as unknown as {
        periodicSync?: { register: (tag: string, opts: { minInterval: number }) => Promise<void> };
      };
      try {
        if (reg.periodicSync) {
          await reg.periodicSync.register("cv-schedule", { minInterval: 60 * 60 * 1000 });
        }
      } catch {
        /* unsupported — fine */
      }
    })(),
  );
});

self.addEventListener("message", (event) => {
  const data = (event as ExtendableMessageEvent).data as
    { type?: string; events?: ScheduledEvent[] } | undefined;
  if (!data) return;
  if (data.type === "ARM_NOTIFICATIONS" && Array.isArray(data.events)) {
    event.waitUntil(armSchedule(data.events as ScheduledEvent[]));
  } else if (data.type === "CLEAR_NOTIFICATIONS") {
    event.waitUntil(
      (async () => {
        clearTimers();
        await writeSchedule([]);
      })(),
    );
  }
});

self.addEventListener("periodicsync", (event) => {
  const ev = event as ExtendableEvent & { tag?: string };
  if (ev.tag === "cv-schedule") {
    ev.waitUntil(
      (async () => {
        const list = await readSchedule();
        await armSchedule(list);
      })(),
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  const url = (event.notification.data as { url?: string } | undefined)?.url || "/";
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) {
        if ("focus" in w) {
          await (w as WindowClient).focus();
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

/* --------------------------------- fetch ------------------------------ */

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never intercept API / oauth traffic.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/~oauth")) {
    event.respondWith(fetch(req));
    return;
  }

  // Navigations: network first, fall back to cached HTML, then the shell.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(req);
          if (res.ok) {
            const cache = await caches.open(CACHE_HTML);
            await cache.put(req, res.clone());
          }
          return res;
        } catch {
          const cached = await caches.match(req, { cacheName: CACHE_HTML });
          if (cached) return cached;
          const shell = await caches.match("/");
          if (shell) return shell;
          throw new Error("offline");
        }
      })(),
    );
    return;
  }

  // Same-origin static: stale-while-revalidate.
  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_STATIC);
        const cached = await cache.match(req);
        if (cached) {
          // Serve instantly, refresh the cache in the background.
          fetch(req)
            .then((res) => {
              if (res.ok) cache.put(req, res.clone());
            })
            .catch(() => undefined);
          return cached;
        }
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })(),
    );
    return;
  }

  // Google fonts: cache first.
  if (url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_FONTS);
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })(),
    );
  }
});

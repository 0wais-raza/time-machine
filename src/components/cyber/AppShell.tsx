import { useEffect, useRef } from "react";
import { useApp, todayStr, PRAYERS } from "@/lib/store";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { VizierDrawer } from "./VizierDrawer";
import { DashboardTab } from "./tabs/Dashboard";
import { NamazTab } from "./tabs/Namaz";
import { TodoTab } from "./tabs/Todo";
import { ScheduleTab } from "./tabs/Schedule";
import { AnalyticsTab } from "./tabs/Analytics";
import { WorkbenchTab } from "./tabs/Workbench";
import { SettingsTab } from "./tabs/Settings";
import { FocusOverlay } from "./FocusOverlay";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { requestNotifyAndShow } from "@/lib/pwa";
import { to12h } from "@/lib/clock";
import { fetchPrayerTimes } from "@/lib/prayerTimes";

const MILESTONES = [25, 50, 75, 100];

export function AppShell() {
  const {
    activeTab,
    tasks,
    blocks,
    prayers,
    prayerTimes,
    coords,
    setDayPrayerTimes,
    notificationsEnabled,
    notifiedMilestones,
    recordMilestone,
    pushNotification,
    dispatched,
    markDispatched,
    markBlockDone,
    recoveryBriefed,
    markRecoveryBriefed,
    pushToActive,
  } = useApp();

  // Boot: auto-fetch today's prayer times for stored coords (default Karachi).
  useEffect(() => {
    if (!coords) return;
    const today = todayStr();
    if (prayerTimes[today]) return;
    fetchPrayerTimes(new Date(), coords.lat, coords.lon)
      .then((map) => setDayPrayerTimes(today, map))
      .catch(() => {
        /* silent — fallback to seeded times */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coords?.lat, coords?.lon]);

  // Milestone notifications.
  const lastPctRef = useRef<number>(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const total = tasks.length || 1;
    const done = tasks.filter((t) => t.done).length;
    const pct = Math.round((done / total) * 100);
    const prev = lastPctRef.current;
    lastPctRef.current = pct;
    const today = todayStr();
    const fired = notifiedMilestones[today] ?? [];
    for (const m of MILESTONES) {
      if (pct >= m && prev < m && !fired.includes(m)) {
        const msg =
          m === 100
            ? "All directives executed. Issue the next mission."
            : `Daily progress crossed ${m}%. Hold the line.`;
        toast(`Vizier // ${m}%`, { description: msg });
        pushNotification({ kind: "milestone", title: `Vizier // ${m}%`, body: msg });
        if (notificationsEnabled) requestNotifyAndShow(`Vizier // ${m}%`, msg);
        recordMilestone(today, m);
      }
    }
  }, [tasks, notificationsEnabled, notifiedMilestones, recordMilestone, pushNotification]);

  // Unified pipeline: tasks (deadline), schedule blocks (start), prayers (approach).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tick = () => {
      const now = new Date();
      const nowMs = now.getTime();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const today = todayStr();
      const todayDay = now.getDay();

      // Deadlines
      for (const t of tasks) {
        if (t.done || !t.dueDate) continue;
        const due = new Date(t.dueDate).getTime();
        const key = `deadline:${t.id}`;
        if (due <= nowMs && !dispatched[key]) {
          markDispatched(key);
          pushNotification({ kind: "deadline", title: `Deadline // ${t.title}`, body: "Execute now." });
          toast(`Deadline reached`, { description: t.title });
          if (notificationsEnabled) requestNotifyAndShow(`Deadline // ${t.title}`, "Execute now.");
        }
      }

      // Schedule blocks starting now
      for (const b of blocks) {
        const day = typeof b.dayOfWeek === "number" ? b.dayOfWeek : new Date(b.date).getDay();
        if (day !== todayDay) continue;
        const [bh, bm] = b.start.split(":").map(Number);
        const startMins = bh * 60 + bm;
        const key = `block:${b.id}:${today}`;
        if (startMins <= nowMins && startMins >= nowMins - 1 && !dispatched[key]) {
          markDispatched(key);
          const range = `${to12h(b.start)} – ${to12h(b.end)}`;
          pushNotification({ kind: "block", title: `Block // ${b.title}`, body: range, refId: b.id });
          if (notificationsEnabled && typeof window !== "undefined" && "Notification" in window) {
            const blockId = b.id;
            const fire = () => {
              try {
                const n = new Notification(`Block // ${b.title}`, { body: range, icon: "/icons/icon-192.png" });
                // Dismissing the notification auto-registers this block as done.
                n.onclose = () => markBlockDone(blockId, today);
                n.onclick = () => markBlockDone(blockId, today);
              } catch {
                requestNotifyAndShow(`Block // ${b.title}`, range);
              }
            };
            if (Notification.permission === "granted") fire();
            else requestNotifyAndShow(`Block // ${b.title}`, range);
          }
        }
      }

      // Prayer approaching (within 10 min)
      const dayTimes = prayerTimes[today] ?? {};
      for (const p of PRAYERS) {
        const tStr = dayTimes[p.name] ?? p.time;
        const [ph, pm] = tStr.split(":").map(Number);
        const pMins = ph * 60 + pm;
        const diff = pMins - nowMins;
        if (diff <= 10 && diff >= 0) {
          const key = `prayer:${p.name}:${today}`;
          if (dispatched[key]) continue;
          if (prayers[today]?.[p.name]) continue;
          markDispatched(key);
          pushNotification({
            kind: "prayer",
            title: `${p.name} approaching`,
            body: `In ${diff} min — ${to12h(tStr)}`,
          });
          if (notificationsEnabled) requestNotifyAndShow(`${p.name} approaching`, `In ${diff} min`);
        }
      }
    };
    tick();
    const id = setInterval(tick, 60 * 1000);
    return () => clearInterval(id);
  }, [tasks, blocks, prayers, prayerTimes, notificationsEnabled, dispatched, markDispatched, pushNotification]);

  // Recovery Briefing — CRITICAL missions past due without completion trigger a
  // one-time audit message from the Chief of Staff.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const check = () => {
      const now = Date.now();
      for (const t of tasks) {
        if (t.done || t.priority !== "critical" || !t.dueDate) continue;
        if (new Date(t.dueDate).getTime() >= now) continue;
        if (recoveryBriefed[t.id]) continue;
        markRecoveryBriefed(t.id);
        const brief = `[RECOVERY BRIEFING] Sir, CRITICAL mission "${t.title}" has slipped past its deadline. Audit: (1) State the obstacle. (2) Reschedule now or terminate. (3) Confirm the corrective time block. Awaiting your directive.`;
        pushNotification({
          kind: "system",
          title: `Recovery // ${t.title}`,
          body: "Critical mission missed. Audit required.",
        });
        try {
          pushToActive({
            id: Math.random().toString(36).slice(2, 10),
            role: "assistant",
            content: brief,
            createdAt: new Date().toISOString(),
          });
        } catch { /* ignore */ }
        toast(`Recovery Briefing // ${t.title}`, { description: "Critical mission missed." });
        if (notificationsEnabled) requestNotifyAndShow("Recovery Briefing", t.title);
      }
    };
    check();
    const id = setInterval(check, 60 * 1000);
    return () => clearInterval(id);
  }, [tasks, recoveryBriefed, markRecoveryBriefed, pushNotification, pushToActive, notificationsEnabled]);

  const vizierCollapsed = useApp((s) => s.vizierCollapsed);
  const railWidth = vizierCollapsed ? 56 : 380;

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div
        className="flex min-w-0 flex-1 flex-col transition-[margin] duration-300"
        style={{ marginLeft: 240, marginRight: railWidth }}
      >
        <TopBar />
        <main className="scroll-y-clean flex-1 min-h-0 px-6 py-6">
          {activeTab === "dashboard" && <DashboardTab />}
          {activeTab === "namaz" && <NamazTab />}
          {activeTab === "todo" && <TodoTab />}
          {activeTab === "schedule" && <ScheduleTab />}
          {activeTab === "analytics" && <AnalyticsTab />}
          {activeTab === "workbench" && <WorkbenchTab />}
          {activeTab === "settings" && <SettingsTab />}
        </main>
      </div>
      <VizierDrawer />
      <Toaster theme="dark" />
      <FocusOverlay />
    </div>
  );
}
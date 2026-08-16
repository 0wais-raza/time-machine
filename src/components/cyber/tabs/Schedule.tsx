import { ScheduleMatrix } from "../ScheduleMatrix";

export function ScheduleTab() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="shrink-0">
        <div className="text-[10px] uppercase tracking-[0.4em] text-[var(--neon-cyan)]">
          Tab 04 / Chronos
        </div>
        <h1 className="mt-1 text-2xl font-black tracking-tight neon-text">
          Weekly Time Matrix
        </h1>
      </div>
      <div className="min-h-0 flex-1">
        <ScheduleMatrix />
      </div>
    </div>
  );
}
import { PanelHeader } from "../PanelHeader";
import { ScheduleMatrix } from "../ScheduleMatrix";

export function ScheduleTab() {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="shrink-0">
        <PanelHeader
          eyebrow="J.A.R.V.I.S. // Chronos"
          title="Weekly Time Matrix"
          subtitle="Drag to shift, resize to stretch, tick a block to bank 3 credits."
        />
      </div>
      <div className="min-h-0 flex-1">
        <ScheduleMatrix />
      </div>
    </div>
  );
}

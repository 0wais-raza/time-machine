import { useState } from "react";
import { PanelHeader } from "../PanelHeader";
import { ScheduleMatrix } from "../ScheduleMatrix";
import { StudyPlanner, ExamCountdownStrip } from "../StudyPlanner";
import { usePageEntrance } from "@/hooks/useGsapMotion";
import { HudLabel } from "../HudLabel";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, GraduationCap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApp } from "@/lib/store";

export function ScheduleTab() {
  const ref = usePageEntrance<HTMLDivElement>("schedule", {
    stagger: 0.08,
    y: 18,
    duration: 0.5,
  });
  const examSubjects = useApp((s) => s.examSubjects);
  const [plannerOpen, setPlannerOpen] = useState(examSubjects.length > 0);

  return (
    <div ref={ref} className="flex h-full min-h-0 flex-col gap-4">
      <div className="shrink-0">
        <PanelHeader
          eyebrow="J.A.R.V.I.S. // Chronos"
          title="Weekly Time Matrix"
          subtitle="Drag to shift, resize to stretch, tick a block to bank 3 credits."
          right={<ExamCountdownStrip />}
        />
      </div>

      {/* Study planner — exam command center */}
      <Collapsible open={plannerOpen} onOpenChange={setPlannerOpen} className="shrink-0">
        <div className="glass-panel overflow-hidden">
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-[oklch(1_1_1/0.02)]">
              <span className="flex items-center gap-2.5">
                <GraduationCap className="size-4 text-[var(--holo-violet)]" />
                <span>
                  <span className="block text-sm font-bold leading-tight">Study Planner</span>
                  <span className="block font-mono text-[9px] uppercase tracking-[0.22em] text-muted-foreground">
                    Exam countdowns · topic mastery · weekly load
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-2">
                <HudLabel accent="violet" dot={false} className="hidden md:flex">
                  Exam Command
                </HudLabel>
                <ChevronDown
                  className={cn(
                    "size-4 text-muted-foreground transition-transform duration-300",
                    plannerOpen && "rotate-180",
                  )}
                />
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-1 data-[state=closed]:duration-200">
            <div className="border-t border-[oklch(1_1_1/0.06)] p-4">
              <StudyPlanner />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      <div className="min-h-0 flex-1">
        <ScheduleMatrix />
      </div>
    </div>
  );
}

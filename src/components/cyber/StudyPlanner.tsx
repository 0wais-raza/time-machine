import { useMemo, useState } from "react";
import { useApp, todayStr, newId } from "@/lib/store";
import { cn } from "@/lib/utils";
import { HudLabel } from "./HudLabel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useNow } from "@/lib/clock";
import {
  Plus,
  Trash2,
  BookOpen,
  CalendarX2,
  Flame,
  GraduationCap,
  Minus,
  Check,
} from "lucide-react";

const COLORS = [
  { key: "", label: "Cyan", ring: "var(--holo-cyan)" },
  { key: "violet", label: "Violet", ring: "var(--holo-violet)" },
  { key: "pink", label: "Pink", ring: "var(--holo-pink)" },
  { key: "green", label: "Green", ring: "var(--holo-green)" },
  { key: "amber", label: "Amber", ring: "var(--holo-amber)" },
];

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr + "T23:59:59").getTime();
  return Math.ceil((target - Date.now()) / 86400000);
}

function urgencyTone(days: number | null): { text: string; chip: string; label: string } {
  if (days === null) return { text: "text-muted-foreground", chip: "border-border text-muted-foreground", label: "No date" };
  if (days <= 3)
    return {
      text: "text-[var(--holo-pink)]",
      chip: "border-[oklch(0.72_0.24_350/0.5)] bg-[oklch(0.72_0.24_350/0.08)] text-[var(--holo-pink)]",
      label: days === 0 ? "TODAY" : days === 1 ? "TOMORROW" : `${days} DAYS`,
    };
  if (days <= 7)
    return {
      text: "text-[var(--holo-amber)]",
      chip: "border-[oklch(0.82_0.16_80/0.5)] bg-[oklch(0.82_0.16_80/0.08)] text-[var(--holo-amber)]",
      label: `${days} DAYS`,
    };
  return {
    text: "text-[var(--holo-cyan)]",
    chip: "border-[oklch(0.85_0.17_200/0.4)] bg-[oklch(0.85_0.17_200/0.07)] text-[var(--holo-cyan)]",
    label: `${days} DAYS`,
  };
}

function AddSubjectDialog({ onAdd }: { onAdd: (s: { name: string; examDate?: string; totalTopics: number; targetHoursWeek: number; color: string }) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [examDate, setExamDate] = useState("");
  const [topics, setTopics] = useState("10");
  const [hours, setHours] = useState("6");
  const [color, setColor] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Plus className="size-3.5 mr-1" /> Subject
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-panel max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-mono text-[11px] uppercase tracking-[0.25em] text-[var(--holo-cyan)]">
            Add Exam Subject
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Subject</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Calculus II" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Exam date</Label>
              <Input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Topics</Label>
              <Input type="number" min={1} value={topics} onChange={(e) => setTopics(e.target.value)} className="mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Target h/week</Label>
            <Input type="number" min={1} value={hours} onChange={(e) => setHours(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Signal color</Label>
            <div className="mt-1.5 flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setColor(c.key)}
                  className={cn(
                    "h-7 flex-1 rounded border text-[9px] uppercase tracking-widest transition",
                    color === c.key ? "ring-2 ring-current" : "opacity-60",
                  )}
                  style={{ borderColor: c.ring, color: c.ring }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
          <Button
            className="w-full"
            onClick={() => {
              if (!name.trim()) return;
              onAdd({
                name: name.trim(),
                examDate: examDate || undefined,
                totalTopics: Math.max(1, parseInt(topics, 10) || 1),
                targetHoursWeek: Math.max(1, parseInt(hours, 10) || 1),
                color,
              });
              setName("");
              setOpen(false);
            }}
          >
            <GraduationCap className="size-4 mr-1" /> Add subject
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function StudyPlanner({ onPickSubject }: { onPickSubject?: (id: string) => void }) {
  const { examSubjects, addExamSubject, updateExamSubject, removeExamSubject, blocks } = useApp();
  const now = useNow(60000);
  void now;

  const sorted = useMemo(() => {
    return [...examSubjects].sort((a, b) => {
      const da = daysUntil(a.examDate) ?? 9999;
      const db = daysUntil(b.examDate) ?? 9999;
      return da - db;
    });
  }, [examSubjects]);

  // Weekly study minutes per subject from this week's completed study blocks.
  const weekMinutes = useMemo(() => {
    const map: Record<string, number> = {};
    for (const b of blocks) {
      if (b.category !== "study" || !b.subjectId) continue;
      const [sh, sm] = b.start.split(":").map(Number);
      const [eh, em] = b.end.split(":").map(Number);
      const mins = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
      map[b.subjectId] = (map[b.subjectId] ?? 0) + mins;
    }
    return map;
  }, [blocks]);

  const nextExam = sorted.find((s) => (daysUntil(s.examDate) ?? 9999) >= 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <HudLabel accent="violet">
          Exam Command · {nextExam ? `Next: ${nextExam.name}` : "No exams tracked"}
        </HudLabel>
        <AddSubjectDialog
          onAdd={(s) =>
            addExamSubject({
              name: s.name,
              color: s.color,
              examDate: s.examDate,
              totalTopics: s.totalTopics,
              masteredTopics: 0,
              targetHoursWeek: s.targetHoursWeek,
            })
          }
        />
      </div>

      {sorted.length === 0 && (
        <div className="glass-panel p-5 text-center text-sm italic text-muted-foreground">
          <BookOpen className="mx-auto mb-2 size-5 text-[var(--holo-violet)]" />
          No subjects tracked. Add your exam subjects — countdowns, topic mastery and study load
          will surface here.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sorted.map((sub) => {
          const days = daysUntil(sub.examDate);
          const tone = urgencyTone(days);
          const mastery = Math.round((sub.masteredTopics / Math.max(1, sub.totalTopics)) * 100);
          const hours = Math.round((weekMinutes[sub.id] ?? 0) / 60);
          const ring = COLORS.find((c) => c.key === (sub.color || ""))?.ring ?? "var(--holo-cyan)";
          const critical = days !== null && days <= 3;
          return (
            <div
              key={sub.id}
              className={cn(
                "glass-panel tilt-card relative overflow-hidden p-4",
                critical && "border-[oklch(0.72_0.24_350/0.45)] shadow-[0_0_26px_oklch(0.72_0.24_350/0.14)]",
              )}
            >
              {/* urgency wash */}
              {critical && (
                <div
                  className="pointer-events-none absolute inset-0 opacity-40"
                  style={{ background: "radial-gradient(circle at 85% 0%, oklch(0.72 0.24 350 / 0.14), transparent 55%)" }}
                />
              )}
              <div className="relative flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: ring, boxShadow: `0 0 8px ${ring}` }}
                    />
                    <input
                      value={sub.name}
                      onChange={(e) => updateExamSubject(sub.id, { name: e.target.value })}
                      className="w-full min-w-0 bg-transparent text-sm font-bold outline-none focus:underline"
                    />
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className={cn("rounded-md border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em]", tone.chip)}>
                      <CalendarX2 className="mr-1 inline size-2.5" />
                      {tone.label}
                    </span>
                    {sub.examDate && (
                      <span className="font-mono text-[9px] text-muted-foreground">
                        {new Date(sub.examDate + "T12:00:00").toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeExamSubject(sub.id)}
                  className="opacity-0 transition group-hover:opacity-100 text-muted-foreground hover:text-[var(--holo-pink)]"
                  title="Remove subject"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>

              {/* Topic mastery */}
              <div className="relative mt-3">
                <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  <span>Topic mastery</span>
                  <span className="tabular-nums">
                    {sub.masteredTopics}/{sub.totalTopics} · {mastery}%
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[oklch(1_1_1/0.06)]">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${mastery}%`, background: ring, boxShadow: `0 0 8px ${ring}` }}
                  />
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <button
                    onClick={() => updateExamSubject(sub.id, { masteredTopics: Math.max(0, sub.masteredTopics - 1) })}
                    className="flex size-6 items-center justify-center rounded border border-border text-muted-foreground transition hover:text-foreground"
                    title="Un-master a topic"
                  >
                    <Minus className="size-3" />
                  </button>
                  <button
                    onClick={() =>
                      updateExamSubject(sub.id, {
                        masteredTopics: Math.min(sub.totalTopics, sub.masteredTopics + 1),
                      })
                    }
                    className="flex size-6 items-center justify-center rounded border border-border text-muted-foreground transition hover:text-[var(--holo-green)]"
                    title="Master a topic"
                  >
                    <Check className="size-3" />
                  </button>
                  <button
                    onClick={() => onPickSubject?.(sub.id)}
                    className="ml-auto rounded-md border border-[oklch(0.66_0.27_295/0.4)] bg-[oklch(0.66_0.27_295/0.08)] px-2 py-1 font-mono text-[9px] uppercase tracking-widest text-[var(--holo-violet)] transition hover:bg-[oklch(0.66_0.27_295/0.16)]"
                    title="Create a study block for this subject in the matrix below"
                  >
                    <Plus className="mr-0.5 inline size-2.5" /> Block
                  </button>
                </div>
              </div>

              {/* Weekly load vs target */}
              <div className="relative mt-3 flex items-center justify-between border-t border-[oklch(1_1_1/0.06)] pt-2.5 font-mono text-[9px] uppercase tracking-widest">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <Flame className="size-3 text-[var(--holo-amber)]" />
                  {hours}h / {sub.targetHoursWeek}h this week
                </span>
                {hours >= sub.targetHoursWeek ? (
                  <span className="text-[var(--holo-green)]">On pace</span>
                ) : (
                  <span className="text-[var(--holo-amber)]">{sub.targetHoursWeek - hours}h to go</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Compact subject picker used inside the block editor. */
export function SubjectSelect({
  value,
  onChange,
}: {
  value?: string;
  onChange: (id: string | undefined) => void;
}) {
  const examSubjects = useApp((s) => s.examSubjects);
  const [key] = useState(() => newId());
  void key;
  if (examSubjects.length === 0) return null;
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Subject</Label>
      <div className="mt-1 flex flex-wrap gap-1.5">
        <button
          onClick={() => onChange(undefined)}
          className={cn(
            "rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-widest transition",
            !value
              ? "border-[var(--holo-cyan)] text-[var(--holo-cyan)]"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          None
        </button>
        {examSubjects.map((s) => (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            className={cn(
              "rounded-md border px-2 py-1 font-mono text-[10px] uppercase tracking-widest transition",
              value === s.id
                ? "border-[var(--holo-cyan)] text-[var(--holo-cyan)]"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {s.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Small strip shown in the Schedule header: days-to-nearest-exam. */
export function ExamCountdownStrip() {
  const examSubjects = useApp((s) => s.examSubjects);
  const next = [...examSubjects]
    .map((s) => ({ s, d: daysUntil(s.examDate) }))
    .filter((x) => x.d !== null && x.d >= 0)
    .sort((a, b) => (a.d ?? 0) - (b.d ?? 0))[0];
  if (!next) return null;
  const tone = urgencyTone(next.d);
  return (
    <span
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.2em]",
        tone.chip,
      )}
    >
      <GraduationCap className="size-3" />
      {next.s.name} · {tone.label}
    </span>
  );
}

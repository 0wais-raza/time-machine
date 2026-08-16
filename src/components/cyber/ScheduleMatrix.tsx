import { useMemo, useRef, useState } from "react";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { useApp, todayStr, type ScheduleBlock } from "@/lib/store";
import { useNow, to12h } from "@/lib/clock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const HOUR_PX = 48;
const SNAP_MIN = 15;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const COLORS = [
  { name: "Cyan", value: "" },
  { name: "Violet", value: "violet" },
  { name: "Pink", value: "pink" },
  { name: "Green", value: "green" },
  { name: "Amber", value: "amber" },
];

const colorClass = (c?: string) => {
  switch (c) {
    case "violet":
      return "bg-accent/12 border-accent/45 text-accent";
    case "pink":
      return "bg-destructive/12 border-destructive/40 text-destructive";
    case "green":
      return "bg-[oklch(0.7_0.13_155_/_0.14)] border-[oklch(0.7_0.13_155)]/45 text-[oklch(0.78_0.13_155)]";
    case "amber":
      return "bg-[oklch(0.75_0.14_85_/_0.14)] border-[oklch(0.75_0.14_85)]/45 text-[oklch(0.82_0.14_85)]";
    default:
      return "bg-primary/12 border-primary/45 text-primary";
  }
};

function toMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function toHHMM(mins: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(mins)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
const snap = (mins: number) => Math.round(mins / SNAP_MIN) * SNAP_MIN;
const blockDay = (b: ScheduleBlock): number =>
  typeof b.dayOfWeek === "number" ? b.dayOfWeek : new Date(b.date).getDay();

interface BlockProps {
  block: ScheduleBlock;
  onClick: () => void;
  onResize: (deltaMin: number) => void;
  onResizeEnd: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  done: boolean;
  onToggleDone: () => void;
}

function BlockCard({
  block,
  onClick,
  onResize,
  onResizeEnd,
  onDuplicate,
  onDelete,
  done,
  onToggleDone,
}: BlockProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: block.id,
    data: { block },
  });
  const start = toMins(block.start);
  const end = toMins(block.end);
  const top = (start / 60) * HOUR_PX;
  const height = Math.max(24, ((end - start) / 60) * HOUR_PX);

  const resizingRef = useRef(false);
  const justResizedRef = useRef(false);
  const startYRef = useRef(0);

  const onResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    resizingRef.current = true;
    startYRef.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onResizeMove = (e: React.PointerEvent) => {
    if (!resizingRef.current) return;
    const dy = e.clientY - startYRef.current;
    onResize((dy / HOUR_PX) * 60);
  };
  const onResizeUp = (e: React.PointerEvent) => {
    if (!resizingRef.current) return;
    resizingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    onResizeEnd();
    // Suppress the click event that fires immediately after pointerup.
    justResizedRef.current = true;
    window.setTimeout(() => {
      justResizedRef.current = false;
    }, 250);
  };

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={(e) => {
        if (resizingRef.current || justResizedRef.current) return;
        if (isDragging) return;
        e.stopPropagation();
        onClick();
      }}
      style={{
        position: "absolute",
        top,
        height,
        left: 4,
        right: 4,
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 40 : 10,
        opacity: isDragging ? 0.85 : 1,
      }}
      className={cn(
        "group rounded-lg border px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing select-none transition",
        colorClass(block.color),
        "hover:brightness-125",
        done && "opacity-60",
      )}
    >
      <div className="flex items-start gap-1.5">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleDone();
          }}
          title={done ? "Mark as not done" : "Mark block complete (+3 credits)"}
          className={cn(
            "mt-[1px] flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border transition",
            done ? "border-current bg-current/20" : "border-current/50 hover:bg-current/15",
          )}
        >
          {done && <Check className="size-2.5" />}
        </button>
        <div
          className={cn(
            "font-semibold text-[11px] leading-tight truncate",
            done && "line-through",
          )}
        >
          {block.title}
        </div>
      </div>
      <div className="font-mono text-[10px] opacity-80 leading-tight">
        {to12h(block.start)} – {to12h(block.end)}
      </div>
      <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100">
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          className="rounded p-0.5 hover:bg-background/40"
          title="Duplicate"
        >
          <Copy className="size-3" />
        </button>
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="rounded p-0.5 hover:bg-background/40"
          title="Delete"
        >
          <Trash2 className="size-3" />
        </button>
      </div>
      <div
        onPointerDown={onResizeStart}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
        onPointerCancel={onResizeUp}
        className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
        style={{ touchAction: "none" }}
        title="Drag to resize"
      />
      <div className="pointer-events-none absolute inset-x-2 bottom-0.5 h-0.5 rounded-full bg-current opacity-30 group-hover:opacity-80" />
    </div>
  );
}

function DayColumn({
  dayIdx,
  blocks,
  onSelect,
  onResize,
  onResizeEnd,
  onDuplicate,
  onDelete,
  isToday,
  nowMins,
  doneIds,
  onToggleDone,
}: {
  dayIdx: number;
  blocks: ScheduleBlock[];
  onSelect: (b: ScheduleBlock) => void;
  onResize: (id: string, dMin: number) => void;
  onResizeEnd: () => void;
  onDuplicate: (b: ScheduleBlock) => void;
  onDelete: (id: string) => void;
  isToday: boolean;
  nowMins: number;
  doneIds: string[];
  onToggleDone: (id: string) => void;
}) {
  return (
    <div
      data-day={dayIdx}
      className="relative flex-1 border-r border-border/40 last:border-r-0"
      style={{ height: 24 * HOUR_PX }}
    >
      {HOURS.map((h) => (
        <div
          key={h}
          className="absolute inset-x-0 border-t border-border/30"
          style={{ top: h * HOUR_PX }}
        />
      ))}
      {isToday && (
        <div
          className="absolute inset-x-0 z-30 h-px bg-primary"
          style={{ top: (nowMins / 60) * HOUR_PX }}
        />
      )}
      {blocks.map((b) => (
        <BlockCard
          key={b.id}
          block={b}
          onClick={() => onSelect(b)}
          onResize={(d) => onResize(b.id, d)}
          onResizeEnd={onResizeEnd}
          onDuplicate={() => onDuplicate(b)}
          onDelete={() => onDelete(b.id)}
          done={doneIds.includes(b.id)}
          onToggleDone={() => onToggleDone(b.id)}
        />
      ))}
    </div>
  );
}

export function ScheduleMatrix() {
  const {
    blocks,
    addBlock,
    removeBlock,
    updateBlock,
    completedBlocks,
    markBlockDone,
    unmarkBlockDone,
  } = useApp();
  const dateKey = todayStr();
  const doneIds = completedBlocks[dateKey] ?? [];
  const toggleDone = (id: string) =>
    doneIds.includes(id) ? unmarkBlockDone(id, dateKey) : markBlockDone(id, dateKey);
  const [editing, setEditing] = useState<ScheduleBlock | null>(null);
  const [resizingDraft, setResizingDraft] = useState<Record<string, number>>({});
  const now = useNow(30000);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const blocksByDay = useMemo(() => {
    const map: Record<number, ScheduleBlock[]> = {};
    for (let i = 0; i < 7; i++) map[i] = [];
    for (const b of blocks) {
      const d = blockDay(b);
      if (map[d]) {
        const draft = resizingDraft[b.id];
        if (draft != null) {
          const startM = toMins(b.start);
          const endM = Math.max(startM + SNAP_MIN, snap(toMins(b.end) + draft));
          map[d].push({ ...b, end: toHHMM(endM) });
        } else {
          map[d].push(b);
        }
      }
    }
    return map;
  }, [blocks, resizingDraft]);

  const onDragEnd = (e: DragEndEvent) => {
    const block = e.active.data.current?.block as ScheduleBlock | undefined;
    if (!block) return;
    const { x, y } = e.delta;

    // Vertical → time shift
    const deltaMin = snap((y / HOUR_PX) * 60);
    const dur = toMins(block.end) - toMins(block.start);
    let newStart = Math.max(0, Math.min(24 * 60 - dur, toMins(block.start) + deltaMin));
    newStart = snap(newStart);
    const newEnd = newStart + dur;

    // Horizontal → day shift (column width)
    const matrix = document.getElementById("matrix-grid");
    const colW = matrix ? matrix.clientWidth / 7 : 120;
    const dayDelta = Math.round(x / colW);
    const currentDay = blockDay(block);
    const newDay = Math.max(0, Math.min(6, currentDay + dayDelta));

    updateBlock(block.id, {
      start: toHHMM(newStart),
      end: toHHMM(newEnd),
      dayOfWeek: newDay,
    });
  };

  const nowMins = now ? now.getHours() * 60 + now.getMinutes() : 0;
  const todayIdx = new Date().getDay();

  const newBlock = () => {
    addBlock({
      title: "New Block",
      category: "work",
      start: "09:00",
      end: "10:00",
      date: new Date().toISOString().slice(0, 10),
      dayOfWeek: todayIdx,
    });
  };

  const duplicateBlock = (b: ScheduleBlock) => {
    addBlock({
      title: b.title,
      category: b.category,
      start: b.start,
      end: b.end,
      date: b.date,
      dayOfWeek: blockDay(b),
      color: b.color,
      notes: b.notes,
    });
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="glass-panel flex items-center justify-between px-4 py-2 shrink-0">
        <div className="text-xs text-muted-foreground">
          Weekly routine · check a block off to earn 3 credits
        </div>
        <Button size="sm" onClick={newBlock}>
          <Plus className="size-4 mr-1" /> Block
        </Button>
      </div>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="glass-panel flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 border-b border-border bg-background/60">
            <div className="w-16 shrink-0 border-r border-border" />
            {DAY_NAMES.map((name, i) => (
              <div
                key={i}
                className={cn(
                  "flex-1 px-2 py-2 text-center border-r border-border last:border-r-0",
                  i === todayIdx && "bg-primary/8",
                )}
              >
                <div className="text-[10px] text-muted-foreground">
                  {DAY_SHORT[i]}
                </div>
                <div
                  className={cn(
                    "text-sm font-semibold",
                    i === todayIdx && "text-primary",
                  )}
                >
                  {name}
                </div>
              </div>
            ))}
          </div>

          <div className="scroll-y-clean relative flex min-h-0 flex-1">
            <div className="sticky left-0 z-10 w-16 shrink-0 border-r border-border bg-background/40">
              <div style={{ height: 24 * HOUR_PX }} className="relative">
                {HOURS.map((h) => {
                  const ampm = h >= 12 ? "PM" : "AM";
                  const h12 = h % 12 || 12;
                  return (
                    <div
                      key={h}
                      className="absolute right-2 -mt-2 font-mono text-[10px] text-muted-foreground"
                      style={{ top: h * HOUR_PX }}
                    >
                      {h12} {ampm}
                    </div>
                  );
                })}
              </div>
            </div>
            <div id="matrix-grid" className="flex flex-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <DayColumn
                  key={i}
                  dayIdx={i}
                  blocks={blocksByDay[i] ?? []}
                  onSelect={(b) => setEditing(b)}
                  onResize={(id, dMin) =>
                    setResizingDraft((s) => ({ ...s, [id]: dMin }))
                  }
                  onResizeEnd={() => {
                    Object.entries(resizingDraft).forEach(([id, dMin]) => {
                      const b = blocks.find((x) => x.id === id);
                      if (!b) return;
                      const startM = toMins(b.start);
                      const endM = Math.max(startM + SNAP_MIN, snap(toMins(b.end) + dMin));
                      updateBlock(id, { end: toHHMM(endM) });
                    });
                    setResizingDraft({});
                  }}
                  onDuplicate={duplicateBlock}
                  onDelete={removeBlock}
                  isToday={i === todayIdx}
                  nowMins={nowMins}
                  doneIds={i === todayIdx ? doneIds : []}
                  onToggleDone={toggleDone}
                />
              ))}
            </div>
          </div>
        </div>
      </DndContext>

      {editing && (
        <BlockEditor
          block={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => {
            updateBlock(editing.id, patch);
            setEditing(null);
          }}
          onDelete={() => {
            removeBlock(editing.id);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function BlockEditor({
  block,
  onClose,
  onSave,
  onDelete,
}: {
  block: ScheduleBlock;
  onClose: () => void;
  onSave: (patch: Partial<ScheduleBlock>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(block.title);
  const [category, setCategory] = useState(block.category);
  const [start, setStart] = useState(block.start);
  const [end, setEnd] = useState(block.end);
  const [day, setDay] = useState<number>(blockDay(block));
  const [color, setColor] = useState(block.color ?? "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-panel w-full max-w-md space-y-3 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-semibold">Edit block</div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ScheduleBlock["category"])}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="study">Study</SelectItem>
                <SelectItem value="work">Work</SelectItem>
                <SelectItem value="rest">Rest</SelectItem>
                <SelectItem value="prayer">Prayer</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Day</Label>
            <Select value={String(day)} onValueChange={(v) => setDay(Number(v))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAY_NAMES.map((d, i) => (
                  <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">Start</Label>
            <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">End</Label>
            <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1" />
          </div>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Color</Label>
          <div className="mt-1 flex gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setColor(c.value)}
                className={cn(
                  "h-7 flex-1 rounded border text-[10px] uppercase tracking-widest",
                  colorClass(c.value),
                  color === c.value ? "ring-2 ring-offset-1 ring-offset-background ring-current" : "opacity-60",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-[var(--neon-pink)]">
            <Trash2 className="size-4 mr-1" /> Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
            <Button
              size="sm"
              onClick={() =>
                onSave({ title, category, start, end, dayOfWeek: day, color })
              }
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
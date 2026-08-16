import type { ScheduleBlock } from "./store";

const toMins = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const toHHMM = (mins: number): string => {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(mins)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

export interface ConflictResolution {
  /** Blocks to delete (fully consumed). */
  deleteIds: string[];
  /** Blocks to shrink: id -> patch. */
  updates: Record<string, Partial<ScheduleBlock>>;
}

/**
 * Compute how a new block should displace existing blocks on the same day.
 * - Fully covered blocks are deleted.
 * - Partial overlaps are trimmed on the offending side.
 * - Blocks fully inside the new block boundary are deleted.
 * - A block that STRICTLY contains the new block is split (left kept, right added).
 */
export function resolveConflicts(
  existing: ScheduleBlock[],
  incoming: { start: string; end: string; dayOfWeek: number },
): ConflictResolution & { splitAdditions: Omit<ScheduleBlock, "id">[] } {
  const ns = toMins(incoming.start);
  const ne = toMins(incoming.end);
  const deleteIds: string[] = [];
  const updates: Record<string, Partial<ScheduleBlock>> = {};
  const splitAdditions: Omit<ScheduleBlock, "id">[] = [];

  for (const b of existing) {
    const day =
      typeof b.dayOfWeek === "number" ? b.dayOfWeek : new Date(b.date).getDay();
    if (day !== incoming.dayOfWeek) continue;
    const bs = toMins(b.start);
    const be = toMins(b.end);
    // No overlap
    if (be <= ns || bs >= ne) continue;
    // Fully consumed
    if (bs >= ns && be <= ne) {
      deleteIds.push(b.id);
      continue;
    }
    // Existing block strictly contains new block -> split.
    if (bs < ns && be > ne) {
      updates[b.id] = { end: toHHMM(ns) };
      splitAdditions.push({
        title: b.title,
        category: b.category,
        start: toHHMM(ne),
        end: toHHMM(be),
        date: b.date,
        dayOfWeek: day,
        color: b.color,
        notes: b.notes,
      });
      continue;
    }
    // Overlaps at the tail of existing
    if (bs < ns && be > ns && be <= ne) {
      updates[b.id] = { end: toHHMM(ns) };
      continue;
    }
    // Overlaps at the head of existing
    if (bs >= ns && bs < ne && be > ne) {
      updates[b.id] = { start: toHHMM(ne) };
      continue;
    }
  }
  return { deleteIds, updates, splitAdditions };
}
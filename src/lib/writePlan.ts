import type { Entry, Idea, Memory, Workspace } from "./schema";

/** Workspace fields that live in one small record rather than per-item stores. */
export interface WorkspaceMeta {
  version: Workspace["version"];
  settings: Workspace["settings"];
  preferences: Workspace["preferences"];
  ideaOrder: string[];
  entryOrder: string[];
  memoryOrder: string[];
}
/** A journal entry as stored: photos live in their own store. */
export type StoredEntry = Omit<Entry, "images"> & {
  images: { id: string; name: string }[];
};
export interface ImageWrite {
  id: string;
  entryId: string;
  dataUrl: string;
}
export interface WritePlan {
  meta: WorkspaceMeta | null;
  ideas: { put: Idea[]; remove: string[] };
  entries: { put: StoredEntry[]; remove: string[] };
  memories: { put: Memory[]; remove: string[] };
  images: { put: ImageWrite[]; remove: string[] };
}

const ids = (items: { id: string }[]) => items.map((i) => i.id);
const sameOrder = (a: string[], b: string[]) =>
  a.length === b.length && a.every((id, i) => id === b[i]);

function diff<T extends { id: string }>(prev: T[], next: T[]) {
  const before = new Map(prev.map((item) => [item.id, item]));
  const after = new Set(ids(next));
  return {
    // Workspace updates are immutable, so identity tells us what changed.
    put: next.filter((item) => before.get(item.id) !== item),
    remove: prev.filter((item) => !after.has(item.id)).map((i) => i.id),
  };
}

export function storedEntry(entry: Entry): StoredEntry {
  return {
    ...entry,
    images: entry.images.map(({ id, name }) => ({ id, name })),
  };
}

export function metaOf(w: Workspace): WorkspaceMeta {
  return {
    version: w.version,
    settings: w.settings,
    preferences: w.preferences,
    ideaOrder: ids(w.ideas),
    entryOrder: ids(w.entries),
    memoryOrder: ids(w.memories),
  };
}

/** The minimal set of record writes that turns `prev` (already stored) into `next`. */
export function planWrites(prev: Workspace | null, next: Workspace): WritePlan {
  const base: Workspace = prev ?? {
    ...next,
    ideas: [],
    entries: [],
    memories: [],
  };
  const metaChanged =
    !prev ||
    prev.version !== next.version ||
    prev.settings !== next.settings ||
    prev.preferences !== next.preferences ||
    !sameOrder(ids(prev.ideas), ids(next.ideas)) ||
    !sameOrder(ids(prev.entries), ids(next.entries)) ||
    !sameOrder(ids(prev.memories), ids(next.memories));
  const entries = diff(base.entries, next.entries);
  const previousImages = new Map(
    base.entries.flatMap((e) => e.images.map((i) => [i.id, i] as const)),
  );
  const nextImageIds = new Set(
    next.entries.flatMap((e) => e.images.map((i) => i.id)),
  );
  const imagePuts: ImageWrite[] = [];
  for (const entry of entries.put)
    for (const image of entry.images)
      if (previousImages.get(image.id)?.dataUrl !== image.dataUrl)
        imagePuts.push({
          id: image.id,
          entryId: entry.id,
          dataUrl: image.dataUrl,
        });
  return {
    meta: metaChanged ? metaOf(next) : null,
    ideas: diff(base.ideas, next.ideas),
    entries: { put: entries.put.map(storedEntry), remove: entries.remove },
    memories: diff(base.memories, next.memories),
    images: {
      put: imagePuts,
      remove: [...previousImages.keys()].filter((id) => !nextImageIds.has(id)),
    },
  };
}

export function isEmptyPlan(plan: WritePlan) {
  return (
    !plan.meta &&
    [plan.ideas, plan.entries, plan.memories, plan.images].every(
      (c) => !c.put.length && !c.remove.length,
    )
  );
}

import { contextLimit } from "../../shared/contract.js";
import type { Workspace } from "./schema";

/**
 * Character budget per section. Each section is filled newest-first until its
 * budget is spent, so one long section can't push the others out and the result
 * is always complete JSON. Unused budget is not redistributed, which keeps the
 * selection predictable.
 */
export const contextBudgets = {
  preferences: 6500,
  recentIdeas: 2000,
  journal: 5200,
} as const;
const limits = { preferences: 30, recentIdeas: 15, journal: 5 } as const;
const journalBodyLimit = 1200;

function fill<T>(items: T[], max: number, budget: number): T[] {
  const kept: T[] = [];
  let used = 2; // []
  for (const item of items.slice(0, max)) {
    const size = JSON.stringify(item).length + (kept.length ? 1 : 0);
    if (used + size > budget) break;
    kept.push(item);
    used += size;
  }
  return kept;
}

export function buildContext(w: Workspace): {
  context: string;
  images: string[];
} {
  if (!w.settings.useMemory)
    return { context: "No personal context. Memory is disabled.", images: [] };
  const shared = w.entries.filter((e) => e.shareWithAI);
  const journal = fill(
    shared.map((e) => ({
      title: e.title,
      body: e.body.slice(0, journalBodyLimit),
      images: e.images.map((i) => i.name),
    })),
    limits.journal,
    contextBudgets.journal,
  );
  const context = JSON.stringify({
    preferences: fill(
      w.memories.map((m) => m.text),
      limits.preferences,
      contextBudgets.preferences,
    ),
    recentIdeas: fill(
      w.ideas.map((i) => ({
        title: i.title,
        category: i.category,
        rating: i.rating,
      })),
      limits.recentIdeas,
      contextBudgets.recentIdeas,
    ),
    journal,
  });
  if (context.length > contextLimit)
    throw new Error("Personal context exceeded its budget.");
  return {
    context,
    // Photos only come from journal entries that made it into the context.
    images: shared
      .slice(0, journal.length)
      .flatMap((e) => e.images.map((i) => i.dataUrl))
      .slice(0, 2),
  };
}

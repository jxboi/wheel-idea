import type { Workspace } from "./schema";
export function buildContext(w: Workspace): {
  context: string;
  images: string[];
} {
  if (!w.settings.useMemory)
    return { context: "No personal context. Memory is disabled.", images: [] };
  const entries = w.entries.filter((e) => e.shareWithAI).slice(0, 5);
  const context = JSON.stringify({
    preferences: w.memories.slice(0, 30).map((m) => m.text),
    recentIdeas: w.ideas
      .slice(0, 15)
      .map((i) => ({ title: i.title, category: i.category, rating: i.rating })),
    journal: entries.map((e) => ({
      title: e.title,
      body: e.body.slice(0, 1200),
      images: e.images.map((i) => i.name),
    })),
  });
  return {
    context: context.slice(0, 14000),
    images: entries.flatMap((e) => e.images.map((i) => i.dataUrl)).slice(0, 2),
  };
}

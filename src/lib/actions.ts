// Pure workspace transitions. Each returns a new workspace and leaves untouched
// records by identity, which lets storage write only what changed.
import type {
  Entry,
  Idea,
  Memory,
  Preferences,
  Provider,
  ResearchStatus,
  Settings,
  Source,
  Workspace,
} from "./schema";

type Clock = { now: () => string; id: () => string };
const system: Clock = {
  now: () => new Date().toISOString(),
  id: () => crypto.randomUUID(),
};

export function researchStatusFor(
  provider: Provider,
  sources: Source[],
): ResearchStatus {
  if (provider === "preview") return "preview";
  if (sources.some((s) => s.verified)) return "cited";
  return sources.length ? "unverified" : "uncited";
}

export const addIdea = (w: Workspace, idea: Idea): Workspace => ({
  ...w,
  ideas: [idea, ...w.ideas],
});

export const updateIdea = (w: Workspace, idea: Idea): Workspace => ({
  ...w,
  ideas: w.ideas.map((i) => (i.id === idea.id ? idea : i)),
});

/** Deleting an idea also forgets the memory notes created from its feedback. */
export const deleteIdea = (w: Workspace, id: string): Workspace => ({
  ...w,
  ideas: w.ideas.filter((i) => i.id !== id),
  memories: w.memories.filter((m) => m.ideaId !== id),
});

/** Feedback is kept on the idea and as an editable, forgettable memory note. */
export function addFeedback(
  w: Workspace,
  ideaId: string,
  text: string,
  clock: Clock = system,
): Workspace {
  const idea = w.ideas.find((i) => i.id === ideaId);
  if (!idea) return w;
  const now = clock.now();
  return {
    ...w,
    ideas: w.ideas.map((i) =>
      i.id === ideaId
        ? {
            ...i,
            feedback: [...i.feedback, { id: clock.id(), text, createdAt: now }],
          }
        : i,
    ),
    memories: [
      {
        id: clock.id(),
        text: `About “${idea.title}” (${idea.category}): ${text}`.slice(
          0,
          2000,
        ),
        source: "feedback",
        ideaId,
        createdAt: now,
      },
      ...w.memories,
    ],
  };
}

export const saveEntry = (w: Workspace, entry: Entry): Workspace => ({
  ...w,
  entries: [entry, ...w.entries.filter((e) => e.id !== entry.id)],
});

export const deleteEntry = (w: Workspace, id: string): Workspace => ({
  ...w,
  entries: w.entries.filter((e) => e.id !== id),
});

export const addMemory = (
  w: Workspace,
  text: string,
  clock: Clock = system,
): Workspace => ({
  ...w,
  memories: [
    { id: clock.id(), text, source: "you", createdAt: clock.now() },
    ...w.memories,
  ],
});

export const editMemory = (w: Workspace, memory: Memory): Workspace => ({
  ...w,
  memories: w.memories.map((m) => (m.id === memory.id ? memory : m)),
});

export const deleteMemory = (w: Workspace, id: string): Workspace => ({
  ...w,
  memories: w.memories.filter((m) => m.id !== id),
});

export const setSettings = (w: Workspace, settings: Settings): Workspace => ({
  ...w,
  settings,
});

export const setUseMemory = (w: Workspace, useMemory: boolean): Workspace => ({
  ...w,
  settings: { ...w.settings, useMemory },
});

export const setPreferences = (
  w: Workspace,
  preferences: Preferences,
): Workspace => ({ ...w, preferences });

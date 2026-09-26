import type { Page, ProgressEvent } from "../../../shared/contract.js";
import type { Idea, Workspace } from "../../lib/schema";

/** What the user handed the model for this spin, for display only. */
export type Ingredients = {
  duration: Idea["duration"];
  mood: string;
  /** null when memory is off. */
  memory: {
    notes: number;
    recentIdeas: number;
    journal: number;
    photos: number;
  } | null;
};

/** Everything observed about one generation so far. */
export type Activity = {
  startedAt: number;
  ingredients: Ingredients;
  /** The server accepted the request and passed it to the provider. */
  started: boolean;
  local: boolean;
  searches: string[];
  pages: Page[];
  /** The latest exposed reasoning, trimmed to a readable tail. */
  thinking: string;
  draft: string;
  /** The kind of the most recent progress event. */
  latest: "search" | "pages" | "thinking" | "draft" | null;
};

const thinkingTail = 360;
const draftLimit = 30000;

export function ingredientsFor(
  workspace: Workspace,
  context: string,
  images: string[],
): Ingredients {
  const { duration, mood } = workspace.preferences;
  if (!workspace.settings.useMemory)
    return { duration, mood: mood.trim(), memory: null };
  const parsed = JSON.parse(context) as {
    preferences: unknown[];
    recentIdeas: unknown[];
    journal: unknown[];
  };
  return {
    duration,
    mood: mood.trim(),
    memory: {
      notes: parsed.preferences.length,
      recentIdeas: parsed.recentIdeas.length,
      journal: parsed.journal.length,
      photos: images.length,
    },
  };
}

export function newActivity(ingredients: Ingredients): Activity {
  return {
    startedAt: Date.now(),
    ingredients,
    started: false,
    local: false,
    searches: [],
    pages: [],
    thinking: "",
    draft: "",
    latest: null,
  };
}

/** Fold one streamed event into the activity. Pure, so it is easy to test. */
export function applyEvent(activity: Activity, event: ProgressEvent): Activity {
  switch (event.type) {
    case "started":
      return { ...activity, started: true, local: event.local };
    case "search":
      return {
        ...activity,
        latest: "search",
        searches: activity.searches.includes(event.query)
          ? activity.searches
          : [...activity.searches, event.query],
      };
    case "pages": {
      const known = new Set(activity.pages.map((p) => p.url));
      const fresh = event.pages.filter((p) => !known.has(p.url));
      return {
        ...activity,
        latest: "pages",
        pages: [...activity.pages, ...fresh],
      };
    }
    case "thinking":
      return {
        ...activity,
        latest: "thinking",
        thinking: (activity.thinking + event.text).slice(-thinkingTail * 2),
      };
    case "draft":
      return {
        ...activity,
        latest: "draft",
        draft: (activity.draft + event.text).slice(0, draftLimit),
      };
    default:
      return activity;
  }
}

export type Step =
  "sending" | "asking" | "searching" | "reading" | "thinking" | "writing";

/** The step to headline: whatever the provider was most recently seen doing. */
export function currentStep(activity: Activity): Step {
  if (!activity.started) return "sending";
  switch (activity.latest) {
    case "search":
      return "searching";
    case "pages":
      return "reading";
    case "thinking":
      return "thinking";
    // Models sometimes narrate before the brief; that still reads as thinking.
    case "draft":
      return activity.draft.includes("{") ? "writing" : "thinking";
    default:
      return "asking";
  }
}

/** Readable reasoning tail, starting at a word boundary. */
export function thinkingSnippet(thinking: string) {
  const flat = thinking.replace(/\s+/g, " ").trim();
  if (flat.length <= thinkingTail) return flat;
  const tail = flat.slice(-thinkingTail);
  return `…${tail.slice(tail.indexOf(" ") + 1)}`;
}

/** Decode a JSON string body that may be cut off mid-escape. */
function decodePartial(raw: string) {
  const safe = raw.replace(/\\(u[0-9a-fA-F]{0,3})?$/, "");
  try {
    return JSON.parse(`"${safe}"`) as string;
  } catch {
    return safe.replace(/\\n/g, " ").replace(/\\"/g, '"');
  }
}

function field(draft: string, name: string) {
  const match = new RegExp(`"${name}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)("?)`).exec(
    draft,
  );
  return match
    ? { text: decodePartial(match[1]), done: match[2] === '"' }
    : null;
}

/**
 * Read what is legible so far from a brief that is still being written as JSON.
 * The model's output is not trusted or validated until the final result.
 */
export function partialBrief(draft: string) {
  const title = field(draft, "title");
  const summary = field(draft, "summary");
  const featuresStart = draft.search(/"features"\s*:\s*\[/);
  const features =
    featuresStart < 0
      ? 0
      : (
          draft
            .slice(featuresStart)
            .split(/\]/)[0]
            .match(/"(?:[^"\\]|\\.)*"\s*[,\]]?/g) ?? []
        ).length - 1;
  const prompt = field(draft, "prompt");
  return {
    title: title?.text ?? "",
    summary: summary?.text ?? "",
    features: Math.max(0, features),
    promptWords: prompt ? prompt.text.split(/\s+/).filter(Boolean).length : 0,
  };
}

import {
  progressEventSchema,
  progressMediaType,
  type ProgressEvent,
} from "../../../shared/contract.js";
import { briefSchema, type Idea, type Workspace } from "../../lib/schema";

export type Credentials = { key: string; token: string };

/**
 * Request a brief. The server streams progress as NDJSON and ends with the
 * result or an error. Errors raised before generation starts arrive as JSON.
 */
export async function requestBrief(
  workspace: Workspace,
  credentials: Credentials,
  category: Idea["category"],
  prepared: { context: string; images: string[] },
  signal: AbortSignal,
  onEvent: (event: ProgressEvent) => void,
) {
  const { settings, preferences } = workspace;
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: `${progressMediaType}, application/json`,
      ...(credentials.key ? { "X-Provider-Key": credentials.key } : {}),
      ...(credentials.token ? { "X-Workspace-Token": credentials.token } : {}),
    },
    body: JSON.stringify({
      category,
      duration: preferences.duration,
      mood: preferences.mood,
      settings,
      ...prepared,
    }),
    signal,
  });
  const unexpected =
    "The server returned an unexpected response. Please try again.";
  if (
    !response.ok ||
    !response.body ||
    !response.headers.get("Content-Type")?.startsWith(progressMediaType)
  ) {
    const result = await response.json().catch(() => ({ error: unexpected }));
    if (!response.ok)
      throw new Error(result.error || "Could not generate an idea.");
    return briefSchema.parse(result);
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    buffer += value ?? "";
    const lines = buffer.split("\n");
    buffer = done ? "" : (lines.pop() ?? "");
    for (const line of lines) {
      if (!line.trim()) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        throw new Error(unexpected);
      }
      const event = progressEventSchema.safeParse(parsed);
      // Unknown or oversized progress is skipped; only the result must be valid.
      if (!event.success) {
        if ((parsed as { type?: unknown })?.type === "result")
          throw new Error(
            "The model returned an incomplete brief. Try again or choose another model.",
          );
        continue;
      }
      if (event.data.type === "result") return event.data.brief;
      if (event.data.type === "error") throw new Error(event.data.error);
      onEvent(event.data);
    }
    if (done) break;
  }
  throw new Error(
    "The connection closed before the idea was finished. Try again.",
  );
}

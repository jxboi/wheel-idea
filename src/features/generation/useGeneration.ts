import { useCallback, useEffect, useRef, useState } from "react";
import {
  categories,
  briefSchema,
  type Idea,
  type Workspace,
} from "../../lib/schema";
import { buildContext } from "../../lib/context";
import { previewBrief } from "../../lib/preview";
import { landingRotation, pickCategory } from "../../lib/wheel";
import { researchStatusFor } from "../../lib/actions";

export type Credentials = { key: string; token: string };

const spinMs = 4900;
const reducedSpinMs = 150;
// Slightly below the server's 120-second function limit.
const requestTimeoutMs = 118000;

async function requestBrief(
  workspace: Workspace,
  credentials: Credentials,
  category: Idea["category"],
  signal: AbortSignal,
) {
  const { settings, preferences } = workspace;
  const response = await fetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(credentials.key ? { "X-Provider-Key": credentials.key } : {}),
      ...(credentials.token ? { "X-Workspace-Token": credentials.token } : {}),
    },
    body: JSON.stringify({
      category,
      duration: preferences.duration,
      mood: preferences.mood,
      settings,
      ...buildContext(workspace),
    }),
    signal,
  });
  const result = await response.json().catch(() => ({
    error: "The server returned an unexpected response. Please try again.",
  }));
  if (!response.ok)
    throw new Error(result.error || "Could not generate an idea.");
  return briefSchema.parse(result);
}

/**
 * The spin lifecycle: pick a category, animate the wheel, and request a brief in
 * parallel. Stale results from cancelled spins are discarded, and cancelling
 * aborts the request so the server can stop the provider call too.
 */
export function useGeneration({
  workspace,
  credentials,
  onIdea,
  onCancelled,
}: {
  workspace: Workspace;
  credentials: Credentials;
  onIdea: (idea: Idea) => void;
  onCancelled: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [rotation, setRotation] = useState(315);
  const [selected, setSelected] = useState<Idea["category"] | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const generation = useRef<AbortController | null>(null);
  const generationId = useRef(0);

  useEffect(() => () => generation.current?.abort(), []);

  const cancel = useCallback(() => {
    generationId.current++;
    generation.current?.abort();
    setBusy(false);
    setStatus("");
    onCancelled();
  }, [onCancelled]);

  const spin = async () => {
    if (busy) return;
    const { settings, preferences } = workspace;
    const id = ++generationId.current;
    const controller = new AbortController();
    generation.current = controller;
    setBusy(true);
    setError("");
    setStatus(
      settings.provider === "preview"
        ? "A little chance is at work…"
        : "Researching a fresh direction…",
    );
    const last = preferences.avoidRepeat
      ? (selected ?? workspace.ideas[0]?.category ?? null)
      : null;
    const index = pickCategory(preferences.enabled, last);
    const category = categories[index];
    setSelected(category);
    setRotation((prev) => landingRotation(prev, index));
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animation = new Promise((resolve) =>
      setTimeout(resolve, reduced ? reducedSpinMs : spinMs),
    );
    const statusTimer = setTimeout(() => {
      if (generationId.current === id)
        setStatus(`Landed on ${category}. Shaping your build prompt…`);
    }, spinMs);
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const [brief] = await Promise.all([
        settings.provider === "preview"
          ? previewBrief(category, preferences.duration, preferences.mood)
          : requestBrief(workspace, credentials, category, controller.signal),
        animation,
      ]);
      if (id !== generationId.current) return;
      onIdea({
        ...brief,
        id: crypto.randomUUID(),
        category,
        createdAt: new Date().toISOString(),
        provider: settings.provider,
        model: settings.model,
        effort: settings.effort,
        duration: preferences.duration,
        saved: false,
        feedback: [],
        rating: null,
        researchStatus: researchStatusFor(settings.provider, brief.sources),
      });
    } catch (err) {
      if (id === generationId.current)
        setError(
          controller.signal.aborted
            ? "The request timed out. Try again with a faster model or lower thinking effort."
            : err instanceof Error
              ? err.message
              : "Something went wrong. Try again.",
        );
    } finally {
      clearTimeout(statusTimer);
      clearTimeout(timeout);
      if (id === generationId.current) {
        setBusy(false);
        setStatus("");
      }
    }
  };

  return { busy, rotation, selected, status, error, setError, spin, cancel };
}

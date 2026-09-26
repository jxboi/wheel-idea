import { useCallback, useEffect, useRef, useState } from "react";
import type { ProgressEvent } from "../../../shared/contract.js";
import { requestBrief, type Credentials } from "./request";
import { categories, type Idea, type Workspace } from "../../lib/schema";
import { buildContext } from "../../lib/context";
import { previewBrief } from "../../lib/preview";
import { landingRotation, pickCategory } from "../../lib/wheel";
import { researchStatusFor } from "../../lib/actions";
import {
  applyEvent,
  ingredientsFor,
  newActivity,
  type Activity,
} from "./activity";

export type { Credentials };

const spinMs = 4900;
const reducedSpinMs = 150;
// Slightly below the server's 120-second function limit.
const requestTimeoutMs = 118000;
const renderEveryMs = 120;

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
  const [landed, setLanded] = useState(false);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [error, setError] = useState("");
  const generation = useRef<AbortController | null>(null);
  const generationId = useRef(0);

  useEffect(() => () => generation.current?.abort(), []);

  const cancel = useCallback(() => {
    generationId.current++;
    generation.current?.abort();
    setBusy(false);
    setActivity(null);
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
    setLanded(false);
    let prepared: { context: string; images: string[] };
    try {
      prepared = buildContext(workspace);
    } catch (err) {
      setBusy(false);
      setError(
        err instanceof Error ? err.message : "Could not prepare context.",
      );
      return;
    }
    // Progress arrives token by token; render it in small batches.
    let current = newActivity(
      ingredientsFor(workspace, prepared.context, prepared.images),
    );
    let renderTimer: ReturnType<typeof setTimeout> | undefined;
    const render = () => {
      renderTimer = undefined;
      if (id === generationId.current) setActivity(current);
    };
    const onEvent = (event: ProgressEvent) => {
      current = applyEvent(current, event);
      renderTimer ??= setTimeout(render, renderEveryMs);
    };
    setActivity(current);
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
    const landTimer = setTimeout(
      () => {
        if (generationId.current === id) setLanded(true);
      },
      reduced ? reducedSpinMs : spinMs,
    );
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try {
      const [brief] = await Promise.all([
        settings.provider === "preview"
          ? previewBrief(category, preferences.duration, preferences.mood)
          : requestBrief(
              workspace,
              credentials,
              category,
              prepared,
              controller.signal,
              onEvent,
            ),
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
      clearTimeout(landTimer);
      clearTimeout(timeout);
      clearTimeout(renderTimer);
      if (id === generationId.current) {
        setBusy(false);
        setActivity(null);
      }
    }
  };

  return {
    busy,
    rotation,
    selected,
    landed,
    activity,
    error,
    setError,
    spin,
    cancel,
  };
}

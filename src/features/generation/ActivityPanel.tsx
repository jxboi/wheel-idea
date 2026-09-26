import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Brain,
  Check,
  Dices,
  FileText,
  PenLine,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { providerNames, type Settings } from "../../lib/schema";
import {
  currentStep,
  partialBrief,
  thinkingSnippet,
  type Activity,
  type Ingredients,
  type Step as StepName,
} from "./activity";

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

function host(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function elapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Step({
  icon,
  state,
  title,
  children,
}: {
  icon: ReactNode;
  state: "done" | "active";
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className={`activity-step ${state}`}>
      <span className="activity-icon" aria-hidden="true">
        {state === "done" ? <Check size={13} strokeWidth={2.4} /> : icon}
      </span>
      <div className="activity-body">
        <div className="activity-title">{title}</div>
        {children}
      </div>
    </li>
  );
}

function IngredientChips({
  ingredients,
  preview,
}: {
  ingredients: Ingredients;
  preview: boolean;
}) {
  const { duration, mood, memory } = ingredients;
  const chips = [
    duration,
    mood && `“${mood.length > 40 ? `${mood.slice(0, 40)}…` : mood}”`,
  ];
  if (preview) chips.push("No AI, sample ideas");
  else if (!memory) chips.push("Memory off");
  else {
    if (memory.notes) chips.push(plural(memory.notes, "note"));
    if (memory.recentIdeas) chips.push(plural(memory.recentIdeas, "past idea"));
    if (memory.journal)
      chips.push(plural(memory.journal, "journal entry", "journal entries"));
    if (memory.photos) chips.push(plural(memory.photos, "photo"));
    if (!memory.notes && !memory.recentIdeas && !memory.journal)
      chips.push("No memory yet");
  }
  return (
    <ul className="activity-chips">
      {chips.filter(Boolean).map((chip) => (
        <li key={chip as string}>{chip}</li>
      ))}
    </ul>
  );
}

/**
 * Live account of a spin: what the user shared, then each thing the model is
 * observed doing. Nothing here is simulated; steps appear only when the server
 * reports them.
 */
export function ActivityPanel({
  activity,
  landed,
  selected,
  settings,
}: {
  activity: Activity;
  landed: boolean;
  selected: string | null;
  settings: Settings;
}) {
  const [now, setNow] = useState(() => Date.now());
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  // Once the wheel stops, bring the live account into view on small screens.
  useEffect(() => {
    const element = panel.current;
    if (
      !landed ||
      !element?.scrollIntoView ||
      !matchMedia("(max-width: 760px)").matches ||
      element.getBoundingClientRect().top < innerHeight * 0.55
    )
      return;
    element.scrollIntoView({
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }, [landed]);
  const preview = settings.provider === "preview";
  const provider = providerNames[settings.provider];
  const step = currentStep(activity);
  const { searches, pages, thinking, draft } = activity;
  const brief = partialBrief(draft);
  const waited = now - activity.startedAt;

  const headline = !landed
    ? "Spinning the wheel…"
    : preview
      ? "Picking a sample idea…"
      : {
          sending: "Sending your context…",
          asking: activity.local
            ? `Running ${provider} on this computer…`
            : `${provider} is researching…`,
          searching: `Searching “${searches.at(-1)}”`,
          reading: `Reading ${plural(pages.length, "page")}…`,
          thinking: "Thinking it through…",
          writing: brief.title ? "Writing your brief…" : "Starting the brief…",
        }[step];

  // Only the step the provider is on right now is active; research can
  // interleave with thinking, so earlier steps may become active again.
  const past = (name: StepName) => step !== name;
  const writing = brief.title || draft.includes("{");

  return (
    <div className="activity" ref={panel}>
      <div className="activity-head">
        <span className="activity-now" aria-live="polite">
          {headline}
        </span>
        <span className="activity-clock" aria-hidden="true">
          {elapsed(waited)}
        </span>
      </div>
      <ol className="activity-steps">
        <Step
          icon={<Dices size={14} />}
          state={landed ? "done" : "active"}
          title={landed ? `Landed on ${selected}` : "Spinning"}
        />
        <Step
          icon={<SlidersHorizontal size={14} />}
          state={activity.started || preview ? "done" : "active"}
          title="Shaped by you"
        >
          <IngredientChips
            ingredients={activity.ingredients}
            preview={preview}
          />
        </Step>
        {!preview && activity.started && searches.length > 0 && (
          <Step
            icon={<Search size={14} />}
            state={past("searching") ? "done" : "active"}
            title={`Searched the web${searches.length > 1 ? ` ${searches.length} times` : ""}`}
          >
            <ul className="activity-queries">
              {searches.map((query) => (
                <li key={query}>“{query}”</li>
              ))}
            </ul>
          </Step>
        )}
        {!preview && pages.length > 0 && (
          <Step
            icon={<FileText size={14} />}
            state={past("reading") ? "done" : "active"}
            title={`Found ${plural(pages.length, "page")}`}
          >
            <ul className="activity-pages">
              {pages.slice(0, 8).map((page) => (
                <li key={page.url}>
                  <a
                    href={page.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={page.title || page.url}
                  >
                    {host(page.url)}
                  </a>
                </li>
              ))}
              {pages.length > 8 && <li>+{pages.length - 8} more</li>}
            </ul>
          </Step>
        )}
        {!preview && thinking && (
          <Step
            icon={<Brain size={14} />}
            state={past("thinking") ? "done" : "active"}
            title={past("thinking") ? "Thought it through" : "Thinking"}
          >
            {step === "thinking" && (
              <p className="activity-thinking">{thinkingSnippet(thinking)}</p>
            )}
          </Step>
        )}
        {!preview && writing && (
          <Step
            icon={<PenLine size={14} />}
            state={past("writing") ? "done" : "active"}
            title="Drafting"
          >
            {brief.title && (
              <p className="activity-draft-title">{brief.title}</p>
            )}
            {brief.summary && (
              <p className="activity-draft-summary">{brief.summary}</p>
            )}
            {(brief.features > 0 || brief.promptWords > 0) && (
              <p className="activity-meta">
                {[
                  brief.features && plural(brief.features, "feature"),
                  brief.promptWords &&
                    `${plural(brief.promptWords, "word")} of build brief`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </Step>
        )}
      </ol>
      {!preview && activity.started && step === "asking" && (
        <p className="activity-note">
          {activity.local
            ? "Local tools report back only when they finish."
            : waited > 12000
              ? "Some models research before they share anything. This can take a minute."
              : "Waiting for the first update…"}
        </p>
      )}
    </div>
  );
}

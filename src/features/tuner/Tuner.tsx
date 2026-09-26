import { useEffect, useRef, useState } from "react";
import {
  Brain,
  CalendarDays,
  Check,
  Clock,
  Rocket,
  SlidersHorizontal,
} from "lucide-react";
import {
  providerNames,
  type Preferences,
  type Settings,
} from "../../lib/schema";

type Duration = Preferences["duration"];

const durations = [
  ["A few hours", Clock, "a few hours"],
  ["A weekend", CalendarDays, "a weekend"],
  ["Go big", Rocket, "time to go big"],
] as const;

const phrase = (duration: Duration) =>
  durations.find(([name]) => name === duration)?.[2] ?? duration;

const shorten = (mood: string) =>
  mood.length > 24 ? `${mood.slice(0, 24).trimEnd()}…` : mood;

/** A sentence with tappable words instead of a form. Every part has a sensible
    default, so spinning never waits on it. */
export function Tuner({
  preferences,
  onPreferences,
  settings,
  onCategories,
  onSettings,
}: {
  preferences: Preferences;
  onPreferences: (preferences: Preferences) => void;
  settings: Settings;
  onCategories: () => void;
  onSettings: () => void;
}) {
  const { mood, duration, enabled } = preferences;
  const update = (change: Partial<Preferences>) =>
    onPreferences({ ...preferences, ...change });
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);
  const picker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!picking) return;
    const close = (e: PointerEvent) => {
      if (!picker.current?.contains(e.target as Node)) setPicking(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPicking(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [picking]);

  const provider =
    settings.provider === "preview"
      ? "Configure AI"
      : providerNames[settings.provider];

  return (
    <section className="tuner" aria-label="Tune the spin">
      <p className="tuner-sentence">
        I have{" "}
        <span className="tuner-pick" ref={picker}>
          <button
            type="button"
            className="tuner-word"
            aria-haspopup="true"
            aria-expanded={picking}
            aria-label={`Time to build: ${duration}`}
            onClick={() => setPicking(!picking)}
          >
            {phrase(duration)}
          </button>
          {picking && (
            <span
              className="tuner-menu"
              role="group"
              aria-label="Time to build"
            >
              {durations.map(([name, Icon]) => (
                <button
                  type="button"
                  key={name}
                  aria-pressed={duration === name}
                  onClick={() => {
                    update({ duration: name });
                    setPicking(false);
                  }}
                >
                  <Icon size={17} />
                  {name}
                  {duration === name && <Check size={16} className="tick" />}
                </button>
              ))}
            </span>
          )}
        </span>{" "}
        and I&rsquo;m in the mood for{" "}
        <span className="tuner-end">
          {editing ? (
            <input
              className="tuner-input"
              autoFocus
              maxLength={200}
              aria-label="What are you in the mood for?"
              placeholder="anything"
              value={mood}
              size={Math.max(8, Math.min(mood.length + 1, 24))}
              onChange={(e) => update({ mood: e.target.value })}
              onBlur={() => setEditing(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") setEditing(false);
              }}
            />
          ) : (
            <button
              type="button"
              className={`tuner-word ${mood.trim() ? "" : "empty"}`}
              aria-label={`Mood: ${mood.trim() || "anything"}. Edit`}
              onClick={() => setEditing(true)}
            >
              {mood.trim() ? shorten(mood.trim()) : "anything"}
            </button>
          )}
          .
        </span>
      </p>
      <div className="tuner-meta">
        <button type="button" className="text-button" onClick={onCategories}>
          <SlidersHorizontal size={14} />
          {enabled.length} of 8 categories
        </button>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          className="text-button"
          onClick={onSettings}
          title={settings.provider === "preview" ? undefined : settings.model}
        >
          <Brain size={14} />
          {provider}
        </button>
      </div>
    </section>
  );
}

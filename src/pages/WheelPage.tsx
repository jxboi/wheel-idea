import { useState } from "react";
import {
  ArrowRight,
  Plus,
  ImagePlus,
  Leaf,
  Clock,
  CalendarDays,
  Rocket,
  Brain,
  ChevronDown,
  LoaderCircle,
  SlidersHorizontal,
  Check,
  RotateCw,
} from "lucide-react";
import { Wheel } from "../components/Wheel";
import { Modal } from "../components/Modal";
import {
  categories,
  providerNames,
  type Category,
  type Preferences,
  type Settings,
} from "../lib/schema";
import { categoryColors } from "../components/Icons";
export function WheelPage({
  settings,
  preferences,
  onPreferences,
  busy,
  rotation,
  selected,
  status,
  error,
  onSpin,
  onSettings,
  onJournal,
  onOpenJournal,
  onMemory,
  onCancel,
}: {
  settings: Settings;
  preferences: Preferences;
  onPreferences: (preferences: Preferences) => void;
  busy: boolean;
  rotation: number;
  selected: string | null;
  status: string;
  error: string;
  onSpin: () => void;
  onSettings: () => void;
  onJournal: (photo?: boolean) => void;
  onOpenJournal: () => void;
  onMemory: () => void;
  onCancel: () => void;
}) {
  const { mood, duration, enabled, avoidRepeat } = preferences;
  const update = (change: Partial<Preferences>) =>
    onPreferences({ ...preferences, ...change });
  const toggle = (cat: Category) =>
    update({
      enabled: enabled.includes(cat)
        ? enabled.length > 1
          ? enabled.filter((c) => c !== cat)
          : enabled
        : categories.filter((c) => c === cat || enabled.includes(c)),
    });
  const [customize, setCustomize] = useState(false);
  return (
    <>
      <div className="page-intro wheel-intro">
        <h1>A little chance. A great next idea.</h1>
        <p>Get out of your head. Find something worth building.</p>
      </div>
      <div className="studio-grid">
        <section className="wheel-column" aria-label="Spin your next project">
          <Wheel rotation={rotation} spinning={busy} selected={selected} />
          <div className="spin-actions">
            <button
              className="button primary spin-button"
              disabled={busy}
              onClick={onSpin}
            >
              {busy ? (
                <>
                  <LoaderCircle className="loading-icon" size={20} />
                  Spinning…
                </>
              ) : (
                <>
                  Spin the wheel <ArrowRight size={21} />
                </>
              )}
            </button>
            <div className="spin-caption" aria-live="polite">
              {busy ? status : ""}
            </div>
            {busy ? (
              <button className="text-button category-edit" onClick={onCancel}>
                Cancel
              </button>
            ) : (
              <button
                className="text-button category-edit"
                onClick={() => setCustomize(true)}
              >
                <SlidersHorizontal size={14} />
                {enabled.length} of 8 categories
              </button>
            )}
          </div>
        </section>
        <section className="mood-panel">
          <h2>
            What are you in
            <br className="panel-break" /> the mood for?
          </h2>
          <label className="sr-only" htmlFor="mood">
            What are you in the mood for?
          </label>
          <div className="mood-input">
            <textarea
              id="mood"
              maxLength={200}
              value={mood}
              onChange={(e) => update({ mood: e.target.value })}
              placeholder="Optional: small, useful, a little unexpected…"
            />
            {mood.length > 150 && <span>{mood.length}/200</span>}
          </div>
          <fieldset className="time-field">
            <legend>Time to build</legend>
            <div className="time-options">
              {(
                [
                  ["A few hours", Clock],
                  ["A weekend", CalendarDays],
                  ["Go big", Rocket],
                ] as const
              ).map(([name, Icon]) => (
                <button
                  type="button"
                  key={name}
                  aria-pressed={duration === name}
                  className={duration === name ? "selected" : ""}
                  onClick={() => update({ duration: name })}
                >
                  <Icon size={17} />
                  {name}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="copilot">
            <label>
              <Brain size={20} />
              Your creative copilot
            </label>
            <button className="select-button" onClick={onSettings}>
              <span>
                {settings.provider === "preview"
                  ? "Configure AI"
                  : providerNames[settings.provider]}
              </span>
              <ChevronDown size={16} />
            </button>
            {settings.provider !== "preview" && (
              <p>{settings.model || "CLI default model"}</p>
            )}
          </div>
        </section>
      </div>
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button className="text-button" onClick={onSettings}>
            Check settings <ArrowRight size={15} />
          </button>
        </div>
      )}
      {settings.provider === "preview" && (
        <div className="preview-note">
          <span className="status-dot" /> Offline preview · sample ideas
        </div>
      )}
      <section className="spark-section">
        <div className="section-heading">
          <h2>Capture a thought</h2>
          <button className="text-button" onClick={onOpenJournal}>
            Journal <ArrowRight size={16} />
          </button>
        </div>
        <div className="spark-options">
          <button onClick={() => onJournal()}>
            <Plus size={28} />
            <span>Write a note</span>
            <ArrowRight size={16} className="spark-arrow" />
          </button>
          <button onClick={() => onJournal(true)}>
            <ImagePlus size={28} />
            <span>Add a photo</span>
            <ArrowRight size={16} className="spark-arrow" />
          </button>
          <button onClick={onMemory}>
            <Leaf size={28} />
            <span>Add a memory</span>
            <ArrowRight size={16} className="spark-arrow" />
          </button>
        </div>
      </section>
      {customize && (
        <Modal title="Categories" onClose={() => setCustomize(false)}>
          <div className="modal-body">
            <p className="muted">Pick what the wheel can land on.</p>
            <div className="category-picker">
              {categories.map((cat, i) => (
                <button
                  key={cat}
                  className={enabled.includes(cat) ? "checked" : ""}
                  aria-pressed={enabled.includes(cat)}
                  onClick={() => toggle(cat)}
                >
                  <i style={{ background: categoryColors[i] }} />
                  {cat}
                  {enabled.includes(cat) && <Check size={18} />}
                </button>
              ))}
            </div>
            <label className="toggle-row repeat-toggle">
              <span>No repeats in a row</span>
              <input
                type="checkbox"
                role="switch"
                checked={avoidRepeat}
                onChange={(e) => update({ avoidRepeat: e.target.checked })}
              />
            </label>
            <div className="button-row">
              <button
                className="text-button"
                onClick={() => update({ enabled: [...categories] })}
              >
                <RotateCw size={15} />
                Reset
              </button>
              <button
                className="button primary"
                onClick={() => setCustomize(false)}
              >
                Done
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

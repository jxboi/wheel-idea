import { useState } from "react";
import {
  ArrowRight,
  Plus,
  ImagePlus,
  Leaf,
  Sparkles,
  Clock,
  CalendarDays,
  Rocket,
  Brain,
  ChevronDown,
  BookOpen,
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
  type Settings,
} from "../lib/schema";
import { categoryColors } from "../components/Icons";
export type SpinInput = {
  mood: string;
  duration: "A few hours" | "A weekend" | "Go big";
  enabled: Category[];
};
export function WheelPage({
  settings,
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
  busy: boolean;
  rotation: number;
  selected: string | null;
  status: string;
  error: string;
  onSpin: (input: SpinInput) => void;
  onSettings: () => void;
  onJournal: (photo?: boolean) => void;
  onOpenJournal: () => void;
  onMemory: () => void;
  onCancel: () => void;
}) {
  const [mood, setMood] = useState("");
  const [duration, setDuration] =
    useState<SpinInput["duration"]>("A few hours");
  const [enabled, setEnabled] = useState<Category[]>([...categories]);
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
              onClick={() => onSpin({ mood, duration, enabled })}
            >
              {busy ? (
                <>
                  <LoaderCircle className="loading-icon" size={21} />
                  Finding your next thing…
                </>
              ) : (
                <>
                  Spin the wheel <ArrowRight size={21} />
                </>
              )}
            </button>
            <div className="spin-caption" aria-live="polite">
              {busy ? status : "A little serendipity goes a long way."}
            </div>
            <button
              className="text-button category-edit"
              disabled={busy}
              onClick={() => setCustomize(true)}
            >
              <SlidersHorizontal size={13} />
              {enabled.length === 8
                ? "8 possibilities"
                : `${enabled.length} possibilities`}{" "}
              · Make it your wheel
            </button>
            {busy && (
              <button className="text-button" onClick={onCancel}>
                Cancel generation
              </button>
            )}
          </div>
        </section>
        <section className="mood-panel">
          <div className="panel-kicker">
            <Sparkles size={18} />
            <span>Make it yours</span>
          </div>
          <h2>
            What are you in
            <br className="panel-break" /> the mood for?
          </h2>
          <p className="muted">Give chance a little direction.</p>
          <label className="sr-only" htmlFor="mood">
            What are you in the mood for?
          </label>
          <div className="mood-input">
            <textarea
              id="mood"
              maxLength={200}
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              placeholder="Something small, useful, and a little unexpected…"
            />
            <span>{mood.length}/200</span>
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
                  onClick={() => setDuration(name)}
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
            <p>
              {settings.provider === "preview"
                ? "Connect your favorite model in Settings."
                : `${settings.model || "CLI default model"} · ${settings.effort === "default" ? "default" : settings.effort} thinking`}
            </p>
          </div>
          <div className="memory-note">
            <BookOpen size={22} />
            <p>Your journal and feedback help shape every idea.</p>
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
          <span className="status-dot" /> Offline preview{" "}
          <span>
            Curated ideas for a test spin. Connect AI for live research.
          </span>
        </div>
      )}
      <section className="spark-section">
        <div className="section-heading">
          <h2>Room for a spark</h2>
          <button className="text-button" onClick={onOpenJournal}>
            Open journal <ArrowRight size={16} />
          </button>
        </div>
        <div className="spark-options">
          <button onClick={() => onJournal()}>
            <Plus size={28} />
            <span>Capture a thought</span>
            <ArrowRight size={16} className="spark-arrow" />
          </button>
          <button onClick={() => onJournal(true)}>
            <ImagePlus size={28} />
            <span>Drop an inspiration</span>
            <ArrowRight size={16} className="spark-arrow" />
          </button>
          <button onClick={onMemory}>
            <Leaf size={28} />
            <span>Make it personal</span>
            <ArrowRight size={16} className="spark-arrow" />
          </button>
        </div>
      </section>
      {customize && (
        <Modal title="Make it your wheel" onClose={() => setCustomize(false)}>
          <div className="modal-body">
            <h2>Leave room for possibility.</h2>
            <p className="muted">
              Choose the categories you’re open to. Every active category has an
              equal chance.
            </p>
            <div className="category-picker">
              {categories.map((cat, i) => (
                <button
                  key={cat}
                  className={enabled.includes(cat) ? "checked" : ""}
                  aria-pressed={enabled.includes(cat)}
                  onClick={() =>
                    setEnabled((prev) =>
                      prev.includes(cat)
                        ? prev.length > 1
                          ? prev.filter((c) => c !== cat)
                          : prev
                        : [...prev, cat],
                    )
                  }
                >
                  <i style={{ background: categoryColors[i] }} />
                  {cat}
                  {enabled.includes(cat) && <Check size={18} />}
                </button>
              ))}
            </div>
            <p className="small muted">
              Keep at least one category selected. All eight remain visible on
              the wheel.
            </p>
            <div className="button-row">
              <button
                className="text-button"
                onClick={() => setEnabled([...categories])}
              >
                <RotateCw size={15} />
                Reset
              </button>
              <button
                className="button primary"
                onClick={() => setCustomize(false)}
              >
                Ready to spin
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

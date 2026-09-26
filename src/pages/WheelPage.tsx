import { useState } from "react";
import {
  ArrowRight,
  Plus,
  ImagePlus,
  Leaf,
  LoaderCircle,
  Check,
  RotateCw,
} from "lucide-react";
import { Wheel } from "../components/Wheel";
import { Modal } from "../components/Modal";
import {
  categories,
  type Category,
  type Preferences,
  type Settings,
} from "../lib/schema";
import { categoryColors } from "../components/Icons";
import { ActivityPanel } from "../features/generation/ActivityPanel";
import type { Activity } from "../features/generation/activity";
import { Tuner } from "../features/tuner/Tuner";
export function WheelPage({
  settings,
  preferences,
  onPreferences,
  busy,
  rotation,
  selected,
  landed,
  activity,
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
  landed: boolean;
  activity: Activity | null;
  error: string;
  onSpin: () => void;
  onSettings: () => void;
  onJournal: (photo?: boolean) => void;
  onOpenJournal: () => void;
  onMemory: () => void;
  onCancel: () => void;
}) {
  const { enabled, avoidRepeat } = preferences;
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
                  {landed ? "Creating your idea…" : "Spinning…"}
                </>
              ) : (
                <>
                  Spin the wheel <ArrowRight size={21} />
                </>
              )}
            </button>
            {busy && (
              <button className="text-button category-edit" onClick={onCancel}>
                Cancel
              </button>
            )}
          </div>
        </section>
        {busy && activity && (
          <div className="activity-slot">
            <ActivityPanel
              activity={activity}
              landed={landed}
              selected={selected}
              settings={settings}
            />
          </div>
        )}
        <Tuner
          preferences={preferences}
          onPreferences={onPreferences}
          settings={settings}
          onCategories={() => setCustomize(true)}
          onSettings={onSettings}
        />
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

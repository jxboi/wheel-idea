import { Check, RotateCw } from "lucide-react";
import { categories, type Category, type Preferences } from "../../lib/schema";
import { categoryColors } from "../../components/Icons";

/** Category toggles and the no-repeat switch, shared by the wheel and Settings. */
export function CategoryPicker({
  preferences,
  onPreferences,
}: {
  preferences: Preferences;
  onPreferences: (preferences: Preferences) => void;
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
  return (
    <>
      <div className="category-picker">
        {categories.map((cat, i) => (
          <button
            key={cat}
            type="button"
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
      <button
        type="button"
        className="text-button category-reset"
        onClick={() => update({ enabled: [...categories] })}
      >
        <RotateCw size={15} />
        Reset
      </button>
    </>
  );
}

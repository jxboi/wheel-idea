import type { Preferences } from "../../lib/schema";
import { CategoryPicker } from "../../features/wheel/CategoryPicker";

export function WheelSettings({
  preferences,
  onPreferences,
}: {
  preferences: Preferences;
  onPreferences: (preferences: Preferences) => void;
}) {
  return (
    <div className="settings-panel">
      <p className="muted">Pick what the wheel can land on.</p>
      <CategoryPicker preferences={preferences} onPreferences={onPreferences} />
    </div>
  );
}

import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

/** Header and back link shared by every settings sub-page. */
export function SettingsSubpage({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="settings-subpage">
      <button className="text-button settings-back" onClick={onBack}>
        <ChevronLeft size={18} />
        Settings
      </button>
      <div className="page-intro">
        <h1>{title}</h1>
      </div>
      {children}
    </div>
  );
}

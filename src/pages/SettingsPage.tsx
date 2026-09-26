import type { Preferences, Settings, Workspace, Memory } from "../lib/schema";
import type { Credentials } from "../features/generation/useGeneration";
import type { AuthState } from "../features/auth/session";
import type { SettingsSection } from "./settings/sections";
import { SettingsHome } from "./settings/SettingsHome";
import { SettingsSubpage } from "./settings/Subpage";
import { ModelSettings } from "./settings/ModelSettings";
import { MemorySettings } from "./settings/MemorySettings";
import { WheelSettings } from "./settings/WheelSettings";
import { BackupSettings } from "./settings/BackupSettings";
import { PrivacySettings } from "./settings/PrivacySettings";

const titles: Record<SettingsSection, string> = {
  model: "AI model",
  memory: "Memory",
  wheel: "Wheel",
  backup: "Backup & restore",
  privacy: "Privacy",
};

/** The settings hub and its sub-pages; `section` comes from the URL hash. */
export function SettingsPage({
  section,
  onSection,
  workspace,
  onSave,
  credentials,
  onCredentials,
  auth,
  onSignOut,
  onPreferences,
  onUseMemory,
  onAddMemory,
  onDeleteMemory,
  onEditMemory,
  onImport,
  toast,
}: {
  section: SettingsSection | null;
  onSection: (section: SettingsSection | null) => void;
  workspace: Workspace;
  onSave: (s: Settings) => void;
  credentials: Credentials;
  onCredentials: (c: Credentials) => void;
  auth: AuthState;
  onSignOut: () => void;
  onPreferences: (p: Preferences) => void;
  onUseMemory: (enabled: boolean) => void;
  onAddMemory: (text: string) => void;
  onDeleteMemory: (id: string) => void;
  onEditMemory: (m: Memory) => void;
  onImport: (w: Workspace) => void;
  toast: (text: string) => void;
}) {
  if (!section)
    return <SettingsHome workspace={workspace} onOpen={onSection} />;
  return (
    <SettingsSubpage title={titles[section]} onBack={() => onSection(null)}>
      {section === "model" && (
        <ModelSettings
          settings={workspace.settings}
          onSave={onSave}
          credentials={credentials}
          onCredentials={onCredentials}
          auth={auth}
          onSignOut={onSignOut}
          toast={toast}
        />
      )}
      {section === "memory" && (
        <MemorySettings
          workspace={workspace}
          onChange={onUseMemory}
          onAdd={onAddMemory}
          onDelete={onDeleteMemory}
          onEdit={onEditMemory}
        />
      )}
      {section === "wheel" && (
        <WheelSettings
          preferences={workspace.preferences}
          onPreferences={onPreferences}
        />
      )}
      {section === "backup" && (
        <BackupSettings
          workspace={workspace}
          onImport={(w) => {
            onImport(w);
            onCredentials({ key: "", token: "" });
          }}
          toast={toast}
        />
      )}
      {section === "privacy" && (
        <PrivacySettings onMemory={() => onSection("memory")} />
      )}
    </SettingsSubpage>
  );
}

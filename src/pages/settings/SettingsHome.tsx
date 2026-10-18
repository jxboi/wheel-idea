import {
  Brain,
  ChevronRight,
  CircleDot,
  HardDriveDownload,
  Leaf,
  Rocket,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { categories, providerNames, type Workspace } from "../../lib/schema";
import type { SettingsSection } from "./sections";
import { LAUNCH_URL } from "../../components/Shell";

type Row = [SettingsSection, string, LucideIcon, string];

export function SettingsHome({
  workspace,
  onOpen,
}: {
  workspace: Workspace;
  onOpen: (section: SettingsSection) => void;
}) {
  const { settings, preferences, memories } = workspace;
  const groups: [string, Row[]][] = [
    [
      "Customize Orbit",
      [
        ["model", "AI model", Brain, providerNames[settings.provider]],
        ["memory", "Memory", Leaf, settings.useMemory ? "On" : "Off"],
        [
          "wheel",
          "Wheel",
          CircleDot,
          `${preferences.enabled.length} of ${categories.length}`,
        ],
      ],
    ],
    [
      "Your data",
      [
        ["backup", "Backup & restore", HardDriveDownload, ""],
        ["privacy", "Privacy", ShieldCheck, "This device"],
      ],
    ],
  ];
  return (
    <>
      <div className="page-intro">
        <h1>Settings</h1>
      </div>
      <div className="settings-home">
        {groups.map(([title, rows]) => (
          <section key={title} className="settings-group">
            <h2>{title}</h2>
            <ul>
              {rows.map(([id, label, Icon, value]) => (
                <li key={id}>
                  <button onClick={() => onOpen(id)}>
                    <Icon size={20} strokeWidth={1.6} />
                    <span className="settings-row-label">{label}</span>
                    {value && (
                      <span className="settings-row-value">{value}</span>
                    )}
                    <ChevronRight size={17} className="settings-row-chevron" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section className="settings-group">
          <h2>Just for fun</h2>
          <ul>
            <li>
              <a href={LAUNCH_URL} target="_blank" rel="noopener">
                <Rocket size={20} strokeWidth={1.6} />
                <span className="settings-row-label">Rocket launch</span>
                <ChevronRight size={17} className="settings-row-chevron" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}

/** Settings sub-pages, addressed as `#settings/<section>`. */
export const settingsSections = [
  "model",
  "memory",
  "wheel",
  "backup",
  "privacy",
] as const;
export type SettingsSection = (typeof settingsSections)[number];
export const isSettingsSection = (value: string): value is SettingsSection =>
  (settingsSections as readonly string[]).includes(value);

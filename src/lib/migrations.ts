import { z } from "zod";
import {
  defaultPreferences,
  defaultSettings,
  entrySchema,
  ideaSchema,
  memorySchema,
  preferencesSchema,
  settingsSchema,
  workspaceSchema,
  type Workspace,
} from "./schema";

/** Workspace v1 exactly as it was persisted and exported. Frozen: do not edit. */
export const workspaceV1Schema = z.object({
  version: z.literal(1),
  settings: settingsSchema,
  ideas: z
    .array(
      ideaSchema.extend({
        researchStatus: z.enum(["preview", "cited", "uncited"]),
      }),
    )
    .max(2000),
  entries: z.array(entrySchema).max(2000),
  memories: z.array(memorySchema).max(500),
});
export type WorkspaceV1 = z.infer<typeof workspaceV1Schema>;

/** Workspace v2 exactly as it was persisted and exported. Frozen: do not edit. */
export const workspaceV2Schema = z.object({
  version: z.literal(2),
  settings: settingsSchema,
  preferences: preferencesSchema,
  ideas: z.array(ideaSchema).max(2000),
  entries: z.array(entrySchema).max(2000),
  memories: z.array(memorySchema).max(500),
});
export type WorkspaceV2 = z.infer<typeof workspaceV2Schema>;

/**
 * v1 → v2: adds wheel preferences. v1 marked any model-listed source as "cited"
 * without checking it against search results, so those ideas become "unverified".
 */
export function migrateV1(v1: WorkspaceV1): WorkspaceV2 {
  return workspaceV2Schema.parse({
    ...v1,
    version: 2,
    preferences: structuredClone(defaultPreferences),
    ideas: v1.ideas.map((idea) => ({
      ...idea,
      researchStatus:
        idea.researchStatus === "cited" ? "unverified" : idea.researchStatus,
    })),
  });
}

/**
 * v2 → v3: the default provider changed from the offline preview to OpenRouter.
 * Workspaces still on the untouched preview default (no model chosen) move to
 * the new default; any other saved provider choice is kept.
 */
export function migrateV2(v2: WorkspaceV2): Workspace {
  const untouched = v2.settings.provider === "preview" && !v2.settings.model;
  return workspaceSchema.parse({
    ...v2,
    version: 3,
    settings: untouched
      ? {
          ...structuredClone(defaultSettings),
          useMemory: v2.settings.useMemory,
        }
      : v2.settings,
  });
}

/**
 * Validate a stored or imported workspace of any supported version and bring it
 * to the current version. Unknown versions and invalid data throw; nothing is
 * coerced or silently dropped.
 */
export function parseWorkspace(value: unknown): Workspace {
  const version = (value as { version?: unknown } | null)?.version;
  if (version === 1)
    return migrateV2(migrateV1(workspaceV1Schema.parse(value)));
  if (version === 2) return migrateV2(workspaceV2Schema.parse(value));
  return workspaceSchema.parse(value);
}

export function safeParseWorkspace(
  value: unknown,
): { success: true; data: Workspace } | { success: false } {
  try {
    return { success: true, data: parseWorkspace(value) };
  } catch {
    return { success: false };
  }
}

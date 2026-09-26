import { z } from "zod";
import {
  briefSchema,
  categories,
  durations,
  imageDataUrlSchema,
  providerSchema,
  requestSchema,
  settingsSchema,
  sourceSchema,
} from "../../shared/contract.js";
export {
  briefSchema,
  categories,
  durations,
  providerSchema,
  requestSchema,
  settingsSchema,
  sourceSchema,
};
export type Category = (typeof categories)[number];
export type Duration = (typeof durations)[number];
export type Provider = z.infer<typeof providerSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Brief = z.infer<typeof briefSchema>;
export type GenerateRequest = z.infer<typeof requestSchema>;
/**
 * preview: offline example. cited: at least one source matches a page the
 * provider's search tool returned. unverified: sources were listed but none could
 * be matched to search results. uncited: no sources.
 */
export const researchStatuses = [
  "preview",
  "cited",
  "unverified",
  "uncited",
] as const;
export type ResearchStatus = (typeof researchStatuses)[number];
export const ideaSchema = briefSchema.extend({
  id: z.string(),
  category: z.enum(categories),
  createdAt: z.string(),
  provider: providerSchema,
  model: z.string(),
  effort: z.string(),
  duration: z.string(),
  saved: z.boolean(),
  feedback: z.array(
    z.object({
      id: z.string(),
      text: z.string().max(2000),
      createdAt: z.string(),
    }),
  ),
  rating: z.enum(["love", "pass"]).nullable(),
  researchStatus: z.enum(researchStatuses),
});
export type Idea = z.infer<typeof ideaSchema>;
export const entrySchema = z.object({
  id: z.string(),
  title: z.string().max(160),
  body: z.string().max(10000),
  createdAt: z.string(),
  updatedAt: z.string(),
  images: z
    .array(
      z.object({
        id: z.string(),
        dataUrl: imageDataUrlSchema,
        name: z.string().max(200),
      }),
    )
    .max(4),
  shareWithAI: z.boolean(),
});
export type Entry = z.infer<typeof entrySchema>;
export const memorySchema = z.object({
  id: z.string(),
  text: z.string().max(2000),
  createdAt: z.string(),
  source: z.enum(["you", "feedback"]),
  ideaId: z.string().optional(),
});
export type Memory = z.infer<typeof memorySchema>;
export const preferencesSchema = z.object({
  mood: z.string().max(200),
  duration: z.enum(durations),
  enabled: z.array(z.enum(categories)).min(1).max(8),
  avoidRepeat: z.boolean(),
});
export type Preferences = z.infer<typeof preferencesSchema>;
export const workspaceSchema = z.object({
  version: z.literal(3),
  settings: settingsSchema,
  preferences: preferencesSchema,
  ideas: z.array(ideaSchema).max(2000),
  entries: z.array(entrySchema).max(2000),
  memories: z.array(memorySchema).max(500),
});
export type Workspace = z.infer<typeof workspaceSchema>;
export const defaultModel = "deepseek/deepseek-v4.1-flash";
export const defaultSettings: Settings = {
  provider: "openrouter",
  model: defaultModel,
  effort: "default",
  useMemory: true,
};
export const defaultPreferences: Preferences = {
  mood: "",
  duration: "A few hours",
  enabled: [...categories],
  avoidRepeat: false,
};
export const emptyWorkspace: Workspace = {
  version: 3,
  settings: defaultSettings,
  preferences: defaultPreferences,
  ideas: [],
  entries: [],
  memories: [],
};
export const providerNames: Record<Provider, string> = {
  preview: "Offline preview",
  openrouter: "OpenRouter",
  openai: "OpenAI API",
  anthropic: "Claude API",
  "codex-local": "Local Codex",
  "claude-local": "Local Claude",
};
export const modelDefaults: Record<Provider, string> = {
  preview: "",
  openrouter: defaultModel,
  openai: "gpt-5.2",
  anthropic: "claude-sonnet-4-6",
  "codex-local": "",
  "claude-local": "sonnet",
};

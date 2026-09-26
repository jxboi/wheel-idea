import { z } from "zod";
export const categories = [
  "Productivity",
  "Games",
  "Lifestyle",
  "Learning",
  "Creative tools",
  "Community",
  "Wellness",
  "Wildcard",
] as const;
export type Category = (typeof categories)[number];
export const providerSchema = z.enum([
  "preview",
  "openrouter",
  "openai",
  "anthropic",
  "codex-local",
  "claude-local",
]);
export type Provider = z.infer<typeof providerSchema>;
export const settingsSchema = z.object({
  provider: providerSchema,
  model: z.string().max(150),
  effort: z.enum(["default", "low", "medium", "high"]),
  useMemory: z.boolean(),
});
export type Settings = z.infer<typeof settingsSchema>;
export const sourceSchema = z.object({
  title: z.string().max(500),
  url: z
    .string()
    .url()
    .refine((v) => /^https?:\/\//.test(v)),
});
export const briefSchema = z.object({
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(2000),
  whyNow: z.string().max(3000),
  features: z.array(z.string().max(600)).min(1).max(8),
  prompt: z.string().min(100).max(24000),
  sources: z.array(sourceSchema).max(12),
});
export type Brief = z.infer<typeof briefSchema>;
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
  researchStatus: z.enum(["preview", "cited", "uncited"]),
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
        dataUrl: z
          .string()
          .max(1500000)
          .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
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
export const workspaceSchema = z.object({
  version: z.literal(1),
  settings: settingsSchema,
  ideas: z.array(ideaSchema).max(2000),
  entries: z.array(entrySchema).max(2000),
  memories: z.array(memorySchema).max(500),
});
export type Workspace = z.infer<typeof workspaceSchema>;
export const requestSchema = z.object({
  category: z.enum(categories),
  duration: z.enum(["A few hours", "A weekend", "Go big"]),
  mood: z.string().max(200),
  settings: settingsSchema,
  context: z.string().max(14000),
  images: z
    .array(
      z
        .string()
        .max(1500000)
        .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
    )
    .max(2)
    .default([]),
});
export type GenerateRequest = z.infer<typeof requestSchema>;
export const defaultSettings: Settings = {
  provider: "preview",
  model: "",
  effort: "default",
  useMemory: true,
};
export const emptyWorkspace: Workspace = {
  version: 1,
  settings: defaultSettings,
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
  openrouter: "openai/gpt-5.2",
  openai: "gpt-5.2",
  anthropic: "claude-sonnet-4-6",
  "codex-local": "",
  "claude-local": "sonnet",
};

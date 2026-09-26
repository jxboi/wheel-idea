// @ts-check
// Wire contract shared by the browser, the API handler, and tests.
// Plain JavaScript with explicit extensions so Vercel's Node bundler can trace it;
// TypeScript infers the types through `allowJs`.
import { z } from "zod";

export const categories = /** @type {const} */ ([
  "Productivity",
  "Games",
  "Lifestyle",
  "Learning",
  "Creative tools",
  "Community",
  "Wellness",
  "Wildcard",
]);
export const durations = /** @type {const} */ ([
  "A few hours",
  "A weekend",
  "Go big",
]);
export const providerSchema = z.enum([
  "preview",
  "openrouter",
  "openai",
  "anthropic",
  "codex-local",
  "claude-local",
]);
export const settingsSchema = z.object({
  provider: providerSchema,
  model: z.string().max(150),
  effort: z.enum(["default", "low", "medium", "high"]),
  useMemory: z.boolean(),
});
export const imageDataUrlSchema = z
  .string()
  .max(1500000)
  .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/);
export const sourceSchema = z.object({
  title: z.string().max(500),
  url: z
    .string()
    .url()
    .refine((value) => /^https?:\/\//.test(value)),
  // Set by the server only: true when the URL matches a page the provider's
  // search tool actually returned. Never taken from model output.
  verified: z.boolean().optional(),
});
export const briefSchema = z.object({
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(2000),
  whyNow: z.string().max(3000),
  features: z.array(z.string().max(600)).min(1).max(8),
  prompt: z.string().min(100).max(24000),
  sources: z.array(sourceSchema).max(12),
});
export const contextLimit = 14000;
export const requestSchema = z.object({
  category: z.enum(categories),
  duration: z.enum(durations),
  mood: z.string().max(200),
  settings: settingsSchema,
  context: z.string().max(contextLimit),
  images: z.array(imageDataUrlSchema).max(2).default([]),
});

/** @typedef {z.infer<typeof settingsSchema>} Settings */
/** @typedef {z.infer<typeof sourceSchema>} Source */
/** @typedef {z.infer<typeof briefSchema>} Brief */
/** @typedef {z.infer<typeof requestSchema>} GenerateRequest */

// Live progress, streamed as newline-delimited JSON while a brief is generated.
// Every event describes something that actually happened in the provider run.
export const progressMediaType = "application/x-ndjson";
export const pageSchema = z.object({
  title: z.string().max(500),
  url: sourceSchema.shape.url,
});
export const progressEventSchema = z.discriminatedUnion("type", [
  // The server accepted the request and handed it to the provider.
  z.object({ type: z.literal("started"), local: z.boolean() }),
  // A web search the model ran, with its query.
  z.object({ type: z.literal("search"), query: z.string().max(500) }),
  // Pages the provider's search tool returned.
  z.object({ type: z.literal("pages"), pages: z.array(pageSchema).max(20) }),
  // Reasoning text the provider chose to expose, appended as it arrives.
  z.object({ type: z.literal("thinking"), text: z.string().max(20000) }),
  // Brief output appended as it is written. Not validated until "result".
  z.object({ type: z.literal("draft"), text: z.string().max(30000) }),
  z.object({ type: z.literal("result"), brief: briefSchema }),
  z.object({ type: z.literal("error"), error: z.string().max(2000) }),
]);

/** @typedef {z.infer<typeof pageSchema>} Page */
/** @typedef {z.infer<typeof progressEventSchema>} ProgressEvent */
/** @typedef {(event: ProgressEvent) => void} OnProgress */

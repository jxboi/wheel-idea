import type { ApiRequest, ApiResponse } from "../server/http";
import { timingSafeEqual } from "node:crypto";
import { requestSchema } from "../src/lib/schema";
import { generateFromAPI } from "../server/providers";
import { generateLocal } from "../server/local";
export const config = { maxDuration: 120 };
function equal(a: string, b: string) {
  return (
    Buffer.byteLength(a) === Buffer.byteLength(b) &&
    timingSafeEqual(Buffer.from(a), Buffer.from(b))
  );
}
export default async function handler(req: ApiRequest, res: ApiResponse) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST")
    return res.status(405).json({ error: "Use POST to generate an idea." });
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host)
        return res
          .status(403)
          .json({ error: "This request must come from your Orbit workspace." });
    } catch {
      return res.status(403).json({ error: "Invalid origin." });
    }
  }
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({
      error: "Some request fields are invalid. Refresh and try again.",
    });
  const input = parsed.data;
  if (input.settings.provider === "preview")
    return res
      .status(400)
      .json({ error: "Preview ideas are generated on your device." });
  const token = String(req.headers["x-workspace-token"] ?? "");
  const local = input.settings.provider.endsWith("-local");
  if (
    local &&
    (process.env.VERCEL || process.env.ORBIT_ENABLE_LOCAL_CLI !== "true")
  )
    return res.status(400).json({
      error:
        "Local Codex and Claude are available only in local development with ORBIT_ENABLE_LOCAL_CLI=true.",
    });
  const suppliedKey = String(req.headers["x-provider-key"] ?? "");
  if (suppliedKey.length > 512)
    return res.status(400).json({ error: "Invalid API key." });
  const envName = {
    openrouter: "OPENROUTER_API_KEY",
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
  }[input.settings.provider as "openai" | "openrouter" | "anthropic"];
  const key = suppliedKey || (envName ? process.env[envName] : "") || "";
  if (!local && !key)
    return res
      .status(401)
      .json({ error: "Connect an API key in Settings, then spin again." });
  // Never expose a server-funded public endpoint: deployed keys require a workspace token.
  if (!suppliedKey && !local && process.env.VERCEL) {
    const expected = process.env.ORBIT_ACCESS_TOKEN;
    if (!expected || !equal(token, expected))
      return res.status(401).json({
        error:
          "Enter the workspace password in Settings to use the server’s API key.",
      });
  }
  try {
    return res
      .status(200)
      .json(
        local ? await generateLocal(input) : await generateFromAPI(input, key),
      );
  } catch (error) {
    const raw =
      error instanceof Error ? error.message : "Generation failed. Try again.";
    const message = key ? raw.replaceAll(key, "[redacted]") : raw;
    return res.status(502).json({
      error:
        message.includes("abort") || message.includes("timeout")
          ? "The model took too long. Try a lower thinking effort or another model."
          : message,
    });
  }
}

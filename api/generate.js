// @ts-check
import { progressMediaType, requestSchema } from "../shared/contract.js";
import { generateFromAPI } from "../server/providers.js";
import { generateLocal, localToolsEnabled } from "../server/local.js";
import { equal, githubConfigured, signedInAndAllowed } from "../server/auth.js";

export const config = { maxDuration: 120 };

/**
 * @param {import("../server/http").ApiRequest} req
 * @param {import("../server/http").ApiResponse} res
 */
export default async function handler(req, res) {
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
  const local = input.settings.provider.endsWith("-local");
  if (local && !localToolsEnabled())
    return res.status(400).json({
      error:
        "Local Codex and Claude are available only in local development with ORBIT_ENABLE_LOCAL_CLI=true.",
    });
  const suppliedKey = String(req.headers["x-provider-key"] ?? "");
  if (suppliedKey.length > 512)
    return res.status(400).json({ error: "Invalid API key." });
  /** @type {Record<string, string | undefined>} */
  const environmentKeys = {
    openrouter: "OPENROUTER_API_KEY",
    openai: "OPENAI_API_KEY",
    anthropic: "ANTHROPIC_API_KEY",
  };
  const environmentKey = environmentKeys[input.settings.provider];
  const key =
    suppliedKey || (environmentKey ? process.env[environmentKey] : "") || "";
  if (!local && !key)
    return res
      .status(401)
      .json({ error: "Connect an API key in Settings, then spin again." });
  // Server-funded calls on Vercel need an allowlisted GitHub session or the
  // workspace password (if one is still configured).
  if (!suppliedKey && !local && process.env.VERCEL) {
    const expected = process.env.ORBIT_ACCESS_TOKEN;
    const received = String(req.headers["x-workspace-token"] ?? "");
    const passwordOk = Boolean(expected && equal(received, expected));
    if (!passwordOk && !signedInAndAllowed(req))
      return res.status(401).json({
        error: githubConfigured()
          ? "Sign in with GitHub in Settings to use the server’s API key."
          : "Enter the workspace password in Settings to use the server’s API key.",
      });
  }
  // Stop paid provider work (and local CLI runs) when the browser goes away.
  const disconnect = new AbortController();
  res.on?.("close", () => {
    if (!res.writableEnded) disconnect.abort();
  });
  /** @param {unknown} error */
  const failure = (error) => {
    const raw =
      error instanceof Error ? error.message : "Generation failed. Try again.";
    const message = key ? raw.replaceAll(key, "[redacted]") : raw;
    return message.includes("abort") || message.includes("timeout")
      ? "The model took too long. Try a lower thinking effort or another model."
      : message;
  };
  // Clients that accept NDJSON get live progress, then the result or error as
  // the last line. The status is already 200 by then, so errors travel in-band.
  if (String(req.headers.accept ?? "").includes(progressMediaType)) {
    res.statusCode = 200;
    res.setHeader("Content-Type", `${progressMediaType}; charset=utf-8`);
    res.setHeader("X-Accel-Buffering", "no");
    /** @param {import("../shared/contract.js").ProgressEvent} event */
    const send = (event) => {
      if (!res.writableEnded) res.write(`${JSON.stringify(event)}\n`);
    };
    send({ type: "started", local });
    try {
      const brief = local
        ? await generateLocal(input, disconnect.signal)
        : await generateFromAPI(input, key, disconnect.signal, send);
      send({ type: "result", brief });
    } catch (error) {
      send({ type: "error", error: failure(error) });
    }
    res.end();
    return;
  }
  try {
    const brief = local
      ? await generateLocal(input, disconnect.signal)
      : await generateFromAPI(input, key, disconnect.signal);
    return res.status(200).json(brief);
  } catch (error) {
    return res.status(502).json({ error: failure(error) });
  }
}

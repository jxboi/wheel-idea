// @ts-check
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildPrompt } from "./prompt.js";
import { parseBrief } from "./providers.js";
import { attachProvenance } from "./provenance.js";

/** @typedef {import("../shared/contract.js").GenerateRequest} GenerateRequest */

export const localDeadlineMs = 110000;

export function localToolsEnabled() {
  return !process.env.VERCEL && process.env.ORBIT_ENABLE_LOCAL_CLI === "true";
}

/**
 * The exact program and argument array for a local CLI run. Arguments are never
 * joined into a shell string, and tool access is limited to web search.
 * @param {GenerateRequest["settings"]} settings
 * @param {string} outputPath where Codex writes its final message
 */
export function localCommand(settings, outputPath) {
  const model = settings.model.trim();
  const effort = settings.effort;
  if (settings.provider === "codex-local")
    return {
      command: "codex",
      args: [
        "--search",
        "-a",
        "never",
        "exec",
        "--ignore-user-config",
        "--ephemeral",
        "--skip-git-repo-check",
        "--sandbox",
        "read-only",
        "-c",
        "features.shell_tool=false",
        "-c",
        "project_doc_max_bytes=0",
        "--output-last-message",
        outputPath,
        ...(model ? ["--model", model] : []),
        ...(effort !== "default"
          ? ["-c", `model_reasoning_effort="${effort}"`]
          : []),
        "-",
      ],
    };
  if (settings.provider === "claude-local")
    return {
      command: "claude",
      args: [
        "-p",
        "--output-format",
        "json",
        "--tools",
        "WebSearch",
        "--allowedTools",
        "WebSearch",
        "--permission-mode",
        "dontAsk",
        "--no-session-persistence",
        "--disable-slash-commands",
        "--strict-mcp-config",
        ...(model ? ["--model", model] : []),
        ...(effort !== "default" ? ["--effort", effort] : []),
      ],
    };
  throw new Error("Unknown local provider.");
}

/**
 * @param {GenerateRequest} input
 * @param {AbortSignal} [signal] aborted when the browser disconnects
 */
export async function generateLocal(input, signal) {
  if (!localToolsEnabled())
    throw new Error(
      "Local tools are disabled. Run Orbit on your computer with ORBIT_ENABLE_LOCAL_CLI=true.",
    );
  if (input.images.length)
    throw new Error(
      "Local tools currently accept text inspiration only. Unshare journal photos or choose an API provider.",
    );
  const dir = await mkdtemp(join(tmpdir(), "orbit-"));
  const output = join(dir, "brief.txt");
  const { command, args } = localCommand(input.settings, output);
  const isCodex = command === "codex";
  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(command, args, {
        cwd: dir,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
        env: process.env,
      });
      let stdout = "";
      let size = 0;
      /** @param {Error} error */
      const stop = (error) => {
        child.kill("SIGKILL");
        clearTimeout(timeout);
        signal?.removeEventListener("abort", onAbort);
        reject(error);
      };
      const onAbort = () => stop(new Error("Local model run was aborted."));
      signal?.addEventListener("abort", onAbort, { once: true });
      const timeout = setTimeout(
        () =>
          stop(
            new Error(
              "Local model timed out after 110 seconds. Try a lower thinking effort.",
            ),
          ),
        localDeadlineMs,
      );
      child.stdout.on("data", (chunk) => {
        size += chunk.length;
        if (size > 2_000_000)
          stop(new Error("Local model output exceeded the limit."));
        else stdout += chunk.toString();
      });
      child.stderr.resume();
      child.stdin.on("error", () => {});
      child.on("error", () =>
        stop(
          new Error(
            `${isCodex ? "Codex" : "Claude"} CLI could not start. Install it and sign in first.`,
          ),
        ),
      );
      child.on("close", (code) => {
        clearTimeout(timeout);
        signal?.removeEventListener("abort", onAbort);
        code === 0
          ? resolve(stdout)
          : reject(
              new Error(
                "Local model failed. Check that the CLI is installed, signed in, and supports the selected model.",
              ),
            );
      });
      if (signal?.aborted) onAbort();
      else child.stdin.end(buildPrompt(input));
    });
    // Local CLIs do not expose their search results, so sources stay unverified.
    if (isCodex)
      return attachProvenance(parseBrief(await readFile(output, "utf8")), null);
    const response = JSON.parse(result);
    if (response.is_error)
      throw new Error(
        "Claude could not finish. Check its local authentication and model settings.",
      );
    return attachProvenance(parseBrief(response.result ?? ""), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GenerateRequest } from "../src/lib/schema";
import { buildPrompt } from "./prompt";
import { parseBrief } from "./providers";
export async function generateLocal(input: GenerateRequest) {
  if (process.env.VERCEL || process.env.ORBIT_ENABLE_LOCAL_CLI !== "true")
    throw new Error(
      "Local tools are disabled. Run Orbit on your computer with ORBIT_ENABLE_LOCAL_CLI=true.",
    );
  if (input.images.length)
    throw new Error(
      "Local tools currently accept text inspiration only. Unshare journal photos or choose an API provider.",
    );
  const dir = await mkdtemp(join(tmpdir(), "orbit-"));
  const output = join(dir, "brief.txt");
  const isCodex = input.settings.provider === "codex-local";
  const model = input.settings.model.trim();
  const effort = input.settings.effort;
  const args = isCodex
    ? [
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
        output,
        ...(model ? ["--model", model] : []),
        ...(effort !== "default"
          ? ["-c", `model_reasoning_effort="${effort}"`]
          : []),
        "-",
      ]
    : [
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
      ];
  try {
    const result = await new Promise<string>((resolve, reject) => {
      const child = spawn(isCodex ? "codex" : "claude", args, {
        cwd: dir,
        shell: false,
        stdio: ["pipe", "pipe", "pipe"],
        env: process.env,
      });
      let stdout = "";
      let size = 0;
      const timeout = setTimeout(() => {
        child.kill("SIGKILL");
        reject(
          new Error(
            "Local model timed out after 110 seconds. Try a lower thinking effort.",
          ),
        );
      }, 110000);
      child.stdout.on("data", (chunk) => {
        size += chunk.length;
        if (size > 2_000_000) {
          child.kill("SIGKILL");
          clearTimeout(timeout);
          reject(new Error("Local model output exceeded the limit."));
        } else stdout += chunk.toString();
      });
      child.stderr.resume();
      child.stdin.on("error", () => {});
      child.on("error", () => {
        clearTimeout(timeout);
        reject(
          new Error(
            `${isCodex ? "Codex" : "Claude"} CLI could not start. Install it and sign in first.`,
          ),
        );
      });
      child.on("close", (code) => {
        clearTimeout(timeout);
        code === 0
          ? resolve(stdout)
          : reject(
              new Error(
                "Local model failed. Check that the CLI is installed, signed in, and supports the selected model.",
              ),
            );
      });
      child.stdin.end(buildPrompt(input));
    });
    if (isCodex) return parseBrief(await readFile(output, "utf8"));
    const response = JSON.parse(result);
    if (response.is_error)
      throw new Error(
        "Claude could not finish. Check its local authentication and model settings.",
      );
    return parseBrief(response.result ?? "");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

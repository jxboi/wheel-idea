import { describe, it, expect, afterEach, vi } from "vitest";
import {
  generateLocal,
  localCommand,
  localToolsEnabled,
} from "../server/local.js";

const settings = (provider: "codex-local" | "claude-local") => ({
  provider,
  model: "some-model; rm -rf /",
  effort: "high" as const,
  useMemory: false,
});

afterEach(() => vi.unstubAllEnvs());

describe("local CLI boundaries", () => {
  it("runs Codex read-only, without a shell tool or user config", () => {
    const { command, args } = localCommand(settings("codex-local"), "/tmp/o");
    expect(command).toBe("codex");
    expect(args).toEqual(
      expect.arrayContaining([
        "--ignore-user-config",
        "--ephemeral",
        "features.shell_tool=false",
        "project_doc_max_bytes=0",
      ]),
    );
    expect(args[args.indexOf("--sandbox") + 1]).toBe("read-only");
    expect(args[args.indexOf("-a") + 1]).toBe("never");
    expect(args.join(" ")).not.toMatch(/danger|full-auto|workspace-write/);
  });
  it("limits Claude to web search with no persistence or MCP", () => {
    const { command, args } = localCommand(settings("claude-local"), "");
    expect(command).toBe("claude");
    expect(args[args.indexOf("--tools") + 1]).toBe("WebSearch");
    expect(args[args.indexOf("--allowedTools") + 1]).toBe("WebSearch");
    expect(args).toEqual(
      expect.arrayContaining([
        "--no-session-persistence",
        "--strict-mcp-config",
        "--disable-slash-commands",
      ]),
    );
    expect(args.join(" ")).not.toMatch(/dangerously|bypassPermissions/);
  });
  it("passes user values as single arguments, never through a shell", () => {
    const { args } = localCommand(settings("claude-local"), "");
    expect(args[args.indexOf("--model") + 1]).toBe("some-model; rm -rf /");
  });
  it("is disabled unless opted in, and always on Vercel", async () => {
    vi.stubEnv("ORBIT_ENABLE_LOCAL_CLI", "");
    vi.stubEnv("VERCEL", "");
    expect(localToolsEnabled()).toBe(false);
    vi.stubEnv("ORBIT_ENABLE_LOCAL_CLI", "true");
    expect(localToolsEnabled()).toBe(true);
    vi.stubEnv("VERCEL", "1");
    expect(localToolsEnabled()).toBe(false);
    await expect(
      generateLocal({
        category: "Games",
        duration: "A few hours",
        mood: "",
        settings: settings("codex-local"),
        context: "",
        images: [],
      }),
    ).rejects.toThrow("disabled");
  });
});

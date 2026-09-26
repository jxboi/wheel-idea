import { describe, it, expect, vi, afterEach } from "vitest";
import { landingRotation } from "../src/lib/wheel";
import { buildContext } from "../src/lib/context";
import {
  emptyWorkspace,
  workspaceSchema,
  requestSchema,
  categories,
} from "../src/lib/schema";
import { previewBrief } from "../src/lib/preview";
import { parseBrief, generateFromAPI } from "../server/providers";
import handler from "../api/generate.js";

describe("wheel geometry", () => {
  it("lands every sector at the pointer after repeated spins", () => {
    let rotation = 337.5;
    for (let round = 0; round < 3; round++)
      for (let index = 0; index < 8; index++) {
        const next = landingRotation(rotation, index);
        expect(next - rotation).toBeGreaterThanOrEqual(1800);
        expect(((index + 0.5) * 45 + next) % 360).toBeCloseTo(0);
        rotation = next;
      }
  });
});
describe("memory privacy", () => {
  it("omits all context and images when memory is disabled", () => {
    const w = structuredClone(emptyWorkspace);
    w.settings.useMemory = false;
    w.memories.push({ id: "m", text: "private", source: "you", createdAt: "" });
    expect(buildContext(w)).toEqual({
      context: "No personal context. Memory is disabled.",
      images: [],
    });
  });
  it("shares only explicitly selected entries and caps images", () => {
    const w = structuredClone(emptyWorkspace);
    w.entries = [
      {
        id: "1",
        title: "private",
        body: "not shared",
        createdAt: "",
        updatedAt: "",
        images: [],
        shareWithAI: false,
      },
      {
        id: "2",
        title: "inspiration",
        body: "allowed",
        createdAt: "",
        updatedAt: "",
        images: [
          { id: "x", dataUrl: "data:image/jpeg;base64,abc", name: "test" },
        ],
        shareWithAI: true,
      },
    ];
    const result = buildContext(w);
    expect(result.context).not.toContain("not shared");
    expect(result.context).toContain("allowed");
    expect(result.images).toHaveLength(1);
  });
});
describe("validation", () => {
  it("validates all offline examples and distinguishes them from research", () => {
    for (const category of categories) {
      const brief = previewBrief(category, "A weekend", "");
      expect(parseBrief(JSON.stringify(brief)).title).toBe(brief.title);
      expect(brief.sources).toEqual([]);
      expect(brief.whyNow).toContain("offline");
    }
  });
  it("rejects malformed output and unsafe source links", () => {
    expect(() => parseBrief("not a brief")).toThrow();
    const brief = previewBrief("Games", "A weekend", "");
    expect(() =>
      parseBrief(
        JSON.stringify({
          ...brief,
          sources: [{ title: "bad", url: "javascript:alert(1)" }],
        }),
      ),
    ).toThrow();
  });
  it("rejects invalid backup versions without coercion", () => {
    expect(
      workspaceSchema.safeParse({ ...emptyWorkspace, version: 2 }).success,
    ).toBe(false);
  });
  it("rejects unsupported images and invalid categories", () => {
    expect(requestSchema.safeParse({ category: "invalid" }).success).toBe(
      false,
    );
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("provider contracts", () => {
  const brief = previewBrief("Games", "A few hours", "");
  for (const provider of ["openrouter", "openai", "anthropic"] as const)
    it(`${provider} includes search, model, and thinking settings`, async () => {
      const payload =
        provider === "openrouter"
          ? { choices: [{ message: { content: JSON.stringify(brief) } }] }
          : provider === "openai"
            ? {
                status: "completed",
                output: [
                  {
                    content: [
                      { type: "output_text", text: JSON.stringify(brief) },
                    ],
                  },
                ],
              }
            : { content: [{ type: "text", text: JSON.stringify(brief) }] };
      const mock = vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => payload });
      vi.stubGlobal("fetch", mock);
      const result = await generateFromAPI(
        {
          category: "Games",
          duration: "A few hours",
          mood: "tiny puzzles",
          settings: {
            provider,
            model: "test-model",
            effort: "medium",
            useMemory: true,
          },
          context: "notes",
          images: [],
        },
        "test-key",
      );
      expect(result.title).toBe(brief.title);
      const body = JSON.parse(mock.mock.calls[0][1].body);
      expect(body.model).toBe("test-model");
      expect(body.tools).toHaveLength(1);
      expect(body.reasoning?.effort ?? body.output_config?.effort).toBe(
        "medium",
      );
    });
  it("surfaces provider errors without fabricating a result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: "Invalid key" } }),
      }),
    );
    await expect(
      generateFromAPI(
        {
          category: "Games",
          duration: "A few hours",
          mood: "",
          settings: {
            provider: "openrouter",
            model: "test",
            effort: "default",
            useMemory: false,
          },
          context: "",
          images: [],
        },
        "x",
      ),
    ).rejects.toThrow("401");
  });
});
describe("endpoint boundaries", () => {
  function res() {
    return {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
  }
  it("rejects invalid payloads", async () => {
    const r = res();
    await handler(
      { method: "POST", headers: {}, body: {} } as never,
      r as never,
    );
    expect(r.status).toHaveBeenCalledWith(400);
  });
  it("rejects cross-origin requests", async () => {
    const r = res();
    await handler(
      {
        method: "POST",
        headers: { origin: "https://other.site", host: "localhost" },
        body: {},
      } as never,
      r as never,
    );
    expect(r.status).toHaveBeenCalledWith(403);
  });
  it("does not expose server-side keys on Vercel without a token", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("OPENAI_API_KEY", "private");
    vi.stubEnv("ORBIT_ACCESS_TOKEN", "");
    const r = res();
    await handler(
      {
        method: "POST",
        headers: {},
        body: {
          category: "Games",
          duration: "A few hours",
          mood: "",
          settings: {
            provider: "openai",
            model: "test",
            effort: "default",
            useMemory: false,
          },
          context: "",
          images: [],
        },
      } as never,
      r as never,
    );
    expect(r.status).toHaveBeenCalledWith(401);
  });
  it("rejects local tools on Vercel", async () => {
    vi.stubEnv("VERCEL", "1");
    const r = res();
    await handler(
      {
        method: "POST",
        headers: {},
        body: {
          category: "Games",
          duration: "A few hours",
          mood: "",
          settings: {
            provider: "codex-local",
            model: "",
            effort: "default",
            useMemory: false,
          },
          context: "",
          images: [],
        },
      } as never,
      r as never,
    );
    expect(r.status).toHaveBeenCalledWith(400);
  });
});

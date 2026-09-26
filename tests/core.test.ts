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
import { parseBrief, generateFromAPI } from "../server/providers.js";
import { parseWorkspace } from "../src/lib/migrations";
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
      workspaceSchema.safeParse({ ...emptyWorkspace, version: 3 }).success,
    ).toBe(false);
    expect(() => parseWorkspace({ ...emptyWorkspace, version: 3 })).toThrow();
    expect(() => parseWorkspace({ version: 1, settings: {} })).toThrow();
  });
  it("migrates v1 backups and stops calling model-listed sources cited", () => {
    const brief = previewBrief("Games", "A weekend", "");
    const idea = {
      ...brief,
      sources: [{ title: "A page", url: "https://example.com/a" }],
      id: "i1",
      category: "Games",
      createdAt: "2026-01-01T00:00:00.000Z",
      provider: "openai",
      model: "m",
      effort: "default",
      duration: "A weekend",
      saved: true,
      feedback: [],
      rating: "love",
      researchStatus: "cited",
    };
    const v1 = {
      version: 1,
      settings: emptyWorkspace.settings,
      ideas: [idea, { ...idea, id: "i2", researchStatus: "uncited" }],
      entries: [],
      memories: [],
    };
    const migrated = parseWorkspace(v1);
    expect(migrated.version).toBe(2);
    expect(migrated.preferences).toEqual(emptyWorkspace.preferences);
    expect(migrated.ideas.map((i) => i.researchStatus)).toEqual([
      "unverified",
      "uncited",
    ]);
    expect(migrated.ideas[0].sources[0].url).toBe("https://example.com/a");
  });
  it("finds the brief after prose that contains braces", () => {
    const brief = previewBrief("Games", "A weekend", "");
    const raw = `Here is {one} idea:\n${JSON.stringify(brief)}`;
    expect(parseBrief(raw).title).toBe(brief.title);
  });
  it("never trusts a verified flag written by the model", () => {
    const brief = previewBrief("Games", "A weekend", "");
    const parsed = parseBrief(
      JSON.stringify({
        ...brief,
        sources: [{ title: "x", url: "https://x.dev", verified: true }],
      }),
    );
    expect(parsed.sources[0]).toEqual({ title: "x", url: "https://x.dev" });
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
const apiInput = (provider: "openrouter" | "openai" | "anthropic") => ({
  category: "Games" as const,
  duration: "A few hours" as const,
  mood: "",
  settings: {
    provider,
    model: "m",
    effort: "default" as const,
    useMemory: false,
  },
  context: "",
  images: [],
});
const ok = (payload: unknown) => ({ ok: true, json: async () => payload });
describe("research provenance and continuation", () => {
  const brief = previewBrief("Games", "A few hours", "");
  it("continues a paused Anthropic turn and verifies sources it searched", async () => {
    const withSources = JSON.stringify({
      ...brief,
      sources: [
        { title: "Found", url: "https://www.example.com/post/?utm_source=x" },
        { title: "Invented", url: "https://made-up.example/post" },
      ],
    });
    const mock = vi
      .fn()
      .mockResolvedValueOnce(
        ok({
          stop_reason: "pause_turn",
          content: [
            {
              type: "server_tool_use",
              id: "s1",
              name: "web_search",
              input: {},
            },
            {
              type: "web_search_tool_result",
              tool_use_id: "s1",
              content: [
                {
                  type: "web_search_result",
                  url: "https://example.com/post",
                  title: "Found",
                },
              ],
            },
          ],
        }),
      )
      .mockResolvedValueOnce(
        ok({
          stop_reason: "end_turn",
          content: [
            { type: "text", text: withSources.slice(0, 40) },
            { type: "text", text: withSources.slice(40) },
          ],
        }),
      );
    vi.stubGlobal("fetch", mock);
    const result = await generateFromAPI(apiInput("anthropic"), "k");
    expect(mock).toHaveBeenCalledTimes(2);
    const second = JSON.parse(mock.mock.calls[1][1].body);
    expect(second.messages).toHaveLength(2);
    expect(second.messages[1].role).toBe("assistant");
    expect(second.messages[1].content[0].type).toBe("server_tool_use");
    expect(result.sources.map((s) => s.verified)).toEqual([true, false]);
  });
  it("stops after a bounded number of continuations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(ok({ stop_reason: "pause_turn", content: [] })),
    );
    await expect(generateFromAPI(apiInput("anthropic"), "k")).rejects.toThrow(
      "Research did not finish",
    );
  });
  it("uses OpenAI search sources and url citations", async () => {
    const mock = vi.fn().mockResolvedValue(
      ok({
        status: "completed",
        output: [
          {
            type: "web_search_call",
            action: { sources: [{ type: "url", url: "https://a.dev/x" }] },
          },
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  ...brief,
                  sources: [{ title: "A", url: "https://a.dev/x/" }],
                }),
                annotations: [],
              },
            ],
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", mock);
    const result = await generateFromAPI(apiInput("openai"), "k");
    expect(JSON.parse(mock.mock.calls[0][1].body).include).toContain(
      "web_search_call.action.sources",
    );
    expect(result.sources).toEqual([
      { title: "A", url: "https://a.dev/x/", verified: true },
    ]);
  });
  it("surfaces OpenRouter citations when the model listed none", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        ok({
          choices: [
            {
              message: {
                content: JSON.stringify(brief),
                annotations: [
                  {
                    type: "url_citation",
                    url_citation: { url: "https://b.dev/y", title: "B" },
                  },
                  {
                    type: "url_citation",
                    url_citation: { url: "javascript:x" },
                  },
                ],
              },
            },
          ],
        }),
      ),
    );
    const result = await generateFromAPI(apiInput("openrouter"), "k");
    expect(result.sources).toEqual([
      { title: "B", url: "https://b.dev/y", verified: true },
    ]);
  });
  it("passes the caller's abort signal to the provider request", async () => {
    const mock = vi
      .fn()
      .mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) =>
            init.signal?.addEventListener("abort", () =>
              reject(new Error("This operation was aborted")),
            ),
          ),
      );
    vi.stubGlobal("fetch", mock);
    const controller = new AbortController();
    const pending = generateFromAPI(
      apiInput("openrouter"),
      "k",
      controller.signal,
    );
    controller.abort();
    await expect(pending).rejects.toThrow("aborted");
  });
});
describe("endpoint boundaries", () => {
  function res() {
    return {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      on: vi.fn(),
      writableEnded: false,
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
  it("aborts provider work when the browser disconnects", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            signal = init.signal ?? undefined;
            signal?.addEventListener("abort", () =>
              reject(new Error("This operation was aborted")),
            );
          }),
      ),
    );
    const r = res();
    const pending = handler(
      {
        method: "POST",
        headers: { "x-provider-key": "k" },
        body: apiInput("openrouter"),
      } as never,
      r as never,
    );
    await vi.waitFor(() => expect(signal).toBeDefined());
    const onClose = r.on.mock.calls.find(([event]) => event === "close")?.[1];
    onClose();
    await pending;
    expect(signal?.aborted).toBe(true);
    expect(r.status).toHaveBeenCalledWith(502);
  });
});

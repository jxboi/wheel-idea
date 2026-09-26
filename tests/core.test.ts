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
import { progressEventSchema } from "../shared/contract.js";

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
      workspaceSchema.safeParse({ ...emptyWorkspace, version: 4 }).success,
    ).toBe(false);
    expect(() => parseWorkspace({ ...emptyWorkspace, version: 4 })).toThrow();
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
    expect(migrated.version).toBe(3);
    expect(migrated.preferences).toEqual(emptyWorkspace.preferences);
    expect(migrated.ideas.map((i) => i.researchStatus)).toEqual([
      "unverified",
      "uncited",
    ]);
    expect(migrated.ideas[0].sources[0].url).toBe("https://example.com/a");
  });
  it("moves v2 workspaces on the untouched preview default to OpenRouter", () => {
    const v2 = (settings: object) => ({
      ...emptyWorkspace,
      version: 2,
      settings: { ...emptyWorkspace.settings, ...settings },
    });
    const untouched = parseWorkspace(
      v2({ provider: "preview", model: "", useMemory: false }),
    );
    expect(untouched.version).toBe(3);
    expect(untouched.settings).toEqual({
      provider: "openrouter",
      model: "deepseek/deepseek-v4.1-flash",
      effort: "default",
      useMemory: false,
    });
    const chosen = { provider: "openai", model: "gpt-5.2", effort: "high" };
    expect(parseWorkspace(v2(chosen)).settings).toMatchObject(chosen);
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

/** Serve events as a server-sent event stream, in small uneven chunks. */
function sse(events: unknown[], named = false) {
  const text = events
    .map((event) =>
      named
        ? `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`
        : `data: ${typeof event === "string" ? event : JSON.stringify(event)}\n\n`,
    )
    .join("");
  const bytes = new TextEncoder().encode(`: keep-alive\n\n${text}`);
  return new Response(
    new ReadableStream({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 37)
          controller.enqueue(bytes.slice(i, i + 37));
        controller.close();
      },
    }),
  );
}
const pieces = (text: string) => text.match(/[\s\S]{1,60}/g) ?? [];
/** A chat completion as OpenRouter streams it. */
function openRouterStream(message: {
  content: string;
  annotations?: unknown[];
}) {
  return sse([
    { choices: [{ delta: { reasoning: "Considering puzzles. " } }] },
    ...pieces(message.content).map((content) => ({
      choices: [{ delta: { content } }],
    })),
    {
      choices: [
        {
          delta: { annotations: message.annotations ?? [] },
          finish_reason: "stop",
        },
      ],
    },
    "[DONE]",
  ]);
}
/** A Responses API result as it streams: deltas, finished items, then the whole response. */
function openAIStream(response: {
  status: string;
  output: {
    type?: string;
    content?: { type: string; text?: string; annotations?: unknown[] }[];
  }[];
}) {
  return sse([
    ...response.output.flatMap((item) => [
      ...(item.content ?? [])
        .filter((part) => part.type === "output_text")
        .flatMap((part) =>
          pieces(part.text ?? "").map((delta) => ({
            type: "response.output_text.delta",
            delta,
          })),
        ),
      { type: "response.output_item.done", item },
    ]),
    {
      type: `response.${response.status === "incomplete" ? "incomplete" : "completed"}`,
      response,
    },
  ]);
}
/** A Messages API turn as it streams, block by block. */
function anthropicStream(message: {
  stop_reason: string;
  content: Record<string, unknown>[];
}) {
  const events: unknown[] = [{ type: "message_start", message: {} }];
  message.content.forEach((block, index) => {
    if (block.type === "text") {
      events.push({
        type: "content_block_start",
        index,
        content_block: { type: "text", text: "" },
      });
      for (const text of pieces(block.text as string))
        events.push({
          type: "content_block_delta",
          index,
          delta: { type: "text_delta", text },
        });
    } else if (block.type === "server_tool_use") {
      events.push({
        type: "content_block_start",
        index,
        content_block: { ...block, input: {} },
      });
      const input = JSON.stringify(block.input);
      for (const partial_json of [input.slice(0, 5), input.slice(5)])
        events.push({
          type: "content_block_delta",
          index,
          delta: { type: "input_json_delta", partial_json },
        });
    } else
      events.push({ type: "content_block_start", index, content_block: block });
    events.push({ type: "content_block_stop", index });
  });
  events.push(
    { type: "message_delta", delta: { stop_reason: message.stop_reason } },
    { type: "message_stop" },
  );
  return sse(events, true);
}
describe("provider contracts", () => {
  const brief = previewBrief("Games", "A few hours", "");
  for (const provider of ["openrouter", "openai", "anthropic"] as const)
    it(`${provider} includes search, model, and thinking settings`, async () => {
      const text = JSON.stringify(brief);
      const mock = vi.fn().mockResolvedValue(
        provider === "openrouter"
          ? openRouterStream({ content: text })
          : provider === "openai"
            ? openAIStream({
                status: "completed",
                output: [{ content: [{ type: "output_text", text }] }],
              })
            : anthropicStream({
                stop_reason: "end_turn",
                content: [{ type: "text", text }],
              }),
      );
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
      expect(body.stream).toBe(true);
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
        anthropicStream({
          stop_reason: "pause_turn",
          content: [
            {
              type: "server_tool_use",
              id: "s1",
              name: "web_search",
              input: { query: "tiny puzzle games" },
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
        anthropicStream({
          stop_reason: "end_turn",
          content: [
            { type: "text", text: withSources.slice(0, 40) },
            { type: "text", text: withSources.slice(40) },
          ],
        }),
      );
    vi.stubGlobal("fetch", mock);
    const progress = vi.fn();
    const result = await generateFromAPI(
      apiInput("anthropic"),
      "k",
      undefined,
      progress,
    );
    expect(mock).toHaveBeenCalledTimes(2);
    const second = JSON.parse(mock.mock.calls[1][1].body);
    expect(second.messages).toHaveLength(2);
    expect(second.messages[1].role).toBe("assistant");
    // The rebuilt turn is sent back exactly as the API streamed it.
    expect(second.messages[1].content[0]).toEqual({
      type: "server_tool_use",
      id: "s1",
      name: "web_search",
      input: { query: "tiny puzzle games" },
    });
    expect(second.messages[1].content[1].content[0].url).toBe(
      "https://example.com/post",
    );
    const events = progress.mock.calls.map(([event]) => event);
    expect(events).toContainEqual({
      type: "search",
      query: "tiny puzzle games",
    });
    expect(events).toContainEqual({
      type: "pages",
      pages: [{ url: "https://example.com/post", title: "Found" }],
    });
    expect(
      events
        .filter((e) => e.type === "draft")
        .map((e) => e.text)
        .join(""),
    ).toBe(withSources);
    expect(result.sources.map((s) => s.verified)).toEqual([true, false]);
  });
  it("stops after a bounded number of continuations", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation(async () =>
          anthropicStream({ stop_reason: "pause_turn", content: [] }),
        ),
    );
    await expect(generateFromAPI(apiInput("anthropic"), "k")).rejects.toThrow(
      "Research did not finish",
    );
  });
  it("uses OpenAI search sources and url citations", async () => {
    const mock = vi.fn().mockResolvedValue(
      openAIStream({
        status: "completed",
        output: [
          {
            type: "web_search_call",
            action: {
              type: "search",
              query: "puzzle trends",
              sources: [{ type: "url", url: "https://a.dev/x" }],
            },
          } as never,
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
    const progress = vi.fn();
    const result = await generateFromAPI(
      apiInput("openai"),
      "k",
      undefined,
      progress,
    );
    expect(progress).toHaveBeenCalledWith({
      type: "search",
      query: "puzzle trends",
    });
    expect(progress).toHaveBeenCalledWith({
      type: "pages",
      pages: [{ url: "https://a.dev/x", title: "" }],
    });
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
        openRouterStream({
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
        }),
      ),
    );
    const progress = vi.fn();
    const result = await generateFromAPI(
      apiInput("openrouter"),
      "k",
      undefined,
      progress,
    );
    expect(progress).toHaveBeenCalledWith({
      type: "thinking",
      text: "Considering puzzles. ",
    });
    // Unsafe links never reach the progress feed.
    expect(progress).toHaveBeenCalledWith({
      type: "pages",
      pages: [{ url: "https://b.dev/y", title: "B" }],
    });
    expect(result.sources).toEqual([
      { title: "B", url: "https://b.dev/y", verified: true },
    ]);
  });
  it("reads OpenRouter's live stream shape with citations before the brief", async () => {
    // As observed from deepseek/deepseek-v4.1-flash with openrouter:web_search:
    // citations arrive early, one per chunk with empty content; reasoning comes
    // in a few large chunks; a usage chunk follows the finish.
    const delta = (fields: object) => ({
      choices: [
        { index: 0, delta: { role: "assistant", content: "", ...fields } },
      ],
    });
    const cite = (url: string, title: string) =>
      delta({
        annotations: [
          {
            type: "url_citation",
            url_citation: {
              url,
              title,
              start_index: 0,
              end_index: 0,
              content: "…",
            },
          },
        ],
      });
    const long = "r".repeat(25000);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sse([
          delta({ reasoning: "Let me search. " }),
          cite("https://a.dev/x", "A"),
          cite("https://b.dev/y", "B"),
          delta({ reasoning: long }),
          ...pieces(JSON.stringify({ ...brief, sources: [] })).map((content) =>
            delta({ content }),
          ),
          {
            choices: [
              {
                index: 0,
                delta: { role: "assistant", content: "" },
                finish_reason: "stop",
              },
            ],
          },
          {
            choices: [
              {
                index: 0,
                delta: { role: "assistant", content: "" },
                finish_reason: "stop",
              },
            ],
            usage: { server_tool_use_details: { web_search_requests: 2 } },
          },
          "[DONE]",
        ]),
      ),
    );
    const progress = vi.fn();
    const result = await generateFromAPI(
      apiInput("openrouter"),
      "k",
      undefined,
      progress,
    );
    const events = progress.mock.calls.map(([event]) => event);
    expect(events.filter((e) => e.type === "pages")).toHaveLength(2);
    // Oversized reasoning keeps its tail so it still fits the progress schema.
    const thinking = events.filter((e) => e.type === "thinking");
    expect(thinking[1].text).toHaveLength(20000);
    for (const event of events)
      expect(progressEventSchema.safeParse(event).success).toBe(true);
    expect(result.sources).toEqual([
      { title: "A", url: "https://a.dev/x", verified: true },
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

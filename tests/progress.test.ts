import { describe, it, expect, vi, afterEach } from "vitest";
import { generateFromAPI } from "../server/providers.js";
import { readEvents } from "../server/stream.js";
import handler from "../api/generate.js";
import { previewBrief } from "../src/lib/preview";
import { emptyWorkspace } from "../src/lib/schema";
import { requestBrief } from "../src/features/generation/request";
import {
  applyEvent,
  currentStep,
  ingredientsFor,
  newActivity,
  partialBrief,
  thinkingSnippet,
} from "../src/features/generation/activity";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const brief = previewBrief("Games", "A few hours", "");
const input = (provider: "openrouter" | "openai" | "anthropic") => ({
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
const stream = (text: string, type = "text/event-stream") =>
  new Response(text, { headers: { "Content-Type": type } });
const data = (...events: unknown[]) =>
  events
    .map((e) => `data: ${typeof e === "string" ? e : JSON.stringify(e)}\n\n`)
    .join("");

describe("server-sent events", () => {
  it("joins multi-line data, skips comments, and handles CRLF", async () => {
    const seen = [];
    // A stream that ends without a trailing blank line still yields its last event.
    const body = stream(
      ": ping\r\n\r\nevent: a\r\ndata: 1\r\ndata: 2\r\n\r\ndata: 3",
    ).body;
    for await (const event of readEvents(body)) seen.push(event);
    expect(seen).toEqual([
      { event: "a", data: "1\n2" },
      { event: "", data: "3" },
    ]);
  });
});

describe("stream failures never produce a brief", () => {
  it("surfaces an OpenRouter error sent mid-stream", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          stream(
            data(
              { choices: [{ delta: { content: '{"title":' } }] },
              { error: { message: "Upstream overloaded" } },
            ),
          ),
        ),
    );
    await expect(generateFromAPI(input("openrouter"), "k")).rejects.toThrow(
      "Upstream overloaded",
    );
  });
  it("reports OpenRouter output that hit the token limit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        stream(
          data(
            {
              choices: [{ delta: { content: "{" }, finish_reason: "length" }],
            },
            "[DONE]",
          ),
        ),
      ),
    );
    await expect(generateFromAPI(input("openrouter"), "k")).rejects.toThrow(
      "ran out of output space",
    );
  });
  it("rejects an OpenAI stream that ends before completion", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          stream(data({ type: "response.output_text.delta", delta: "{" })),
        ),
    );
    await expect(generateFromAPI(input("openai"), "k")).rejects.toThrow(
      "stream ended",
    );
  });
  it("rejects an Anthropic stream cut off before its stop reason", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        stream(
          data({
            type: "content_block_start",
            index: 0,
            content_block: { type: "text", text: JSON.stringify(brief) },
          }),
        ),
      ),
    );
    await expect(generateFromAPI(input("anthropic"), "k")).rejects.toThrow(
      "stream ended",
    );
  });
  it("surfaces an Anthropic error event", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          stream(
            data({ type: "error", error: { message: "Overloaded right now" } }),
          ),
        ),
    );
    await expect(generateFromAPI(input("anthropic"), "k")).rejects.toThrow(
      "Overloaded right now",
    );
  });
  it("finishes OpenAI without streaming when the organization cannot stream", async () => {
    const mock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: "Your organization must be verified to stream this model.",
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: "completed",
          output: [
            {
              content: [{ type: "output_text", text: JSON.stringify(brief) }],
            },
          ],
        }),
      });
    vi.stubGlobal("fetch", mock);
    const result = await generateFromAPI(input("openai"), "k");
    expect(result.title).toBe(brief.title);
    expect(JSON.parse(mock.mock.calls[0][1].body).stream).toBe(true);
    expect(JSON.parse(mock.mock.calls[1][1].body).stream).toBeUndefined();
  });
  it("does not retry other OpenAI errors", async () => {
    const mock = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: { message: "Unknown model" } }),
    });
    vi.stubGlobal("fetch", mock);
    await expect(generateFromAPI(input("openai"), "k")).rejects.toThrow(
      "Unknown model",
    );
    expect(mock).toHaveBeenCalledTimes(1);
  });
});

describe("progress endpoint", () => {
  function res() {
    const written: string[] = [];
    const r = {
      statusCode: 0,
      writableEnded: false,
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      on: vi.fn(),
      write: vi.fn((chunk: string) => written.push(chunk)),
      end: vi.fn(() => {
        r.writableEnded = true;
      }),
    };
    const events = () =>
      written
        .join("")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    return { r, events };
  }
  const request = (key = "secret-key") =>
    ({
      method: "POST",
      headers: { accept: "application/x-ndjson", "x-provider-key": key },
      body: input("openrouter"),
    }) as never;

  it("streams progress and ends with the result", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          stream(
            data(
              { choices: [{ delta: { reasoning: "Hmm." } }] },
              { choices: [{ delta: { content: JSON.stringify(brief) } }] },
              "[DONE]",
            ),
          ),
        ),
    );
    const { r, events } = res();
    await handler(request(), r as never);
    expect(r.statusCode).toBe(200);
    expect(r.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "application/x-ndjson; charset=utf-8",
    );
    const all = events();
    expect(all[0]).toEqual({ type: "started", local: false });
    expect(all[1]).toEqual({ type: "thinking", text: "Hmm." });
    expect(all.at(-1).type).toBe("result");
    expect(all.at(-1).brief.title).toBe(brief.title);
    expect(r.end).toHaveBeenCalled();
  });
  it("sends failures in-band with the key redacted", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          stream(data({ error: { message: "bad key secret-key" } })),
        ),
    );
    const { r, events } = res();
    await handler(request(), r as never);
    const last = events().at(-1);
    expect(last.type).toBe("error");
    expect(last.error).toContain("[redacted]");
    expect(last.error).not.toContain("secret-key");
  });
  it("keeps validation errors as plain JSON responses", async () => {
    const { r } = res();
    await handler(
      {
        method: "POST",
        headers: { accept: "application/x-ndjson" },
        body: {},
      } as never,
      r as never,
    );
    expect(r.status).toHaveBeenCalledWith(400);
    expect(r.write).not.toHaveBeenCalled();
  });
});

describe("client progress reader", () => {
  const prepared = { context: "", images: [] };
  const ndjson = (...lines: unknown[]) =>
    stream(
      lines.map((l) => JSON.stringify(l)).join("\n") + "\n",
      "application/x-ndjson; charset=utf-8",
    );
  const call = (onEvent = vi.fn()) =>
    requestBrief(
      emptyWorkspace,
      { key: "", token: "" },
      "Games",
      prepared,
      new AbortController().signal,
      onEvent,
    );

  it("passes progress through and returns the validated result", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          ndjson(
            { type: "started", local: false },
            { type: "search", query: "q" },
            { type: "mystery" },
            { type: "result", brief },
          ),
        ),
    );
    const onEvent = vi.fn();
    const result = await call(onEvent);
    expect(result.title).toBe(brief.title);
    expect(onEvent.mock.calls.map(([e]) => e.type)).toEqual([
      "started",
      "search",
    ]);
  });
  it("throws the streamed error instead of inventing a result", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          ndjson(
            { type: "started", local: false },
            { type: "error", error: "No quota" },
          ),
        ),
    );
    await expect(call()).rejects.toThrow("No quota");
  });
  it("rejects an invalid result and a stream that closes early", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(ndjson({ type: "result", brief: { title: "" } }))
        .mockResolvedValueOnce(ndjson({ type: "started", local: false })),
    );
    await expect(call()).rejects.toThrow("incomplete brief");
    await expect(call()).rejects.toThrow("closed before");
  });
  it("still reads plain JSON errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Connect an API key" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    await expect(call()).rejects.toThrow("Connect an API key");
  });
});

describe("activity", () => {
  it("summarizes only what was actually shared", () => {
    const w = emptyWorkspace;
    const off = { ...w, settings: { ...w.settings, useMemory: false } };
    expect(ingredientsFor(off, "", []).memory).toBeNull();
    const on = { ...w, settings: { ...w.settings, useMemory: true } };
    expect(
      ingredientsFor(
        on,
        JSON.stringify({
          preferences: ["a", "b"],
          recentIdeas: [],
          journal: [{}],
        }),
        ["img"],
      ).memory,
    ).toEqual({ notes: 2, recentIdeas: 0, journal: 1, photos: 1 });
  });
  it("follows the most recent event and dedupes research", () => {
    let a = newActivity({ duration: "A weekend", mood: "", memory: null });
    expect(currentStep(a)).toBe("sending");
    a = applyEvent(a, { type: "started", local: false });
    expect(currentStep(a)).toBe("asking");
    a = applyEvent(a, { type: "thinking", text: "First, " });
    a = applyEvent(a, { type: "search", query: "q" });
    a = applyEvent(a, { type: "search", query: "q" });
    expect(currentStep(a)).toBe("searching");
    expect(a.searches).toEqual(["q"]);
    const page = { url: "https://a.dev", title: "A" };
    a = applyEvent(a, { type: "pages", pages: [page] });
    a = applyEvent(a, { type: "pages", pages: [page] });
    expect(a.pages).toEqual([page]);
    expect(currentStep(a)).toBe("reading");
    a = applyEvent(a, { type: "draft", text: "Here is the idea. " });
    expect(currentStep(a)).toBe("thinking");
    a = applyEvent(a, { type: "draft", text: '{"title":"Tid' });
    expect(currentStep(a)).toBe("writing");
  });
  it("reads a brief that is still being written", () => {
    expect(partialBrief("")).toEqual({
      title: "",
      summary: "",
      features: 0,
      promptWords: 0,
    });
    const draft =
      '{"title":"Tide \\"Pool\\"","summary":"A calm \\n ga\\u00e9 and more\\';
    expect(partialBrief(draft).title).toBe('Tide "Pool"');
    expect(partialBrief(draft).summary).toContain("A calm");
    const later =
      '{"title":"T","summary":"S","whyNow":"W","features":["one, two","three"],"prompt":"Build a small';
    expect(partialBrief(later)).toMatchObject({
      features: 2,
      promptWords: 3,
    });
  });
  it("trims reasoning to a readable tail", () => {
    expect(thinkingSnippet("  short\n thought ")).toBe("short thought");
    const long = thinkingSnippet("word ".repeat(200));
    expect(long.startsWith("…word")).toBe(true);
    expect(long.length).toBeLessThanOrEqual(361);
  });
});

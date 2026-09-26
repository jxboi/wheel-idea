// @ts-check
import { briefSchema } from "../shared/contract.js";
import { buildPrompt } from "./prompt.js";
import {
  attachProvenance,
  retrievedFromAnthropic,
  retrievedFromOpenAI,
  retrievedFromOpenRouter,
} from "./provenance.js";
import { json, pagesFrom, readEvents } from "./stream.js";

/** @typedef {import("../shared/contract.js").GenerateRequest} GenerateRequest */
/** @typedef {import("../shared/contract.js").Brief} Brief */
/** @typedef {import("../shared/contract.js").OnProgress} OnProgress */

export const providerDeadlineMs = 105000;
const maxContinuations = 3;

/**
 * Find the brief JSON object in model output. Models sometimes write a sentence
 * (which may itself contain braces) before the object, so try each opening brace.
 * @param {string} raw
 * @returns {Brief}
 */
export function parseBrief(raw) {
  const end = raw.lastIndexOf("}");
  let start = raw.indexOf("{");
  if (start < 0 || end < start)
    throw new Error(
      "The model did not return a complete brief. Try again or choose another model.",
    );
  for (
    let attempts = 0;
    start >= 0 && start < end && attempts < 50;
    attempts++
  ) {
    try {
      const parsed = briefSchema.parse(JSON.parse(raw.slice(start, end + 1)));
      // Provenance is decided by the server, never by the model.
      return {
        ...parsed,
        sources: parsed.sources.map(({ title, url }) => ({ title, url })),
      };
    } catch {
      start = raw.indexOf("{", start + 1);
    }
  }
  throw new Error(
    "The model returned an incomplete brief. Try again or choose another model.",
  );
}

/**
 * Open a streaming provider request. Errors before the stream starts carry the
 * provider's message; errors inside the stream are handled by each adapter.
 * @param {string} url
 * @param {Record<string, string>} headers
 * @param {unknown} body
 * @param {AbortSignal} signal
 */
async function post(url, headers, body, signal) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      ...headers,
    },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) await failure(response);
  return response.body;
}

/**
 * @param {Response} response
 * @returns {Promise<never>}
 */
async function failure(response) {
  const error = await response.json().catch(() => ({}));
  const message =
    typeof error?.error?.message === "string"
      ? error.error.message
      : "Request rejected";
  throw new Error(
    `Provider error (${response.status}): ${message.slice(0, 300)}`,
  );
}

/** @param {unknown} message */
const streamError = (message) =>
  new Error(
    `Provider error: ${typeof message === "string" && message ? message.slice(0, 300) : "the stream failed"}`,
  );

/**
 * @param {ReadableStream<Uint8Array> | null} body
 * @param {OnProgress} progress
 */
async function readOpenRouter(body, progress) {
  let content = "";
  /** @type {any[]} */
  const annotations = [];
  let finish = null;
  for await (const { data } of readEvents(body)) {
    if (data === "[DONE]") break;
    const chunk = json(data);
    if (!chunk) continue;
    if (chunk.error) throw streamError(chunk.error.message);
    const choice = chunk.choices?.[0];
    const delta = choice?.delta ?? {};
    if (typeof delta.reasoning === "string" && delta.reasoning)
      progress({ type: "thinking", text: delta.reasoning });
    if (typeof delta.content === "string" && delta.content) {
      content += delta.content;
      progress({ type: "draft", text: delta.content });
    }
    if (Array.isArray(delta.annotations) && delta.annotations.length) {
      annotations.push(...delta.annotations);
      const pages = pagesFrom(
        retrievedFromOpenRouter({
          choices: [{ message: { annotations: delta.annotations } }],
        }),
      );
      if (pages.length) progress({ type: "pages", pages });
    }
    if (choice?.finish_reason) finish = choice.finish_reason;
  }
  if (finish === "length")
    throw new Error(
      "The model ran out of output space. Choose a lower thinking effort and try again.",
    );
  if (finish === "error") throw streamError("");
  return { choices: [{ message: { content, annotations } }] };
}

/**
 * Rebuild the Responses API result from its stream. The final event carries the
 * whole response, so parsing and provenance match the non-streaming shape.
 * @param {ReadableStream<Uint8Array> | null} body
 * @param {OnProgress} progress
 */
async function readOpenAI(body, progress) {
  for await (const { data } of readEvents(body)) {
    const event = json(data);
    switch (event?.type) {
      case "response.output_text.delta":
        if (event.delta) progress({ type: "draft", text: event.delta });
        break;
      case "response.reasoning_summary_text.delta":
        if (event.delta) progress({ type: "thinking", text: event.delta });
        break;
      case "response.output_item.done": {
        const item = event.item;
        if (item?.type !== "web_search_call") break;
        const query = item.action?.query;
        if (typeof query === "string" && query)
          progress({ type: "search", query: query.slice(0, 500) });
        const pages = pagesFrom(
          retrievedFromOpenAI({ output: [{ ...item, content: [] }] }),
        );
        if (pages.length) progress({ type: "pages", pages });
        break;
      }
      case "response.completed":
      case "response.incomplete":
        return event.response;
      case "response.failed":
        throw streamError(event.response?.error?.message);
      case "error":
        throw streamError(event.message ?? event.error?.message);
    }
  }
  throw new Error(
    "The provider stream ended before the brief was complete. Try again.",
  );
}

/**
 * Accumulate a streamed Messages API turn into complete content blocks, which a
 * paused turn must send back unchanged.
 * @param {ReadableStream<Uint8Array> | null} body
 * @param {OnProgress} progress
 */
async function readAnthropic(body, progress) {
  /** @type {any[]} */
  const blocks = [];
  /** @type {Map<number, string>} */
  const inputs = new Map();
  let stopReason = null;
  for await (const { data } of readEvents(body)) {
    const event = json(data);
    switch (event?.type) {
      case "content_block_start": {
        const block = { ...event.content_block };
        blocks[event.index] = block;
        if (block.type === "server_tool_use" || block.type === "tool_use")
          inputs.set(event.index, "");
        if (block.type === "web_search_tool_result") {
          const pages = pagesFrom(retrievedFromAnthropic([block]));
          if (pages.length) progress({ type: "pages", pages });
        }
        break;
      }
      case "content_block_delta": {
        const block = blocks[event.index];
        const delta = event.delta ?? {};
        if (!block) break;
        if (delta.type === "text_delta") {
          block.text = (block.text ?? "") + delta.text;
          progress({ type: "draft", text: delta.text });
        } else if (delta.type === "thinking_delta") {
          block.thinking = (block.thinking ?? "") + delta.thinking;
          progress({ type: "thinking", text: delta.thinking });
        } else if (delta.type === "signature_delta")
          block.signature = delta.signature;
        else if (delta.type === "input_json_delta")
          inputs.set(
            event.index,
            (inputs.get(event.index) ?? "") + delta.partial_json,
          );
        else if (delta.type === "citations_delta")
          (block.citations ??= []).push(delta.citation);
        break;
      }
      case "content_block_stop": {
        const block = blocks[event.index];
        const partial = inputs.get(event.index);
        if (!block || partial === undefined) break;
        block.input = partial ? (json(partial) ?? {}) : (block.input ?? {});
        inputs.delete(event.index);
        const query = block.input?.query;
        if (block.type === "server_tool_use" && typeof query === "string")
          progress({ type: "search", query: query.slice(0, 500) });
        break;
      }
      case "message_delta":
        stopReason = event.delta?.stop_reason ?? stopReason;
        break;
      case "error":
        throw streamError(event.error?.message);
    }
  }
  return { stop_reason: stopReason, content: blocks.filter(Boolean) };
}

/**
 * @param {GenerateRequest} input
 * @param {string} key
 * @param {AbortSignal} [signal] aborted when the browser disconnects
 * @param {OnProgress} [progress] receives live events as the provider works
 * @returns {Promise<Brief>}
 */
export async function generateFromAPI(input, key, signal, progress = () => {}) {
  const { provider, model, effort } = input.settings;
  if (!model.trim()) throw new Error("Choose a model in Settings first.");
  const prompt = buildPrompt(input);
  // One deadline for the whole generation, including continuations.
  const deadline = AbortSignal.timeout(providerDeadlineMs);
  const combined = signal ? AbortSignal.any([signal, deadline]) : deadline;
  if (provider === "openrouter") {
    const content = input.images.length
      ? [
          { type: "text", text: prompt },
          ...input.images.map((url) => ({
            type: "image_url",
            image_url: { url },
          })),
        ]
      : prompt;
    const data = await readOpenRouter(
      await post(
        "https://openrouter.ai/api/v1/chat/completions",
        { Authorization: `Bearer ${key}`, "X-Title": "Orbit Studio" },
        {
          model,
          messages: [{ role: "user", content }],
          tools: [
            {
              type: "openrouter:web_search",
              parameters: { max_uses: 3, max_total_results: 6 },
            },
          ],
          ...(effort !== "default" ? { reasoning: { effort } } : {}),
          max_tokens: 8000,
          stream: true,
        },
        combined,
      ),
      progress,
    );
    return attachProvenance(
      parseBrief(data.choices[0].message.content),
      retrievedFromOpenRouter(data),
    );
  }
  if (provider === "openai") {
    const content = [
      { type: "input_text", text: prompt },
      ...input.images.map((image_url) => ({
        type: "input_image",
        image_url,
        detail: "auto",
      })),
    ];
    const body = {
      model,
      input: [{ role: "user", content }],
      tools: [{ type: "web_search" }],
      tool_choice: "required",
      include: ["web_search_call.action.sources"],
      ...(effort !== "default" ? { reasoning: { effort } } : {}),
      max_output_tokens: 8000,
      store: false,
    };
    const url = "https://api.openai.com/v1/responses";
    const headers = { Authorization: `Bearer ${key}` };
    let data;
    try {
      data = await readOpenAI(
        await post(url, headers, { ...body, stream: true }, combined),
        progress,
      );
    } catch (error) {
      // Some models stream only for verified organizations. Progress is a
      // nicety, so finish the same request without it rather than failing.
      if (
        !(error instanceof Error) ||
        !/^Provider error \(400\).*(stream|verif)/i.test(error.message)
      )
        throw error;
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: combined,
      });
      if (!response.ok) await failure(response);
      data = await response.json();
    }
    if (data?.status === "incomplete")
      throw new Error(
        "The model ran out of output space. Choose a lower thinking effort and try again.",
      );
    return attachProvenance(
      parseBrief(
        (data?.output ?? [])
          .flatMap((/** @type {any} */ output) => output.content ?? [])
          .filter((/** @type {any} */ part) => part.type === "output_text")
          .map((/** @type {any} */ part) => part.text)
          .join("\n"),
      ),
      retrievedFromOpenAI(data),
    );
  }
  if (provider === "anthropic") {
    const content = [
      { type: "text", text: prompt },
      ...input.images.map((url) => {
        const [prefix, data] = url.split(",");
        return {
          type: "image",
          source: { type: "base64", media_type: prefix.slice(5, -7), data },
        };
      }),
    ];
    // The server-side search loop can pause mid-turn. Send the partial assistant
    // turn back unchanged and the API resumes where it stopped.
    const assistant = [];
    for (let continuation = 0; ; continuation++) {
      const data = await readAnthropic(
        await post(
          "https://api.anthropic.com/v1/messages",
          { "x-api-key": key, "anthropic-version": "2023-06-01" },
          {
            model,
            max_tokens: 8000,
            messages: [
              { role: "user", content },
              ...(assistant.length
                ? [{ role: "assistant", content: assistant }]
                : []),
            ],
            tools: [
              { type: "web_search_20250305", name: "web_search", max_uses: 3 },
            ],
            ...(effort !== "default"
              ? { thinking: { type: "adaptive" }, output_config: { effort } }
              : {}),
            stream: true,
          },
          combined,
        ),
        progress,
      );
      assistant.push(...data.content);
      if (data.stop_reason === "pause_turn") {
        if (continuation < maxContinuations) continue;
        throw new Error(
          "Research did not finish within this request. Try again with lower thinking effort.",
        );
      }
      if (data.stop_reason === "max_tokens")
        throw new Error(
          "The model ran out of output space. Choose a lower thinking effort and try again.",
        );
      if (data.stop_reason === "refusal")
        throw new Error(
          "The model declined this request. Try again or adjust your mood and memory.",
        );
      if (!data.stop_reason)
        throw new Error(
          "The provider stream ended before the brief was complete. Try again.",
        );
      return attachProvenance(
        parseBrief(
          assistant
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join(""),
        ),
        retrievedFromAnthropic(assistant),
      );
    }
  }
  throw new Error("Unknown API provider.");
}

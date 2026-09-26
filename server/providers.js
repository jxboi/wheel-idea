// @ts-check
import { briefSchema } from "../shared/contract.js";
import { buildPrompt } from "./prompt.js";
import {
  attachProvenance,
  retrievedFromAnthropic,
  retrievedFromOpenAI,
  retrievedFromOpenRouter,
} from "./provenance.js";

/** @typedef {import("../shared/contract.js").GenerateRequest} GenerateRequest */
/** @typedef {import("../shared/contract.js").Brief} Brief */

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
 * @param {string} url
 * @param {Record<string, string>} headers
 * @param {unknown} body
 * @param {AbortSignal} signal
 */
async function post(url, headers, body, signal) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message =
      typeof error?.error?.message === "string"
        ? error.error.message
        : "Request rejected";
    throw new Error(
      `Provider error (${response.status}): ${message.slice(0, 300)}`,
    );
  }
  return response.json();
}

/**
 * @param {GenerateRequest} input
 * @param {string} key
 * @param {AbortSignal} [signal] aborted when the browser disconnects
 * @returns {Promise<Brief>}
 */
export async function generateFromAPI(input, key, signal) {
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
    const data = await post(
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
      },
      combined,
    );
    return attachProvenance(
      parseBrief(data.choices?.[0]?.message?.content ?? ""),
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
    const data = await post(
      "https://api.openai.com/v1/responses",
      { Authorization: `Bearer ${key}` },
      {
        model,
        input: [{ role: "user", content }],
        tools: [{ type: "web_search" }],
        tool_choice: "required",
        include: ["web_search_call.action.sources"],
        ...(effort !== "default" ? { reasoning: { effort } } : {}),
        max_output_tokens: 8000,
        store: false,
      },
      combined,
    );
    if (data.status === "incomplete")
      throw new Error(
        "The model ran out of output space. Choose a lower thinking effort and try again.",
      );
    return attachProvenance(
      parseBrief(
        (data.output ?? [])
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
      const data = await post(
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
        },
        combined,
      );
      assistant.push(...(data.content ?? []));
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

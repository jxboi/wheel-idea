import {
  briefSchema,
  type GenerateRequest,
  type Brief,
} from "../src/lib/schema";
import { buildPrompt } from "./prompt";
export function parseBrief(raw: string): Brief {
  const start = raw.indexOf("{"),
    end = raw.lastIndexOf("}");
  if (start < 0 || end < start)
    throw new Error(
      "The model did not return a complete brief. Try again or choose another model.",
    );
  try {
    return briefSchema.parse(JSON.parse(raw.slice(start, end + 1)));
  } catch {
    throw new Error(
      "The model returned an incomplete brief. Try again or choose another model.",
    );
  }
}
async function post(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal?: AbortSignal,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: signal ?? AbortSignal.timeout(105000),
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
export async function generateFromAPI(
  input: GenerateRequest,
  key: string,
  signal?: AbortSignal,
): Promise<Brief> {
  const { provider, model, effort } = input.settings;
  if (!model.trim()) throw new Error("Choose a model in Settings first.");
  const prompt = buildPrompt(input);
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
      signal,
    );
    return parseBrief(data.choices?.[0]?.message?.content ?? "");
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
        ...(effort !== "default" ? { reasoning: { effort } } : {}),
        max_output_tokens: 8000,
        store: false,
      },
      signal,
    );
    if (data.status === "incomplete")
      throw new Error(
        "The model ran out of output space. Choose a lower thinking effort and try again.",
      );
    return parseBrief(
      (data.output ?? [])
        .flatMap(
          (o: { content?: { type: string; text?: string }[] }) =>
            o.content ?? [],
        )
        .filter((c: { type: string }) => c.type === "output_text")
        .map((c: { text: string }) => c.text)
        .join("\n"),
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
    const data = await post(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": key, "anthropic-version": "2023-06-01" },
      {
        model,
        max_tokens: 8000,
        messages: [{ role: "user", content }],
        tools: [
          { type: "web_search_20250305", name: "web_search", max_uses: 3 },
        ],
        ...(effort !== "default"
          ? { thinking: { type: "adaptive" }, output_config: { effort } }
          : {}),
      },
      signal,
    );
    if (data.stop_reason === "max_tokens" || data.stop_reason === "pause_turn")
      throw new Error(
        "Research did not finish within this request. Try again with lower thinking effort.",
      );
    return parseBrief(
      (data.content ?? [])
        .filter((c: { type: string }) => c.type === "text")
        .map((c: { text: string }) => c.text)
        .join("\n"),
    );
  }
  throw new Error("Unknown API provider.");
}

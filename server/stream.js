// @ts-check
// Server-sent event parsing for provider streams, and progress helpers.

/** @typedef {import("../shared/contract.js").Page} Page */

/**
 * Yield the data payload of each server-sent event. Comment lines (keep-alives)
 * are skipped, and multi-line data fields are joined as the spec requires.
 * @param {ReadableStream<Uint8Array> | null | undefined} body
 * @returns {AsyncGenerator<{ event: string, data: string }>}
 */
export async function* readEvents(body) {
  if (!body) throw new Error("The provider returned an empty stream.");
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  /** @param {string} block */
  const parse = (block) => {
    let event = "";
    const data = [];
    for (const line of block.split(/\r?\n/)) {
      if (!line || line.startsWith(":")) continue;
      const colon = line.indexOf(":");
      const field = colon < 0 ? line : line.slice(0, colon);
      const value = colon < 0 ? "" : line.slice(colon + 1).replace(/^ /, "");
      if (field === "event") event = value;
      else if (field === "data") data.push(value);
    }
    return data.length ? { event, data: data.join("\n") } : null;
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = done ? "" : (blocks.pop() ?? "");
      for (const block of blocks) {
        const parsed = parse(block);
        if (parsed) yield parsed;
      }
      if (done) return;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Parse one event's JSON. Unparseable keep-alive payloads are ignored.
 * @param {string} data
 * @returns {any}
 */
export function json(data) {
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Pages safe to show the user: http(s) only, bounded titles, no duplicates.
 * @param {{ url: unknown, title?: unknown }[]} found
 * @returns {Page[]}
 */
export function pagesFrom(found) {
  const seen = new Set();
  /** @type {Page[]} */
  const pages = [];
  for (const { url, title } of found) {
    if (typeof url !== "string" || !/^https?:\/\//.test(url) || seen.has(url))
      continue;
    try {
      new URL(url);
    } catch {
      continue;
    }
    seen.add(url);
    pages.push({
      url,
      title: (typeof title === "string" ? title : "").slice(0, 500),
    });
    if (pages.length === 20) break;
  }
  return pages;
}

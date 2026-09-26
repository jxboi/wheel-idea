// @ts-check
// Research provenance: which pages did the provider's search tool actually return?
// Model-written source lists are only marked verified when they match one of these.

/** @typedef {{ url: string, title: string }} Retrieved */
/** @typedef {import("../shared/contract.js").Brief} Brief */

/** Comparable form of a URL: host without www, path without trailing slash, no hash or utm_*. */
/** @param {string} value */
export function normalizeUrl(value) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return null;
    for (const key of [...url.searchParams.keys()])
      if (key.toLowerCase().startsWith("utm_")) url.searchParams.delete(key);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const path = url.pathname.replace(/\/+$/, "");
    const search = url.searchParams.toString();
    return `${host}${path}${search ? `?${search}` : ""}`;
  } catch {
    return null;
  }
}

/** @param {unknown} value */
const text = (value) => (typeof value === "string" ? value : "");

/**
 * @param {any} data provider response JSON
 * @returns {Retrieved[]}
 */
export function retrievedFromOpenRouter(data) {
  return (data?.choices?.[0]?.message?.annotations ?? [])
    .filter((/** @type {any} */ a) => a?.type === "url_citation")
    .map((/** @type {any} */ a) => ({
      url: text(a.url_citation?.url),
      title: text(a.url_citation?.title),
    }));
}

/**
 * @param {any} data provider response JSON
 * @returns {Retrieved[]}
 */
export function retrievedFromOpenAI(data) {
  const found = [];
  for (const item of data?.output ?? []) {
    if (item?.type === "web_search_call")
      for (const source of item.action?.sources ?? [])
        found.push({ url: text(source?.url), title: text(source?.title) });
    for (const part of item?.content ?? [])
      for (const a of part?.annotations ?? [])
        if (a?.type === "url_citation")
          found.push({ url: text(a.url), title: text(a.title) });
  }
  return found;
}

/**
 * @param {any[]} blocks assistant content blocks
 * @returns {Retrieved[]}
 */
export function retrievedFromAnthropic(blocks) {
  const found = [];
  for (const block of blocks ?? []) {
    // A failed search returns an error object instead of a result list.
    if (
      block?.type === "web_search_tool_result" &&
      Array.isArray(block.content)
    )
      for (const result of block.content)
        if (result?.type === "web_search_result")
          found.push({ url: text(result.url), title: text(result.title) });
    for (const citation of block?.citations ?? [])
      if (citation?.type === "web_search_result_location")
        found.push({ url: text(citation.url), title: text(citation.title) });
  }
  return found;
}

/**
 * Mark each model-listed source as verified or not. When the model listed none
 * but the search tool did return pages, surface up to five of those instead.
 * @param {Brief} brief
 * @param {Retrieved[] | null} retrieved null when the provider exposes no search results
 * @returns {Brief}
 */
export function attachProvenance(brief, retrieved) {
  const known = new Set(
    (retrieved ?? []).map((r) => normalizeUrl(r.url)).filter(Boolean),
  );
  const sources = brief.sources.map((source) => ({
    title: source.title,
    url: source.url,
    verified: known.has(normalizeUrl(source.url)),
  }));
  if (!sources.length && retrieved?.length) {
    const seen = new Set();
    for (const r of retrieved) {
      const key = normalizeUrl(r.url);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      sources.push({
        title: (r.title || new URL(r.url).hostname).slice(0, 500),
        url: r.url,
        verified: true,
      });
      if (sources.length === 5) break;
    }
  }
  return { ...brief, sources };
}

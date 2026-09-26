import type { Credentials } from "./request";

const storageKey = "orbit.credentials";
const empty: Credentials = { key: "", token: "" };

/**
 * Credentials live in tab-scoped session storage so a reload, or a mobile
 * browser discarding a background tab, does not drop them. They are never
 * written to persistent storage and disappear when the tab closes.
 */
export function loadCredentials(storage = sessionStore()): Credentials {
  try {
    const raw = storage?.getItem(storageKey);
    if (!raw) return { ...empty };
    const parsed = JSON.parse(raw) as Partial<Credentials>;
    return {
      key: typeof parsed.key === "string" ? parsed.key : "",
      token: typeof parsed.token === "string" ? parsed.token : "",
    };
  } catch {
    return { ...empty };
  }
}

export function storeCredentials(
  credentials: Credentials,
  storage = sessionStore(),
) {
  try {
    if (!credentials.key && !credentials.token) storage?.removeItem(storageKey);
    else storage?.setItem(storageKey, JSON.stringify(credentials));
  } catch {
    // Storage can be unavailable (private mode, blocked site data); memory still works.
  }
}

function sessionStore(): Storage | undefined {
  try {
    return typeof sessionStorage === "undefined" ? undefined : sessionStorage;
  } catch {
    return undefined;
  }
}

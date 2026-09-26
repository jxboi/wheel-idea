// @ts-check
import {
  createHmac,
  createHash,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/**
 * GitHub sign-in for server-funded generation. The session is a signed,
 * HttpOnly cookie holding only the GitHub user id and login; the GitHub
 * access token is revoked right after sign-in and never stored.
 */

const sessionDays = 30;
const stateMinutes = 10;

/** @typedef {{ id: number, login: string }} GitHubUser */
/** @typedef {{ headers: Record<string, string | string[] | undefined>, url?: string }} AuthRequest */

export function githubConfigured() {
  return Boolean(
    process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
  );
}

/** Numeric GitHub user ids allowed to use server keys. Empty means nobody. */
export function allowedIds() {
  return new Set(
    String(process.env.ORBIT_ALLOWED_GITHUB_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => /^\d+$/.test(id)),
  );
}

/** @param {number} id */
export function isAllowed(id) {
  return allowedIds().has(String(id));
}

/** @param {string} left @param {string} right */
export function equal(left, right) {
  return (
    Buffer.byteLength(left) === Buffer.byteLength(right) &&
    timingSafeEqual(Buffer.from(left), Buffer.from(right))
  );
}

function secure() {
  return Boolean(process.env.VERCEL);
}

function cookieNames() {
  // __Host- binds the cookie to this exact origin; it requires HTTPS.
  return secure()
    ? { session: "__Host-orbit_session", state: "__Host-orbit_oauth" }
    : { session: "orbit_session", state: "orbit_oauth" };
}

function signingKey() {
  const secret =
    process.env.ORBIT_SESSION_SECRET || process.env.GITHUB_CLIENT_SECRET;
  if (!secret) return null;
  return createHash("sha256").update(`orbit-session:${secret}`).digest();
}

/** @param {string} payload @param {Buffer} key */
function sign(payload, key) {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

/**
 * @param {GitHubUser} user
 * @param {number} [now]
 */
export function createSession(user, now = Date.now()) {
  const key = signingKey();
  if (!key) throw new Error("GitHub sign-in is not configured.");
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      login: user.login,
      exp: now + sessionDays * 86_400_000,
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload, key)}`;
}

/**
 * @param {string | undefined} value
 * @param {number} [now]
 * @returns {GitHubUser | null}
 */
export function readSession(value, now = Date.now()) {
  const key = signingKey();
  if (!key || !value) return null;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra !== undefined) return null;
  if (!equal(signature, sign(payload, key))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (
      typeof data.id !== "number" ||
      typeof data.login !== "string" ||
      typeof data.exp !== "number" ||
      data.exp <= now
    )
      return null;
    return { id: data.id, login: data.login };
  } catch {
    return null;
  }
}

/** @param {AuthRequest} req */
export function parseCookies(req) {
  /** @type {Record<string, string>} */
  const cookies = {};
  const header = req.headers.cookie;
  for (const part of String(
    Array.isArray(header) ? header.join(";") : (header ?? ""),
  ).split(";")) {
    const index = part.indexOf("=");
    if (index < 1) continue;
    const name = part.slice(0, index).trim();
    try {
      cookies[name] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      // Ignore cookies we did not write.
    }
  }
  return cookies;
}

/**
 * The signed-in GitHub user, whether or not they are on the allowlist.
 * @param {AuthRequest} req
 */
export function sessionUser(req) {
  if (!githubConfigured()) return null;
  return readSession(parseCookies(req)[cookieNames().session]);
}

/**
 * True when the request carries a session for an allowed GitHub account.
 * The allowlist is checked on every request so removing an id revokes access.
 * @param {AuthRequest} req
 */
export function signedInAndAllowed(req) {
  const user = sessionUser(req);
  return Boolean(user && isAllowed(user.id));
}

/**
 * @param {string} name
 * @param {string} value
 * @param {number} maxAge seconds; 0 clears the cookie
 */
function cookie(name, value, maxAge) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    ...(secure() ? ["Secure"] : []),
  ].join("; ");
}

/** @param {GitHubUser} user */
export function sessionCookie(user) {
  return cookie(
    cookieNames().session,
    createSession(user),
    sessionDays * 86_400,
  );
}

export function clearSessionCookie() {
  return cookie(cookieNames().session, "", 0);
}

/** @param {string} state */
export function stateCookie(state) {
  return cookie(cookieNames().state, state, stateMinutes * 60);
}

export function clearStateCookie() {
  return cookie(cookieNames().state, "", 0);
}

/** @param {AuthRequest} req */
export function savedState(req) {
  return parseCookies(req)[cookieNames().state] ?? "";
}

export function newState() {
  return randomBytes(24).toString("base64url");
}

/** @param {AuthRequest} req */
export function callbackUrl(req) {
  const host = String(req.headers.host ?? "");
  return `${secure() ? "https" : "http"}://${host}/api/auth/callback`;
}

/** @param {AuthRequest} req @param {string} state */
export function authorizeUrl(req, state) {
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", String(process.env.GITHUB_CLIENT_ID));
  url.searchParams.set("redirect_uri", callbackUrl(req));
  url.searchParams.set("state", state);
  url.searchParams.set("allow_signup", "false");
  return url.toString();
}

/**
 * Exchange the OAuth code for the GitHub user, then revoke the token.
 * @param {AuthRequest} req
 * @param {string} code
 * @returns {Promise<GitHubUser>}
 */
export async function exchangeCode(req, code) {
  const clientId = String(process.env.GITHUB_CLIENT_ID);
  const clientSecret = String(process.env.GITHUB_CLIENT_SECRET);
  const tokenResponse = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUrl(req),
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );
  const token = /** @type {{ access_token?: unknown }} */ (
    await tokenResponse.json().catch(() => ({}))
  ).access_token;
  if (!tokenResponse.ok || typeof token !== "string" || !token)
    throw new Error("GitHub did not accept the sign-in.");
  try {
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "Orbit",
      },
      signal: AbortSignal.timeout(10_000),
    });
    const user = /** @type {{ id?: unknown, login?: unknown }} */ (
      await userResponse.json().catch(() => ({}))
    );
    if (
      !userResponse.ok ||
      typeof user.id !== "number" ||
      typeof user.login !== "string"
    )
      throw new Error("Could not read your GitHub account.");
    return { id: user.id, login: user.login };
  } finally {
    // Orbit only needs to know who signed in, so drop GitHub's token.
    await fetch(`https://api.github.com/applications/${clientId}/token`, {
      method: "DELETE",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "User-Agent": "Orbit",
      },
      body: JSON.stringify({ access_token: token }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => {});
  }
}

/**
 * @param {import("./http").ApiResponse} res
 * @param {string} location
 */
export function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.end();
}

/**
 * Same-origin check for state-changing requests. Cookie auth makes this the
 * guard against other sites acting with the visitor's session.
 * @param {AuthRequest} req
 */
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(String(origin)).host === req.headers.host;
  } catch {
    return false;
  }
}

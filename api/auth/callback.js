// @ts-check
import {
  clearStateCookie,
  equal,
  exchangeCode,
  githubConfigured,
  isAllowed,
  redirect,
  savedState,
  sessionCookie,
} from "../../server/auth.js";

/**
 * Finish GitHub sign-in. Only allowlisted accounts get a session.
 * @param {import("../../server/http").ApiRequest} req
 * @param {import("../../server/http").ApiResponse} res
 */
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET")
    return res.status(405).json({ error: "Use GET to finish signing in." });
  /** @param {string} outcome @param {string[]} [cookies] */
  const done = (outcome, cookies = []) => {
    res.setHeader("Set-Cookie", [clearStateCookie(), ...cookies]);
    return redirect(res, `/?auth=${outcome}#settings/model`);
  };
  if (!githubConfigured()) return done("unavailable");
  const params = new URL(req.url ?? "/", "http://orbit").searchParams;
  const code = params.get("code") ?? "";
  const state = params.get("state") ?? "";
  const expected = savedState(req);
  if (!code || !state || !expected || !equal(state, expected))
    return done("failed");
  try {
    const user = await exchangeCode(req, code);
    if (!isAllowed(user.id)) return done("denied");
    return done("signed-in", [sessionCookie(user)]);
  } catch {
    return done("failed");
  }
}

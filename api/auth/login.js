// @ts-check
import {
  authorizeUrl,
  githubConfigured,
  newState,
  redirect,
  stateCookie,
} from "../../server/auth.js";

/**
 * Start GitHub sign-in.
 * @param {import("../../server/http").ApiRequest} req
 * @param {import("../../server/http").ApiResponse} res
 */
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET")
    return res.status(405).json({ error: "Use GET to sign in." });
  if (!githubConfigured())
    return redirect(res, "/?auth=unavailable#settings/model");
  const state = newState();
  res.setHeader("Set-Cookie", stateCookie(state));
  return redirect(res, authorizeUrl(req, state));
}

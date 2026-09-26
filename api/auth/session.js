// @ts-check
import {
  clearSessionCookie,
  githubConfigured,
  isAllowed,
  sameOrigin,
  sessionUser,
} from "../../server/auth.js";

/**
 * GET reports whether GitHub sign-in is available and who is signed in.
 * DELETE signs out.
 * @param {import("../../server/http").ApiRequest} req
 * @param {import("../../server/http").ApiResponse} res
 */
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "DELETE") {
    if (!sameOrigin(req))
      return res
        .status(403)
        .json({ error: "This request must come from your Orbit workspace." });
    res.setHeader("Set-Cookie", clearSessionCookie());
    return res.status(200).json({ configured: githubConfigured(), user: null });
  }
  if (req.method !== "GET")
    return res.status(405).json({ error: "Use GET or DELETE." });
  const user = sessionUser(req);
  return res.status(200).json({
    configured: githubConfigured(),
    user: user && isAllowed(user.id) ? user : null,
  });
}

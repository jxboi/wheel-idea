// @ts-check
import {
  deviceCookieHeader,
  equal,
  issueDevice,
  readDeviceCookie,
  verifyDevice,
} from "../server/device.js";

/**
 * GET reports whether this device is remembered, POST remembers it after
 * checking the workspace password, DELETE forgets it.
 * @param {import("../server/http").ApiRequest} req
 * @param {import("../server/http").ApiResponse} res
 */
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host)
        return res
          .status(403)
          .json({ error: "This request must come from your Orbit workspace." });
    } catch {
      return res.status(403).json({ error: "Invalid origin." });
    }
  }
  const expected = process.env.ORBIT_ACCESS_TOKEN ?? "";
  if (req.method === "GET")
    return res.status(200).json({
      available: Boolean(expected),
      remembered: verifyDevice(readDeviceCookie(req.headers.cookie), expected),
    });
  if (req.method === "DELETE") {
    res.setHeader("Set-Cookie", deviceCookieHeader(""));
    return res.status(200).json({ remembered: false });
  }
  if (req.method !== "POST")
    return res.status(405).json({ error: "Unsupported method." });
  if (!expected)
    return res
      .status(400)
      .json({ error: "Set ORBIT_ACCESS_TOKEN on the server first." });
  const received = String(req.headers["x-workspace-token"] ?? "");
  if (!equal(received, expected))
    return res.status(401).json({ error: "Wrong workspace password." });
  res.setHeader("Set-Cookie", deviceCookieHeader(issueDevice(expected)));
  return res.status(200).json({ remembered: true });
}

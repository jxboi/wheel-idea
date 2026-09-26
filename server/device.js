// @ts-check
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * "Remember this device" for server-funded spins. After the workspace password
 * is verified once, the browser gets an HttpOnly cookie holding only an expiry
 * and an HMAC of it keyed by ORBIT_ACCESS_TOKEN. The password and provider key
 * are never stored, page scripts cannot read the cookie, and changing
 * ORBIT_ACCESS_TOKEN revokes every remembered device.
 */
export const deviceCookie = "orbit_device";
export const deviceDays = 30;

/**
 * @param {string} left
 * @param {string} right
 */
export function equal(left, right) {
  return (
    Buffer.byteLength(left) === Buffer.byteLength(right) &&
    timingSafeEqual(Buffer.from(left), Buffer.from(right))
  );
}

/**
 * @param {string} secret
 * @param {string} expires
 */
function sign(secret, expires) {
  return createHmac("sha256", secret)
    .update(`orbit-device:${expires}`)
    .digest("base64url");
}

/** @param {string} secret */
export function issueDevice(secret, now = Date.now()) {
  const expires = String(now + deviceDays * 86_400_000);
  return `${expires}.${sign(secret, expires)}`;
}

/**
 * @param {string} value
 * @param {string} secret
 */
export function verifyDevice(value, secret, now = Date.now()) {
  if (!secret) return false;
  const [expires, signature = ""] = value.split(".");
  if (!/^\d{13}$/.test(expires ?? "") || Number(expires) <= now) return false;
  return equal(signature, sign(secret, expires));
}

/** @param {string | undefined} header */
export function readDeviceCookie(header) {
  for (const part of (header ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === deviceCookie) return rest.join("=");
  }
  return "";
}

/** @param {string} value Empty clears the cookie. */
export function deviceCookieHeader(value) {
  return [
    `${deviceCookie}=${value}`,
    "Path=/api",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${value ? deviceDays * 86_400 : 0}`,
    ...(process.env.VERCEL ? ["Secure"] : []),
  ].join("; ");
}

/**
 * True when the request carries the workspace password or a valid remembered
 * device cookie.
 * @param {import("node:http").IncomingHttpHeaders} headers
 */
export function workspaceUnlocked(headers) {
  const expected = process.env.ORBIT_ACCESS_TOKEN ?? "";
  if (!expected) return false;
  const received = String(headers["x-workspace-token"] ?? "");
  if (received && equal(received, expected)) return true;
  return verifyDevice(readDeviceCookie(headers.cookie), expected);
}

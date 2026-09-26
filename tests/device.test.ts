import { afterEach, describe, expect, it, vi } from "vitest";
import {
  issueDevice,
  readDeviceCookie,
  verifyDevice,
  deviceCookieHeader,
  workspaceUnlocked,
} from "../server/device.js";
import deviceHandler from "../api/device.js";
import generateHandler from "../api/generate.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function res() {
  return {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    on: vi.fn(),
    writableEnded: false,
  };
}

describe("remembered device grant", () => {
  it("verifies only an unexpired grant signed with the current password", () => {
    const now = Date.now();
    const grant = issueDevice("secret", now);
    expect(verifyDevice(grant, "secret", now)).toBe(true);
    expect(verifyDevice(grant, "rotated", now)).toBe(false);
    expect(verifyDevice(grant, "secret", now + 31 * 86_400_000)).toBe(false);
    expect(verifyDevice(grant, "", now)).toBe(false);
    const [expires] = grant.split(".");
    expect(verifyDevice(`${Number(expires) + 1}.x`, "secret", now)).toBe(false);
    expect(verifyDevice("garbage", "secret", now)).toBe(false);
  });
  it("never puts the password in the cookie", () => {
    const header = deviceCookieHeader(issueDevice("hunter2-password"));
    expect(header).not.toContain("hunter2");
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Strict");
    expect(deviceCookieHeader("")).toContain("Max-Age=0");
  });
  it("reads the cookie among others", () => {
    expect(readDeviceCookie("a=1; orbit_device=abc.def; b=2")).toBe("abc.def");
    expect(readDeviceCookie(undefined)).toBe("");
  });
  it("unlocks with the password header or a valid cookie", () => {
    vi.stubEnv("ORBIT_ACCESS_TOKEN", "secret");
    expect(workspaceUnlocked({ "x-workspace-token": "secret" })).toBe(true);
    expect(workspaceUnlocked({ "x-workspace-token": "nope" })).toBe(false);
    expect(
      workspaceUnlocked({ cookie: `orbit_device=${issueDevice("secret")}` }),
    ).toBe(true);
    vi.stubEnv("ORBIT_ACCESS_TOKEN", "");
    expect(
      workspaceUnlocked({ cookie: `orbit_device=${issueDevice("")}` }),
    ).toBe(false);
  });
});

describe("/api/device", () => {
  it("rejects a wrong password without setting a cookie", async () => {
    vi.stubEnv("ORBIT_ACCESS_TOKEN", "secret");
    const r = res();
    await deviceHandler(
      { method: "POST", headers: { "x-workspace-token": "nope" } } as never,
      r as never,
    );
    expect(r.status).toHaveBeenCalledWith(401);
    expect(r.setHeader).not.toHaveBeenCalledWith(
      "Set-Cookie",
      expect.anything(),
    );
  });
  it("remembers, reports, and forgets a device", async () => {
    vi.stubEnv("ORBIT_ACCESS_TOKEN", "secret");
    const post = res();
    await deviceHandler(
      { method: "POST", headers: { "x-workspace-token": "secret" } } as never,
      post as never,
    );
    expect(post.status).toHaveBeenCalledWith(200);
    const cookie = post.setHeader.mock.calls
      .find(([name]) => name === "Set-Cookie")?.[1]
      .split(";")[0];
    const get = res();
    await deviceHandler(
      { method: "GET", headers: { cookie } } as never,
      get as never,
    );
    expect(get.json).toHaveBeenCalledWith({
      available: true,
      remembered: true,
    });
    const del = res();
    await deviceHandler(
      { method: "DELETE", headers: {} } as never,
      del as never,
    );
    expect(del.setHeader).toHaveBeenCalledWith(
      "Set-Cookie",
      expect.stringContaining("Max-Age=0"),
    );
  });
  it("rejects cross-origin requests", async () => {
    const r = res();
    await deviceHandler(
      {
        method: "POST",
        headers: { origin: "https://other.site", host: "localhost" },
      } as never,
      r as never,
    );
    expect(r.status).toHaveBeenCalledWith(403);
  });
  it("lets a remembered device use the server key on Vercel", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("ORBIT_ACCESS_TOKEN", "secret");
    vi.stubEnv("OPENROUTER_API_KEY", "server-key");
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline fixture"));
    vi.stubGlobal("fetch", fetchMock);
    const body = {
      category: "Games",
      duration: "A few hours",
      mood: "",
      settings: {
        provider: "openrouter",
        model: "test",
        effort: "default",
        useMemory: false,
      },
      context: "",
      images: [],
    };
    const locked = res();
    await generateHandler(
      { method: "POST", headers: {}, body } as never,
      locked as never,
    );
    expect(locked.status).toHaveBeenCalledWith(401);
    const unlocked = res();
    await generateHandler(
      {
        method: "POST",
        headers: { cookie: `orbit_device=${issueDevice("secret")}` },
        body,
      } as never,
      unlocked as never,
    );
    // Past the password check: the (fixture) provider call was attempted.
    expect(fetchMock).toHaveBeenCalled();
    expect(unlocked.status).not.toHaveBeenCalledWith(401);
  });
});

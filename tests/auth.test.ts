import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  createSession,
  readSession,
  signedInAndAllowed,
} from "../server/auth.js";
import login from "../api/auth/login.js";
import callback from "../api/auth/callback.js";
import session from "../api/auth/session.js";
import generate from "../api/generate.js";

beforeEach(() => {
  vi.stubEnv("GITHUB_CLIENT_ID", "client-id");
  vi.stubEnv("GITHUB_CLIENT_SECRET", "client-secret");
  vi.stubEnv("ORBIT_SESSION_SECRET", "");
  vi.stubEnv("ORBIT_ALLOWED_GITHUB_IDS", "42");
  vi.stubEnv("VERCEL", "1");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function res() {
  const headers: Record<string, unknown> = {};
  const r = {
    statusCode: 200,
    headers,
    setHeader: vi.fn((name: string, value: unknown) => {
      headers[name.toLowerCase()] = value;
    }),
    status: vi.fn((code: number) => {
      r.statusCode = code;
      return r;
    }),
    json: vi.fn(() => r),
    end: vi.fn(),
    on: vi.fn(),
    writableEnded: false,
  };
  return r;
}

function cookies(r: ReturnType<typeof res>) {
  const value = r.headers["set-cookie"];
  return (Array.isArray(value) ? value : [value]).map(String);
}

function withSession(id: number) {
  return `__Host-orbit_session=${createSession({ id, login: "someone" })}`;
}

describe("session cookie", () => {
  it("round-trips and rejects tampering and expiry", () => {
    const value = createSession({ id: 42, login: "me" }, 0);
    expect(readSession(value, 1)).toEqual({ id: 42, login: "me" });
    const [payload, signature] = value.split(".");
    const forged = Buffer.from(
      JSON.stringify({ id: 7, login: "x", exp: 9e15 }),
    ).toString("base64url");
    expect(readSession(`${forged}.${signature}`, 1)).toBeNull();
    expect(readSession(`${payload}.${signature}x`, 1)).toBeNull();
    expect(readSession(value, 31 * 86_400_000)).toBeNull();
  });

  it("stops working when the signing secret changes", () => {
    const value = createSession({ id: 42, login: "me" });
    vi.stubEnv("GITHUB_CLIENT_SECRET", "rotated");
    expect(readSession(value)).toBeNull();
  });

  it("re-checks the allowlist on every request", () => {
    const req = { headers: { cookie: withSession(42) } };
    expect(signedInAndAllowed(req)).toBe(true);
    vi.stubEnv("ORBIT_ALLOWED_GITHUB_IDS", "7");
    expect(signedInAndAllowed(req)).toBe(false);
  });
});

describe("sign-in endpoints", () => {
  it("redirects to GitHub with a state bound to a cookie", () => {
    const r = res();
    login(
      { method: "GET", headers: { host: "orbit.test" } } as never,
      r as never,
    );
    const location = new URL(String(r.headers.location));
    expect(location.origin).toBe("https://github.com");
    expect(location.searchParams.get("redirect_uri")).toBe(
      "https://orbit.test/api/auth/callback",
    );
    const state = location.searchParams.get("state");
    expect(state).toBeTruthy();
    expect(cookies(r)[0]).toContain(`__Host-orbit_oauth=${state}`);
    expect(cookies(r)[0]).toMatch(/HttpOnly.*SameSite=Lax.*Secure/);
  });

  it("refuses a callback whose state does not match", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const r = res();
    await callback(
      {
        method: "GET",
        url: "/api/auth/callback?code=c&state=attacker",
        headers: { host: "orbit.test", cookie: "__Host-orbit_oauth=mine" },
      } as never,
      r as never,
    );
    expect(fetch).not.toHaveBeenCalled();
    expect(r.headers.location).toBe("/?auth=failed#settings/model");
  });

  function github(id: number) {
    return vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.includes("access_token"))
        return Response.json({ access_token: "gho_token" });
      if (url.endsWith("/user")) return Response.json({ id, login: "me" });
      return new Response(null, { status: 204 });
    });
  }

  async function finish() {
    const r = res();
    await callback(
      {
        method: "GET",
        url: "/api/auth/callback?code=c&state=s",
        headers: { host: "orbit.test", cookie: "__Host-orbit_oauth=s" },
      } as never,
      r as never,
    );
    return r;
  }

  it("signs in an allowlisted account and revokes GitHub's token", async () => {
    const fetch = github(42);
    vi.stubGlobal("fetch", fetch);
    const r = await finish();
    expect(r.headers.location).toBe("/?auth=signed-in#settings/model");
    const session = cookies(r).find((c) =>
      c.startsWith("__Host-orbit_session="),
    );
    expect(session).toBeTruthy();
    expect(session).not.toContain("gho_token");
    const revoke = fetch.mock.calls.find(([url]) =>
      String(url).includes("/applications/client-id/token"),
    );
    expect(revoke?.[1]).toMatchObject({ method: "DELETE" });
  });

  it("gives no session to an account outside the allowlist", async () => {
    vi.stubGlobal("fetch", github(7));
    const r = await finish();
    expect(r.headers.location).toBe("/?auth=denied#settings/model");
    expect(cookies(r).some((c) => c.startsWith("__Host-orbit_session="))).toBe(
      false,
    );
  });

  it("reports the signed-in account and signs out", () => {
    const r = res();
    session(
      { method: "GET", headers: { cookie: withSession(42) } } as never,
      r as never,
    );
    expect(r.json).toHaveBeenCalledWith({
      configured: true,
      user: { id: 42, login: "someone" },
    });
    const out = res();
    session(
      {
        method: "DELETE",
        headers: { origin: "https://orbit.test", host: "orbit.test" },
      } as never,
      out as never,
    );
    expect(cookies(out)[0]).toContain("Max-Age=0");
    const cross = res();
    session(
      {
        method: "DELETE",
        headers: { origin: "https://evil.test", host: "orbit.test" },
      } as never,
      cross as never,
    );
    expect(cross.statusCode).toBe(403);
  });
});

describe("server key guard", () => {
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

  async function spin(headers: Record<string, string>) {
    vi.stubEnv("OPENROUTER_API_KEY", "server-key");
    const fetch = vi.fn().mockRejectedValue(new Error("provider reached"));
    vi.stubGlobal("fetch", fetch);
    const r = res();
    await generate({ method: "POST", headers, body } as never, r as never);
    return { r, reachedProvider: fetch.mock.calls.length > 0 };
  }

  it("asks for GitHub sign-in when it is set up", async () => {
    const { r, reachedProvider } = await spin({});
    expect(r.statusCode).toBe(401);
    expect(r.json).toHaveBeenCalledWith({
      error: "Sign in with GitHub in Settings to use the server’s API key.",
    });
    expect(reachedProvider).toBe(false);
  });

  it("uses the server key for an allowlisted session", async () => {
    const { reachedProvider } = await spin({ cookie: withSession(42) });
    expect(reachedProvider).toBe(true);
  });

  it("refuses a signed-in account that is no longer allowed", async () => {
    const { r, reachedProvider } = await spin({ cookie: withSession(7) });
    expect(r.statusCode).toBe(401);
    expect(reachedProvider).toBe(false);
  });

  it("still accepts the workspace password while it is configured", async () => {
    vi.stubEnv("ORBIT_ACCESS_TOKEN", "something-special");
    const { reachedProvider } = await spin({
      "x-workspace-token": "something-special",
    });
    expect(reachedProvider).toBe(true);
  });
});

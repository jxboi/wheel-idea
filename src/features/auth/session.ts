import { useCallback, useEffect, useState } from "react";

export type GitHubUser = { id: number; login: string };
export type AuthState = {
  /** False until the server says whether GitHub sign-in is set up. */
  loaded: boolean;
  configured: boolean;
  user: GitHubUser | null;
};

const outcomes: Record<string, string> = {
  "signed-in": "Signed in with GitHub.",
  denied: "That GitHub account isn’t allowed to use this workspace.",
  failed: "GitHub sign-in didn’t finish. Try again.",
  unavailable: "GitHub sign-in isn’t set up on this server.",
};

/** Read and remove the `?auth=` result the sign-in redirect leaves behind. */
export function takeAuthOutcome(): string | null {
  const url = new URL(location.href);
  const outcome = url.searchParams.get("auth");
  if (!outcome) return null;
  url.searchParams.delete("auth");
  history.replaceState(history.state, "", url);
  return outcomes[outcome] ?? null;
}

async function readSession(init?: RequestInit): Promise<AuthState> {
  const response = await fetch("/api/auth/session", {
    cache: "no-store",
    ...init,
  });
  if (!response.ok) throw new Error("Could not reach the sign-in service.");
  const data = (await response.json()) as Partial<AuthState>;
  const user = data.user;
  return {
    loaded: true,
    configured: data.configured === true,
    user:
      user && typeof user.id === "number" && typeof user.login === "string"
        ? { id: user.id, login: user.login }
        : null,
  };
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>({
    loaded: false,
    configured: false,
    user: null,
  });
  useEffect(() => {
    // Without the API (e.g. `vite preview`) sign-in simply stays hidden.
    readSession()
      .then(setAuth)
      .catch(() => setAuth((a) => ({ ...a, loaded: true })));
  }, []);
  const signOut = useCallback(async () => {
    setAuth(await readSession({ method: "DELETE" }));
  }, []);
  return { auth, signOut };
}

/**
 * Client for /api/device. The server keeps the remembered-device grant in an
 * HttpOnly cookie, so nothing here stores or reads a credential.
 */
export type DeviceState = { available: boolean; remembered: boolean };

async function call(init: RequestInit) {
  const response = await fetch("/api/device", {
    credentials: "same-origin",
    ...init,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(result.error || "Couldn’t reach the server.");
  return result;
}

export async function deviceState(): Promise<DeviceState> {
  const result = await call({ method: "GET" });
  return {
    available: Boolean(result.available),
    remembered: Boolean(result.remembered),
  };
}

export async function rememberDevice(token: string) {
  await call({ method: "POST", headers: { "X-Workspace-Token": token } });
}

export async function forgetDevice() {
  await call({ method: "DELETE" });
}

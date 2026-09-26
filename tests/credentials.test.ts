import { describe, expect, it } from "vitest";
import {
  loadCredentials,
  storeCredentials,
} from "../src/features/generation/credentials";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
}

describe("session credentials", () => {
  it("survives a reload within the same tab", () => {
    const storage = memoryStorage();
    storeCredentials({ key: "", token: "something-special" }, storage);
    expect(loadCredentials(storage)).toEqual({
      key: "",
      token: "something-special",
    });
  });

  it("removes the entry when credentials are cleared", () => {
    const storage = memoryStorage();
    storeCredentials({ key: "k", token: "t" }, storage);
    storeCredentials({ key: "", token: "" }, storage);
    expect(storage.length).toBe(0);
    expect(loadCredentials(storage)).toEqual({ key: "", token: "" });
  });

  it("ignores corrupt or missing storage", () => {
    const storage = memoryStorage();
    storage.setItem("orbit.credentials", "{not json");
    expect(loadCredentials(storage)).toEqual({ key: "", token: "" });
    expect(loadCredentials(undefined)).toEqual({ key: "", token: "" });
  });
});

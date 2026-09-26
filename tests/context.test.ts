import { describe, it, expect } from "vitest";
import { buildContext, contextBudgets } from "../src/lib/context";
import { emptyWorkspace, type Entry, type Workspace } from "../src/lib/schema";
import { contextLimit } from "../shared/contract.js";

const entry = (id: string, body: string, shareWithAI = true): Entry => ({
  id,
  title: `Entry ${id}`,
  body,
  createdAt: "",
  updatedAt: "",
  images: [
    { id: `img-${id}`, dataUrl: `data:image/jpeg;base64,${id}`, name: id },
  ],
  shareWithAI,
});

function fullWorkspace(): Workspace {
  const w = structuredClone(emptyWorkspace);
  w.memories = Array.from({ length: 40 }, (_, i) => ({
    id: `m${i}`,
    text: `memory ${i} `.padEnd(1500, "x"),
    source: "you" as const,
    createdAt: "",
  }));
  w.entries = Array.from({ length: 8 }, (_, i) =>
    entry(String(i), "y".repeat(5000)),
  );
  return w;
}

describe("context budgets", () => {
  it("always produces complete JSON within the request limit", () => {
    const { context } = buildContext(fullWorkspace());
    expect(context.length).toBeLessThanOrEqual(contextLimit);
    expect(() => JSON.parse(context)).not.toThrow();
  });
  it("keeps journal entries even when memories are long", () => {
    const parsed = JSON.parse(buildContext(fullWorkspace()).context);
    expect(parsed.journal.length).toBeGreaterThan(0);
    expect(parsed.preferences.length).toBeGreaterThan(0);
    expect(JSON.stringify(parsed.preferences).length).toBeLessThanOrEqual(
      contextBudgets.preferences,
    );
    // Newest first.
    expect(parsed.preferences[0]).toMatch(/^memory 0 /);
  });
  it("only sends photos from entries that made it into the context", () => {
    const w = fullWorkspace();
    const parsed = JSON.parse(buildContext(w).context);
    const included = new Set(
      parsed.journal.map((j: { title: string }) => j.title),
    );
    for (const url of buildContext(w).images) {
      const id = url.split(",")[1];
      expect(included.has(`Entry ${id}`)).toBe(true);
    }
  });
  it("skips private entries before choosing which to include", () => {
    const w = structuredClone(emptyWorkspace);
    w.entries = [entry("a", "private", false), entry("b", "shared")];
    const result = buildContext(w);
    expect(result.context).not.toContain("private");
    expect(result.images).toEqual(["data:image/jpeg;base64,b"]);
  });
});

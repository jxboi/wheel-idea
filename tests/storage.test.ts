import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { openDB } from "idb";
import { planWrites } from "../src/lib/writePlan";
import * as actions from "../src/lib/actions";
import { previewBrief } from "../src/lib/preview";
import { emptyWorkspace, type Idea, type Workspace } from "../src/lib/schema";

// A 1×1 JPEG-sized payload is enough; the bytes only need to round-trip.
const photo = `data:image/jpeg;base64,${btoa("orbit-photo-bytes")}`;

function idea(id: string): Idea {
  return {
    ...previewBrief("Games", "A weekend", ""),
    id,
    category: "Games",
    createdAt: "",
    provider: "preview",
    model: "",
    effort: "default",
    duration: "A weekend",
    saved: false,
    feedback: [],
    rating: null,
    researchStatus: "preview",
  };
}

function sample(): Workspace {
  let w: Workspace = structuredClone(emptyWorkspace);
  w = actions.addIdea(actions.addIdea(w, idea("old")), idea("new"));
  w = actions.saveEntry(w, {
    id: "e1",
    title: "Sketch",
    body: "Notes",
    createdAt: "",
    updatedAt: "",
    images: [{ id: "p1", dataUrl: photo, name: "sketch.jpg" }],
    shareWithAI: true,
  });
  return actions.addMemory(w, "Likes co-op games", {
    now: () => "",
    id: () => "m1",
  });
}

let storage: typeof import("../src/lib/storage");
beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory();
  // storage.ts caches its connection at module level.
  vi.resetModules();
  storage = await import("../src/lib/storage");
});

async function seedV1(value: unknown) {
  const db = await openDB("orbit-studio", 1, {
    upgrade(db) {
      db.createObjectStore("workspace");
    },
  });
  await db.put("workspace", value, "main");
  db.close();
}

describe("workspace storage", () => {
  it("migrates a database-v1 workspace into per-record stores", async () => {
    const { version: _version, preferences: _p, ...rest } = sample();
    await seedV1({ ...rest, version: 1 });
    const loaded = await storage.loadWorkspace();
    expect(loaded.version).toBe(2);
    expect(loaded.ideas.map((i) => i.id)).toEqual(["new", "old"]);
    expect(loaded.entries[0].images[0].dataUrl).toBe(photo);
    const db = await openDB("orbit-studio");
    expect(await db.get("workspace", "main")).toBeUndefined();
    expect(await db.count("ideas")).toBe(2);
    const image = await db.get("images", "p1");
    expect(image.blob.type).toBe("image/jpeg");
    const entry = await db.get("entries", "e1");
    expect(entry.images).toEqual([{ id: "p1", name: "sketch.jpg" }]);
    db.close();
  });
  it("leaves invalid v1 data untouched instead of clearing it", async () => {
    await seedV1({ version: 1, settings: { provider: "nope" } });
    await expect(storage.loadWorkspace()).rejects.toThrow();
    const db = await openDB("orbit-studio");
    expect(await db.get("workspace", "main")).toEqual({
      version: 1,
      settings: { provider: "nope" },
    });
    db.close();
  });
  it("indexes a fresh database so record-only edits survive reload", async () => {
    const fresh = await storage.loadWorkspace();
    const w = actions.addMemory(fresh, "Hi", { now: () => "", id: () => "m" });
    await storage.persistWorkspace(fresh, w);
    const edited = actions.editMemory(w, { ...w.memories[0], text: "Hello" });
    await storage.persistWorkspace(w, edited);
    expect((await storage.loadWorkspace()).memories[0].text).toBe("Hello");
  });
  it("round-trips a workspace, keeping order and photos", async () => {
    const w = sample();
    await storage.loadWorkspace();
    await storage.persistWorkspace(null, w);
    const loaded = await storage.loadWorkspace();
    expect(loaded).toEqual(w);
  });
  it("applies incremental changes and removes deleted photos", async () => {
    const w = sample();
    await storage.loadWorkspace();
    await storage.persistWorkspace(null, w);
    const next = actions.deleteEntry(
      actions.updateIdea(w, { ...w.ideas[1], saved: true }),
      "e1",
    );
    await storage.persistWorkspace(w, next);
    expect(await storage.loadWorkspace()).toEqual(next);
    const db = await openDB("orbit-studio");
    expect(await db.count("images")).toBe(0);
    db.close();
  });
});

describe("write planning", () => {
  it("writes only the record that changed", () => {
    const w = sample();
    const next = actions.updateIdea(w, { ...w.ideas[0], rating: "love" });
    const plan = planWrites(w, next);
    expect(plan.meta).toBeNull();
    expect(plan.ideas.put.map((i) => i.id)).toEqual(["new"]);
    expect(plan.entries.put).toEqual([]);
    expect(plan.images.put).toEqual([]);
  });
  it("rewrites a photo only when the entry's photo changed", () => {
    const w = sample();
    const retitled = actions.saveEntry(w, { ...w.entries[0], title: "New" });
    expect(planWrites(w, retitled).images.put).toEqual([]);
    expect(planWrites(w, retitled).entries.put).toHaveLength(1);
    const withPhoto = actions.saveEntry(w, {
      ...w.entries[0],
      images: [...w.entries[0].images, { id: "p2", dataUrl: photo, name: "b" }],
    });
    expect(planWrites(w, withPhoto).images.put.map((i) => i.id)).toEqual([
      "p2",
    ]);
  });
  it("records order changes in the meta record", () => {
    const w = sample();
    const next = { ...w, ideas: [...w.ideas].reverse() };
    expect(planWrites(w, next).meta?.ideaOrder).toEqual(["old", "new"]);
  });
});

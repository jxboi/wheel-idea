import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { parseWorkspace } from "./migrations";
import {
  emptyWorkspace,
  type Idea,
  type Memory,
  type Workspace,
} from "./schema";
import {
  isEmptyPlan,
  planWrites,
  type StoredEntry,
  type WorkspaceMeta,
} from "./writePlan";

interface StoredImage {
  id: string;
  entryId: string;
  blob: Blob;
}
interface OrbitDB extends DBSchema {
  /** Database v1: the whole workspace in one record. Read once to migrate. */
  workspace: { key: string; value: unknown };
  meta: { key: string; value: WorkspaceMeta };
  ideas: { key: string; value: Idea };
  entries: { key: string; value: StoredEntry };
  memories: { key: string; value: Memory };
  images: { key: string; value: StoredImage };
}
const stores = ["meta", "ideas", "entries", "memories", "images"] as const;

let blockedListener: (() => void) | undefined;
/** Called when another open tab prevents the database upgrade from starting. */
export function onUpgradeBlocked(listener: () => void) {
  blockedListener = listener;
}
let connection: Promise<IDBPDatabase<OrbitDB>> | undefined;
const db = () =>
  (connection ??= openDB<OrbitDB>("orbit-studio", 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) db.createObjectStore("workspace");
      if (oldVersion < 2) {
        db.createObjectStore("meta");
        db.createObjectStore("ideas", { keyPath: "id" });
        db.createObjectStore("entries", { keyPath: "id" });
        db.createObjectStore("memories", { keyPath: "id" });
        db.createObjectStore("images", { keyPath: "id" });
      }
    },
    blocked() {
      // An older Orbit tab still has the previous database version open.
      blockedListener?.();
    },
    blocking(_current, _next, event) {
      // A newer Orbit tab needs to upgrade; step aside instead of blocking it.
      (event.target as IDBDatabase).close();
      connection = undefined;
    },
  }));

export function dataUrlToBlob(dataUrl: string): Blob {
  const [prefix, data] = dataUrl.split(",");
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: prefix.slice(5, -7) });
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type};base64,${btoa(binary)}`;
}

function byOrder<T extends { id: string }>(items: T[], order: string[]) {
  const map = new Map(items.map((item) => [item.id, item]));
  return order.flatMap((id) => map.get(id) ?? []);
}

async function readV2(
  database: IDBPDatabase<OrbitDB>,
  meta: WorkspaceMeta,
): Promise<Workspace> {
  const tx = database.transaction(
    ["ideas", "entries", "memories", "images"],
    "readonly",
  );
  const [ideas, entries, memories, images] = await Promise.all([
    tx.objectStore("ideas").getAll(),
    tx.objectStore("entries").getAll(),
    tx.objectStore("memories").getAll(),
    tx.objectStore("images").getAll(),
  ]);
  const photos = new Map(
    await Promise.all(
      images.map(async (i) => [i.id, await blobToDataUrl(i.blob)] as const),
    ),
  );
  return parseWorkspace({
    version: meta.version,
    settings: meta.settings,
    preferences: meta.preferences,
    ideas: byOrder(ideas, meta.ideaOrder),
    entries: byOrder(entries, meta.entryOrder).map((entry) => ({
      ...entry,
      images: entry.images.map((image) => ({
        ...image,
        dataUrl: photos.get(image.id),
      })),
    })),
    memories: byOrder(memories, meta.memoryOrder),
  });
}

/**
 * Load the workspace. A database-v1 workspace is validated, migrated, and moved
 * into per-record stores in one transaction; on any failure nothing is changed.
 */
export async function loadWorkspace(): Promise<Workspace> {
  const database = await db();
  const meta = await database.get("meta", "main");
  if (meta) return readV2(database, meta);
  const legacy = await database.get("workspace", "main");
  const workspace = legacy
    ? parseWorkspace(legacy)
    : structuredClone(emptyWorkspace);
  // Write the meta record now so later incremental writes always have an index.
  await applyWrites(null, workspace, Boolean(legacy));
  return workspace;
}

async function applyWrites(
  prev: Workspace | null,
  next: Workspace,
  clearLegacy = false,
) {
  const plan = planWrites(prev, next);
  if (isEmptyPlan(plan) && !clearLegacy) return;
  const database = await db();
  const tx = database.transaction(
    clearLegacy ? [...stores, "workspace"] : [...stores],
    "readwrite",
  );
  const pending: Promise<unknown>[] = [];
  if (plan.meta) pending.push(tx.objectStore("meta").put(plan.meta, "main"));
  for (const idea of plan.ideas.put)
    pending.push(tx.objectStore("ideas").put(idea));
  for (const id of plan.ideas.remove)
    pending.push(tx.objectStore("ideas").delete(id));
  for (const entry of plan.entries.put)
    pending.push(tx.objectStore("entries").put(entry));
  for (const id of plan.entries.remove)
    pending.push(tx.objectStore("entries").delete(id));
  for (const memory of plan.memories.put)
    pending.push(tx.objectStore("memories").put(memory));
  for (const id of plan.memories.remove)
    pending.push(tx.objectStore("memories").delete(id));
  for (const image of plan.images.put)
    pending.push(
      tx.objectStore("images").put({
        id: image.id,
        entryId: image.entryId,
        blob: dataUrlToBlob(image.dataUrl),
      }),
    );
  for (const id of plan.images.remove)
    pending.push(tx.objectStore("images").delete(id));
  if (clearLegacy) pending.push(tx.objectStore("workspace").delete("main"));
  await Promise.all([...pending, tx.done]);
}

/**
 * Persist only the records that differ from the last stored snapshot, in a
 * single transaction. Pass `null` as `prev` to write everything.
 */
export function persistWorkspace(prev: Workspace | null, next: Workspace) {
  return applyWrites(prev, next);
}

/**
 * Warn when another tab holds this workspace. Orbit has no cross-tab merge, so
 * two open tabs can overwrite each other's changes. Calls back with `true` while
 * another tab is open and `false` once this tab owns the workspace.
 */
export function watchOtherTabs(onChange: (contended: boolean) => void) {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) return;
  const hold = () => new Promise<void>(() => {});
  locks
    .request("orbit-workspace", { ifAvailable: true }, (lock) => {
      if (lock) return hold();
      onChange(true);
      return locks.request("orbit-workspace", () => {
        onChange(false);
        return hold();
      });
    })
    .catch(() => {});
}

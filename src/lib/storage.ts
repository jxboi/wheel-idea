import { openDB } from "idb";
import { emptyWorkspace, workspaceSchema, type Workspace } from "./schema";
let connection: ReturnType<typeof openDB> | undefined;
const db = () =>
  (connection ??= openDB("orbit-studio", 1, {
    upgrade(db) {
      db.createObjectStore("workspace");
    },
  }));
export async function loadWorkspace(): Promise<Workspace> {
  const value = await (await db()).get("workspace", "main");
  return value ? workspaceSchema.parse(value) : structuredClone(emptyWorkspace);
}
export async function persistWorkspace(workspace: Workspace) {
  await (await db()).put("workspace", workspace, "main");
}
export function download(
  name: string,
  content: string,
  type = "text/markdown",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function imageFromFile(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPG, PNG, or WebP image.");
  if (file.size > 10 * 1024 * 1024)
    throw new Error("Please choose an image under 10 MB.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const result = canvas.toDataURL("image/jpeg", 0.78);
  if (result.length > 1500000)
    throw new Error("This photo is too detailed. Try a smaller image.");
  return result;
}

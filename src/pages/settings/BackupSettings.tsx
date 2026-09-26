import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import type { Workspace } from "../../lib/schema";
import { safeParseWorkspace } from "../../lib/migrations";
import { download } from "../../lib/files";
export function BackupSettings({
  workspace,
  onImport,
  toast,
}: {
  workspace: Workspace;
  onImport: (w: Workspace) => void;
  toast: (text: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Workspace | null>(null);
  return (
    <div className="settings-panel backup-panel">
      <p className="muted">
        A backup holds your ideas, journal, photos, and memory. Keys are never
        included.
      </p>
      <button
        className="button secondary full-width"
        onClick={() =>
          download(
            `orbit-backup-${new Date().toISOString().slice(0, 10)}.json`,
            JSON.stringify(workspace, null, 2),
            "application/json",
          )
        }
      >
        <Download size={17} />
        Export
      </button>
      <input
        type="file"
        ref={input}
        hidden
        accept="application/json,.json"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            if (file.size > 30 * 1024 * 1024)
              throw new Error("Choose a backup smaller than 30 MB.");
            const parsed = safeParseWorkspace(JSON.parse(await file.text()));
            if (!parsed.success)
              throw new Error("This file is not a valid Orbit backup.");
            setPending(parsed.data);
          } catch (error) {
            toast(
              error instanceof SyntaxError
                ? "This file is not valid JSON."
                : (error as Error).message,
            );
          } finally {
            e.target.value = "";
          }
        }}
      />
      <button
        className="button secondary full-width"
        onClick={() => input.current?.click()}
      >
        <Upload size={17} />
        Import
      </button>
      {pending && (
        <div className="import-confirm" role="alert">
          <p>
            Replace everything with {pending.ideas.length} ideas,{" "}
            {pending.entries.length} entries, and {pending.memories.length}{" "}
            memories?
          </p>
          <div className="button-row">
            <button className="text-button" onClick={() => setPending(null)}>
              Cancel
            </button>
            <button
              className="button primary small-button"
              onClick={() => {
                onImport(pending);
                setPending(null);
              }}
            >
              Replace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

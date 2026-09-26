import { useRef, useState } from "react";
import {
  Plus,
  ImagePlus,
  ArrowUpRight,
  Trash2,
  NotebookPen,
  X,
  Check,
  LoaderCircle,
} from "lucide-react";
import { Modal } from "../components/Modal";
import { imageFromFile } from "../lib/storage";
import type { Entry } from "../lib/schema";
export function JournalPage({
  entries,
  onEdit,
  onNew,
  onDelete,
}: {
  entries: Entry[];
  onEdit: (entry: Entry) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <>
      <div className="page-intro page-heading-row">
        <div>
          <h1>Follow the little sparks.</h1>
          <p>
            Half-formed thoughts, everyday discoveries, and things worth
            keeping.
          </p>
        </div>
        <button className="button primary" onClick={onNew}>
          <Plus size={17} />
          New entry
        </button>
      </div>
      <div className="journal-topline">
        <span>
          {entries.length
            ? `${entries.length} ${entries.length === 1 ? "entry" : "entries"}, and room for more.`
            : "A notebook with no rules."}
        </span>
        <span>Saved on this device</span>
      </div>
      {entries.length ? (
        <div className="journal-grid">
          {entries.map((entry, i) => (
            <article key={entry.id} className={`journal-card paper-${i % 3}`}>
              {entry.images[0] && (
                <button className="journal-cover" onClick={() => onEdit(entry)}>
                  <img
                    src={entry.images[0].dataUrl}
                    alt={entry.images[0].name}
                  />
                  {entry.images.length > 1 && (
                    <span>+{entry.images.length - 1}</span>
                  )}
                </button>
              )}
              <button
                className="journal-card-body"
                onClick={() => onEdit(entry)}
              >
                <time>
                  {new Date(entry.createdAt).toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </time>
                <h2>{entry.title || "An untitled spark"}</h2>
                <p>{entry.body || "A little visual inspiration."}</p>
                <span className="text-button">
                  Keep the thought going <ArrowUpRight size={15} />
                </span>
              </button>
              <div className="journal-card-footer">
                <span>
                  {entry.shareWithAI
                    ? "Shared with your copilot"
                    : "Just for you"}
                </span>
                <button
                  className="icon-button"
                  aria-label={`Delete ${entry.title || "entry"}`}
                  onClick={() => onDelete(entry.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="journal-empty">
          <div className="notebook-art" aria-hidden="true">
            <NotebookPen size={58} strokeWidth={1} />
            <span>
              everything starts
              <br />
              with a little thought.
            </span>
          </div>
          <h2>It doesn’t have to be an idea yet.</h2>
          <p>
            A screenshot. An observation. A “what if.”
            <br />
            Give it a little space to grow.
          </p>
          <button className="button primary" onClick={onNew}>
            <Plus size={17} />
            Capture your first spark
          </button>
        </div>
      )}
    </>
  );
}
export function JournalEditor({
  entry,
  onClose,
  onSave,
  toast,
}: {
  entry: Entry;
  onClose: () => void;
  onSave: (entry: Entry) => void;
  toast: (text: string) => void;
}) {
  const [draft, setDraft] = useState(entry);
  const [uploading, setUploading] = useState(false);
  const [discarding, setDiscarding] = useState(false);
  const requestClose = () => {
    if (JSON.stringify(draft) !== JSON.stringify(entry) || uploading)
      setDiscarding(true);
    else onClose();
  };
  const input = useRef<HTMLInputElement>(null);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    if (files.length + draft.images.length > 4) {
      toast("Keep up to four images in each entry.");
      return;
    }
    setUploading(true);
    try {
      const images = await Promise.all(
        Array.from(files).map(async (f) => ({
          id: crypto.randomUUID(),
          dataUrl: await imageFromFile(f),
          name: f.name,
        })),
      );
      setDraft((prev) => ({
        ...prev,
        images: [...prev.images, ...images].slice(0, 4),
      }));
    } catch (error) {
      toast((error as Error).message);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };
  return (
    <Modal
      title={entry.title ? "A page in your journal" : "A fresh page"}
      onClose={requestClose}
      wide
    >
      {discarding && (
        <div className="error-banner" role="alert">
          <span>This entry has unsaved changes.</span>
          <div className="button-row">
            <button
              className="text-button"
              onClick={() => setDiscarding(false)}
            >
              Keep writing
            </button>
            <button className="button secondary small-button" onClick={onClose}>
              Discard changes
            </button>
          </div>
        </div>
      )}
      <form
        className="journal-editor"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.body.trim() || draft.title.trim() || draft.images.length)
            onSave({
              ...draft,
              title: draft.title.trim(),
              body: draft.body.trim(),
              updatedAt: new Date().toISOString(),
            });
        }}
      >
        <time>
          {new Date(draft.createdAt).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </time>
        <input
          className="journal-title-input"
          aria-label="Entry title"
          maxLength={160}
          placeholder="What’s on your mind?"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
        <textarea
          className="journal-body-input"
          aria-label="Journal entry"
          maxLength={10000}
          placeholder="An idea you can’t shake. Something you noticed. A thing you wish existed…"
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
        />
        <div className="attachment-grid">
          {draft.images.map((img) => (
            <div key={img.id}>
              <img src={img.dataUrl} alt={img.name} />
              <button
                type="button"
                className="icon-button"
                aria-label={`Remove ${img.name}`}
                onClick={() =>
                  setDraft({
                    ...draft,
                    images: draft.images.filter((i) => i.id !== img.id),
                  })
                }
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        <input
          ref={input}
          hidden
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => void upload(e.target.files)}
        />
        <button
          className="upload-zone"
          type="button"
          disabled={uploading || draft.images.length >= 4}
          onClick={() => input.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (!uploading) void upload(e.dataTransfer.files);
          }}
        >
          {uploading ? (
            <LoaderCircle className="loading-icon" size={23} />
          ) : (
            <ImagePlus size={23} />
          )}
          <span>
            {uploading
              ? "Making room for your inspiration…"
              : "Add a photo or drop one here"}
            <small>JPG, PNG, WebP · Up to 4 images · 10 MB each</small>
          </span>
          <Plus size={18} />
        </button>
        <label className="check-row">
          <input
            type="checkbox"
            checked={draft.shareWithAI}
            onChange={(e) =>
              setDraft({ ...draft, shareWithAI: e.target.checked })
            }
          />
          <span>
            Let this inspire future spins
            <small>
              Share this entry and its photos with your AI provider when memory
              is on.
            </small>
          </span>
        </label>
        <div className="editor-footer">
          <span className="small muted">
            Saved locally when you save this entry.
          </span>
          <button
            className="button primary"
            disabled={
              uploading ||
              (!draft.title.trim() &&
                !draft.body.trim() &&
                !draft.images.length)
            }
          >
            <Check size={17} />
            Save entry
          </button>
        </div>
      </form>
    </Modal>
  );
}

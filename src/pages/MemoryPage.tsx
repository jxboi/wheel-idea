import { useState } from "react";
import {
  Leaf,
  Plus,
  Trash2,
  Pencil,
  Check,
  Heart,
  MessageSquare,
  BookOpen,
} from "lucide-react";
import type { Workspace, Memory } from "../lib/schema";
export function MemoryPage({
  workspace,
  onChange,
  onAdd,
  onDelete,
  onEdit,
}: {
  workspace: Workspace;
  onChange: (enabled: boolean) => void;
  onAdd: (text: string) => void;
  onDelete: (id: string) => void;
  onEdit: (m: Memory) => void;
}) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const shared = workspace.entries.filter((e) => e.shareWithAI).length;
  const reactions = workspace.ideas.filter((i) => i.rating).length;
  return (
    <>
      <div className="page-intro">
        <h1>A little more you, every time.</h1>
        <p>Your taste is the compass. Chance just opens a few doors.</p>
      </div>
      <div className="memory-layout">
        <section>
          <div className="memory-intro">
            <div className="memory-leaf">
              <Leaf size={30} strokeWidth={1.3} />
            </div>
            <div>
              <h2>A copilot that gets to know you.</h2>
              <p>
                Preferences, feedback, and the journal entries you choose to
                share give each spin a little more direction. You can edit or
                forget anything.
              </p>
            </div>
          </div>
          <form
            className="memory-add"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) {
                onAdd(text.trim());
                setText("");
              }
            }}
          >
            <label htmlFor="memory-text">What should Orbit remember?</label>
            <textarea
              id="memory-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              placeholder="I like playful tools with a practical purpose. I usually build with React, and I’d rather avoid social feeds."
              rows={3}
            />
            <button className="button primary" disabled={!text.trim()}>
              <Plus size={16} />
              Remember this
            </button>
          </form>
          <div className="section-heading memory-list-heading">
            <h2>Notes about you</h2>
            <span className="small muted">
              {workspace.memories.length}{" "}
              {workspace.memories.length === 1 ? "memory" : "memories"}
            </span>
          </div>
          <div className="memory-list">
            {workspace.memories.length ? (
              workspace.memories.map((m) => (
                <article key={m.id}>
                  {editing === m.id ? (
                    <>
                      <textarea
                        aria-label="Edit memory"
                        value={draft}
                        maxLength={2000}
                        onChange={(e) => setDraft(e.target.value)}
                      />
                      <div className="button-row">
                        <button
                          className="text-button"
                          onClick={() => setEditing(null)}
                        >
                          Cancel
                        </button>
                        <button
                          className="button primary small-button"
                          disabled={!draft.trim()}
                          onClick={() => {
                            onEdit({ ...m, text: draft.trim() });
                            setEditing(null);
                          }}
                        >
                          <Check size={15} />
                          Save
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <p>{m.text}</p>
                        <span className="small muted">
                          {m.source === "you"
                            ? "Added by you"
                            : "From your feedback"}{" "}
                          ·{" "}
                          {new Date(m.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      <div className="memory-row-actions">
                        <button
                          className="icon-button"
                          aria-label="Edit memory"
                          onClick={() => {
                            setDraft(m.text);
                            setEditing(m.id);
                          }}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label="Forget memory"
                          onClick={() => onDelete(m.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </>
                  )}
                </article>
              ))
            ) : (
              <p className="empty-note">
                A blank page, for now. Tell Orbit a little about your taste.
              </p>
            )}
          </div>
        </section>
        <aside className="memory-settings">
          <h3>You’re in control.</h3>
          <label className="toggle-row">
            <span>Use memory in my spins</span>
            <input
              type="checkbox"
              role="switch"
              checked={workspace.settings.useMemory}
              onChange={(e) => onChange(e.target.checked)}
            />
          </label>
          <p className="small muted">
            {workspace.settings.useMemory
              ? "Your relevant notes are included with AI requests."
              : "Personal context and photos stay out of AI requests. Your notes are still saved."}
          </p>
          <div className="memory-sources">
            <h4>What shapes your ideas</h4>
            <p>
              <Leaf size={17} />
              <span>Your preferences</span>
              <b>{workspace.memories.length}</b>
            </p>
            <p>
              <Heart size={17} />
              <span>Idea reactions</span>
              <b>{reactions}</b>
            </p>
            <p>
              <MessageSquare size={17} />
              <span>Feedback notes</span>
              <b>
                {workspace.ideas.reduce((n, i) => n + i.feedback.length, 0)}
              </b>
            </p>
            <p>
              <BookOpen size={17} />
              <span>Shared journal entries</span>
              <b>{shared}</b>
            </p>
          </div>
          <p className="small muted">
            Stored on this device. Nothing is sent to a model until you spin
            with a connected provider. Offline preview doesn’t use memory.
          </p>
        </aside>
      </div>
    </>
  );
}

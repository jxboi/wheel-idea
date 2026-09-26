import { useState } from "react";
import {
  Bookmark,
  Check,
  Copy,
  Download,
  ExternalLink,
  Heart,
  MessageSquare,
  Send,
  ThumbsDown,
  Pencil,
  Globe,
  FlaskConical,
} from "lucide-react";
import Markdown from "react-markdown";
import { Modal } from "./Modal";
import { categoryColors } from "./Icons";
import { categories, providerNames, type Idea } from "../lib/schema";
import { download } from "../lib/storage";
export function IdeaDetail({
  idea,
  onClose,
  onUpdate,
  onFeedback,
  toast,
}: {
  idea: Idea;
  onClose: () => void;
  onUpdate: (idea: Idea) => void;
  onFeedback: (text: string) => void;
  toast: (text: string) => void;
}) {
  const [tab, setTab] = useState<"idea" | "prompt" | "feedback">("idea");
  const [feedback, setFeedback] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(idea.prompt);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(idea.prompt);
      toast("Build prompt copied. Go make something.");
    } catch {
      toast("Clipboard unavailable. Use Download instead.");
    }
  };
  return (
    <Modal title="Your next possibility" onClose={onClose} wide>
      <div className="idea-detail">
        <div className="detail-meta">
          <span
            className="category-tag"
            style={{
              background: categoryColors[categories.indexOf(idea.category)],
            }}
          >
            {idea.category}
          </span>
          <span>{idea.duration}</span>
          <span>·</span>
          <span>
            {idea.researchStatus === "preview"
              ? "Offline preview"
              : providerNames[idea.provider]}
          </span>
        </div>
        <h2 className="detail-title">{idea.title}</h2>
        <p className="detail-summary">{idea.summary}</p>
        <div className="detail-actions">
          <button
            className={`button ${idea.saved ? "saved" : "primary"}`}
            onClick={() => onUpdate({ ...idea, saved: !idea.saved })}
          >
            {idea.saved ? <Check size={17} /> : <Bookmark size={17} />}{" "}
            {idea.saved ? "Saved to library" : "Save idea"}
          </button>
          <button className="button secondary" onClick={copy}>
            <Copy size={17} />
            Copy build prompt
          </button>
          <button
            className="icon-button outlined"
            title="Download build prompt"
            aria-label="Download build prompt"
            onClick={() =>
              download(
                `${idea.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.md`,
                idea.prompt,
              )
            }
          >
            <Download size={18} />
          </button>
        </div>
        <div className="tabs" role="tablist" aria-label="Idea details">
          {(["idea", "prompt", "feedback"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
            >
              {t === "idea"
                ? "The idea"
                : t === "prompt"
                  ? "Build prompt"
                  : `Feedback${idea.feedback.length ? ` (${idea.feedback.length})` : ""}`}
            </button>
          ))}
        </div>
        <div className="tab-content" role="tabpanel">
          {tab === "idea" ? (
            <>
              <div className="research-heading">
                {idea.researchStatus === "preview" ? (
                  <FlaskConical size={18} />
                ) : (
                  <Globe size={18} />
                )}
                <h3>
                  {idea.researchStatus === "preview"
                    ? "A starting point"
                    : "Why this, why now"}
                </h3>
              </div>
              <p>{idea.whyNow}</p>
              {idea.researchStatus === "uncited" && (
                <p className="inline-note">
                  The model returned no source links. Treat this idea as
                  unverified research.
                </p>
              )}
              <h3>The first version</h3>
              <ol className="feature-list">
                {idea.features.map((f, i) => (
                  <li key={i}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {f}
                  </li>
                ))}
              </ol>
              {idea.sources.length > 0 && (
                <>
                  <h3>From the research</h3>
                  <div className="source-list">
                    {idea.sources.map((s, i) => (
                      <a
                        key={i}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Globe size={16} />
                        <span>
                          {s.title}
                          <small>{new URL(s.url).hostname}</small>
                        </span>
                        <ExternalLink size={14} />
                      </a>
                    ))}
                  </div>
                  <p className="small muted">
                    Sources returned by your model; verify important claims
                    before building.
                  </p>
                </>
              )}
              <div className="reaction-row">
                <span>Is this your kind of thing?</span>
                <button
                  className={`reaction ${idea.rating === "love" ? "selected" : ""}`}
                  aria-pressed={idea.rating === "love"}
                  onClick={() =>
                    onUpdate({
                      ...idea,
                      rating: idea.rating === "love" ? null : "love",
                    })
                  }
                >
                  <Heart size={17} />
                  Love it
                </button>
                <button
                  className={`reaction ${idea.rating === "pass" ? "selected" : ""}`}
                  aria-pressed={idea.rating === "pass"}
                  onClick={() =>
                    onUpdate({
                      ...idea,
                      rating: idea.rating === "pass" ? null : "pass",
                    })
                  }
                >
                  <ThumbsDown size={17} />
                  Not quite
                </button>
              </div>
            </>
          ) : tab === "prompt" ? (
            <>
              <div className="section-heading">
                <span className="small muted">
                  Ready for your favorite coding agent.
                </span>
                <button
                  className="text-button"
                  onClick={() => {
                    setDraft(idea.prompt);
                    setEditing(!editing);
                  }}
                >
                  <Pencil size={15} />
                  {editing ? "Cancel edit" : "Edit prompt"}
                </button>
              </div>
              {editing ? (
                <>
                  <label className="sr-only" htmlFor="prompt-editor">
                    Edit build prompt
                  </label>
                  <textarea
                    id="prompt-editor"
                    className="prompt-editor"
                    value={draft}
                    maxLength={24000}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                  <button
                    className="button primary"
                    disabled={draft.trim().length < 100}
                    onClick={() => {
                      onUpdate({ ...idea, prompt: draft.trim() });
                      setEditing(false);
                      toast("Your prompt is updated.");
                    }}
                  >
                    Save changes
                  </button>
                </>
              ) : (
                <div className="markdown">
                  <Markdown>{idea.prompt}</Markdown>
                </div>
              )}
            </>
          ) : (
            <>
              <h3>A little feedback goes a long way.</h3>
              <p className="muted">
                What fits? What would you change? Your notes help shape future
                spins when memory is on.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (feedback.trim()) {
                    onFeedback(feedback.trim());
                    setFeedback("");
                  }
                }}
              >
                <label className="sr-only" htmlFor="feedback">
                  Your feedback
                </label>
                <textarea
                  id="feedback"
                  placeholder="I love the concept, but I’d prefer something without a social feed…"
                  maxLength={2000}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={4}
                />
                <button className="button primary" disabled={!feedback.trim()}>
                  <Send size={16} />
                  Add feedback
                </button>
              </form>
              <div className="feedback-list">
                {idea.feedback.length ? (
                  idea.feedback.map((f) => (
                    <article key={f.id}>
                      <MessageSquare size={17} />
                      <div>
                        <p>{f.text}</p>
                        <time>
                          {new Date(f.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </time>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="empty-note">
                    No feedback yet. Your perspective belongs here.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

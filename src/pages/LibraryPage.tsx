import { useMemo, useState } from "react";
import {
  Search,
  ArrowUpRight,
  Bookmark,
  Trash2,
  ArrowRight,
  BookOpen,
} from "lucide-react";
import { categories, type Idea } from "../lib/schema";
import { categoryColors, categoryIcons } from "../components/Icons";
export function LibraryPage({
  ideas,
  onOpen,
  onUpdate,
  onDelete,
  onSpin,
}: {
  ideas: Idea[];
  onOpen: (id: string) => void;
  onUpdate: (i: Idea) => void;
  onDelete: (id: string) => void;
  onSpin: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [cat, setCat] = useState("all");
  const visible = useMemo(
    () =>
      ideas.filter(
        (i) =>
          (filter !== "saved" || i.saved) &&
          (cat === "all" || i.category === cat) &&
          `${i.title} ${i.summary} ${i.category}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [ideas, filter, cat, query],
  );
  return (
    <>
      <div className="page-intro page-heading-row">
        <div>
          <h1>Good ideas have a home.</h1>
          <p>A collection of possibilities. One could be your next thing.</p>
        </div>
        <button className="button primary" onClick={onSpin}>
          Find an idea <ArrowRight size={17} />
        </button>
      </div>
      <div className="library-toolbar">
        <div className="tabs">
          <button
            className={filter === "all" ? "selected" : ""}
            onClick={() => setFilter("all")}
          >
            All ideas <span>{ideas.length}</span>
          </button>
          <button
            className={filter === "saved" ? "selected" : ""}
            onClick={() => setFilter("saved")}
          >
            Saved <span>{ideas.filter((i) => i.saved).length}</span>
          </button>
        </div>
        <div className="library-filters">
          <label className="search-field">
            <Search size={17} />
            <input
              aria-label="Search ideas"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a possibility…"
            />
          </label>
          <select
            aria-label="Filter by category"
            value={cat}
            onChange={(e) => setCat(e.target.value)}
          >
            <option value="all">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>
      {visible.length ? (
        <div className="idea-grid">
          {visible.map((idea) => {
            const index = categories.indexOf(idea.category);
            const Icon = categoryIcons[index];
            return (
              <article className="idea-card" key={idea.id}>
                <div
                  className="idea-card-top"
                  style={{ background: categoryColors[index] }}
                >
                  <Icon size={36} strokeWidth={1.3} />
                  <span>{idea.category}</span>
                  <button
                    className={`icon-button ${idea.saved ? "is-saved" : ""}`}
                    aria-label={idea.saved ? "Unsave idea" : "Save idea"}
                    onClick={() => onUpdate({ ...idea, saved: !idea.saved })}
                  >
                    <Bookmark
                      size={19}
                      fill={idea.saved ? "currentColor" : "none"}
                    />
                  </button>
                </div>
                <button
                  className="idea-card-content"
                  onClick={() => onOpen(idea.id)}
                >
                  <span className="small muted">
                    {idea.duration} <span>·</span>{" "}
                    {idea.researchStatus === "preview" ? "Preview" : "AI idea"}
                  </span>
                  <h2>{idea.title}</h2>
                  <p>{idea.summary}</p>
                  <span className="text-button">
                    Explore this idea <ArrowUpRight size={17} />
                  </span>
                </button>
                <div className="idea-card-footer">
                  <time>
                    {new Date(idea.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </time>
                  <button
                    className="icon-button"
                    aria-label={`Delete ${idea.title}`}
                    onClick={() => onDelete(idea.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-symbol">
            <BookOpen size={38} strokeWidth={1.2} />
          </div>
          <h2>
            {ideas.length
              ? "No ideas in this little corner."
              : "Your next chapter is unwritten."}
          </h2>
          <p>
            {ideas.length
              ? "Try another search or save an idea you love."
              : "Give the wheel a spin. Every idea will land here, ready when you are."}
          </p>
          <button
            className="button primary"
            onClick={
              ideas.length
                ? () => {
                    setQuery("");
                    setFilter("all");
                    setCat("all");
                  }
                : onSpin
            }
          >
            {ideas.length ? "Clear filters" : "Let’s find your first idea"}
            <ArrowRight size={17} />
          </button>
        </div>
      )}
    </>
  );
}

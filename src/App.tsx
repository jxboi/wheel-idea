import { useCallback, useEffect, useRef, useState } from "react";
import { X, Check, AlertCircle } from "lucide-react";
import { Shell, type Page } from "./components/Shell";
import { WheelPage, type SpinInput } from "./pages/WheelPage";
import { LibraryPage } from "./pages/LibraryPage";
import { JournalPage, JournalEditor } from "./pages/JournalPage";
import { MemoryPage } from "./pages/MemoryPage";
import { SettingsPage, type Credentials } from "./pages/SettingsPage";
import { IdeaDetail } from "./components/IdeaDetail";
import { Modal } from "./components/Modal";
import {
  categories,
  emptyWorkspace,
  briefSchema,
  type Workspace,
  type Idea,
  type Entry,
} from "./lib/schema";
import { loadWorkspace, persistWorkspace } from "./lib/storage";
import { buildContext } from "./lib/context";
import { previewBrief } from "./lib/preview";
import { landingRotation, chooseCategory } from "./lib/wheel";
const validPages: Page[] = [
  "wheel",
  "library",
  "journal",
  "memory",
  "settings",
];
function currentPage(): Page {
  const p = location.hash.slice(1) as Page;
  return validPages.includes(p) ? p : "wheel";
}
export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>(
    structuredClone(emptyWorkspace),
  );
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [page, setPage] = useState<Page>(currentPage);
  const [credentials, setCredentials] = useState<Credentials>({
    key: "",
    token: "",
  });
  const [notice, setNotice] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [journalDraft, setJournalDraft] = useState<Entry | null>(null);
  const [confirmation, setConfirmation] = useState<{
    type: "idea" | "entry";
    id: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [rotation, setRotation] = useState(315);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const generation = useRef<AbortController | null>(null);
  const generationId = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writeQueue = useRef(Promise.resolve());
  const toast = useCallback((text: string) => {
    setNotice(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setNotice(""), 5000);
  }, []);
  useEffect(() => {
    loadWorkspace()
      .then((w) => {
        setWorkspace(w);
        setReady(true);
      })
      .catch(() =>
        setLoadError(
          "Orbit couldn’t open this browser’s storage. Your data has not been overwritten. Enable browser storage, then reload.",
        ),
      );
    const fn = () => setPage(currentPage());
    window.addEventListener("hashchange", fn);
    return () => {
      window.removeEventListener("hashchange", fn);
      generation.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    writeQueue.current = writeQueue.current
      .catch(() => {})
      .then(() => persistWorkspace(workspace))
      .then(() => setSaveError(""))
      .catch(() =>
        setSaveError(
          "Your latest changes couldn’t be saved. Storage may be full. Export your workspace in Settings before leaving this page.",
        ),
      );
  }, [workspace, ready]);
  const navigate = (p: Page) => {
    location.hash = p;
    setPage(p);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const updateIdea = (idea: Idea) =>
    setWorkspace((w) => ({
      ...w,
      ideas: w.ideas.map((i) => (i.id === idea.id ? idea : i)),
    }));
  const newJournal = (photo = false) => {
    const now = new Date().toISOString();
    setJournalDraft({
      id: crypto.randomUUID(),
      title: "",
      body: "",
      createdAt: now,
      updatedAt: now,
      images: [],
      shareWithAI: false,
    });
    if (photo) toast("Add a photo to your new journal entry.");
  };
  const cancel = () => {
    generationId.current++;
    generation.current?.abort();
    setBusy(false);
    setStatus("");
    toast("Generation cancelled.");
  };
  const spin = async (input: SpinInput) => {
    if (busy) return;
    const id = ++generationId.current;
    const controller = new AbortController();
    generation.current = controller;
    setBusy(true);
    setError("");
    setStatus(
      workspace.settings.provider === "preview"
        ? "A little chance is at work…"
        : "Researching a fresh direction…",
    );
    // Rejection sampling keeps each enabled category equally likely.
    let index = chooseCategory();
    while (!input.enabled.includes(categories[index])) index = chooseCategory();
    const category = categories[index];
    setSelected(category);
    setRotation((prev) => landingRotation(prev, index));
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animation = new Promise((resolve) =>
      setTimeout(resolve, reduced ? 150 : 4900),
    );
    const statusTimer = setTimeout(() => {
      if (generationId.current === id)
        setStatus(`Landed on ${category}. Shaping your build prompt…`);
    }, 4900);
    const timeout = setTimeout(() => controller.abort(), 118000);
    try {
      const dataPromise =
        workspace.settings.provider === "preview"
          ? Promise.resolve(previewBrief(category, input.duration, input.mood))
          : fetch("/api/generate", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(credentials.key
                  ? { "X-Provider-Key": credentials.key }
                  : {}),
                ...(credentials.token
                  ? { "X-Workspace-Token": credentials.token }
                  : {}),
              },
              body: JSON.stringify({
                category,
                duration: input.duration,
                mood: input.mood,
                settings: workspace.settings,
                ...buildContext(workspace),
              }),
              signal: controller.signal,
            }).then(async (response) => {
              const result = await response.json().catch(() => ({
                error:
                  "The server returned an unexpected response. Please try again.",
              }));
              if (!response.ok)
                throw new Error(result.error || "Could not generate an idea.");
              return briefSchema.parse(result);
            });
      const [brief] = await Promise.all([dataPromise, animation]);
      if (id !== generationId.current) return;
      const idea: Idea = {
        ...brief,
        id: crypto.randomUUID(),
        category,
        createdAt: new Date().toISOString(),
        provider: workspace.settings.provider,
        model: workspace.settings.model,
        effort: workspace.settings.effort,
        duration: input.duration,
        saved: false,
        feedback: [],
        rating: null,
        researchStatus:
          workspace.settings.provider === "preview"
            ? "preview"
            : brief.sources.length
              ? "cited"
              : "uncited",
      };
      setWorkspace((w) => ({ ...w, ideas: [idea, ...w.ideas] }));
      setDetailId(idea.id);
    } catch (err) {
      if (id === generationId.current)
        setError(
          controller.signal.aborted
            ? "The request timed out. Try again with a faster model or lower thinking effort."
            : err instanceof Error
              ? err.message
              : "Something went wrong. Try again.",
        );
    } finally {
      clearTimeout(statusTimer);
      clearTimeout(timeout);
      if (id === generationId.current) {
        setBusy(false);
        setStatus("");
      }
    }
  };
  const detail = workspace.ideas.find((i) => i.id === detailId);
  if (loadError)
    return (
      <div className="startup-state">
        <AlertCircle size={30} />
        <h1>A moment to reconnect.</h1>
        <p>{loadError}</p>
        <button className="button primary" onClick={() => location.reload()}>
          Reload Orbit
        </button>
      </div>
    );
  if (!ready)
    return (
      <div className="startup-state">
        <div className="loading-orbit" />
        <p>Making room for a little possibility…</p>
      </div>
    );
  return (
    <>
      <Shell page={page} onNavigate={navigate}>
        {saveError && (
          <div className="error-banner" role="alert">
            {saveError}
            <button
              className="text-button"
              onClick={() => navigate("settings")}
            >
              Open Settings
            </button>
          </div>
        )}
        {page === "wheel" && (
          <WheelPage
            settings={workspace.settings}
            busy={busy}
            rotation={rotation}
            selected={selected}
            status={status}
            error={error}
            onSpin={spin}
            onSettings={() => navigate("settings")}
            onJournal={newJournal}
            onOpenJournal={() => navigate("journal")}
            onMemory={() => navigate("memory")}
            onCancel={cancel}
          />
        )}{" "}
        {page === "library" && (
          <LibraryPage
            ideas={workspace.ideas}
            onOpen={setDetailId}
            onUpdate={updateIdea}
            onDelete={(id) => setConfirmation({ type: "idea", id })}
            onSpin={() => navigate("wheel")}
          />
        )}{" "}
        {page === "journal" && (
          <JournalPage
            entries={workspace.entries}
            onEdit={setJournalDraft}
            onNew={() => newJournal()}
            onDelete={(id) => setConfirmation({ type: "entry", id })}
          />
        )}{" "}
        {page === "memory" && (
          <MemoryPage
            workspace={workspace}
            onChange={(enabled) =>
              setWorkspace((w) => ({
                ...w,
                settings: { ...w.settings, useMemory: enabled },
              }))
            }
            onAdd={(text) =>
              setWorkspace((w) => ({
                ...w,
                memories: [
                  {
                    id: crypto.randomUUID(),
                    text,
                    source: "you",
                    createdAt: new Date().toISOString(),
                  },
                  ...w.memories,
                ],
              }))
            }
            onDelete={(id) =>
              setWorkspace((w) => ({
                ...w,
                memories: w.memories.filter((m) => m.id !== id),
              }))
            }
            onEdit={(memory) =>
              setWorkspace((w) => ({
                ...w,
                memories: w.memories.map((m) =>
                  m.id === memory.id ? memory : m,
                ),
              }))
            }
          />
        )}{" "}
        {page === "settings" && (
          <SettingsPage
            settings={workspace.settings}
            onSave={(settings) => {
              setWorkspace((w) => ({ ...w, settings }));
              setError("");
            }}
            credentials={credentials}
            onCredentials={setCredentials}
            workspace={workspace}
            onImport={(w) => {
              setWorkspace(w);
              toast("Your workspace is restored.");
            }}
            toast={toast}
          />
        )}
      </Shell>
      {detail && (
        <IdeaDetail
          idea={detail}
          onClose={() => setDetailId(null)}
          onUpdate={updateIdea}
          toast={toast}
          onFeedback={(text) => {
            const now = new Date().toISOString();
            setWorkspace((w) => ({
              ...w,
              ideas: w.ideas.map((i) =>
                i.id === detail.id
                  ? {
                      ...i,
                      feedback: [
                        ...i.feedback,
                        { id: crypto.randomUUID(), text, createdAt: now },
                      ],
                    }
                  : i,
              ),
              memories: [
                {
                  id: crypto.randomUUID(),
                  text: `About “${detail.title}” (${detail.category}): ${text}`.slice(
                    0,
                    2000,
                  ),
                  source: "feedback",
                  ideaId: detail.id,
                  createdAt: now,
                },
                ...w.memories,
              ],
            }));
            toast("Feedback saved to this idea and your memory.");
          }}
        />
      )}
      {journalDraft && (
        <JournalEditor
          entry={journalDraft}
          onClose={() => setJournalDraft(null)}
          toast={toast}
          onSave={(entry) => {
            setWorkspace((w) => ({
              ...w,
              entries: [entry, ...w.entries.filter((e) => e.id !== entry.id)],
            }));
            setJournalDraft(null);
            toast("A little spark, safely kept.");
          }}
        />
      )}
      {confirmation && (
        <Modal title="Make a little room" onClose={() => setConfirmation(null)}>
          <div className="modal-body">
            <h2>
              Delete this{" "}
              {confirmation.type === "idea" ? "idea" : "journal entry"}?
            </h2>
            <p className="muted">
              This removes it from this device.{" "}
              {confirmation.type === "idea"
                ? "Any memory notes created from its feedback will also be removed."
                : ""}
            </p>
            <div className="button-row">
              <button
                className="button secondary"
                onClick={() => setConfirmation(null)}
              >
                Keep it
              </button>
              <button
                className="button danger"
                onClick={() => {
                  setWorkspace((w) =>
                    confirmation.type === "idea"
                      ? {
                          ...w,
                          ideas: w.ideas.filter(
                            (i) => i.id !== confirmation.id,
                          ),
                          memories: w.memories.filter(
                            (m) => m.ideaId !== confirmation.id,
                          ),
                        }
                      : {
                          ...w,
                          entries: w.entries.filter(
                            (e) => e.id !== confirmation.id,
                          ),
                        },
                  );
                  setConfirmation(null);
                  toast("Removed from your workspace.");
                }}
              >
                Delete {confirmation.type === "idea" ? "idea" : "entry"}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {notice && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}

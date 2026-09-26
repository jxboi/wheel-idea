import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { X, Check, AlertCircle } from "lucide-react";
import { Shell, type Page } from "./components/Shell";
import { WheelPage } from "./pages/WheelPage";
import { Modal } from "./components/Modal";
import { emptyWorkspace, type Workspace, type Entry } from "./lib/schema";
import {
  loadWorkspace,
  onUpgradeBlocked,
  persistWorkspace,
  watchOtherTabs,
} from "./lib/storage";
import * as actions from "./lib/actions";
import {
  isSettingsSection,
  type SettingsSection,
} from "./pages/settings/sections";
import {
  useGeneration,
  type Credentials,
} from "./features/generation/useGeneration";
import {
  loadCredentials,
  storeCredentials,
} from "./features/generation/credentials";
import { takeAuthOutcome, useAuth } from "./features/auth/session";

// Secondary surfaces load on demand so the wheel paints sooner.
const LibraryPage = lazy(() =>
  import("./pages/LibraryPage").then((m) => ({ default: m.LibraryPage })),
);
const JournalPage = lazy(() =>
  import("./pages/JournalPage").then((m) => ({ default: m.JournalPage })),
);
const JournalEditor = lazy(() =>
  import("./pages/JournalPage").then((m) => ({ default: m.JournalEditor })),
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((m) => ({ default: m.SettingsPage })),
);
const IdeaDetail = lazy(() =>
  import("./components/IdeaDetail").then((m) => ({ default: m.IdeaDetail })),
);

const validPages: Page[] = ["wheel", "library", "journal", "settings"];
type Route = { page: Page; section: SettingsSection | null };
/** Reads `#page` or `#settings/<section>`. The old `#memory` page now lives in Settings. */
function currentRoute(): Route {
  const [head, sub = ""] = location.hash.slice(1).split("/");
  if (head === "memory") return { page: "settings", section: "memory" };
  if (head === "settings")
    return {
      page: "settings",
      section: isSettingsSection(sub) ? sub : null,
    };
  const page = head as Page;
  return { page: validPages.includes(page) ? page : "wheel", section: null };
}
export default function App() {
  const [workspace, setWorkspace] = useState<Workspace>(
    structuredClone(emptyWorkspace),
  );
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [upgradeBlocked, setUpgradeBlocked] = useState(false);
  const [otherTab, setOtherTab] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [route, setRoute] = useState<Route>(currentRoute);
  const { page, section } = route;
  const [credentials, setCredentials] = useState<Credentials>(loadCredentials);
  const [notice, setNotice] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [journalDraft, setJournalDraft] = useState<Entry | null>(null);
  const [confirmation, setConfirmation] = useState<{
    type: "idea" | "entry";
    id: string;
  } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writeQueue = useRef(Promise.resolve());
  /** The workspace as last written to storage; writes are diffs against it. */
  const stored = useRef<Workspace | null>(null);
  const toast = useCallback((text: string) => {
    setNotice(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setNotice(""), 5000);
  }, []);
  const update = (change: (w: Workspace) => Workspace) => setWorkspace(change);
  useEffect(() => storeCredentials(credentials), [credentials]);
  const { auth, signOut } = useAuth();
  const onCancelled = useCallback(() => toast("Cancelled."), [toast]);
  const generation = useGeneration({
    workspace,
    credentials,
    onIdea: (idea) => {
      update((w) => actions.addIdea(w, idea));
      setDetailId(idea.id);
    },
    onCancelled,
  });
  useEffect(() => {
    onUpgradeBlocked(() => setUpgradeBlocked(true));
    loadWorkspace()
      .then((w) => {
        stored.current = w;
        setWorkspace(w);
        setUpgradeBlocked(false);
        setReady(true);
        watchOtherTabs(setOtherTab);
      })
      .catch(() =>
        setLoadError(
          "Orbit couldn’t open this browser’s storage. Your data has not been overwritten. Enable browser storage, then reload.",
        ),
      );
    const outcome = takeAuthOutcome();
    if (outcome) toast(outcome);
    const fn = () => setRoute(currentRoute());
    window.addEventListener("hashchange", fn);
    return () => window.removeEventListener("hashchange", fn);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const snapshot = workspace;
    // Serialized so an older save can never overtake a newer one. Each write is
    // a diff against the last snapshot that actually reached storage.
    writeQueue.current = writeQueue.current
      .catch(() => {})
      .then(() => persistWorkspace(stored.current, snapshot))
      .then(() => {
        stored.current = snapshot;
        setSaveError("");
      })
      .catch(() =>
        setSaveError(
          "Your latest changes couldn’t be saved. Storage may be full. Export your workspace in Settings before leaving this page.",
        ),
      );
  }, [workspace, ready]);
  const navigate = (p: Page, sub: SettingsSection | null = null) => {
    location.hash = sub ? `${p}/${sub}` : p;
    setRoute({ page: p, section: sub });
    window.scrollTo({ top: 0, behavior: "instant" });
  };
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
    if (photo) toast("Add a photo below.");
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
        <p>
          {upgradeBlocked
            ? "Orbit is updating how it stores your workspace. Close other Orbit tabs to continue."
            : "Making room for a little possibility…"}
        </p>
      </div>
    );
  const pageFallback = (
    <div className="startup-state page-loading">
      <div className="loading-orbit" />
    </div>
  );
  return (
    <>
      <Shell page={page} onNavigate={navigate}>
        {otherTab && (
          <div className="error-banner" role="alert">
            Orbit is open in another tab. Changes made in two tabs can overwrite
            each other, so keep working in one.
          </div>
        )}
        {saveError && (
          <div className="error-banner" role="alert">
            {saveError}
            <button
              className="text-button"
              onClick={() => navigate("settings", "backup")}
            >
              Open Settings
            </button>
          </div>
        )}
        {page === "wheel" && (
          <WheelPage
            settings={workspace.settings}
            preferences={workspace.preferences}
            onPreferences={(p) => update((w) => actions.setPreferences(w, p))}
            busy={generation.busy}
            rotation={generation.rotation}
            selected={generation.selected}
            landed={generation.landed}
            activity={generation.activity}
            error={generation.error}
            onSpin={generation.spin}
            onSettings={() => navigate("settings", "model")}
            onJournal={newJournal}
            onOpenJournal={() => navigate("journal")}
            onMemory={() => navigate("settings", "memory")}
            onCancel={generation.cancel}
          />
        )}
        <Suspense fallback={pageFallback}>
          {page === "library" && (
            <LibraryPage
              ideas={workspace.ideas}
              onOpen={setDetailId}
              onUpdate={(idea) => update((w) => actions.updateIdea(w, idea))}
              onDelete={(id) => setConfirmation({ type: "idea", id })}
              onSpin={() => navigate("wheel")}
            />
          )}
          {page === "journal" && (
            <JournalPage
              entries={workspace.entries}
              onEdit={setJournalDraft}
              onNew={() => newJournal()}
              onDelete={(id) => setConfirmation({ type: "entry", id })}
            />
          )}
          {page === "settings" && (
            <SettingsPage
              section={section}
              onSection={(sub) => navigate("settings", sub)}
              workspace={workspace}
              onSave={(settings) => {
                update((w) => actions.setSettings(w, settings));
                generation.setError("");
              }}
              credentials={credentials}
              onCredentials={setCredentials}
              auth={auth}
              onSignOut={async () => {
                try {
                  await signOut();
                  toast("Signed out of GitHub.");
                } catch {
                  toast("Couldn’t sign out. Check your connection.");
                }
              }}
              onPreferences={(p) => update((w) => actions.setPreferences(w, p))}
              onUseMemory={(enabled) =>
                update((w) => actions.setUseMemory(w, enabled))
              }
              onAddMemory={(text) => update((w) => actions.addMemory(w, text))}
              onDeleteMemory={(id) =>
                update((w) => actions.deleteMemory(w, id))
              }
              onEditMemory={(memory) =>
                update((w) => actions.editMemory(w, memory))
              }
              onImport={(w) => {
                setWorkspace(w);
                toast("Workspace restored.");
              }}
              toast={toast}
            />
          )}
        </Suspense>
      </Shell>
      <Suspense fallback={null}>
        {detail && (
          <IdeaDetail
            idea={detail}
            onClose={() => setDetailId(null)}
            onUpdate={(idea) => update((w) => actions.updateIdea(w, idea))}
            toast={toast}
            onFeedback={(text) => {
              update((w) => actions.addFeedback(w, detail.id, text));
              toast("Feedback saved.");
            }}
          />
        )}
        {journalDraft && (
          <JournalEditor
            entry={journalDraft}
            onClose={() => setJournalDraft(null)}
            toast={toast}
            onSave={(entry) => {
              update((w) => actions.saveEntry(w, entry));
              setJournalDraft(null);
              toast("Saved.");
            }}
          />
        )}
      </Suspense>
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
                  const { type, id } = confirmation;
                  update((w) =>
                    type === "idea"
                      ? actions.deleteIdea(w, id)
                      : actions.deleteEntry(w, id),
                  );
                  setConfirmation(null);
                  toast("Deleted.");
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

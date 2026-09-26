import { useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Download,
  Upload,
  KeyRound,
  ShieldCheck,
  Terminal,
  Brain,
  FlaskConical,
  Globe,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  providerNames,
  modelDefaults,
  type Settings,
  type Provider,
  type Workspace,
} from "../lib/schema";
import { safeParseWorkspace } from "../lib/migrations";
import { download } from "../lib/files";
import type { Credentials } from "../features/generation/useGeneration";
export function SettingsPage({
  settings,
  onSave,
  credentials,
  onCredentials,
  workspace,
  onImport,
  toast,
}: {
  settings: Settings;
  onSave: (s: Settings) => void;
  credentials: Credentials;
  onCredentials: (c: Credentials) => void;
  workspace: Workspace;
  onImport: (w: Workspace) => void;
  toast: (text: string) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [secrets, setSecrets] = useState(credentials);
  const [showKey, setShowKey] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Workspace | null>(null);
  const local = draft.provider.endsWith("-local");
  const preview = draft.provider === "preview";
  const changeProvider = (provider: Provider) => {
    setDraft({
      ...draft,
      provider,
      model: modelDefaults[provider],
      effort: "default",
    });
    setSecrets({ ...secrets, key: "" });
  };
  return (
    <>
      <div className="page-intro">
        <h1>Settings</h1>
      </div>
      <div className="settings-layout">
        <form
          className="settings-main"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(draft);
            onCredentials(secrets);
            toast("Settings saved.");
          }}
        >
          <div className="section-heading">
            <h2>AI model</h2>
            <Brain size={23} />
          </div>
          <label htmlFor="provider">AI provider</label>
          <select
            id="provider"
            value={draft.provider}
            onChange={(e) => changeProvider(e.target.value as Provider)}
          >
            {Object.entries(providerNames).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
                {id.endsWith("-local") ? " · on your computer" : ""}
              </option>
            ))}
          </select>
          {preview ? (
            <div className="setting-notice">
              <FlaskConical size={23} />
              <div>
                <strong>Sample ideas only.</strong>
                <p>No AI, research, or personal context.</p>
              </div>
            </div>
          ) : (
            <>
              <label htmlFor="model">
                Model{" "}
                <span className="optional">
                  {local ? "optional · uses CLI default" : "model ID"}
                </span>
              </label>
              <input
                id="model"
                value={draft.model}
                maxLength={150}
                required={!local}
                placeholder={
                  modelDefaults[draft.provider] ||
                  "Use the signed-in CLI’s default model"
                }
                onChange={(e) => setDraft({ ...draft, model: e.target.value })}
              />
              <label htmlFor="effort">Thinking effort</label>
              <select
                id="effort"
                value={draft.effort}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    effort: e.target.value as Settings["effort"],
                  })
                }
              >
                <option value="default">Default</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              {local ? (
                <div className="setting-notice">
                  <Terminal size={23} />
                  <div>
                    <strong>Local only.</strong>
                    <p>
                      Set <code>ORBIT_ENABLE_LOCAL_CLI=true</code> and sign in
                      to the{" "}
                      {draft.provider === "codex-local" ? "Codex" : "Claude"}{" "}
                      CLI. Not available on Vercel.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <label htmlFor="api-key">
                    API key <span className="optional">this session only</span>
                  </label>
                  <div className="key-input">
                    <KeyRound size={17} />
                    <input
                      id="api-key"
                      type={showKey ? "text" : "password"}
                      autoComplete="off"
                      spellCheck={false}
                      value={secrets.key}
                      onChange={(e) =>
                        setSecrets({ ...secrets, key: e.target.value })
                      }
                      placeholder="Paste your API key"
                    />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={showKey ? "Hide API key" : "Show API key"}
                      onClick={() => setShowKey(!showKey)}
                    >
                      {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  <p className="field-hint">
                    Never saved. Leave empty to use a server key.
                  </p>
                  <label htmlFor="workspace-token">
                    Workspace password{" "}
                    <span className="optional">optional</span>
                  </label>
                  <input
                    id="workspace-token"
                    type="password"
                    autoComplete="off"
                    value={secrets.token}
                    onChange={(e) =>
                      setSecrets({ ...secrets, token: e.target.value })
                    }
                    placeholder="For a shared server key"
                  />
                </>
              )}
              <div className="research-note">
                <Globe size={18} />
                <span>Each spin uses web search. Provider charges apply.</span>
              </div>
            </>
          )}
          <button className="button primary settings-save">
            <Check size={17} />
            Save settings
          </button>
        </form>
        <aside className="settings-side">
          <section>
            <ShieldCheck size={26} strokeWidth={1.5} />
            <h2>Your data stays here.</h2>
            <p>Everything lives in this browser. Nothing is synced.</p>
          </section>
          <section>
            <h3>Backup</h3>
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
                  const parsed = safeParseWorkspace(
                    JSON.parse(await file.text()),
                  );
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
                  {pending.entries.length} entries, and{" "}
                  {pending.memories.length} memories?
                </p>
                <div className="button-row">
                  <button
                    className="text-button"
                    onClick={() => setPending(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="button primary small-button"
                    onClick={() => {
                      onImport(pending);
                      setDraft(pending.settings);
                      setPending(null);
                      onCredentials({ key: "", token: "" });
                      setSecrets({ key: "", token: "" });
                    }}
                  >
                    Replace
                  </button>
                </div>
              </div>
            )}
          </section>
          <a
            className="text-button"
            href={
              draft.provider === "anthropic" ||
              draft.provider === "claude-local"
                ? "https://platform.claude.com/docs/en/home"
                : draft.provider === "openai"
                  ? "https://developers.openai.com/api/docs"
                  : draft.provider.endsWith("-local")
                    ? "https://developers.openai.com/codex/cli"
                    : "https://openrouter.ai/docs/quickstart"
            }
            target="_blank"
            rel="noopener noreferrer"
          >
            Provider documentation <ArrowUpRight size={16} />
          </a>
        </aside>
      </div>
    </>
  );
}

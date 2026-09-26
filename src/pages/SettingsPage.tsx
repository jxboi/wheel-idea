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
  workspaceSchema,
} from "../lib/schema";
import { download } from "../lib/storage";
export type Credentials = { key: string; token: string };
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
        <h1>A workspace that works for you.</h1>
        <p>Your tools, your models, your way of making things.</p>
      </div>
      <div className="settings-layout">
        <form
          className="settings-main"
          onSubmit={(e) => {
            e.preventDefault();
            onSave(draft);
            onCredentials(secrets);
            toast("Your copilot settings are saved.");
          }}
        >
          <div className="section-heading">
            <h2>Your creative copilot</h2>
            <Brain size={23} />
          </div>
          <p className="muted">
            Bring the model you love. Orbit gives it a little direction.
          </p>
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
                <strong>A little test drive.</strong>
                <p>
                  Offline preview uses eight curated example briefs. No AI call,
                  web research, or personal context. Choose a provider for the
                  full experience.
                </p>
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
              <p className="field-hint">
                Enter any model ID supported by your provider. Search, images,
                and thinking support vary by model.
              </p>
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
                <option value="default">Model default — recommended</option>
                <option value="low">Low — a quick spark</option>
                <option value="medium">
                  Medium — a little more considered
                </option>
                <option value="high">High — room to think deeply</option>
              </select>
              <p className="field-hint">
                Higher effort may take longer and cost more. Choose default for
                models without reasoning controls.
              </p>
              {local ? (
                <div className="setting-notice">
                  <Terminal size={23} />
                  <div>
                    <strong>Powered by your local tools.</strong>
                    <p>
                      Run Orbit locally, enable{" "}
                      <code>ORBIT_ENABLE_LOCAL_CLI=true</code>, and sign in to
                      your installed{" "}
                      {draft.provider === "codex-local" ? "Codex" : "Claude"}{" "}
                      CLI. Local tools use text inspiration only and aren’t
                      available on Vercel.
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
                    Kept in memory for this tab. Sent only to Orbit’s server and
                    your selected provider; never saved with your journal or
                    backups. Leave empty to use a configured server key.
                  </p>
                  <label htmlFor="workspace-token">
                    Workspace password{" "}
                    <span className="optional">for a server key on Vercel</span>
                  </label>
                  <input
                    id="workspace-token"
                    type="password"
                    autoComplete="off"
                    value={secrets.token}
                    onChange={(e) =>
                      setSecrets({ ...secrets, token: e.target.value })
                    }
                    placeholder="Only if your deployment uses a shared key"
                  />
                </>
              )}
              <div className="research-note">
                <Globe size={18} />
                <span>
                  Live web research is requested with every connected spin.
                  Provider and search charges apply.
                </span>
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
            <h2>Your ideas belong to you.</h2>
            <p>
              Ideas, journal entries, photos, and memory live in this browser on
              this device. They aren’t synced to an account.
            </p>
            <p>
              Your chosen context is sent to your AI provider when you spin. You
              can turn this off in Memory.
            </p>
          </section>
          <section>
            <h3>Keep a copy.</h3>
            <p>
              Back up your workspace before clearing browser data or moving to
              another device.
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
              Export workspace
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
                  const parsed = workspaceSchema.safeParse(
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
              Import workspace
            </button>
            {pending && (
              <div className="import-confirm" role="alert">
                <p>
                  Replace this workspace with {pending.ideas.length} ideas,{" "}
                  {pending.entries.length} journal entries, and{" "}
                  {pending.memories.length} memories? Export a copy first if you
                  want to keep your current work.
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
                    Replace workspace
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

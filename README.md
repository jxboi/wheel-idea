# Orbit

A little chance. A great next idea. A mobile-first personal studio for deciding what to build, researching it, and keeping the sparks along the way.

## Run locally

Requires Node.js 22.12+ and npm.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5173. The app starts on **OpenRouter** with `deepseek/deepseek-v4.1-flash`. Spinning needs an OpenRouter key: paste one in Settings, or set `OPENROUTER_API_KEY` on the server (on Vercel, also set `ORBIT_ACCESS_TOKEN` and enter it in Settings as the workspace password). Without a key, a spin shows a recoverable error rather than an example. To explore without a key, choose **Offline preview** in Settings; it produces clearly labeled curated examples without an AI call, is not live research, and does not personalize results.

## Connect a model

Open **Settings**, choose a provider, enter its model ID, choose thinking effort, and save. Use “Model default” if a model does not accept reasoning controls.

| Provider     | How it works                             | Research                                                     |
| ------------ | ---------------------------------------- | ------------------------------------------------------------ |
| OpenRouter   | Chat completions, any supported model ID | `openrouter:web_search` server tool                          |
| OpenAI API   | Responses API                            | Native `web_search`, required tool use                       |
| Claude API   | Messages API                             | Native web search; adaptive thinking when effort is selected |
| Local Codex  | Installed, signed-in Codex CLI           | CLI live web search                                          |
| Local Claude | Installed, signed-in Claude CLI          | WebSearch-only tool access                                   |

API keys entered in Settings remain **in memory for this tab only**. They are sent via headers to your Orbit server, which forwards requests to the selected provider. They are never written to IndexedDB or exported. Do not use an untrusted deployment with your API key.

Alternatively, copy `.env.example` to `.env` and set `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, or `ANTHROPIC_API_KEY` on your server. No secret uses a `VITE_` prefix. Empty key input uses the matching server credential.

Search and reasoning capabilities depend on the model. Preset IDs are starting points, not an up-to-date catalog or a guarantee of availability. Provider errors are displayed without quietly substituting preview content. Sources are checked against the pages the provider’s search tool actually returned (Claude web search results and citations, OpenAI search sources and URL citations, OpenRouter URL citations). Each link is labeled “Found by search” or “Not confirmed by search”. An idea is **cited** only when at least one source matches, **unverified** when sources were listed but none matched, and **uncited** when there are none. Local CLIs don’t expose their search results, so their sources always show as unverified. A match means the page was retrieved, not that it supports the claim. A provider may decline or fail to search even when a tool is offered.

Cancelling a spin, or closing the tab, aborts the request, and the server then aborts the provider call or kills the local CLI. Claude web-search turns that pause mid-research are resumed up to three times before Orbit reports an error.

### Local Codex / Claude

Set `ORBIT_ENABLE_LOCAL_CLI=true` in `.env`, restart `npm run dev`, and choose the local provider. The CLI must already be installed and authenticated. No API key is needed in the UI. These integrations run on the same computer as the local development server and **do not run on Vercel**.

Codex runs ephemeral, in a temporary directory, with a read-only sandbox, shell tool disabled, and user configuration ignored. Claude is limited to WebSearch, with no session persistence or configured MCP servers. Both use argument arrays rather than a shell, have bounded output and a 110-second deadline, and remove their temporary directory. Local model and thinking settings are forwarded. Photos are currently supported by API providers only; local tools reject image-bearing context with an actionable message.

## Deploy to Vercel

Import this repository as a **Vite** project. `vercel.json` configures the build, SPA routing, and `/api/generate` Node function.

- Build command: `npm run build`
- Output directory: `dist`
- Node version: 22.x
- API timeout: 120 seconds (check your Vercel plan’s limits)
- Browser keys work without server environment credentials.
- If using server credentials, also set a strong `ORBIT_ACCESS_TOKEN` and enter it as the **Workspace password** in Settings. Server-funded requests on Vercel are rejected without it.
- Do not enable the local CLI setting on Vercel.

`npm run preview` serves static production files only; it does not run the API. Use `npm run dev` for the complete local app or Vercel for production.

The foundation is designed for a personal workspace. Before turning it into a shared hosted service, add individual authentication, per-user durable storage, shared rate limiting, and spending controls. The workspace password protects server-funded calls but is not a user account system.

## What is included

- An eight-category, cryptographically randomized spinner with exact visual landing, equal odds for enabled categories, readable labels, deceleration, reduced motion, and double-submit protection.
- Context controls: mood, time budget, provider, model, and thinking effort.
- Research-backed AI briefs with MVP features, sources, and a detailed editable Markdown build prompt.
- Idea library with search, category filters, saving, reactions, copy/download, and deletion.
- Feedback that becomes inspectable, editable memory. Forgetting a memory actually excludes that note from future requests.
- Journal entries with up to four compressed photos, explicit sharing controls, and unsaved-change protection.
- Local IndexedDB storage with one record per idea, entry, memory, and photo (photos are stored as binary). Each change writes only the records that changed. Also: versioned validation with explicit migrations, backup export/import (v1 backups are migrated on import), and visible storage errors.
- Wheel mood, time budget, categories, and an optional “don’t repeat the last category” setting are saved with the workspace.
- No analytics, trackers, stock imagery, or fabricated user history.

## Memory and privacy

Memory lives in **Settings → Memory**, next to the global toggle. Settings is a list of sections (AI model, Memory, Wheel, Backup & restore, Privacy), each on its own page.

With memory enabled, each connected spin receives up to 30 memory notes, 15 recent idea titles/categories/reactions (to avoid repetition), and the five most recently saved journal entries marked “Let this inspire future spins.” Up to two photos from those included entries are sent. Context is always complete JSON of at most 14,000 characters. Each section (memory notes, recent ideas, journal) has its own budget and is filled newest-first, so a long memory list can’t crowd out the journal. This is transparent context retrieval, not model training, embeddings, or a hidden profiling system. Explicit feedback is kept as memory, so editing or forgetting it controls what the model sees. Turning memory off excludes all personal context and photos. Offline examples do not use this context.

Everything persists in this browser on this device. There is no cloud sync. Backups include personal journal content and images, but not credentials. Back up before clearing browser storage. Imported backups replace the workspace only after review and confirmation. Use one active tab per workspace. Orbit warns when it is open in another tab, but it does not merge changes between tabs.

## Validate and extend

```sh
npm test
npm run build
npm run format:check
```

See [architecture](docs/ARCHITECTURE.md), [agent handoff](AGENTS.md), [design system](docs/design/DESIGN.md), and [QA evidence](docs/QA.md). Provider contract tests use mock transport. No paid live API call is part of the test suite.

Provider references used for the adapters: [OpenRouter web search](https://openrouter.ai/docs/guides/features/server-tools/web-search), [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search), [Claude web search](https://platform.claude.com/docs/en/agents-and-tools/tool-use/web-search-tool), and [Claude effort](https://platform.claude.com/docs/en/build-with-claude/effort).

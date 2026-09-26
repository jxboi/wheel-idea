# Architecture

## Boundaries

- `src/App.tsx`: composition, routing, persistence scheduling, and notifications. Secondary pages and the idea detail load lazily. Hash navigation supports browser back/forward without a router dependency.
- `src/features/generation/useGeneration.ts`: the spin lifecycle (category pick, animation, request, cancellation, stale-result guard).
- `src/features/generation/request.ts`: the `/api/generate` client. Reads the NDJSON progress stream and validates the final brief.
- `src/features/generation/activity.ts` and `ActivityPanel.tsx`: pure progress model (event folding, current step, partial-draft reading) and the live panel under the wheel.
- `src/lib/actions.ts`: pure workspace transitions. They keep untouched records by identity, which is what makes incremental writes possible.
- `src/pages/`: five independent product surfaces. Editing and selection stay in their owning view.
- `src/components/`: shell, native accessible dialog, wheel, icons, and idea detail.
- `shared/contract.js`: the wire contract (categories, settings, brief, request) shared by browser, API, and tests. Plain JS with JSDoc so Vercel’s Node runtime loads it unbundled.
- `src/lib/schema.ts`: Zod domain models built on the shared contract. No server credentials belong here.
- `src/lib/migrations.ts`: frozen older schemas and explicit upgrades. Backups and stored data both go through `parseWorkspace`.
- `src/lib/storage.ts` and `src/lib/writePlan.ts`: IndexedDB repository with per-record stores, a pure diff planner, one-time database-v1 migration, and the multi-tab lock. Replace this boundary to introduce a cloud repository.
- `src/lib/files.ts`: image compression and downloads.
- `src/lib/context.ts`: deterministic, opt-in memory retrieval with per-section budgets that always produce valid JSON. Keep it pure and testable.
- `src/lib/wheel.ts`: unbiased eight-category selection and landing geometry. Category subsets, including the optional no-repeat exclusion, use rejection sampling.
- `src/lib/preview.ts`: explicit offline examples, never a fallback for failed real requests.
- `server/prompt.js`: provider-independent brief instruction and contextual input.
- `server/providers.js`: streaming outbound API adapters, Claude `pause_turn` continuation (turns are rebuilt from stream events and sent back unchanged), and defensive result parsing. Never import into browser code.
- `server/stream.js`: server-sent event reader and the page filter applied before anything is shown as progress.
- `server/provenance.js`: extracts the pages each provider’s search actually returned and marks model-listed sources as verified or not.
- `server/local.js`: optional developer-local CLI adapters. `localCommand` is the single place argument arrays are built. Vercel explicitly refuses them.
- `api/generate.js`: HTTP boundary, validation, origin checks, credential routing, workspace-token guard, and abort-on-disconnect.

All server code is plain ESM JavaScript with explicit `.js` imports and `// @ts-check`. The tests import exactly the modules Vercel runs, and CI loads the handler under plain Node to confirm the import graph resolves.

- `server/dev.ts`: loopback-only Vite middleware server with the same API handler and a request body limit.

## Data flow

1. Choose an active category using cryptographic randomness, then calculate the matching final rotation.
2. Begin animation and AI request together. UI waits for both before presenting the result.
3. Build memory context from approved notes, idea reactions, and explicitly shared journal entries.
4. Send validated inputs to `/api/generate`. Credentials travel in headers, never JSON backups.
5. The selected adapter streams research and a structured brief. As it runs, the server forwards what the provider actually reports (search queries, pages returned, exposed reasoning, brief text) as NDJSON progress, and the wheel page shows it next to what the user shared. Nothing is simulated: a provider that reports nothing shows nothing but elapsed time. The last line is the validated brief or an error; the brief schema still rejects incomplete output and unsafe source protocols.
6. Store the idea locally, then show the dialog. A failed request leaves an actionable error; it does not invent a result.
7. Feedback creates an explicit memory record. Reactions remain in recent-idea context. Deleted ideas also remove related memory records.

Progress is opt-in per request (`Accept: application/x-ndjson`); other clients still get one JSON response. Errors raised before generation starts keep their HTTP status. Once streaming begins the status is 200, so failures arrive as a final `error` line with the key redacted. OpenAI refuses to stream some models for unverified organizations; that one error retries the same request without streaming, and progress is skipped.

Workspace writes are serialized to prevent older saves from overtaking newer ones, and each write is a single transaction containing only the records that differ from the last stored snapshot. Startup validation failures do not overwrite data. Storage failures remain visible and the current in-memory workspace can still be exported. Cancellation discards stale results and aborts the browser request. The API handler then aborts the provider request or kills the local CLI. A provider may still bill for work already done, so do not present cancellation as a billing guarantee.

## Data model and migrations

`Workspace v3 = settings + preferences + ideas + entries + memories`. v1 had no `preferences`, and its `cited` status meant only that the model listed sources, so the v1→v2 migration sets those ideas to `unverified`. v2→v3 changes the default provider from Offline preview to OpenRouter with `deepseek/deepseek-v4.1-flash`; only workspaces still on the untouched preview default (provider `preview`, no model) are moved, keeping their memory toggle. All timestamps are ISO strings, identities use UUIDs, and photos are compressed JPEGs. In memory and in backups they are data URLs. In IndexedDB (database version 2) they are Blobs in an `images` store, and entries keep only image ids and names. Existing backup schemas are explicit. Introduce migrations before changing a persisted field or bumping `version`; never silently clear a user’s journal on schema errors.

An `Idea` records its provider, model, effort, category, time budget, sources, editable prompt, reactions, and feedback. Research status is `preview`, `cited` (at least one source matches a page the provider’s search returned), `unverified` (sources listed, none matched), or `uncited`. The `verified` flag on a source is set only by the server, and `parseBrief` strips any value the model supplies. A match shows the page was retrieved, not that it supports the claim. API responses need all brief fields.

## Suggested next increments

1. Add a model capability catalog and searchable model picker with available effort levels per model. The current free-form ID supports custom/new models without redeploying.
2. Add authenticated cloud persistence behind a repository interface and object storage for photos, retaining local export and explicit AI-sharing semantics.
3. Stream local CLI progress (`claude --output-format stream-json`, Codex JSON events). API providers already stream.
4. Introduce semantic retrieval/summarization only after keeping provenance, deletion, and opt-out behavior correct.
5. Add a public-service rate limiter and per-user usage budgets before sharing server-funded generation widely.
6. Merge concurrent edits across tabs (currently detected and warned about, not merged).

## Deliberate constraints

No cloud accounts or sync yet. No embeddings/vector store. Source verification confirms a page was retrieved, not that it supports the claim. Local tools are text-only and development-only. No live model call was made during initial QA; transport behavior was validated with fixtures. Local CLIs are isolated from the project, but are installed programs using the developer’s existing account. Do not turn them into public execution endpoints.

## Testing

Unit/contract tests cover:

- wheel landing and selection odds
- memory exclusion, private journal omission, and context budgets
- valid previews, malformed AI replies, and source schemes
- backups and the v1 migration
- provider request bodies, `pause_turn` continuation, and source provenance for all three APIs, driven by SSE fixtures
- stream failures (mid-stream errors, truncation, early close), the NDJSON endpoint, the client reader, and the progress model
- abort-on-disconnect and HTTP security boundaries
- local CLI argument arrays
- IndexedDB migration, round-trips, and incremental writes (`fake-indexeddb`)
- a few jsdom component tests

jsdom is only for component logic; layout and dialogs are verified in a real browser at 390px and desktop. Add integration fixtures for any new provider and preserve the pure schema/context tests. CI (`.github/workflows/ci.yml`) runs format, tests, build, and a plain-Node import of the API handler.

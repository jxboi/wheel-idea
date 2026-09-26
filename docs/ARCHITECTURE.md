# Architecture

## Boundaries

- `src/App.tsx`: workspace orchestration, async generation lifecycle, routing, notifications, and composition. Hash navigation supports browser back/forward without a router dependency.
- `src/pages/`: five independent product surfaces. Editing and selection stay in their owning view.
- `src/components/`: shell, native accessible dialog, wheel, icons, and idea detail.
- `src/lib/schema.ts`: Zod domain models and wire contracts. No server credentials belong here.
- `src/lib/storage.ts`: IndexedDB repository, image compression, and downloads. Replace this boundary to introduce a cloud repository.
- `src/lib/context.ts`: deterministic, bounded, opt-in memory retrieval. Keep it pure and testable.
- `src/lib/wheel.ts`: unbiased eight-category selection and landing geometry. Category subsets use rejection sampling.
- `src/lib/preview.ts`: explicit offline examples, never a fallback for failed real requests.
- `server/prompt.ts`: provider-independent brief instruction and contextual input.
- `server/providers.ts`: outbound API adapters and defensive result parsing. Never import into browser code.
- `server/local.ts`: optional developer-local CLI adapters. Vercel explicitly refuses them.
- `api/generate.ts`: HTTP boundary, validation, origin checks, credential routing, and workspace-token guard.
- `server/dev.ts`: loopback-only Vite middleware server with the same API handler and a request body limit.

## Data flow

1. Choose an active category using cryptographic randomness, then calculate the matching final rotation.
2. Begin animation and AI request together. UI waits for both before presenting the result.
3. Build memory context from approved notes, idea reactions, and explicitly shared journal entries.
4. Send validated inputs to `/api/generate`. Credentials travel in headers, never JSON backups.
5. The selected adapter requests research and a structured brief. A schema rejects incomplete output and unsafe source protocols.
6. Store the idea locally, then show the dialog. A failed request leaves an actionable error; it does not invent a result.
7. Feedback creates an explicit memory record. Reactions remain in recent-idea context. Deleted ideas also remove related memory records.

Workspace writes are serialized to prevent older saves from overtaking newer ones. Startup validation failures do not overwrite data. Storage failures remain visible and the current in-memory workspace can still be exported. Cancellation discards stale results and aborts the browser request. Provider/server work may continue until its own timeout; do not present cancellation as a billing guarantee.

## Data model and migrations

`Workspace v1 = settings + ideas + entries + memories`. All timestamps are ISO strings, identities use UUIDs, and photos are compressed JPEG data URLs stored with entries. Existing backup schemas are explicit. Introduce migrations before changing a persisted field or bumping `version`; never silently clear a user’s journal on schema errors.

An `Idea` records its provider, model, effort, category, time budget, sources, editable prompt, reactions, and feedback. Research status is `preview`, `cited` (model supplied sources), or `uncited`; `cited` is not independent verification. API responses need all brief fields.

## Suggested next increments

1. Add a model capability catalog and searchable model picker with available effort levels per model. The current free-form ID supports custom/new models without redeploying.
2. Add authenticated cloud persistence behind a repository interface and object storage for photos, retaining local export and explicit AI-sharing semantics.
3. Add true streaming generation and provider tool-call provenance. Preserve cancellation and malformed-output handling.
4. Introduce semantic retrieval/summarization only after keeping provenance, deletion, and opt-out behavior correct.
5. Add a public-service rate limiter and per-user usage budgets before sharing server-funded generation widely.
6. Persist wheel categories/mood/time settings and handle cross-tab conflicts.

## Deliberate constraints

No cloud accounts or sync yet. No embeddings/vector store. No guaranteed source verification. Local tools are text-only and development-only. No live model call was made during initial QA; transport behavior was validated with fixtures. Local CLIs are isolated from the project, but are installed programs using the developer’s existing account. Do not turn them into public execution endpoints.

## Testing

Unit/contract tests cover wheel landing, memory exclusion, private journal omission, valid previews, malformed AI replies, source schemes, backups, provider request bodies, and HTTP security boundaries. Browser QA uses the Codex in-app browser, not a simulated DOM. Add integration fixtures for any new provider and preserve the pure schema/context tests.

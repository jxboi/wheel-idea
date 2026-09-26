# Working on Orbit

Read README.md, docs/ARCHITECTURE.md, and docs/design/DESIGN.md before changing the product.

- This is a React + Vite + TypeScript personal workspace. Keep the warm editorial design, functional SVG wheel, local fonts, and mobile bottom navigation.
- Use `npm run dev` for both UI and API. `vite preview` alone has no generation API.
- Keep provider integrations server-side. Never put credentials in `VITE_*`, persistent browser storage, logs, or exports.
- Preserve versioned Zod schemas and introduce explicit migrations for persistent data changes.
- Never substitute offline examples for failed live AI requests. Label research provenance honestly.
- Personal context must respect both the global memory toggle and each journal entry’s sharing setting. Forgetting memory must exclude it from future prompts.
- Local CLI providers must remain disabled on Vercel and opt-in locally. Never add shell interpolation or broad agent tool permissions.
- Extend feature modules rather than collecting every behavior in App.tsx. Keep storage, context retrieval, wheel math, and provider adapters independently testable.
- Run `npm test`, `npm run build`, and `npm run format:check` for substantive changes. Verify affected flows at 390px and desktop in a real browser.
- API tests use fixtures. A green test suite does not mean live provider credentials, quotas, tool permissions, or model availability were verified.
- Keep QA data out of the delivered workspace. Preserve the user’s real data.

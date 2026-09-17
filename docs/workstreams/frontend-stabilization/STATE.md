# Workstream State — frontend stabilization

Workstream: frontend_stabilization
Workstream-State: current
Date: 2026-09-17
Branch: `claude/github-connection-q4t7zr`
Pull Request: none yet (branch is pushed, no PR opened)

## Why this file exists

This branch carried 13 unmerged commits of frontend/tax-engine work done on
2026-08-27 that were never registered anywhere in the machine state layer: not
in `ACTIVE_WORK.json`, not in any `docs/workstreams/` entry, and with no PR. It
was invisible to `npm run resume`, which is exactly the failure mode Resume Gate
v1.3 exists to prevent. Registering it now.

Main has since merged Project Ready Guard and Resume Gate v1.3; that
infrastructure was merged into this branch in `6f2285d` so the branch is current
with main and passes the gate.

## Durable work already present on this branch

All of the following is committed and pushed. It is **not** in `main` and must
not be reconstructed from memory.

- **Prettier** (`ac64fa5`) — `.prettierrc.json` / `.prettierignore`, `src/**`
  (excluding shadcn `components/ui/**`) and `server/**` formatted;
  `format` / `format:check` scripts; `format:check` wired into both
  `ci.yml` and `deploy-pages.yml`.
- **Tax rules resolved by year** (`ec563d7`) — replaced the hardcoded
  `TAX_2026` object with a `TAX_RULES_BY_YEAR` registry + `resolveTaxRules(year)`.
  A year with no registered rules no longer silently misapplies stale
  constants: it falls back to the latest known year *and* pushes a visible
  warning note. `TAX_2026` kept as a backward-compatible alias. No figures for
  2027+ were invented — only the seam and the honest fallback.
  - Fixed a real latent bug found by this change: `quarterlyAdvances(store,
    ops, year)` already accepted a year (the UI has a year selector) but never
    forwarded it to `calcTax`, so quarterly advances were always computed with
    the current hardcoded rules regardless of the selected year.
- **Marketplace credential encryption at rest** (`c6792b8`) —
  `src/lib/secretCrypto.ts`: PBKDF2 → AES-GCM 256 via WebCrypto. Opt-in; the
  passphrase is never persisted and the derived key lives only in tab memory.
  `saveState` became async and serialized (a queue) so fast successive edits
  can't finish encrypting out of order and clobber a newer write.
  `ApiCredential.secret?` / `AppState.credentialsSalt?` are both optional, so
  existing plaintext installs keep working until a user opts in.
  Deliberately does **not** defend against live XSS while unlocked — it closes
  passive reads of the stored value (DevTools, an extension enumerating
  storage, profile access, an old unencrypted export).
- **Test coverage** — 0 → 45 tests across `tax.test.ts`,
  `organizationTax.test.ts`, `secretCrypto.test.ts`, `storage.test.ts`,
  `taxCalendar.test.ts` (`ec563d7`, `c6792b8`, `9769918`). Covers the 2026 tax
  engine, the year-fallback behavior, credential crypto round-trips and the
  save-queue ordering guarantee, and the obligations calendar (deadline
  statuses, payment settlement, cumulative USN quarterly advances, patent
  installments, summary aggregation).
- **Code-splitting** (`a2ad4b1`) — all six sections behind `React.lazy()` +
  one `Suspense`; `xlsx` (the heaviest dependency) moved to a dynamic
  `import()` inside `parseReportFile`. Killed the "chunk larger than 500 kB"
  warning that had been in every build: largest initial chunk went 823 kB →
  312 kB, with `xlsx` as a separate 429 kB chunk most sessions never fetch.
  Verified by actually driving the built app in headless Chromium through all
  six nav sections, not just by reading build output.
- **A false-positive finding, investigated and closed** (`72fb021`) — the
  "insurance only for IP" gate in `buildTaxCalendar` reads `store.legalForm`
  rather than `organization.legalForm`. This was initially flagged as a bug;
  deeper inspection showed `organization.legalForm` is write-once at creation
  and never editable, while `store.legalForm` is what the user actually edits
  in Settings and what `tax.ts`'s OSNO calculation already keys off. "Fixing"
  it would have been a regression. No code changed; the misleading comment in
  the test was corrected so this isn't re-flagged.
- **Resume Gate v1.3 merged in** (`6f2285d`) — see the commit for how the
  `package.json` and `README.md` conflicts were resolved.

## Verification status

Green on this branch head as of 2026-09-17: `npx tsc -b --noEmit`,
`npm run lint`, `npm run format:check`, `npm test` (45/45),
`npm run resume` → `RESUME_VERDICT=PASS`.

GitHub Actions CI has **never** run on this branch: the workflows trigger on
`pull_request` or `push` to `main`, and no PR was ever opened. All verification
above is local only.

## Current blocker

No technical blocker. The open question is a product/ownership decision, not an
engineering one:

This branch improves the **client-only localStorage MVP**. PR #3 restores the
**real multi-tenant PostgreSQL backend** that already runs on Hetzner. These are
two different architectures for the same product, and nobody has decided how
they converge. Merging this branch is safe in isolation (it touches no backend
and no production surface), but it invests further in the localStorage path that
PR #3 is designed to replace.

## ONE NEXT ACTION

Decide with the project owner whether this branch merges to `main` as-is
(improving the MVP frontend while the PR #3 backend lands separately), or
whether it should be rebased/re-scoped once the PR #3 backend is the real data
source. Do not open a PR or merge without that decision.

If the answer is "merge it": open a PR from `claude/github-connection-q4t7zr`
to `main`, let CI run for the first time, and merge only on green.

## Safety / stop condition

- this branch touches **no** production surface: no Hetzner, no PostgreSQL, no
  `server/production/`, no DNS/Caddy/UFW, no deployment config;
- do not merge this branch into PR #3's recovery branch or vice versa — they are
  separate workstreams with separate gates;
- credential encryption is opt-in by design; do not silently force-migrate
  existing users' stored keys;
- the passphrase is unrecoverable by design — losing it means the stored
  credentials are unreadable and must be re-entered.

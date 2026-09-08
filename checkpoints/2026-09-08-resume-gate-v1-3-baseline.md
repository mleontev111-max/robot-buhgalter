# Checkpoint — Resume Gate v1.3 rollout baseline

Date: 2026-09-08
Track: project_ready
Checkpoint-Role: latest
Cross-Track-Current-State: externalized
Status: ROLLOUT CANDIDATE
Main baseline: `fcadd123d07b54c091079a25326f48eeb574affc`

## Scope

This checkpoint records only the Resume Gate / continuity rollout for Robot-Buhgalter. Mutable product state is intentionally externalized to `PROJECT_STATE.json`, `ACTIVE_WORK.json`, `CHECKPOINT_INDEX.json`, the product checkpoint, and registered workstream state.

Resume Gate v1.3 adds:

- mandatory root `START_HERE_FOR_AI.md` before any project answer/plan/action;
- `PROJECT_STATE.json` for merged-main tracks;
- `ACTIVE_WORK.json` for important unmerged PR/branch work;
- `MILESTONE_INDEX.json` / `docs/WORK_DONE_INDEX.md` for “already done?” lookup;
- `npm run resume` / `tools/project_resume.py`;
- `tools/resume_guard.py` in Project Ready CI;
- hard stop when continuity is red even if ordinary CI is green.

## Registered WIP

Draft PR #3 / `recovery/production-backend-2026-08-27` is registered as `production_backend_recovery` in `ACTIVE_WORK.json`.

The current product continuation is not duplicated here; read the current machine state and product checkpoint instead.

## ONE NEXT ACTION

Verify this rollout PR with Project Ready Guard + ordinary CI on its exact head and merge only on PASS. After merge, synchronize Resume Gate v1.3 into PR #3, create or refresh `docs/workstreams/production-backend-recovery/STATE.md` on the exact current PR head, make the exact-head continuity guard green, and then run a clean-room resume test.

## Stop condition

Do not resume production-backend feature/deployment work while the relevant Project Ready/Resume Guard is red, the registered WIP state file is absent/stale, or exact PR head evidence is ambiguous.

## Safety

This rollout is Git documentation/state/validation only. It does not authorize production server changes, PostgreSQL writes, marketplace API writes, secret changes, DNS/Caddy/UFW changes, or deployment.

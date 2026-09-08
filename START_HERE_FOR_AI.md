# START HERE FOR AI — MANDATORY RESUME GATE

Resume-System-Version: 1.3

This is the first file for every AI/helper session in this repository.

The rule applies before **any project answer, plan, status summary, task choice, code review, code change, data operation, deployment suggestion, or proposal to redo prior work**. It is not limited to write operations.

## Mandatory preflight

1. Establish the exact Git context; fetch `origin` before trusting local refs.
2. Read `PROJECT_STATE.json` — canonical merged-main state.
3. Read `ACTIVE_WORK.json` — important unmerged PR/branch work.
4. Read `CHECKPOINT_INDEX.json` — canonical checkpoint pointers.
5. Run `python3 tools/project_resume.py` (or `npm run resume`).
6. If the user names a PR/branch/workstream, select it from `ACTIVE_WORK.json`; otherwise use `PROJECT_STATE.json.default_resume_track` unless the user explicitly selects another track.
7. Read the selected current source/checkpoint and its safety boundaries.
8. For “didn’t we already do this?” questions, inspect `MILESTONE_INDEX.json` / `docs/WORK_DONE_INDEX.md` before proposing reconstruction.

## Hard stop rules

STOP and report BLOCKER/DRIFT before continuing if:

- the resume command reports `RESUME_VERDICT=BLOCKER`;
- Project Ready Guard is red on the exact relevant head;
- a registered WIP branch has no current workstream state file;
- meaningful scoped work exists after its registered state file;
- `PROJECT_STATE.json`, `ACTIVE_WORK.json`, `CHECKPOINT_INDEX.json`, or the selected current source contradict one another;
- required private GitHub/server access is unavailable.

Do **not** continue feature work merely because ordinary CI is green when the continuity/resume guard is red.

## Source hierarchy

1. exact GitHub branch/PR/main refs;
2. `PROJECT_STATE.json` for merged-main tracks;
3. `ACTIVE_WORK.json` for unmerged workstreams;
4. `CHECKPOINT_INDEX.json` + selected current source/checkpoint;
5. `MILESTONE_INDEX.json` / historical checkpoints as evidence;
6. chat history only as a hint that must be verified.

`PROJECT_STATUS.md`, README narratives and arbitrary newest filenames are not allowed to override the machine current-state layer.

## Session handoff

Before ending meaningful work, update the correct durable source. Main work gets a dated checkpoint + state/index update. Unmerged PR/branch work gets a current `docs/workstreams/<workstream>/STATE.md` and matching `ACTIVE_WORK.json` entry. Important work is not handed off if it exists only in chat/local files or after a stale state file.
#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]


def load_json(name: str) -> dict[str, Any]:
    try:
        value = json.loads((ROOT / name).read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"[BLOCKER] cannot read {name}: {exc}")
        return {}
    return value if isinstance(value, dict) else {}


def git(*args: str) -> str:
    try:
        p = subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True, check=False)
    except OSError:
        return ""
    return p.stdout.strip() if p.returncode == 0 else ""


def branch() -> str:
    env = os.environ.get("PROJECT_RESUME_HEAD_REF", "").strip()
    return env.removeprefix("refs/heads/") if env else (git("branch", "--show-current") or "DETACHED")


def head() -> str:
    return os.environ.get("PROJECT_RESUME_HEAD_SHA", "").strip() or git("rev-parse", "HEAD") or "UNKNOWN"


def workstream_errors(name: str, ws: dict[str, Any], target: str) -> list[str]:
    errors: list[str] = []
    rel = ws.get("state_file")
    if not isinstance(rel, str) or not rel:
        return [f"{name}: state_file missing"]
    path = ROOT / rel
    if not path.is_file():
        return [f"{name}: state file missing on this branch: {rel}"]
    text = path.read_text(encoding="utf-8")
    for marker in (f"Workstream: {name}", "Workstream-State: current", "ONE NEXT ACTION"):
        if marker not in text:
            errors.append(f"{name}: state file missing marker {marker!r}")
    state_commit = git("log", "-1", "--format=%H", "--", rel)
    scopes = ws.get("scope_paths")
    if not re.fullmatch(r"[0-9a-f]{40}", state_commit) or not isinstance(scopes, list) or not scopes:
        return errors + [f"{name}: cannot evaluate state freshness"]
    target_ref = target if re.fullmatch(r"[0-9a-f]{40}", target) else "HEAD"
    changed = git("diff", "--name-only", f"{state_commit}..{target_ref}", "--", *[str(v) for v in scopes])
    stale = [x for x in changed.splitlines() if x.strip() and x.strip() != rel]
    if stale:
        errors.append(f"{name}: STATE stale after scoped changes: " + ", ".join(stale[:12]))
    return errors


def main() -> int:
    state = load_json("PROJECT_STATE.json")
    active = load_json("ACTIVE_WORK.json")
    index = load_json("CHECKPOINT_INDEX.json")
    milestones = load_json("MILESTONE_INDEX.json")
    b = branch(); h = head()
    print(f"=== PROJECT RESUME: {state.get('project','UNKNOWN')} ===")
    print(f"CHECKOUT_BRANCH={b}")
    print(f"CHECKOUT_HEAD={h}")
    print(f"ORIGIN_MAIN={git('rev-parse','origin/main') or 'UNAVAILABLE (run git fetch --prune origin)'}")
    print(f"DEFAULT_RESUME_TRACK={state.get('default_resume_track','UNKNOWN')}")
    print(f"CURRENT_FOCUS_TRACK={state.get('current_focus_track','UNKNOWN')}")
    blockers: list[str] = []

    tracks = state.get("tracks", {})
    idx = index.get("tracks", {})
    print("\n[MAIN TRACKS]")
    if isinstance(tracks, dict):
        for name, item in tracks.items():
            if not isinstance(item, dict): continue
            print(f"- {name}: {item.get('status')} | checkpoint={item.get('latest_checkpoint')}")
            if item.get("one_next_action"): print(f"  NEXT: {item.get('one_next_action')}")
            ix = idx.get(name, {}) if isinstance(idx, dict) else {}
            if not isinstance(ix, dict) or ix.get("latest_checkpoint") != item.get("latest_checkpoint"):
                blockers.append(f"track {name}: PROJECT_STATE/CHECKPOINT_INDEX mismatch")

    print("\n[UNMERGED / ACTIVE WORK]")
    workstreams = active.get("workstreams", {})
    if isinstance(workstreams, dict):
        for name, ws in workstreams.items():
            if not isinstance(ws, dict): continue
            print(f"- {name}: {ws.get('status')} | branch={ws.get('branch')} | PR=#{ws.get('pull_request')}")
            print(f"  NEXT: {ws.get('one_next_action')}")
            if ws.get("blocker"): print(f"  NOTE: {ws.get('blocker')}")
            if ws.get("branch") == b:
                blockers.extend(workstream_errors(name, ws, h))

    print("\n[RECENT DURABLE MILESTONES]")
    vals = milestones.get("milestones", [])
    if isinstance(vals, list):
        for item in vals[-8:]:
            if isinstance(item, dict): print(f"- [{item.get('integration_state','?')}] {item.get('summary',item.get('id'))}")

    if not (ROOT / "START_HERE_FOR_AI.md").is_file(): blockers.append("START_HERE_FOR_AI.md missing")
    if blockers:
        print("\n[BLOCKERS]")
        for x in blockers: print(f"- {x}")
        print("RESUME_VERDICT=BLOCKER")
        return 2
    print("\nRESUME_VERDICT=PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())

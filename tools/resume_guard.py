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
REQUIRED = (
    "START_HERE_FOR_AI.md", "AGENTS.md", "CLAUDE.md", "PROJECT_READY.json",
    "PROJECT_STATE.json", "CHECKPOINT_INDEX.json", "ACTIVE_WORK.json",
    "MILESTONE_INDEX.json", "docs/WORK_DONE_INDEX.md", "tools/project_resume.py"
)


def load(name: str, errors: list[str]) -> dict[str, Any]:
    p = ROOT / name
    if not p.is_file(): errors.append(f"missing {name}"); return {}
    try: v = json.loads(p.read_text(encoding="utf-8"))
    except Exception as exc: errors.append(f"invalid {name}: {exc}"); return {}
    if not isinstance(v, dict): errors.append(f"{name} must be object"); return {}
    return v


def git(*args: str) -> str:
    try: p = subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True, check=False)
    except OSError: return ""
    return p.stdout.strip() if p.returncode == 0 else ""


def validate_branch(name: str, ws: dict[str, Any], target: str, errors: list[str]) -> None:
    rel = ws.get("state_file")
    if not isinstance(rel, str) or not rel: errors.append(f"{name}: state_file required"); return
    p = ROOT / rel
    if not p.is_file(): errors.append(f"{name}: state file missing on branch: {rel}"); return
    text = p.read_text(encoding="utf-8")
    for marker in (f"Workstream: {name}", "Workstream-State: current", "ONE NEXT ACTION"):
        if marker not in text: errors.append(f"{name}: state missing marker {marker!r}")
    state_commit = git("log", "-1", "--format=%H", "--", rel)
    scopes = ws.get("scope_paths")
    if not re.fullmatch(r"[0-9a-f]{40}", state_commit): errors.append(f"{name}: cannot resolve state commit"); return
    if not isinstance(scopes, list) or not scopes: errors.append(f"{name}: scope_paths required"); return
    target_ref = target if re.fullmatch(r"[0-9a-f]{40}", target) else "HEAD"
    changed = git("diff", "--name-only", f"{state_commit}..{target_ref}", "--", *[str(x) for x in scopes])
    stale = [x for x in changed.splitlines() if x.strip() and x.strip() != rel]
    if stale: errors.append(f"{name}: STATE stale; scoped files changed after state: " + ", ".join(stale[:12]))


def main() -> int:
    errors: list[str] = []
    for rel in REQUIRED:
        if not (ROOT / rel).is_file(): errors.append(f"required resume file missing: {rel}")

    start = (ROOT / "START_HERE_FOR_AI.md")
    if start.is_file():
        t = start.read_text(encoding="utf-8").casefold()
        for marker in ("resume-system-version: 1.3", "before **any project answer", "active_work.json", "resume_verdict=blocker", "do **not** continue feature work"):
            if marker.casefold() not in t: errors.append(f"START_HERE_FOR_AI missing marker {marker!r}")

    agents = ROOT / "AGENTS.md"
    if agents.is_file():
        t = agents.read_text(encoding="utf-8").casefold()
        if "start_here_for_ai.md" not in t or "before any" not in t: errors.append("AGENTS must require root resume gate before any answer/plan/action")
    claude = ROOT / "CLAUDE.md"
    if claude.is_file() and "START_HERE_FOR_AI.md" not in claude.read_text(encoding="utf-8"):
        errors.append("CLAUDE.md must route through START_HERE_FOR_AI.md")

    ready = load("PROJECT_READY.json", errors); state = load("PROJECT_STATE.json", errors)
    index = load("CHECKPOINT_INDEX.json", errors); active = load("ACTIVE_WORK.json", errors); milestones = load("MILESTONE_INDEX.json", errors)

    if ready:
        if ready.get("entrypoint") != "START_HERE_FOR_AI.md": errors.append("PROJECT_READY entrypoint must be START_HERE_FOR_AI.md")
        if ready.get("status_file") != "PROJECT_STATE.json": errors.append("PROJECT_READY status_file must be PROJECT_STATE.json")
        qs = ready.get("questions", {})
        for q in ("current_state", "next_action"):
            spec = qs.get(q) if isinstance(qs, dict) else None
            if not isinstance(spec, dict) or spec.get("source") != "PROJECT_STATE.json": errors.append(f"PROJECT_READY {q} must source PROJECT_STATE.json")

    if state:
        if state.get("resume_system_version") != "1.3": errors.append("PROJECT_STATE resume_system_version must be 1.3")
        if state.get("active_work_registry") != "ACTIVE_WORK.json": errors.append("PROJECT_STATE active_work_registry mismatch")
        if state.get("milestone_index") != "MILESTONE_INDEX.json": errors.append("PROJECT_STATE milestone_index mismatch")
        tracks = state.get("tracks", {}); idx = index.get("tracks", {}) if isinstance(index, dict) else {}
        if state.get("default_resume_track") not in tracks: errors.append("default_resume_track must exist")
        if isinstance(tracks, dict):
            for name, item in tracks.items():
                ix = idx.get(name, {}) if isinstance(idx, dict) else {}
                if not isinstance(item, dict) or not isinstance(ix, dict) or item.get("latest_checkpoint") != ix.get("latest_checkpoint"):
                    errors.append(f"track {name}: PROJECT_STATE/CHECKPOINT_INDEX mismatch")

    workstreams = active.get("workstreams", {}) if active else {}
    if active and active.get("resume_system_version") != "1.3": errors.append("ACTIVE_WORK resume_system_version must be 1.3")
    if not isinstance(workstreams, dict): errors.append("ACTIVE_WORK workstreams must be object"); workstreams = {}
    for name, ws in workstreams.items():
        if not isinstance(ws, dict): errors.append(f"{name}: workstream must be object"); continue
        for f in ("status", "branch", "pull_request", "state_file", "scope_paths", "one_next_action"):
            if f not in ws: errors.append(f"{name}: missing {f}")

    if milestones and (milestones.get("resume_system_version") != "1.3" or not isinstance(milestones.get("milestones"), list)):
        errors.append("MILESTONE_INDEX invalid v1.3 shape")

    package = ROOT / "package.json"
    if package.is_file():
        try: pkg = json.loads(package.read_text(encoding="utf-8"))
        except Exception as exc: errors.append(f"invalid package.json: {exc}")
        else:
            if pkg.get("scripts", {}).get("resume") != "python3 tools/project_resume.py": errors.append("package.json must expose resume script")

    branch = os.environ.get("PROJECT_RESUME_HEAD_REF", "").strip().removeprefix("refs/heads/")
    head = os.environ.get("PROJECT_RESUME_HEAD_SHA", "").strip()
    if branch:
        for name, ws in workstreams.items():
            if isinstance(ws, dict) and ws.get("branch") == branch: validate_branch(name, ws, head, errors)

    if errors:
        for e in errors: print(f"[FAIL] {e}")
        print(f"RESUME_GATE_ERRORS={len(errors)}")
        print("RESUME_GATE_VERDICT=BLOCKER")
        return 1
    print("RESUME_GATE_VERDICT=PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())

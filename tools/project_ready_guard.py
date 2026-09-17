#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path

QUESTION_ORDER = [
    "project",
    "current_state",
    "local_services",
    "remote_services",
    "data",
    "secrets",
    "start",
    "verify",
    "must_not_change",
    "next_action",
]

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "PROJECT_READY.json"


def main() -> int:
    errors: list[str] = []
    passed = 0

    if not MANIFEST_PATH.is_file():
        print("[FAIL] PROJECT_READY.json is missing")
        return 1

    try:
        manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"[FAIL] cannot parse PROJECT_READY.json: {exc}")
        return 1

    for field in ("standard_version", "project", "entrypoint", "status_file", "agent_protocol", "questions"):
        if field not in manifest:
            errors.append(f"manifest field missing: {field}")

    if manifest.get("standard_version") != "1.0":
        errors.append("standard_version must be 1.0")

    for field in ("entrypoint", "status_file", "agent_protocol"):
        value = manifest.get(field)
        if isinstance(value, str) and not (ROOT / value).is_file():
            errors.append(f"referenced {field} does not exist: {value}")

    questions = manifest.get("questions")
    if not isinstance(questions, dict):
        errors.append("questions must be an object")
        questions = {}

    for name in QUESTION_ORDER:
        spec = questions.get(name)
        if not isinstance(spec, dict):
            print(f"[FAIL] {name}: manifest question is missing")
            continue
        source = spec.get("source")
        marker = spec.get("contains")
        if not isinstance(source, str) or not source:
            print(f"[FAIL] {name}: source is missing")
            continue
        if not isinstance(marker, str) or not marker:
            print(f"[FAIL] {name}: contains marker is missing")
            continue
        path = ROOT / source
        if not path.is_file():
            print(f"[FAIL] {name}: source file not found: {source}")
            continue
        text = path.read_text(encoding="utf-8")
        if marker.casefold() not in text.casefold():
            print(f"[FAIL] {name}: marker not found in {source}: {marker!r}")
            continue
        print(f"[PASS] {name}: {source}")
        passed += 1

    for error in errors:
        print(f"[FAIL] manifest: {error}")

    print(f"PROJECT_READY_SCORE={passed}/10")
    if errors or passed != len(QUESTION_ORDER):
        return 1
    print("PROJECT_READY_VERDICT=PASS")
    return 0


if __name__ == "__main__":
    sys.exit(main())

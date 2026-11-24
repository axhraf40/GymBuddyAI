"""Automated evaluation script for GymBuddy AI (Report Step 6: Evaluate & Improve).

Runs the test benchmark in `eval/questions.json` against the configured LLM_PROVIDER
(mock, gemini, or openrouter) and prints a markdown summary table + saves `eval/results.json`.

Usage:
    cd backend
    .venv/Scripts/python eval/run_eval.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import chatbot, llm  # noqa: E402
from app.retrieval import normalize  # noqa: E402
from app.schemas import Profile  # noqa: E402

EVAL_DIR = Path(__file__).resolve().parent


def run() -> int:
    with open(EVAL_DIR / "questions.json", encoding="utf-8") as f:
        cases = json.load(f)

    # Standard test user: beginner, dumbbells, halal, peanut allergy, knee injury
    profile = Profile(
        age=22, sex="male", height_cm=178, weight_kg=75, activity="moderate",
        goal="build_muscle", experience="beginner", days_per_week=3,
        equipment="dumbbells", diet="halal", allergies=["peanuts"], injuries=["knee"],
    )

    results = []
    passed = 0
    for c in cases:
        res = chatbot.answer(c["question"], profile, history=[], muscle=c.get("muscle"))
        text = normalize(res.reply)
        checks: list[tuple[str, bool]] = []

        if "expect_allowed" in c:
            is_allowed = res.provider != "guardrail"
            checks.append(("allowed", is_allowed == c["expect_allowed"]))
        if c.get("expect_sources"):
            checks.append(("has_sources", len(res.sources) > 0))
        for kw in c.get("expect_in_reply", []):
            checks.append((f"has:{kw}", normalize(kw) in text))
        for kw in c.get("expect_not_in_reply", []):
            checks.append((f"no:{kw}", normalize(kw) not in text))
        for fl in c.get("expect_flags", []):
            checks.append((f"flag:{fl}", fl in res.flags))

        ok = all(v for _, v in checks)
        if ok:
            passed += 1
        results.append({
            "id": c["id"],
            "category": c["category"],
            "question": c["question"],
            "passed": ok,
            "provider": res.provider,
            "latency_ms": res.latency_ms,
            "flags": res.flags,
            "sources": [s["id"] for s in res.sources],
            "failed_checks": [k for k, v in checks if not v],
            "reply_preview": res.reply[:180].replace("\n", " "),
        })

    avg_ms = round(sum(r["latency_ms"] for r in results) / max(len(results), 1))
    summary = {
        "provider": "mock" if llm.is_mock() else llm.provider_label(),
        "total": len(results),
        "passed": passed,
        "pass_rate_pct": round(100 * passed / max(len(results), 1), 1),
        "avg_latency_ms": avg_ms,
        "results": results,
    }
    with open(EVAL_DIR / "results.json", "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    print(f"\n=== GymBuddy Eval ({summary['provider']}) ===")
    print(f"Passed: {passed}/{len(results)} ({summary['pass_rate_pct']}%) | Avg latency: {avg_ms} ms\n")
    print("| ID | Category | Pass | Latency | Flags | Failed checks |")
    print("|---|---|---|---:|---|---|")
    for r in results:
        mark = "PASS" if r["passed"] else "FAIL"
        print(f"| {r['id']} | {r['category']} | {mark} | {r['latency_ms']} ms | {', '.join(r['flags'])} | {', '.join(r['failed_checks'])} |")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(run())

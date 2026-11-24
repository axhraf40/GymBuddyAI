"""Enrich backend/app/data/exercises.json with real animated GIFs, thumbnails, and
step-by-step EN/FR instructions from https://github.com/hasaneyldrm/exercises-dataset.

Run once:
    cd backend
    .venv/Scripts/python scripts/enrich_exercises.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import httpx

DATA_URL = "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/data/exercises.json"
RAW_BASE = "https://raw.githubusercontent.com/hasaneyldrm/exercises-dataset/main/"
EXERCISES_PATH = Path(__file__).resolve().parent.parent / "app" / "data" / "exercises.json"

# Manual high-accuracy keyword hints for exercises whose names differ slightly in the dataset
SEARCH_HINTS: dict[str, str] = {
    "bench_press": "barbell bench press",
    "db_bench_press": "dumbbell bench press",
    "incline_db_press": "dumbbell incline bench press",
    "push_up": "push-up",
    "cable_fly": "cable standing fly",
    "overhead_press": "barbell standing overhead press",
    "db_shoulder_press": "dumbbell seated shoulder press",
    "lateral_raise": "dumbbell lateral raise",
    "face_pull": "cable rear delt row",
    "pike_push_up": "pike push",
    "barbell_curl": "barbell curl",
    "db_curl": "dumbbell biceps curl",
    "hammer_curl": "dumbbell hammer curl",
    "chin_up": "chin-up",
    "triceps_pushdown": "cable pushdown",
    "overhead_triceps_ext": "dumbbell standing triceps extension",
    "bench_dip": "bench dip",
    "close_grip_push_up": "diamond push-up",
    "farmer_carry": "farmers walk",
    "wrist_curl": "dumbbell palms up wrist curl",
    "dead_hang": "pull-up",
    "plank": "front plank",
    "crunch": "crunch floor",
    "hanging_leg_raise": "hanging leg raise",
    "cable_crunch": "cable kneeling crunch",
    "russian_twist": "russian twist",
    "side_plank": "side plank",
    "pallof_press": "cable pallof",
    "back_squat": "barbell full squat",
    "goblet_squat": "dumbbell goblet squat",
    "leg_press": "sled 45° leg press",
    "bulgarian_split_squat": "split squat",
    "bodyweight_squat": "bodyweight squat",
    "sumo_squat": "dumbbell sumo squat",
    "copenhagen_plank": "side plank",
    "adductor_machine": "lever seated hip adduction",
    "standing_calf_raise": "standing calf raise",
    "seated_calf_raise": "seated calf raise",
    "shrug": "dumbbell shrug",
    "upright_row": "dumbbell upright row",
    "pull_up": "pull-up",
    "lat_pulldown": "cable pulldown",
    "barbell_row": "barbell bent over row",
    "one_arm_db_row": "dumbbell bent over row",
    "inverted_row": "inverted row",
    "back_extension": "hyperextension",
    "bird_dog": "superman",
    "deadlift": "barbell deadlift",
    "hip_thrust": "barbell hip thrust",
    "glute_bridge": "glute bridge",
    "walking_lunge": "dumbbell lunge",
    "romanian_deadlift": "barbell romanian deadlift",
    "leg_curl": "lever lying leg curl",
    "nordic_curl": "glute-ham raise",
    "single_leg_rdl": "dumbbell single leg deadlift",
}


def tokens(s: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", s.lower()))


def best_match(hint: str, dataset: list[dict]) -> dict | None:
    h_low = hint.lower()
    h_toks = tokens(hint)
    best = None
    best_score = 0.0
    for item in dataset:
        name = item["name"].lower()
        if name == h_low:
            return item
        n_toks = tokens(name)
        if not n_toks:
            continue
        overlap = len(h_toks & n_toks)
        if overlap == 0:
            continue
        score = overlap / (len(h_toks) + 0.3 * len(n_toks - h_toks))
        if h_low in name:
            score += 0.5
        if score > best_score:
            best_score = score
            best = item
    return best if best_score >= 0.4 else None


def main() -> None:
    print("Downloading exercises-dataset JSON...")
    r = httpx.get(DATA_URL, timeout=60, follow_redirects=True)
    r.raise_for_status()
    dataset: list[dict] = r.json()
    print(f"Loaded {len(dataset)} exercises from hasaneyldrm/exercises-dataset.")

    with open(EXERCISES_PATH, encoding="utf-8") as f:
        ours: list[dict] = json.load(f)

    matched = 0
    for ex in ours:
        hint = SEARCH_HINTS.get(ex["id"], ex["name"])
        m = best_match(hint, dataset)
        if m:
            matched += 1
            ex["image_url"] = RAW_BASE + m["image"]
            ex["gif_url"] = RAW_BASE + m["gif_url"]
            ex["dataset_name"] = m["name"]
            ex["steps_en"] = m.get("instruction_steps", {}).get("en", [])[:5]
            ex["steps_fr"] = m.get("instruction_steps", {}).get("fr", [])[:5]
        else:
            ex.setdefault("image_url", "")
            ex.setdefault("gif_url", "")
            print(f"  [no match] {ex['id']} ({ex['name']})")

    with open(EXERCISES_PATH, "w", encoding="utf-8") as f:
        json.dump(ours, f, indent=2, ensure_ascii=False)

    print(f"Done! Matched {matched}/{len(ours)} exercises with real GIFs & thumbnails.")


if __name__ == "__main__":
    main()

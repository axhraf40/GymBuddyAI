"""Knowledge base loading + BM25 retrieval (the "R" of RAG).

Why BM25 and not embeddings? The corpus is small (~150 curated documents), BM25 is
free, fast, deterministic and easy to explain/debug. The selected muscle and the
user's equipment are used to boost/filter results.
"""
from __future__ import annotations

import json
import math
import re
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent / "data"

STOPWORDS = set(
    """a an the and or but of to in on for with at by from is are was were be been am do does did
    i me my you your it its this that these those what which who how when where why can could should
    would will shall may might must have has had not no so if than then too very just about into over
    some any all more most much many give tell please want need get best good make
    le la les un une des de du et ou en au aux pour avec sur dans par est sont je tu il elle mon ma mes
    ton ta tes quel quelle quels quelles comment quoi que qui faire veux peux""".split()
)

# Small synonym map so FR/EN and casual words hit the right documents
SYNONYMS = {
    "pecs": "chest", "pectoraux": "chest", "poitrine": "chest",
    "epaules": "shoulders", "epaule": "shoulders", "delts": "shoulders", "deltoids": "shoulders",
    "abdos": "abs", "abdominaux": "abs", "core": "abs", "sixpack": "abs",
    "cuisses": "quads", "quadriceps": "quads", "thighs": "quads",
    "fessiers": "glutes", "fesses": "glutes", "butt": "glutes",
    "mollets": "calves", "calf": "calves",
    "dos": "back", "lats": "back", "dorsaux": "back",
    "ischios": "hamstrings", "hamstring": "hamstrings",
    "maison": "home", "halteres": "dumbbells", "dumbbell": "dumbbells",
    "proteine": "protein", "proteines": "protein", "proteins": "protein",
    "maigrir": "fat", "perdre": "lose", "poids": "weight", "muscle": "muscle", "muscler": "muscle",
    "repas": "meal", "recette": "recipe", "recettes": "recipe", "recipes": "recipe",
    "congelateur": "freezer", "freeze": "freezer", "frozen": "freezer",
    "eau": "water", "sommeil": "sleep", "repos": "rest", "series": "sets", "repetitions": "reps",
    "squats": "squat", "pushups": "push", "pullups": "pull",
}


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    return text.lower()


def tokenize(text: str) -> list[str]:
    tokens = re.findall(r"[a-z0-9]+", normalize(text))
    out = []
    for t in tokens:
        if t in STOPWORDS or len(t) < 2:
            continue
        t = SYNONYMS.get(t, t)
        if len(t) > 4 and t.endswith("s") and not t.endswith("ss"):
            t = t[:-1]  # naive plural stemming: "exercises" -> "exercise"
        out.append(t)
    return out


@dataclass
class Doc:
    id: str
    type: str  # exercise | food | principle | recipe
    title: str
    text: str
    muscle: str | None = None
    equipment: list[str] = field(default_factory=list)
    allergens: list[str] = field(default_factory=list)
    raw: dict = field(default_factory=dict)


def _load(name: str) -> list[dict]:
    with open(DATA_DIR / name, encoding="utf-8") as f:
        return json.load(f)


@lru_cache
def muscles() -> list[dict]:
    return _load("muscles.json")


@lru_cache
def muscle_names() -> dict[str, str]:
    return {m["id"]: m["name"] for m in muscles()}


@lru_cache
def exercises() -> list[dict]:
    return _load("exercises.json")


@lru_cache
def foods() -> list[dict]:
    return _load("foods.json")


@lru_cache
def recipes() -> list[dict]:
    return _load("recipes.json")


@lru_cache
def principles() -> list[dict]:
    return _load("principles.json")


@lru_cache
def equipment_guides() -> list[dict]:
    return _load("equipment.json")


def equipment_text(eq: dict) -> str:
    names = muscle_names()
    mus = ", ".join(names.get(m, m) for m in eq["muscles"])
    return (
        f"Gym equipment: {eq['name']}. Target muscles: {mus}. "
        f"Setup: {eq['setup']} How to use: {eq['how_to_use']} Safety: {eq['safety']}"
    )


def exercise_text(e: dict) -> str:
    names = muscle_names()
    sec = ", ".join(names.get(s, s) for s in e["secondary"]) or "none"
    return (
        f"{e['name']} - main muscle: {names.get(e['muscle'], e['muscle'])}; secondary: {sec}; "
        f"equipment: {', '.join(e['equipment'])}; level: {e['level']}; {e['sets_reps']}. "
        f"How to: {e['instructions']} Tips: {e['tips']}"
        + (f" Avoid or modify if you have {', '.join(e['avoid_if'])} problems." if e["avoid_if"] else "")
    )


def food_text(f: dict) -> str:
    return (
        f"{f['name']} ({f['per']}): {f['kcal']} kcal, {f['protein']} g protein, {f['carbs']} g carbs, "
        f"{f['fat']} g fat. Tags: {', '.join(f['tags'])}."
        + (f" Allergens: {', '.join(f['allergens'])}." if f["allergens"] else "")
    )


def recipe_text(r: dict) -> str:
    return (
        f"Recipe: {r['name']} ({r['meal']}, {r['servings']} servings, {r['time_min']} min). Per serving: "
        f"{r['kcal']} kcal, {r['protein']} g protein, {r['carbs']} g carbs, {r['fat']} g fat. "
        f"Tags: {', '.join(r['tags'])}. Ingredients: {'; '.join(r['ingredients'])}. Steps: {r['steps']}"
        + (f" Allergens: {', '.join(r['allergens'])}." if r["allergens"] else "")
    )


@lru_cache
def all_docs() -> tuple[Doc, ...]:
    docs: list[Doc] = []
    names = muscle_names()
    for e in exercises():
        docs.append(Doc(e["id"], "exercise", e["name"], exercise_text(e) + f" {names.get(e['muscle'], '')} {e['muscle']}",
                        muscle=e["muscle"], equipment=e["equipment"], raw=e))
    for f in foods():
        docs.append(Doc(f["id"], "food", f["name"], food_text(f) + " nutrition calories macros food",
                        allergens=f["allergens"], raw=f))
    for r in recipes():
        docs.append(Doc(r["id"], "recipe", r["name"], recipe_text(r) + " recipe meal cook",
                        allergens=r["allergens"], raw=r))
    for p in principles():
        docs.append(Doc(p["id"], "principle", p["title"], f"{p['title']}. {p['text']}", raw=p))
    for eq in equipment_guides():
        aliases = " ".join(eq.get("aliases", []))
        docs.append(Doc(eq["id"], "equipment", eq["name"], equipment_text(eq) + f" {aliases}", raw=eq))
    return tuple(docs)


class BM25:
    def __init__(self, docs: tuple[Doc, ...], k1: float = 1.5, b: float = 0.75):
        self.docs = docs
        self.k1, self.b = k1, b
        self.tfs = [Counter(tokenize(d.title + " " + d.title + " " + d.text)) for d in docs]
        self.lens = [sum(tf.values()) for tf in self.tfs]
        self.avgdl = sum(self.lens) / max(len(self.lens), 1)
        df: Counter = Counter()
        for tf in self.tfs:
            df.update(tf.keys())
        n = len(docs)
        self.idf = {t: math.log(1 + (n - c + 0.5) / (c + 0.5)) for t, c in df.items()}

    def score(self, query_tokens: list[str], i: int) -> float:
        tf, dl = self.tfs[i], self.lens[i]
        s = 0.0
        for t in query_tokens:
            if t not in tf:
                continue
            f = tf[t]
            s += self.idf.get(t, 0) * f * (self.k1 + 1) / (f + self.k1 * (1 - self.b + self.b * dl / self.avgdl))
        return s


@lru_cache
def index() -> BM25:
    return BM25(all_docs())


def detect_muscle(text: str) -> str | None:
    """Find a muscle mentioned in free text (EN/FR aliases). The longest alias wins
    ("lower back" -> lower_back, not upper_back via "back")."""
    t = " " + normalize(text) + " "
    best: tuple[int, str] | None = None
    for m in muscles():
        for alias in m["aliases"]:
            a = normalize(alias)
            if re.search(rf"(?<![a-z]){re.escape(a)}(?![a-z])", t):
                if best is None or len(a) > best[0]:
                    best = (len(a), m["id"])
    return best[1] if best else None


def search(
    query: str,
    k: int = 5,
    muscle: str | None = None,
    equipment: str | None = None,
    exclude_allergens: list[str] | None = None,
) -> list[Doc]:
    idx = index()
    q = tokenize(query)
    if muscle:
        q += tokenize(muscle_names().get(muscle, muscle))
    exclude = {a.lower() for a in (exclude_allergens or [])}
    scored = []
    for i, d in enumerate(idx.docs):
        s = idx.score(q, i)
        if muscle and d.muscle == muscle:
            s = s * 1.5 + 2.0  # boost exercises of the selected muscle
        if equipment and d.type == "exercise" and equipment not in d.equipment:
            s *= 0.3  # prefer exercises the user can actually do
        if exclude and set(d.allergens) & exclude:
            continue  # never retrieve the user's allergens
        if s > 0:
            scored.append((s, d))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [d for _, d in scored[:k]]


def exercises_for(muscle: str, equipment: str | None = None, injuries: list[str] | None = None) -> list[dict]:
    injuries = [i.lower() for i in (injuries or [])]
    out = []
    for e in exercises():
        if e["muscle"] != muscle:
            continue
        item = dict(e)
        item["fits_equipment"] = equipment is None or equipment in e["equipment"]
        item["injury_warning"] = [a for a in e["avoid_if"] if any(a in inj or inj in a for inj in injuries)]
        out.append(item)
    out.sort(key=lambda e: (not e["fits_equipment"], bool(e["injury_warning"]), e["level"] != "beginner"))
    return out

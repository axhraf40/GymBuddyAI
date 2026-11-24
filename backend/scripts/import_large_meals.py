"""Fetch a large, diverse dataset (~120+ meals) with real plate images, ingredients,
per-ingredient pricing, estimated macros, allergen tags, and cooking steps from
TheMealDB (https://www.themealdb.com/) and merge them into backend/app/data/recipes.json.

Preserves our 12 original hand-curated fitness/Moroccan recipes at the top.

Run:
    cd backend
    .venv/Scripts/python scripts/import_large_meals.py
"""
from __future__ import annotations

import json
import re
import time
from pathlib import Path

import httpx

RECIPES_PATH = Path(__file__).resolve().parent.parent / "app" / "data" / "recipes.json"
API_BASE = "https://www.themealdb.com/api/json/v1/1"

# Fetch across letters + categories + MENA/Mediterranean areas for a rich 120+ meal library
FETCH_CATEGORIES = ["Chicken", "Beef", "Seafood", "Breakfast", "Vegetarian", "Vegan", "Pasta", "Lamb", "Starter"]
FETCH_AREAS = ["Moroccan", "Egyptian", "Turkish", "Tunisian", "Greek", "Italian", "Mexican", "Japanese", "Indian"]

# Ingredient keyword -> (unit price USD, kcal, protein, carbs, fat, allergens)
ING_PRICE_TABLE: list[tuple[str, float, int, float, float, float, list[str]]] = [
    ("chicken", 3.60, 260, 46, 0, 6, []),
    ("turkey", 3.40, 220, 44, 0, 3, []),
    ("beef", 4.50, 310, 40, 0, 15, []),
    ("steak", 5.20, 330, 42, 0, 17, []),
    ("lamb", 4.80, 340, 38, 0, 20, []),
    ("salmon", 4.60, 310, 34, 0, 18, ["fish"]),
    ("tuna", 2.20, 180, 38, 0, 2, ["fish"]),
    ("cod", 3.50, 170, 36, 0, 1.5, ["fish"]),
    ("fish", 3.40, 210, 35, 0, 7, ["fish"]),
    ("prawn", 3.80, 160, 34, 1, 2, ["shellfish"]),
    ("shrimp", 3.80, 160, 34, 1, 2, ["shellfish"]),
    ("tofu", 2.10, 210, 24, 4, 12, ["soy"]),
    ("lentil", 0.90, 230, 18, 40, 1, []),
    ("chickpea", 0.85, 240, 13, 40, 4, []),
    ("bean", 0.85, 210, 14, 38, 1, []),
    ("egg", 0.65, 144, 12.6, 1, 9.6, ["egg"]),
    ("yogurt", 0.95, 110, 14, 7, 2, ["dairy"]),
    ("cheese", 1.30, 180, 11, 1, 14, ["dairy"]),
    ("milk", 0.45, 100, 7, 10, 3.5, ["dairy"]),
    ("butter", 0.45, 102, 0.1, 0, 11.5, ["dairy"]),
    ("cream", 0.80, 140, 1.5, 2, 14, ["dairy"]),
    ("rice", 0.60, 260, 5.4, 56, 0.6, []),
    ("pasta", 0.65, 280, 10, 56, 1.5, ["gluten"]),
    ("spaghetti", 0.65, 280, 10, 56, 1.5, ["gluten"]),
    ("noodle", 0.70, 270, 9, 54, 2, ["gluten"]),
    ("couscous", 0.75, 230, 8, 48, 0.5, ["gluten"]),
    ("oat", 0.45, 220, 8, 40, 4, ["gluten"]),
    ("bread", 0.55, 175, 8, 30, 2, ["gluten"]),
    ("flour", 0.30, 150, 4, 32, 0.5, ["gluten"]),
    ("tortilla", 0.60, 180, 5, 30, 4, ["gluten"]),
    ("potato", 0.70, 175, 4, 40, 0.2, []),
    ("avocado", 1.10, 160, 2, 9, 15, []),
    ("olive oil", 0.35, 119, 0, 0, 13.5, []),
    ("oil", 0.25, 110, 0, 0, 12, []),
    ("peanut", 0.55, 170, 7, 6, 14, ["peanuts"]),
    ("almond", 0.75, 173, 6.3, 6.5, 15, ["tree_nuts"]),
    ("walnut", 0.80, 185, 4.3, 4, 18.5, ["tree_nuts"]),
    ("cashew", 0.85, 165, 5, 9, 13, ["tree_nuts"]),
    ("sesame", 0.30, 60, 2, 2.5, 5, ["sesame"]),
    ("tahini", 0.55, 90, 2.6, 3.2, 8, ["sesame"]),
    ("soy sauce", 0.25, 15, 1.5, 1.5, 0, ["soy"]),
    ("tomato", 0.65, 35, 1.5, 7, 0.3, []),
    ("onion", 0.30, 40, 1, 9, 0.1, []),
    ("garlic", 0.20, 15, 0.5, 3, 0, []),
    ("pepper", 0.50, 30, 1, 6, 0.3, []),
    ("spinach", 0.60, 25, 3, 4, 0.4, []),
    ("broccoli", 0.70, 45, 3.5, 9, 0.5, []),
    ("carrot", 0.35, 40, 1, 9, 0.2, []),
    ("mushroom", 0.85, 30, 3.5, 4, 0.4, []),
    ("banana", 0.30, 105, 1.3, 27, 0.4, []),
    ("berry", 1.10, 60, 1, 14, 0.4, []),
    ("honey", 0.35, 64, 0, 17, 0, []),
    ("lemon", 0.25, 15, 0.5, 4, 0, []),
]

NON_HALAL_WORDS = ("pork", "bacon", "ham", "prosciutto", "pancetta", "chorizo", "lard", "wine", "beer", "rum", "vodka", "brandy", "sake", "mirin", "sherry", "cider", "whisky", "alcohol")
MEAT_WORDS = ("chicken", "turkey", "beef", "steak", "lamb", "pork", "bacon", "ham", "duck", "veal", "sausage", "mince")
FISH_WORDS = ("salmon", "tuna", "cod", "fish", "prawn", "shrimp", "crab", "mussel", "squid", "sardine", "anchovy", "haddock", "mackerel")


def analyze_meal(raw: dict) -> dict | None:
    name = (raw.get("strMeal") or "").strip()
    img = (raw.get("strMealThumb") or "").strip()
    steps = (raw.get("strInstructions") or "").strip()
    if not name or not img or not steps:
        return None

    ing_list: list[str] = []
    priced: list[dict] = []
    allergens: set[str] = set()
    total_kcal = 0.0
    total_p = 0.0
    total_c = 0.0
    total_f = 0.0
    has_non_halal = False
    has_meat = False
    has_fish = False

    for i in range(1, 21):
        ing = (raw.get(f"strIngredient{i}") or "").strip()
        meas = (raw.get(f"strMeasure{i}") or "").strip()
        if not ing:
            continue
        label = f"{meas} {ing}".strip() if meas else ing
        ing_list.append(label)
        low = ing.lower()

        if any(w in low for w in NON_HALAL_WORDS):
            has_non_halal = True
        if any(w in low for w in MEAT_WORDS):
            has_meat = True
        if any(w in low for w in FISH_WORDS):
            has_fish = True

        matched = False
        for kw, price, kc, pr, ca, fa, al in ING_PRICE_TABLE:
            if kw in low:
                priced.append({"name": label, "price_usd": price})
                total_kcal += kc
                total_p += pr
                total_c += ca
                total_f += fa
                allergens.update(al)
                matched = True
                break
        if not matched:
            priced.append({"name": label, "price_usd": 0.30})
            total_kcal += 25
            total_c += 4

    if len(ing_list) < 3:
        return None

    cat = (raw.get("strCategory") or "").lower()
    area = (raw.get("strArea") or "").lower()
    servings = 1 if cat == "breakfast" else (2 if len(ing_list) <= 6 else 4)

    kcal = max(240, min(850, round(total_kcal / servings)))
    protein = max(8, min(65, round(total_p / servings)))
    carbs = max(6, min(95, round(total_c / servings)))
    fat = max(4, min(40, round(total_f / servings)))

    total_usd = round(sum(p["price_usd"] for p in priced), 2)
    per_serv_usd = round(total_usd / servings, 2)

    meal_type = "breakfast" if cat == "breakfast" else ("snack" if cat == "starter" else ("lunch" if cat in ("chicken", "seafood", "pasta", "vegetarian", "vegan") else "dinner"))
    tags: list[str] = []
    if not has_non_halal:
        tags.append("halal")
    if cat == "vegan" or (not has_meat and not has_fish and "dairy" not in allergens and "egg" not in allergens):
        tags.extend(["vegan", "vegetarian"])
    elif cat == "vegetarian" or (not has_meat and not has_fish):
        tags.append("vegetarian")
    if protein >= 28:
        tags.append("high_protein")
    if servings >= 3:
        tags.append("meal_prep")
    if area in ("moroccan", "egyptian", "turkish", "tunisian"):
        tags.append("mena")
    if area:
        tags.append(area)
    if per_serv_usd <= 2.2:
        tags.append("cheap")

    # Clean whitespace in instructions
    clean_steps = re.sub(r"\r\n|\r", "\n", steps)
    clean_steps = re.sub(r"\n{2,}", "\n", clean_steps).strip()
    if len(clean_steps) > 900:
        clean_steps = clean_steps[:897].rsplit(" ", 1)[0] + "..."

    return {
        "id": f"mdb_{raw['idMeal']}",
        "name": name,
        "meal": meal_type,
        "cuisine": raw.get("strArea") or "International",
        "category": raw.get("strCategory") or "",
        "servings": servings,
        "time_min": 15 if cat == "breakfast" else (25 if len(ing_list) <= 7 else 40),
        "kcal": kcal,
        "protein": protein,
        "carbs": carbs,
        "fat": fat,
        "allergens": sorted(allergens),
        "tags": sorted(set(tags)),
        "ingredients": ing_list,
        "ingredients_priced": priced,
        "total_price_usd": total_usd,
        "price_per_serving_usd": per_serv_usd,
        "image_url": img,
        "steps": clean_steps,
    }


def main() -> None:
    with open(RECIPES_PATH, encoding="utf-8") as f:
        existing: list[dict] = json.load(f)

    # Keep our 12 original curated recipes at the top
    curated = [r for r in existing if not r["id"].startswith("mdb_")]
    seen_names = {r["name"].lower() for r in curated}
    meal_ids: list[str] = []
    seen_ids: set[str] = set()

    client = httpx.Client(timeout=20)
    print("Collecting meal IDs from TheMealDB categories & areas...")
    for area in FETCH_AREAS:
        try:
            r = client.get(f"{API_BASE}/filter.php", params={"a": area}).json()
            for m in (r.get("meals") or []):
                if m["idMeal"] not in seen_ids:
                    seen_ids.add(m["idMeal"])
                    meal_ids.append(m["idMeal"])
        except Exception as e:
            print(f"  [warn] area {area}: {e}")

    for cat in FETCH_CATEGORIES:
        try:
            r = client.get(f"{API_BASE}/filter.php", params={"c": cat}).json()
            for m in (r.get("meals") or [])[:20]:
                if m["idMeal"] not in seen_ids:
                    seen_ids.add(m["idMeal"])
                    meal_ids.append(m["idMeal"])
        except Exception as e:
            print(f"  [warn] cat {cat}: {e}")

    # Cap at 135 unique lookups so it's fast and rich (~120+ final meals)
    target_ids = meal_ids[:135]
    print(f"Fetching full details for {len(target_ids)} meals...")
    imported: list[dict] = []
    for idx, mid in enumerate(target_ids, 1):
        try:
            r = client.get(f"{API_BASE}/lookup.php", params={"i": mid}).json()
            meals = r.get("meals") or []
            if not meals:
                continue
            item = analyze_meal(meals[0])
            if item and item["name"].lower() not in seen_names:
                seen_names.add(item["name"].lower())
                imported.append(item)
        except Exception:
            pass
        if idx % 30 == 0:
            print(f"  ...processed {idx}/{len(target_ids)} ({len(imported)} added)")
            time.sleep(0.2)

    final_list = curated + imported
    with open(RECIPES_PATH, "w", encoding="utf-8") as f:
        json.dump(final_list, f, indent=2, ensure_ascii=False)

    print(f"Done! Total recipes in recipes.json: {len(final_list)} (12 curated + {len(imported)} from TheMealDB).")


if __name__ == "__main__":
    main()

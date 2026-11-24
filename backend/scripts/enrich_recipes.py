"""Enrich backend/app/data/recipes.json with real dish photography from TheMealDB
(https://www.themealdb.com/) and structured per-ingredient pricing (base USD, converted
to MAD / EUR / USD / GBP / SAR / AED / CAD in the app).

Run once:
    cd backend
    .venv/Scripts/python scripts/enrich_recipes.py
"""
from __future__ import annotations

import json
from pathlib import Path

import httpx

RECIPES_PATH = Path(__file__).resolve().parent.parent / "app" / "data" / "recipes.json"

# Verified TheMealDB search terms for each recipe to pull real plate images
THEMEALDB_QUERIES: dict[str, list[str]] = {
    "r_chicken_rice_bowl": ["Teriyaki Chicken Casserole", "Chicken Mandi", "Chicken"],
    "r_overnight_oats": ["Breakfast", "Pancakes", "Porridge"],
    "r_egg_omelette": ["Bread omelette", "Omelette", "Egg"],
    "r_lentil_stew": ["Lentil", "Moroccan", "Dal"],
    "r_chicken_tajine_light": ["Chicken Couscous", "Tajine", "Moroccan"],
    "r_tuna_pasta": ["Tuna Nicoise", "Tuna", "Pasta"],
    "r_beef_potato": ["Beef", "Minced Beef", "Steak"],
    "r_chickpea_salad": ["Chickpea", "Salad", "Tuna"],
    "r_tofu_stir_fry": ["Tofu", "Stir-fry", "Vegetable"],
    "r_yogurt_snack": ["Smoothie", "Fruit", "Berry"],
    "r_harira_light": ["Harira", "Soup", "Moroccan"],
    "r_banana_pb_toast": ["Banana", "Toast", "Peanut"],
}

# Realistic per-ingredient grocery prices in USD (converted cleanly to MAD/EUR/etc.)
INGREDIENT_PRICES_USD: dict[str, list[dict]] = {
    "r_chicken_rice_bowl": [
        {"name": "800 g chicken breast", "price_usd": 5.60},
        {"name": "300 g dry rice", "price_usd": 0.65},
        {"name": "600 g mixed vegetables (broccoli, carrot, pepper)", "price_usd": 1.80},
        {"name": "2 tbsp olive oil", "price_usd": 0.40},
        {"name": "garlic, paprika, cumin, salt, pepper", "price_usd": 0.25},
    ],
    "r_overnight_oats": [
        {"name": "60 g rolled oats", "price_usd": 0.25},
        {"name": "150 g Greek yogurt 0%", "price_usd": 0.90},
        {"name": "150 ml milk", "price_usd": 0.20},
        {"name": "1 scoop whey protein (optional)", "price_usd": 0.95},
        {"name": "100 g berries or 1 banana", "price_usd": 0.60},
        {"name": "cinnamon", "price_usd": 0.05},
    ],
    "r_egg_omelette": [
        {"name": "3 whole eggs", "price_usd": 0.75},
        {"name": "handful of spinach", "price_usd": 0.40},
        {"name": "1/2 bell pepper", "price_usd": 0.35},
        {"name": "1/2 onion", "price_usd": 0.15},
        {"name": "1 tsp olive oil", "price_usd": 0.10},
        {"name": "2 slices whole wheat bread", "price_usd": 0.30},
    ],
    "r_lentil_stew": [
        {"name": "400 g dry lentils", "price_usd": 1.10},
        {"name": "1 onion & 2 garlic cloves", "price_usd": 0.30},
        {"name": "2 tomatoes", "price_usd": 0.50},
        {"name": "2 carrots", "price_usd": 0.35},
        {"name": "cumin, paprika, turmeric, coriander", "price_usd": 0.30},
        {"name": "1 tbsp olive oil", "price_usd": 0.20},
    ],
    "r_chicken_tajine_light": [
        {"name": "800 g skinless chicken", "price_usd": 5.20},
        {"name": "2 onions", "price_usd": 0.40},
        {"name": "3 carrots & 2 zucchini", "price_usd": 1.10},
        {"name": "2 potatoes", "price_usd": 0.50},
        {"name": "1 tbsp olive oil", "price_usd": 0.20},
        {"name": "ginger, turmeric, cumin, coriander, preserved lemon", "price_usd": 0.45},
    ],
    "r_tuna_pasta": [
        {"name": "160 g dry pasta", "price_usd": 0.45},
        {"name": "2 cans tuna in water", "price_usd": 2.40},
        {"name": "400 g crushed tomatoes", "price_usd": 0.90},
        {"name": "1 garlic clove & basil", "price_usd": 0.20},
        {"name": "1 tsp olive oil", "price_usd": 0.10},
    ],
    "r_beef_potato": [
        {"name": "600 g lean ground beef 5%", "price_usd": 6.00},
        {"name": "700 g potatoes", "price_usd": 0.90},
        {"name": "1 onion & 1 bell pepper", "price_usd": 0.65},
        {"name": "1 tbsp olive oil", "price_usd": 0.20},
        {"name": "paprika, cumin, garlic powder", "price_usd": 0.20},
    ],
    "r_chickpea_salad": [
        {"name": "150 g cooked chickpeas", "price_usd": 0.45},
        {"name": "1 can tuna in water", "price_usd": 1.20},
        {"name": "tomato, cucumber, red onion", "price_usd": 0.70},
        {"name": "1 tbsp olive oil & lemon juice", "price_usd": 0.30},
        {"name": "fresh parsley", "price_usd": 0.15},
    ],
    "r_tofu_stir_fry": [
        {"name": "300 g firm tofu", "price_usd": 2.10},
        {"name": "300 g mixed vegetables", "price_usd": 1.00},
        {"name": "150 g dry rice", "price_usd": 0.35},
        {"name": "2 tbsp soy sauce", "price_usd": 0.25},
        {"name": "1 tsp oil, garlic, ginger", "price_usd": 0.25},
    ],
    "r_yogurt_snack": [
        {"name": "200 g Greek yogurt 0%", "price_usd": 1.15},
        {"name": "1 banana or 100 g berries", "price_usd": 0.55},
        {"name": "15 g almonds", "price_usd": 0.35},
        {"name": "honey (optional)", "price_usd": 0.15},
    ],
    "r_harira_light": [
        {"name": "150 g lentils & 200 g chickpeas", "price_usd": 1.00},
        {"name": "250 g lean beef or chicken cubes", "price_usd": 2.40},
        {"name": "500 g tomatoes", "price_usd": 0.85},
        {"name": "onion, celery, parsley, coriander", "price_usd": 0.65},
        {"name": "2 tbsp flour & Moroccan spices", "price_usd": 0.35},
    ],
    "r_banana_pb_toast": [
        {"name": "2 slices whole wheat bread", "price_usd": 0.30},
        {"name": "1 tbsp peanut butter", "price_usd": 0.25},
        {"name": "1 medium banana", "price_usd": 0.25},
    ],
}


def find_mealdb_image(queries: list[str]) -> str:
    for q in queries:
        try:
            r = httpx.get(
                "https://www.themealdb.com/api/json/v1/1/search.php",
                params={"s": q},
                timeout=15,
            ).json()
            meals = r.get("meals") or []
            if meals and meals[0].get("strMealThumb"):
                return meals[0]["strMealThumb"]
        except Exception:
            continue
    return "https://www.themealdb.com/images/media/meals/wyxwsp1486979827.jpg"


def main() -> None:
    with open(RECIPES_PATH, encoding="utf-8") as f:
        recipes: list[dict] = json.load(f)

    for rec in recipes:
        rid = rec["id"]
        img = find_mealdb_image(THEMEALDB_QUERIES.get(rid, [rec["name"].split()[0]]))
        priced = INGREDIENT_PRICES_USD.get(rid) or [{"name": i, "price_usd": 0.50} for i in rec["ingredients"]]
        total_usd = round(sum(p["price_usd"] for p in priced), 2)
        per_serving_usd = round(total_usd / max(rec.get("servings", 1), 1), 2)
        rec["image_url"] = img
        rec["ingredients_priced"] = priced
        rec["total_price_usd"] = total_usd
        rec["price_per_serving_usd"] = per_serving_usd
        print(f"  {rid:24s} -> ${per_serving_usd:.2f}/serv | {img}")

    with open(RECIPES_PATH, "w", encoding="utf-8") as f:
        json.dump(recipes, f, indent=2, ensure_ascii=False)
    print(f"Done! Enriched {len(recipes)} recipes with TheMealDB images & ingredient pricing.")


if __name__ == "__main__":
    main()

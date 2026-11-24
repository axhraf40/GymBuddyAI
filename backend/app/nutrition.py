"""Deterministic calorie & macro calculator (numbers never come from the LLM).

BMR: Mifflin-St Jeor (1990)
    men:   10*kg + 6.25*cm - 5*age + 5
    women: 10*kg + 6.25*cm - 5*age - 161
TDEE = BMR * activity factor, then a goal adjustment, with a safety calorie floor.
"""
from __future__ import annotations

from .schemas import Profile, Targets

ACTIVITY_FACTORS = {
    "sedentary": 1.2,
    "light": 1.375,
    "moderate": 1.55,
    "active": 1.725,
    "very_active": 1.9,
}

GOAL_ADJUSTMENT = {
    "lose_fat": -0.20,
    "build_muscle": 0.08,
    "recomp": 0.0,
    "maintain": 0.0,
}

PROTEIN_PER_KG = {"lose_fat": 2.0, "build_muscle": 1.8, "recomp": 2.0, "maintain": 1.6}

CALORIE_FLOOR = {"male": 1500, "female": 1200}


def bmr(p: Profile) -> float:
    base = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age
    return base + 5 if p.sex == "male" else base - 161


def compute_targets(p: Profile) -> Targets:
    b = bmr(p)
    tdee = b * ACTIVITY_FACTORS[p.activity]
    calories = tdee * (1 + GOAL_ADJUSTMENT[p.goal])
    floor = CALORIE_FLOOR[p.sex]
    note = ""
    if calories < floor:
        calories = floor
        note = f"Calories raised to the safety floor of {floor} kcal."

    protein = PROTEIN_PER_KG[p.goal] * p.weight_kg
    fat = max(0.8 * p.weight_kg, 0.25 * calories / 9)
    carbs = max((calories - protein * 4 - fat * 9) / 4, 50)

    water = round(0.033 * p.weight_kg + 0.5 * min(p.days_per_week, 7) / 7, 1)

    goal_text = {
        "lose_fat": "about 20% below maintenance for steady fat loss (0.5-1% of body weight per week)",
        "build_muscle": "about 8% above maintenance for lean muscle gain",
        "recomp": "at maintenance with high protein (body recomposition)",
        "maintain": "at maintenance",
    }[p.goal]
    note = (note + " " if note else "") + f"Target is {goal_text}. Adjust after 2-3 weeks based on your real weight trend."

    return Targets(
        bmr=round(b),
        tdee=round(tdee),
        calories=round(calories),
        protein_g=round(protein),
        carbs_g=round(carbs),
        fat_g=round(fat),
        water_l=water,
        note=note,
    )

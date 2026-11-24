"""Pydantic request/response models (input validation = first layer of error handling)."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

Goal = Literal["lose_fat", "build_muscle", "recomp", "maintain"]
Sex = Literal["male", "female"]
Activity = Literal["sedentary", "light", "moderate", "active", "very_active"]
Experience = Literal["beginner", "intermediate", "advanced"]
Equipment = Literal["gym", "dumbbells", "bodyweight"]
Diet = Literal["none", "halal", "vegetarian", "vegan"]
Split = Literal[
    "auto",
    "push_pull_legs",
    "upper_lower",
    "full_body",
    "arnold_split",
    "bro_split",
    "phul",
    "phat",
    "push_pull",
    "torso_limbs",
    "athletic_conditioning",
]


class Profile(BaseModel):
    age: int = Field(25, ge=14, le=90)
    sex: Sex = "male"
    height_cm: float = Field(175, ge=120, le=230)
    weight_kg: float = Field(70, ge=30, le=250)
    activity: Activity = "moderate"
    goal: Goal = "build_muscle"
    experience: Experience = "beginner"
    days_per_week: int = Field(3, ge=1, le=7)
    split: Split = "auto"
    equipment: Equipment = "gym"
    diet: Diet = "none"
    allergies: list[str] = Field(default_factory=list)
    injuries: list[str] = Field(default_factory=list)
    medical_conditions: list[str] = Field(default_factory=list)
    language: Literal["en", "fr"] = "en"

    @field_validator("allergies", "injuries", "medical_conditions", mode="before")
    @classmethod
    def _clean_list(cls, v):
        if v is None:
            return []
        if isinstance(v, str):
            v = v.split(",")
        return [str(x).strip().lower() for x in v if str(x).strip()][:15]


class Targets(BaseModel):
    bmr: int
    tdee: int
    calories: int
    protein_g: int
    carbs_g: int
    fat_g: int
    water_l: float
    note: str


class UserCreate(BaseModel):
    name: str = Field("", max_length=80)
    email: str = Field("", max_length=200)
    avatar_url: str = Field("", max_length=1_500_000)
    daily_digest: bool = False
    profile: Profile = Field(default_factory=Profile)


class UserOut(BaseModel):
    user_id: str
    username: str = ""
    name: str
    email: str
    avatar_url: str = ""
    plan: Literal["free", "pro"] = "free"
    is_verified: bool = False
    daily_digest: bool
    profile: Profile
    targets: Targets
    auth_token: str = ""


class AuthRegister(BaseModel):
    username: str = Field("", max_length=60)
    name: str = Field(..., min_length=1, max_length=80)
    email: str = Field(..., min_length=3, max_length=200)
    password: str = Field(..., min_length=6, max_length=128)
    profile: Profile = Field(default_factory=Profile)


class AuthLogin(BaseModel):
    email: str = Field(..., min_length=2, max_length=200)  # accepts email OR username
    password: str = Field(..., min_length=1, max_length=128)
    vault_tokens: list[str] = Field(default_factory=list)


class AuthGoogle(BaseModel):
    id_token: str | None = None
    access_token: str | None = None
    email: str = Field("", max_length=200)
    name: str = Field("", max_length=80)
    avatar_url: str = Field("", max_length=1_500_000)
    vault_tokens: list[str] = Field(default_factory=list)


class VerifyEmailIn(BaseModel):
    email: str = Field(..., min_length=3, max_length=200)
    code: str = Field(..., min_length=6, max_length=6)


class NearbyRestaurantsRequest(BaseModel):
    lat: float | None = None
    lon: float | None = None
    city: str = Field("", max_length=120)
    user_id: str | None = None


class FridgeMealsRequest(BaseModel):
    user_id: str | None = None
    ingredients: str = Field(..., min_length=2, max_length=1000)
    currency_code: str = Field("MAD", max_length=8)


class ForgotPasswordIn(BaseModel):
    email: str = Field(..., min_length=3, max_length=200)
    vault_tokens: list[str] = Field(default_factory=list)


class ResetPasswordIn(BaseModel):
    email: str = Field(..., min_length=3, max_length=200)
    code: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=6, max_length=128)
    vault_tokens: list[str] = Field(default_factory=list)


class PlanUpdate(BaseModel):
    plan: Literal["free", "pro"]


class ChatRequest(BaseModel):
    user_id: str
    conversation_id: str | None = None
    message: str = Field(..., min_length=1, max_length=2000)
    muscle: str | None = None
    model: str | None = None


class EquipmentIdentifyRequest(BaseModel):
    user_id: str
    conversation_id: str | None = None
    image_data_url: str = Field("", max_length=6_000_000)
    barcode: str | None = Field(None, max_length=64)
    scan_mode: Literal["auto", "equipment", "food", "barcode"] = "auto"
    question: str = Field("", max_length=500)


class Source(BaseModel):
    id: str
    title: str
    type: str


class MatchedExercise(BaseModel):
    id: str
    name: str
    muscle: str
    sets_reps: str
    gif_url: str = ""
    image_url: str = ""
    tips: str = ""


class ChatResponse(BaseModel):
    conversation_id: str
    message_id: str
    reply: str
    sources: list[Source]
    flags: list[str]
    suggestions: list[str]
    matched_exercises: list[MatchedExercise] = Field(default_factory=list)
    generated_image_url: str = ""
    provider: str
    latency_ms: int


class RatingIn(BaseModel):
    rating: Literal[-1, 0, 1]


class FeedbackIn(BaseModel):
    user_id: str | None = None
    kind: Literal["bug", "wrong_answer", "idea", "other"] = "bug"
    text: str = Field(..., min_length=3, max_length=3000)
    page: str = Field("", max_length=200)

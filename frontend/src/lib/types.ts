export type Goal = "lose_fat" | "build_muscle" | "recomp" | "maintain";
export type Sex = "male" | "female";
export type Activity = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type Experience = "beginner" | "intermediate" | "advanced";
export type Equipment = "gym" | "dumbbells" | "bodyweight";
export type Diet = "none" | "halal" | "vegetarian" | "vegan";
export type Split =
  | "auto"
  | "push_pull_legs"
  | "upper_lower"
  | "full_body"
  | "arnold_split"
  | "bro_split"
  | "phul"
  | "phat"
  | "push_pull"
  | "torso_limbs"
  | "athletic_conditioning";

export interface Profile {
  age: number;
  sex: Sex;
  height_cm: number;
  weight_kg: number;
  activity: Activity;
  goal: Goal;
  experience: Experience;
  days_per_week: number;
  split: Split;
  equipment: Equipment;
  diet: Diet;
  allergies: string[];
  injuries: string[];
  medical_conditions: string[];
  language: "en" | "fr";
}

export interface Targets {
  bmr: number;
  tdee: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  water_l: number;
  note: string;
}

export interface UserOut {
  user_id: string;
  username?: string;
  name: string;
  email: string;
  avatar_url?: string;
  plan: "free" | "pro";
  is_verified?: boolean;
  daily_digest: boolean;
  profile: Profile;
  targets: Targets;
  auth_token?: string;
}

export interface PricedIngredient {
  name: string;
  price_usd: number;
}

export interface RecipeItem {
  id: string;
  name: string;
  meal: string;
  servings: number;
  time_min: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  allergens: string[];
  tags: string[];
  ingredients: string[];
  ingredients_priced?: PricedIngredient[];
  total_price_usd?: number;
  price_per_serving_usd?: number;
  image_url?: string;
  steps: string;
}

export interface MealAddon {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  price_usd: number;
  allergens: string[];
  tags: string[];
}

export interface CurrencyOption {
  code: string;
  symbol: string;
  label: string;
  rate: number;
}

export interface FoodItem {
  id: string;
  name: string;
  per: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  allergens: string[];
  tags: string[];
}

export interface NutritionOverviewResponse {
  targets: Targets;
  diet: Diet;
  allergies: string[];
  recipes: RecipeItem[];
  foods: FoodItem[];
  addons?: MealAddon[];
  currencies?: CurrencyOption[];
}

export interface SessionExerciseAlt {
  id: string;
  name: string;
  muscle: string;
  sets: number;
  target_reps: string;
  rest_sec: number;
  gif_url?: string;
  image_url?: string;
  tips: string;
  equipment: string[];
}

export interface SessionExercise {
  id: string;
  name: string;
  muscle: string;
  muscle_name: string;
  sets: number;
  target_reps: string;
  is_timed: boolean;
  timed_sec: number;
  rest_sec: number;
  default_weight_kg: number;
  gif_url?: string;
  image_url?: string;
  tips: string;
  injury_warning: string[];
  alternatives: SessionExerciseAlt[];
}

export interface WorkoutSessionResponse {
  split: string;
  title: string;
  available_splits: { id: string; title: string }[];
  exercises: SessionExercise[];
}

export interface Source {
  id: string;
  title: string;
  type: string;
}

export interface MatchedExercise {
  id: string;
  name: string;
  muscle: string;
  sets_reps: string;
  gif_url?: string;
  image_url?: string;
  tips?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  muscle?: string | null;
  image_preview?: string | null;
  generated_image_url?: string;
  sources?: Source[];
  matched_exercises?: MatchedExercise[];
  flags?: string[];
  rating?: number;
  provider?: string;
  latency_ms?: number;
}

export interface NearbyRestaurant {
  name: string;
  cuisine: string;
  distance_km: number | null;
  address: string;
  maps_url: string;
  recommended_dish: string;
  est_kcal: number;
  est_protein_g: number;
  health_score?: number;
  healthy_pick?: boolean;
  badges?: string[];
  dishes?: { dish: string; kcal?: number | null; protein_g?: number | null; tip?: string }[];
  photo_url?: string;
  rating?: number | null;
  rating_count?: number | null;
  price?: string;
  open_now?: boolean | null;
  hours_text?: string;
  summary?: string;
  source?: string;
}

export interface NearbyRestaurantsResponse {
  location: string;
  radius_km?: number;
  count: number;
  restaurants: NearbyRestaurant[];
}

export interface FridgeMealsResponse {
  reply: string;
  generated_image_url: string;
  image_model: string;
  currency: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  updated_at: string;
}

export interface ExerciseItem {
  id: string;
  name: string;
  muscle: string;
  secondary: string[];
  equipment: string[];
  level: string;
  sets_reps: string;
  instructions: string;
  tips: string;
  avoid_if: string[];
  fits_equipment: boolean;
  injury_warning: string[];
  image_url?: string;
  gif_url?: string;
  steps_en?: string[];
  steps_fr?: string[];
}

export interface MuscleExercisesResponse {
  muscle: { id: string; name: string };
  exercises: ExerciseItem[];
  suggestions: string[];
}

export interface HealthInfo {
  status: string;
  llm_provider: string;
  llm_model: string;
  mock_mode: boolean;
  documents: number;
}

export interface ModelOption {
  id: string;
  label: string;
  tag: string;
  vision: boolean;
}

export interface ModelsResponse {
  provider: string;
  default_model: string;
  models: ModelOption[];
}

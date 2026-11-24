"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Check,
  ChefHat,
  Clock,
  Droplets,
  ExternalLink,
  Flame,
  Globe,
  MapPin,
  Navigation,
  Plus,
  Search,
  Send,
  Snowflake,
  Sparkles,
  Star,
  Utensils,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import type {
  CurrencyOption,
  FridgeMealsResponse,
  MealAddon,
  NearbyRestaurant,
  NutritionOverviewResponse,
  RecipeItem,
  UserOut,
} from "@/lib/types";
import { Navbar } from "@/components/Navbar";
import { MarkdownText } from "@/components/MarkdownText";

const STORAGE_USER_KEY = "gymbuddy_user_id";
const STORAGE_CURRENCY_KEY = "gymbuddy_currency";

const FALLBACK_CURRENCIES: CurrencyOption[] = [
  { code: "MAD", symbol: "MAD", label: "Morocco (MAD)", rate: 10.0 },
  { code: "USD", symbol: "$", label: "United States (USD)", rate: 1.0 },
  { code: "EUR", symbol: "€", label: "Europe (EUR)", rate: 0.92 },
  { code: "GBP", symbol: "£", label: "United Kingdom (GBP)", rate: 0.79 },
  { code: "SAR", symbol: "SAR", label: "Saudi Arabia (SAR)", rate: 3.75 },
  { code: "AED", symbol: "AED", label: "UAE (AED)", rate: 3.67 },
  { code: "CAD", symbol: "CA$", label: "Canada (CAD)", rate: 1.38 },
];

function guessCurrencyByLocation(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    if (tz.includes("Casablanca")) return "MAD";
    if (tz.includes("Riyadh")) return "SAR";
    if (tz.includes("Dubai")) return "AED";
    if (tz.includes("London")) return "GBP";
    if (tz.includes("Toronto") || tz.includes("Montreal")) return "CAD";
    if (tz.startsWith("Europe/")) return "EUR";
  } catch {
    // ignore
  }
  return "MAD";
}

export default function NutritionPage() {
  const [user, setUser] = useState<UserOut | null>(null);
  const [data, setData] = useState<NutritionOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [mealFilter, setMealFilter] = useState<string>("all");
  const [mealSearch, setMealSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(18);
  const [foodQuery, setFoodQuery] = useState("");
  const [currencyCode, setCurrencyCode] = useState<string>("MAD");

  // Active recipe modal + meal add-ons + built-in AI Meal Chef chat
  const [activeRecipe, setActiveRecipe] = useState<RecipeItem | null>(null);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);
  const [aiMessages, setAiMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [aiConvId, setAiConvId] = useState<string | null>(null);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Page-level quick AI Nutrition chat
  const [pageAiOpen, setPageAiOpen] = useState(false);

  // "What's in my fridge?" AI Chef + Recraft Image Gen
  const [fridgeInput, setFridgeInput] = useState("");
  const [fridgeLoading, setFridgeLoading] = useState(false);
  const [fridgeResult, setFridgeResult] = useState<FridgeMealsResponse | null>(null);
  const [fridgeError, setFridgeError] = useState<string | null>(null);

  // Nearby Healthy Restaurants (GPS or City)
  const [cityInput, setCityInput] = useState("Casablanca");
  const [restLoading, setRestLoading] = useState(false);
  const [restLocation, setRestLocation] = useState<string>("");
  const [restaurants, setRestaurants] = useState<NearbyRestaurant[]>([]);
  const [restSearched, setRestSearched] = useState(false);
  const [restError, setRestError] = useState<string | null>(null);

  useEffect(() => {
    const savedCurr = typeof window !== "undefined" ? localStorage.getItem(STORAGE_CURRENCY_KEY) : null;
    setCurrencyCode(savedCurr || guessCurrencyByLocation());

    const savedId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_USER_KEY) : null;
    if (savedId) {
      api
        .getUser(savedId)
        .then((u) => {
          setUser(u);
          return api.nutritionOverview(u.user_id);
        })
        .then(setData)
        .catch(() => api.nutritionOverview().then(setData))
        .finally(() => setLoading(false));
    } else {
      api
        .nutritionOverview()
        .then(setData)
        .finally(() => setLoading(false));
    }
  }, []);

  const currencies = data?.currencies?.length ? data.currencies : FALLBACK_CURRENCIES;
  const currency = currencies.find((c) => c.code === currencyCode) || currencies[0];

  const fmtPrice = (usd?: number) => {
    const val = (usd ?? 0) * currency.rate;
    const num = currency.code === "MAD" ? val.toFixed(0) : val.toFixed(2);
    return currency.symbol.length > 1 ? `${num} ${currency.symbol}` : `${currency.symbol}${num}`;
  };

  const openRecipe = (r: RecipeItem) => {
    setActiveRecipe(r);
    setSelectedAddons([]);
    setAiMessages([]);
    setAiConvId(null);
    setAiInput("");
  };

  const toggleAddon = (id: string) => {
    setSelectedAddons((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const generateFromFridge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fridgeInput.trim() || fridgeLoading) return;
    setFridgeLoading(true);
    setFridgeError(null);
    try {
      const res = await api.fridgeMeals({
        user_id: user?.user_id || null,
        ingredients: fridgeInput.trim(),
        currency_code: currencyCode,
      });
      setFridgeResult(res);
    } catch (err) {
      setFridgeError(err instanceof Error ? err.message : "Could not generate meals right now.");
    } finally {
      setFridgeLoading(false);
    }
  };

  const findNearbyByGPS = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setRestError("Geolocation is not supported by your browser. Search by city name instead.");
      return;
    }
    setRestLoading(true);
    setRestError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await api.nearbyRestaurants({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            user_id: user?.user_id || null,
          });
          setRestaurants(res.restaurants);
          setRestLocation(res.location);
          setRestSearched(true);
        } catch (err) {
          setRestError(err instanceof Error ? err.message : "Failed to find nearby restaurants.");
        } finally {
          setRestLoading(false);
        }
      },
      (err) => {
        setRestLoading(false);
        setRestError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Allow location for this site, or type your city and click Search."
            : "Could not get your location in time. Try again outdoors, or type your city and click Search."
        );
      },
      { timeout: 15000, maximumAge: 5 * 60 * 1000, enableHighAccuracy: false }
    );
  };

  const findNearbyByCity = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!cityInput.trim() || restLoading) return;
    setRestLoading(true);
    setRestError(null);
    try {
      const res = await api.nearbyRestaurants({
        city: cityInput.trim(),
        user_id: user?.user_id || null,
      });
      setRestaurants(res.restaurants);
      setRestLocation(res.location);
      setRestSearched(true);
    } catch (err) {
      setRestError(err instanceof Error ? err.message : "Failed to find restaurants for this city.");
    } finally {
      setRestLoading(false);
    }
  };

  const ensureUserId = async (): Promise<string> => {
    if (user) return user.user_id;
    const created = await api.createUser({
      name: "Guest",
      email: "",
      daily_digest: false,
      profile: {
        age: 22,
        sex: "male",
        height_cm: 175,
        weight_kg: 72,
        activity: "moderate",
        goal: "build_muscle",
        experience: "beginner",
        days_per_week: 3,
        split: "auto",
        equipment: "gym",
        diet: "none",
        allergies: [],
        injuries: [],
        medical_conditions: [],
        language: "en",
      },
    });
    setUser(created);
    localStorage.setItem(STORAGE_USER_KEY, created.user_id);
    return created.user_id;
  };

  const askMealAI = async (questionOverride?: string, recipeContext?: RecipeItem | null) => {
    const q = (questionOverride ?? aiInput).trim();
    if (!q || aiLoading) return;
    setAiInput("");
    setAiLoading(true);

    const rec = recipeContext ?? activeRecipe;
    const chosenAddons: MealAddon[] = (data?.addons || []).filter((a) => selectedAddons.includes(a.id));
    const contextPrefix = rec
      ? `[Meal context: "${rec.name}" (${rec.kcal} kcal, ${rec.protein}g protein, ${fmtPrice(
          rec.price_per_serving_usd
        )}/serving in ${currency.code}${
          chosenAddons.length ? `; Add-ons: ${chosenAddons.map((a) => a.name).join(", ")}` : ""
        })]\n`
      : `[Nutrition question, currency: ${currency.code}]\n`;

    setAiMessages((prev) => [...prev, { role: "user", content: q }]);
    try {
      const uid = await ensureUserId();
      const res = await api.sendChat({
        user_id: uid,
        conversation_id: aiConvId,
        message: contextPrefix + q,
      });
      setAiConvId(res.conversation_id);
      setAiMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
    } catch (e) {
      setAiMessages((prev) => [
        ...prev,
        { role: "assistant", content: e instanceof Error ? e.message : "Could not reach the AI Coach right now." },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const recipes = (data?.recipes || []).filter((r) => {
    if (mealSearch.trim()) {
      const q = mealSearch.toLowerCase();
      const hit =
        r.name.toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q)) ||
        r.ingredients.some((i) => i.toLowerCase().includes(q));
      if (!hit) return false;
    }
    if (mealFilter === "all") return true;
    if (mealFilter === "high_protein") return r.protein >= 28 || r.tags.includes("high_protein");
    if (mealFilter === "cheap") return (r.price_per_serving_usd ?? 99) <= 2.2 || r.tags.includes("cheap");
    if (mealFilter === "meal_prep") return r.tags.includes("meal_prep") || r.tags.includes("freezer_friendly");
    if (mealFilter === "mena") return r.tags.includes("mena");
    return r.meal === mealFilter;
  });
  const visibleRecipes = recipes.slice(0, visibleCount);

  const foods = (data?.foods || []).filter((f) =>
    !foodQuery.trim()
      ? true
      : f.name.toLowerCase().includes(foodQuery.toLowerCase()) ||
        f.tags.some((t) => t.includes(foodQuery.toLowerCase()))
  );

  // Compute live totals for the active recipe + selected add-ons
  const activeAddonsList = (data?.addons || []).filter((a) => selectedAddons.includes(a.id));
  const liveKcal = (activeRecipe?.kcal || 0) + activeAddonsList.reduce((s, a) => s + a.kcal, 0);
  const liveProtein = Math.round(((activeRecipe?.protein || 0) + activeAddonsList.reduce((s, a) => s + a.protein, 0)) * 10) / 10;
  const liveCarbs = Math.round(((activeRecipe?.carbs || 0) + activeAddonsList.reduce((s, a) => s + a.carbs, 0)) * 10) / 10;
  const liveFat = Math.round(((activeRecipe?.fat || 0) + activeAddonsList.reduce((s, a) => s + a.fat, 0)) * 10) / 10;
  const liveServingUsd =
    (activeRecipe?.price_per_serving_usd || 0) + activeAddonsList.reduce((s, a) => s + a.price_usd, 0);

  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        {/* Header + Currency Switcher + Ask AI Nutritionist Button */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-forest-deep/10 bg-lime/70 px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest text-forest-deep">
              Personalized Nutrition · Plate Photos · Ingredient Pricing
            </span>
            <h1 className="mt-2 font-display text-3xl font-extrabold text-forest-deep sm:text-4xl">
              Fuel your <span className="text-forest">{(user?.profile.split || "training").replace(/_/g, " ")}</span> split.
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Location Currency Selector */}
            <label className="flex items-center gap-1.5 rounded-full border border-ink/15 bg-surface px-3 py-2 text-xs font-semibold text-forest-deep shadow-soft">
              <Globe className="h-3.5 w-3.5 text-forest" />
              <select
                aria-label="Select currency based on location"
                value={currencyCode}
                onChange={(e) => {
                  setCurrencyCode(e.target.value);
                  localStorage.setItem(STORAGE_CURRENCY_KEY, e.target.value);
                }}
                className="bg-transparent font-bold text-forest-deep focus:outline-none"
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              onClick={() => {
                setPageAiOpen((v) => !v);
                setActiveRecipe(null);
              }}
              className="inline-flex items-center gap-2 rounded-full bg-forest-deep px-5 py-2.5 text-xs font-bold text-lime shadow-soft transition hover:bg-forest"
            >
              <Bot className="h-4 w-4" /> {pageAiOpen ? "Hide AI Nutritionist" : "Talk to AI Nutritionist"}
            </button>
          </div>
        </div>

        {/* Inline AI Nutritionist Drawer (when toggled on the page) */}
        {pageAiOpen && !activeRecipe && (
          <section className="mb-7 rounded-[28px] border border-forest/20 bg-surface p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-2xl bg-forest-deep text-lime">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-forest-deep">AI Nutritionist & Chef</h2>
                  <p className="text-[11px] text-secondary">
                    Ask for a full day meal plan, budget swaps in {currency.code}, or cooking instructions.
                  </p>
                </div>
              </div>
              <Link href="/coach" className="text-xs font-bold text-forest hover:underline">
                Full Coach Workspace →
              </Link>
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              {[
                `Build a budget high-protein day of eating in ${currency.code}`,
                "Give me a Sunday freezer meal-prep plan for 4 days",
                "What should I eat before and after my workout?",
                "Healthy Moroccan meals for muscle gain",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => askMealAI(s, null)}
                  className="rounded-full border border-ink/10 bg-bg px-3 py-1 text-[11px] font-semibold text-forest-deep hover:border-forest hover:bg-forest-pale"
                >
                  {s}
                </button>
              ))}
            </div>

            {aiMessages.length > 0 && (
              <div className="mb-3 max-h-64 space-y-2.5 overflow-y-auto rounded-2xl bg-bg p-3">
                {aiMessages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`rounded-2xl px-3.5 py-2.5 text-xs ${
                      m.role === "user"
                        ? "ml-auto max-w-[80%] bg-forest-deep text-white"
                        : "max-w-[90%] border border-ink/10 bg-surface text-ink"
                    }`}
                  >
                    {m.role === "user" ? m.content : <MarkdownText text={m.content} />}
                  </div>
                ))}
                {aiLoading && <div className="text-xs text-secondary">AI Chef is writing...</div>}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                askMealAI(undefined, null);
              }}
              className="flex items-center gap-2"
            >
              <input
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder={`Ask about meals, recipes, or budget in ${currency.code}...`}
                className="flex-1 rounded-full border border-ink/15 bg-bg px-4 py-2.5 text-xs text-ink focus:border-forest focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={aiLoading || !aiInput.trim()}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-forest-deep text-lime hover:bg-forest disabled:opacity-40"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </section>
        )}

        {loading || !data ? (
          <div className="rounded-[28px] border border-ink/10 bg-surface p-12 text-center text-sm text-secondary shadow-soft">
            Loading your nutrition targets, plate photos & ingredient prices...
          </div>
        ) : (
          <>
            {/* Daily Targets Banner (Dark Forest) */}
            <section className="mb-8 rounded-[28px] border border-white/10 bg-dark p-6 text-white shadow-card">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-lime" />
                  <h2 className="font-display text-lg font-bold">Your Daily Macro Targets</h2>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 capitalize text-[#C5D4CA]">
                    Diet: {data.diet}
                  </span>
                  {data.allergies.length > 0 && (
                    <span className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-amber-300">
                      Excluding: {data.allergies.join(", ")}
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div className="rounded-2xl bg-dark-2 p-3.5 text-center ring-1 ring-white/5">
                  <div className="font-display text-2xl font-extrabold text-lime">{data.targets.calories}</div>
                  <div className="text-[11px] text-[#9AA5A0]">Calories (kcal)</div>
                </div>
                <div className="rounded-2xl bg-dark-2 p-3.5 text-center ring-1 ring-white/5">
                  <div className="font-display text-2xl font-extrabold text-white">{data.targets.protein_g} g</div>
                  <div className="text-[11px] text-[#9AA5A0]">Protein</div>
                </div>
                <div className="rounded-2xl bg-dark-2 p-3.5 text-center ring-1 ring-white/5">
                  <div className="font-display text-2xl font-extrabold text-white">{data.targets.carbs_g} g</div>
                  <div className="text-[11px] text-[#9AA5A0]">Carbs</div>
                </div>
                <div className="rounded-2xl bg-dark-2 p-3.5 text-center ring-1 ring-white/5">
                  <div className="font-display text-2xl font-extrabold text-white">{data.targets.fat_g} g</div>
                  <div className="text-[11px] text-[#9AA5A0]">Healthy Fats</div>
                </div>
                <div className="col-span-2 rounded-2xl bg-dark-2 p-3.5 text-center ring-1 ring-white/5 sm:col-span-1">
                  <div className="flex items-center justify-center gap-1 font-display text-2xl font-extrabold text-sky-300">
                    <Droplets className="h-5 w-5" /> {data.targets.water_l} L
                  </div>
                  <div className="text-[11px] text-[#9AA5A0]">Daily Water</div>
                </div>
              </div>
              <p className="mt-3 text-xs text-[#A8BCB0]">{data.targets.note}</p>
            </section>

            {/* TWO NEW FEATURES: 1) Cook With What's at Home (Recraft Image Gen) + 2) Healthy Restaurants Near You */}
            <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* 1) What's in my fridge? + Recraft Dish Image Generator */}
              <section className="flex flex-col justify-between rounded-[28px] border border-ink/10 bg-surface p-6 shadow-soft">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-lime/70 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-forest-deep">
                      <ChefHat className="h-3.5 w-3.5" /> AI Fridge Chef + Plate Image Gen
                    </span>
                    <span className="text-[11px] font-semibold text-tertiary">Recraft V4.1 Flash V2</span>
                  </div>
                  <h2 className="font-display text-xl font-extrabold text-forest-deep">
                    Cook with what you have at home
                  </h2>
                  <p className="mt-1 text-xs text-secondary">
                    List the ingredients in your fridge/pantry — our AI creates step-by-step meals for your macros and
                    generates a picture of the dish.
                  </p>

                  <form onSubmit={generateFromFridge} className="mt-4 space-y-2.5">
                    <input
                      value={fridgeInput}
                      onChange={(e) => setFridgeInput(e.target.value)}
                      placeholder="e.g. chicken breast, 3 eggs, rice, spinach, olive oil, garlic..."
                      className="w-full rounded-2xl border border-ink/15 bg-bg px-4 py-2.5 text-xs text-ink placeholder:text-tertiary focus:border-forest focus:bg-white focus:outline-none"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1">
                        {[
                          "chicken, rice, broccoli, garlic",
                          "eggs, oats, banana, Greek yogurt",
                          "canned tuna, pasta, tomatoes, olive oil",
                        ].map((sample) => (
                          <button
                            key={sample}
                            type="button"
                            onClick={() => setFridgeInput(sample)}
                            className="rounded-full bg-bg px-2.5 py-1 text-[10px] font-semibold text-secondary hover:bg-forest-pale hover:text-forest-deep"
                          >
                            {sample}
                          </button>
                        ))}
                      </div>
                      <button
                        type="submit"
                        disabled={fridgeLoading || !fridgeInput.trim()}
                        className="inline-flex items-center gap-1.5 rounded-full bg-forest-deep px-4 py-2 text-xs font-bold text-lime shadow-soft transition hover:bg-forest disabled:opacity-40"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {fridgeLoading ? "Cooking & generating image..." : "Generate Meals"}
                      </button>
                    </div>
                  </form>

                  {fridgeError && (
                    <p className="mt-3 rounded-xl bg-[#F16060]/10 p-2.5 text-xs text-red-700">{fridgeError}</p>
                  )}

                  {fridgeResult && (
                    <div className="mt-4 space-y-3 rounded-2xl border border-ink/10 bg-bg p-4">
                      {fridgeResult.generated_image_url && (
                        <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
                          <img
                            src={fridgeResult.generated_image_url}
                            alt="AI generated dish"
                            className="max-h-56 w-full object-cover"
                          />
                        </div>
                      )}
                      <MarkdownText text={fridgeResult.reply} />
                    </div>
                  )}
                </div>
              </section>

              {/* 2) Healthy Restaurants Near You */}
              <section className="flex flex-col justify-between rounded-[28px] border border-ink/10 bg-surface p-6 shadow-soft">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-lime/70 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-forest-deep">
                      <MapPin className="h-3.5 w-3.5" /> Location Macro Finder
                    </span>
                    {restLocation && (
                      <span className="text-[11px] font-bold text-forest">Near {restLocation}</span>
                    )}
                  </div>
                  <h2 className="font-display text-xl font-extrabold text-forest-deep">
                    Healthy restaurants close to you
                  </h2>
                  <p className="mt-1 text-xs text-secondary">
                    Use your phone/browser GPS or search any city to see real nearby spots and the best high-protein dish
                    to order for your goal.
                  </p>

                  <form onSubmit={findNearbyByCity} className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={findNearbyByGPS}
                      disabled={restLoading}
                      className="inline-flex items-center gap-1.5 rounded-full bg-forest-deep px-4 py-2 text-xs font-bold text-lime shadow-soft transition hover:bg-forest disabled:opacity-40"
                    >
                      <Navigation className="h-3.5 w-3.5" /> Use My GPS
                    </button>
                    <input
                      value={cityInput}
                      onChange={(e) => setCityInput(e.target.value)}
                      placeholder="Or enter city (e.g. Casablanca, Rabat, Paris)..."
                      className="min-w-[160px] flex-1 rounded-full border border-ink/15 bg-bg px-3.5 py-2 text-xs text-ink focus:border-forest focus:bg-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={restLoading || !cityInput.trim()}
                      className="rounded-full border border-ink/15 bg-bg px-4 py-2 text-xs font-bold text-forest-deep hover:bg-forest-pale disabled:opacity-40"
                    >
                      {restLoading ? "Searching..." : "Search City"}
                    </button>
                  </form>

                  {restError && (
                    <p className="mt-3 rounded-xl bg-[#F16060]/10 p-2.5 text-xs text-red-700">{restError}</p>
                  )}

                  {restLoading && (
                    <p className="mt-3 text-xs text-secondary">Looking for healthy places near you... this can take a few seconds.</p>
                  )}
                  {!restLoading && restSearched && !restError && restaurants.length === 0 && (
                    <p className="mt-3 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900">
                      No restaurants found on the map around {restLocation || "this place"}. Try a nearby city centre or neighbourhood name.
                    </p>
                  )}
                  {restaurants.length > 0 && (
                    <div className="mt-4 max-h-[34rem] space-y-3 overflow-y-auto pr-1">
                      {restaurants.map((pl, idx) => (
                        <div
                          key={`${pl.name}-${idx}`}
                          className="overflow-hidden rounded-2xl border border-ink/10 bg-bg text-xs"
                        >
                          <div className="flex gap-3 p-3">
                            {pl.photo_url ? (
                              <img
                                src={pl.photo_url}
                                alt={pl.name}
                                loading="lazy"
                                className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-ink/10 sm:h-24 sm:w-24"
                                onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                              />
                            ) : (
                              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-forest-pale text-forest sm:h-24 sm:w-24">
                                <Utensils className="h-6 w-6" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <span className="font-bold text-forest-deep">{pl.name}</span>
                                {pl.distance_km != null && (
                                  <span className="shrink-0 font-bold text-forest">{pl.distance_km} km</span>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                {pl.rating != null && (
                                  <span className="inline-flex items-center gap-0.5 font-bold text-amber-700">
                                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                    {pl.rating.toFixed(1)}
                                    {pl.rating_count ? (
                                      <span className="font-normal text-tertiary">({pl.rating_count.toLocaleString()})</span>
                                    ) : null}
                                  </span>
                                )}
                                {pl.price && <span className="text-tertiary">· {pl.price}</span>}
                                <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-secondary ring-1 ring-ink/10">
                                  {pl.cuisine}
                                </span>
                                {pl.healthy_pick && (
                                  <span className="rounded-full bg-lime/60 px-2 py-0.5 text-[10px] font-bold text-forest-deep">
                                    Healthy pick
                                  </span>
                                )}
                                {(pl.badges || []).map((b) => (
                                  <span key={b} className="rounded-full bg-forest-pale px-2 py-0.5 text-[10px] font-bold text-forest">
                                    {b}
                                  </span>
                                ))}
                              </div>
                              {pl.hours_text && (
                                <div
                                  className={`mt-1 inline-flex items-center gap-1 text-[11px] font-semibold ${
                                    pl.open_now === false ? "text-red-700" : "text-forest"
                                  }`}
                                >
                                  <Clock className="h-3 w-3" /> {pl.hours_text}
                                </div>
                              )}
                              {pl.summary && <p className="mt-1 line-clamp-2 text-[11px] text-secondary">{pl.summary}</p>}
                            </div>
                          </div>
                          <div className="mx-3 rounded-xl bg-forest-pale/70 p-2 text-forest-deep">
                            <div className="text-[10px] font-extrabold uppercase tracking-wide text-forest">
                              What to order for your goal:
                            </div>
                            {(pl.dishes && pl.dishes.length > 0
                              ? pl.dishes
                              : [{ dish: pl.recommended_dish, kcal: pl.est_kcal, protein_g: pl.est_protein_g, tip: "" }]
                            ).map((d, i) => (
                              <div key={i} className={i > 0 ? "mt-1.5 border-t border-forest/10 pt-1.5" : ""}>
                                <div className="font-semibold">{d.dish}</div>
                                <div className="text-[11px] text-secondary">
                                  {d.kcal ? <>~{d.kcal} kcal · </> : null}
                                  {d.protein_g ? <strong>{d.protein_g}g protein</strong> : null}
                                  {d.tip ? <span> · {d.tip}</span> : null}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center justify-between gap-2 p-3 pt-2 text-[11px]">
                            <span className="truncate text-tertiary">{pl.address}</span>
                            <a
                              href={pl.maps_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex shrink-0 items-center gap-1 font-bold text-forest hover:underline"
                            >
                              Open in Google Maps <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>

            {/* Recipes & Weekly Meal Prep with Real Plate Images + Pricing */}
            <section className="mb-10">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="flex items-center gap-2 font-display text-xl font-extrabold text-forest-deep">
                    <Utensils className="h-5 w-5 text-forest" /> Meals, Plate Photos & Pricing ({currency.code})
                  </h2>
                  <p className="text-xs text-secondary">
                    Showing <strong>{visibleRecipes.length}</strong> of <strong>{recipes.length}</strong> meals matching your filters
                  </p>
                </div>

                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-tertiary" />
                  <input
                    value={mealSearch}
                    onChange={(e) => {
                      setMealSearch(e.target.value);
                      setVisibleCount(18);
                    }}
                    placeholder="Search chicken, pasta, Moroccan, salmon..."
                    className="w-full rounded-full border border-ink/15 bg-surface py-2 pl-9 pr-4 text-xs text-ink shadow-soft focus:border-forest focus:outline-none"
                  />
                </div>
              </div>

              <div className="mb-5 flex flex-wrap gap-1.5 rounded-full border border-ink/10 bg-surface p-1 shadow-soft">
                {[
                  ["all", `All (${data.recipes.length})`],
                  ["high_protein", "High Protein"],
                  ["cheap", "Budget"],
                  ["breakfast", "Breakfast"],
                  ["lunch", "Lunch"],
                  ["dinner", "Dinner"],
                  ["snack", "Snacks"],
                  ["meal_prep", "Meal Prep"],
                  ["mena", "MENA / Halal"],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => {
                      setMealFilter(k);
                      setVisibleCount(18);
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                      mealFilter === k ? "bg-forest-deep text-lime" : "text-secondary hover:bg-bg"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {visibleRecipes.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => openRecipe(r)}
                    className="group flex cursor-pointer flex-col overflow-hidden rounded-[26px] border border-ink/10 bg-surface shadow-soft transition hover:-translate-y-1 hover:border-forest/40 hover:shadow-card"
                  >
                    {/* Dish Photo */}
                    <div className="relative h-44 w-full overflow-hidden bg-forest-pale">
                      {r.image_url && (
                        <img
                          src={r.image_url}
                          alt={r.name}
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                        />
                      )}
                      <div className="absolute left-3 top-3 flex gap-1.5">
                        <span className="rounded-full bg-dark/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lime backdrop-blur">
                          {r.meal}
                        </span>
                        {r.tags.includes("freezer_friendly") && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-sky-900/80 px-2 py-0.5 text-[10px] font-semibold text-sky-200 backdrop-blur">
                            <Snowflake className="h-3 w-3" /> Freezer
                          </span>
                        )}
                      </div>
                      <span className="absolute bottom-3 right-3 rounded-full bg-lime px-3 py-1 text-xs font-extrabold text-forest-deep shadow-soft">
                        {fmtPrice(r.price_per_serving_usd)} / serv
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col justify-between p-4">
                      <div>
                        <div className="flex items-center justify-between text-[11px] text-tertiary">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {r.time_min} min · {r.servings} servings
                          </span>
                          <span>Batch: {fmtPrice(r.total_price_usd)}</span>
                        </div>
                        <h3 className="mt-1.5 font-display text-base font-bold text-forest-deep">{r.name}</h3>
                        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                          <span className="rounded-full bg-forest-pale px-2.5 py-0.5 font-extrabold text-forest-deep">
                            {r.kcal} kcal
                          </span>
                          <span className="rounded-full bg-bg px-2.5 py-0.5 font-semibold text-secondary">
                            P {r.protein}g
                          </span>
                          <span className="rounded-full bg-bg px-2.5 py-0.5 text-tertiary">C {r.carbs}g</span>
                          <span className="rounded-full bg-bg px-2.5 py-0.5 text-tertiary">F {r.fat}g</span>
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-ink/10 pt-3 text-xs">
                        <span className="font-semibold text-secondary">Customize & add-ons</span>
                        <span className="inline-flex items-center gap-1 font-bold text-forest">
                          Open & Ask AI <ArrowRight className="h-3.5 w-3.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {visibleCount < recipes.length && (
                <div className="mt-6 text-center">
                  <button
                    onClick={() => setVisibleCount((c) => c + 18)}
                    className="inline-flex items-center gap-2 rounded-full bg-forest-deep px-6 py-2.5 text-xs font-bold text-lime shadow-soft transition hover:bg-forest"
                  >
                    Load more meals ({recipes.length - visibleCount} remaining)
                  </button>
                </div>
              )}
            </section>

            {/* Food Macro Database */}
            <section className="rounded-[28px] border border-ink/10 bg-surface p-6 shadow-soft">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-extrabold text-forest-deep">Food & Macro Library</h2>
                  <p className="text-xs text-secondary">Curated staples & Moroccan/MENA foods filtered for your profile.</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-tertiary" />
                  <input
                    value={foodQuery}
                    onChange={(e) => setFoodQuery(e.target.value)}
                    placeholder="Search chicken, tajine, oats..."
                    className="w-full rounded-full border border-ink/15 bg-bg py-2 pl-9 pr-4 text-xs text-ink focus:border-forest focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-surface text-[11px] uppercase tracking-wider text-tertiary">
                    <tr className="border-b border-ink/10">
                      <th className="py-2 pr-3">Food</th>
                      <th className="py-2 pr-3">Portion</th>
                      <th className="py-2 pr-3 text-right">kcal</th>
                      <th className="py-2 pr-3 text-right">Protein</th>
                      <th className="py-2 pr-3 text-right">Carbs</th>
                      <th className="py-2 text-right">Fat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/5">
                    {foods.map((f) => (
                      <tr key={f.id} className="hover:bg-bg/70">
                        <td className="py-2.5 pr-3 font-semibold text-forest-deep">{f.name}</td>
                        <td className="py-2.5 pr-3 text-tertiary">{f.per}</td>
                        <td className="py-2.5 pr-3 text-right font-bold text-ink">{f.kcal}</td>
                        <td className="py-2.5 pr-3 text-right font-semibold text-forest">{f.protein}g</td>
                        <td className="py-2.5 pr-3 text-right text-secondary">{f.carbs}g</td>
                        <td className="py-2.5 text-right text-secondary">{f.fat}g</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>

      {/* Interactive Meal Builder + Ingredient Pricing + Add-Ons + AI Chef Modal */}
      {activeRecipe && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-dark/65 p-4 backdrop-blur-sm"
          onClick={() => setActiveRecipe(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-ink/10 bg-surface shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Dish Hero Image */}
            <div className="relative h-52 w-full bg-dark">
              {activeRecipe.image_url && (
                <img src={activeRecipe.image_url} alt={activeRecipe.name} className="h-full w-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-dark/90 via-dark/30 to-transparent" />
              <button
                onClick={() => setActiveRecipe(null)}
                className="absolute right-4 top-4 rounded-full bg-dark/70 p-2 text-white backdrop-blur hover:bg-dark"
              >
                <X className="h-5 w-5" />
              </button>
              <div className="absolute bottom-4 left-5 right-5 flex flex-wrap items-end justify-between gap-2 text-white">
                <div>
                  <span className="rounded-full bg-lime px-2.5 py-0.5 text-[10px] font-extrabold uppercase text-forest-deep">
                    {activeRecipe.meal} · {activeRecipe.time_min} min · {activeRecipe.servings} servings
                  </span>
                  <h3 className="mt-1.5 font-display text-2xl font-extrabold">{activeRecipe.name}</h3>
                </div>
                <div className="rounded-2xl bg-dark/80 px-3.5 py-2 text-right backdrop-blur">
                  <div className="font-display text-lg font-extrabold text-lime">{fmtPrice(liveServingUsd)}</div>
                  <div className="text-[10px] text-[#C5D4CA]">per serving ({currency.code})</div>
                </div>
              </div>
            </div>

            <div className="space-y-5 p-6">
              {/* Live Macros (Base + Add-Ons) */}
              <div className="grid grid-cols-4 gap-2 rounded-2xl bg-bg p-3 text-center text-xs">
                <div>
                  <div className="font-display text-lg font-extrabold text-forest-deep">{liveKcal}</div>
                  <div className="text-[10px] text-tertiary">kcal</div>
                </div>
                <div>
                  <div className="font-display text-lg font-extrabold text-forest">{liveProtein}g</div>
                  <div className="text-[10px] text-tertiary">Protein</div>
                </div>
                <div>
                  <div className="font-display text-lg font-extrabold text-ink">{liveCarbs}g</div>
                  <div className="text-[10px] text-tertiary">Carbs</div>
                </div>
                <div>
                  <div className="font-display text-lg font-extrabold text-ink">{liveFat}g</div>
                  <div className="text-[10px] text-tertiary">Fat</div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {/* Per-Ingredient Pricing Breakdown */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="font-display text-xs font-bold uppercase tracking-wider text-tertiary">
                      Ingredients & Pricing ({activeRecipe.servings} serv.)
                    </h4>
                    <span className="text-xs font-bold text-forest-deep">
                      Batch: {fmtPrice(activeRecipe.total_price_usd)}
                    </span>
                  </div>
                  <ul className="divide-y divide-ink/5 rounded-2xl border border-ink/10 bg-bg px-3.5 py-1 text-xs">
                    {(activeRecipe.ingredients_priced || activeRecipe.ingredients.map((i) => ({ name: i, price_usd: 0.5 }))).map(
                      (ing, idx) => (
                        <li key={idx} className="flex items-center justify-between gap-2 py-2">
                          <span className="text-secondary">{ing.name}</span>
                          <span className="shrink-0 font-bold text-forest-deep">{fmtPrice(ing.price_usd)}</span>
                        </li>
                      )
                    )}
                  </ul>

                  <h4 className="mb-1 mt-4 font-display text-xs font-bold uppercase tracking-wider text-tertiary">
                    Preparation & Storage
                  </h4>
                  <p className="text-xs leading-relaxed text-secondary">{activeRecipe.steps}</p>
                </div>

                {/* Interactive Meal Add-Ons */}
                <div>
                  <h4 className="mb-2 font-display text-xs font-bold uppercase tracking-wider text-tertiary">
                    Add-Ons to This Meal (Updates Macros & Price)
                  </h4>
                  <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                    {(data?.addons || []).map((addon) => {
                      const active = selectedAddons.includes(addon.id);
                      return (
                        <button
                          key={addon.id}
                          type="button"
                          onClick={() => toggleAddon(addon.id)}
                          className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left text-xs transition ${
                            active
                              ? "border-forest bg-forest-pale font-bold text-forest-deep"
                              : "border-ink/10 bg-bg text-ink hover:border-forest/40"
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="truncate">{addon.name}</div>
                            <div className="text-[10px] font-medium text-tertiary">
                              +{addon.kcal} kcal · +{addon.protein}g P
                            </div>
                          </div>
                          <div className="ml-2 flex shrink-0 items-center gap-2">
                            <span className="font-bold text-forest-deep">{fmtPrice(addon.price_usd)}</span>
                            <span
                              className={`flex h-5 w-5 items-center justify-center rounded-full ${
                                active ? "bg-forest-deep text-lime" : "bg-surface text-tertiary ring-1 ring-ink/15"
                              }`}
                            >
                              {active ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Embedded AI Chef Chat for THIS Meal */}
              <div className="rounded-2xl border border-forest/20 bg-bg p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-forest-deep text-lime">
                    <Bot className="h-4 w-4" />
                  </span>
                  <div>
                    <h4 className="font-display text-sm font-bold text-forest-deep">Ask AI Coach about this meal</h4>
                    <p className="text-[11px] text-secondary">
                      Ask how to cook it step-by-step, swap ingredients, or lower the cost.
                    </p>
                  </div>
                </div>

                <div className="mb-2.5 flex flex-wrap gap-1.5">
                  {[
                    "Explain step-by-step how to cook this",
                    "How can I make this meal cheaper?",
                    "How do I store and reheat it safely?",
                    "Suggest a high-protein substitute",
                  ].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => askMealAI(q, activeRecipe)}
                      className="rounded-full border border-ink/10 bg-surface px-2.5 py-1 text-[11px] font-semibold text-forest-deep hover:border-forest hover:bg-forest-pale"
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {aiMessages.length > 0 && (
                  <div className="mb-2.5 max-h-52 space-y-2 overflow-y-auto rounded-xl bg-surface p-3">
                    {aiMessages.map((m, i) => (
                      <div
                        key={i}
                        className={`rounded-2xl px-3 py-2 text-xs ${
                          m.role === "user"
                            ? "ml-auto max-w-[80%] bg-forest-deep text-white"
                            : "max-w-[92%] bg-bg text-ink"
                        }`}
                      >
                        {m.role === "user" ? m.content : <MarkdownText text={m.content} />}
                      </div>
                    ))}
                    {aiLoading && <div className="text-xs text-secondary">AI Coach is cooking up an answer...</div>}
                  </div>
                )}

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    askMealAI(undefined, activeRecipe);
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    value={aiInput}
                    onChange={(e) => setAiInput(e.target.value)}
                    placeholder={`Ask anything about ${activeRecipe.name}...`}
                    className="flex-1 rounded-full border border-ink/15 bg-surface px-3.5 py-2 text-xs text-ink focus:border-forest focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={aiLoading || !aiInput.trim()}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-deep text-lime hover:bg-forest disabled:opacity-40"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

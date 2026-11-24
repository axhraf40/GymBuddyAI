"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Camera,
  CheckCircle2,
  Cpu,
  Crown,
  Droplets,
  Flame,
  PauseCircle,
  ShieldCheck,
  Sparkles,
  Timer,
  Utensils,
} from "lucide-react";
import { api } from "@/lib/api";
import type { UserOut } from "@/lib/types";
import { Navbar } from "@/components/Navbar";

const STORAGE_USER_KEY = "gymbuddy_user_id";

export default function LandingPage() {
  const [user, setUser] = useState<UserOut | null>(null);

  useEffect(() => {
    const savedId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_USER_KEY) : null;
    if (savedId) {
      api.getUser(savedId).then(setUser).catch(() => {});
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <Navbar user={user} />

      <main className="flex-1">
        {/* HERO SECTION (Metrya-inspired editorial typography & sage canvas) */}
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-12 sm:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-forest-deep/10 bg-lime/70 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-forest-deep">
              <Sparkles className="h-3.5 w-3.5" /> Your All-In-One AI Workout & Nutrition Partner
            </span>

            <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.04] tracking-tight text-forest-deep sm:text-6xl">
              Your entire gym life, <span className="text-forest">explained and guided.</span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-secondary sm:text-lg">
              GymBuddy AI replaces fragmented workout trackers, calorie apps, and generic chatbots with one personalized
              platform: an interactive muscle map, live in-gym chrono, equipment photo scanner, and tailored nutrition.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/coach"
                className="inline-flex items-center gap-2 rounded-full bg-forest-deep px-7 py-3.5 text-sm font-extrabold text-lime shadow-card transition hover:bg-forest"
              >
                Open AI Coach & Muscle Map <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/gym"
                className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-surface px-6 py-3.5 text-sm font-bold text-forest-deep shadow-soft transition hover:border-forest hover:bg-forest-pale/60"
              >
                <Timer className="h-4 w-4 text-forest" /> Launch In-Gym Chrono
              </Link>
              <Link
                href="/nutrition"
                className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-surface px-6 py-3.5 text-sm font-bold text-forest-deep shadow-soft transition hover:border-forest hover:bg-forest-pale/60"
              >
                <Utensils className="h-4 w-4 text-forest" /> Nutrition & Meal Prep
              </Link>
            </div>
          </div>

          {/* 4-Pillar Bento Overview */}
          <div className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-[24px] border border-ink/10 bg-surface p-5 shadow-soft">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-forest-deep text-lime">
                <Bot className="h-5 w-5" />
              </div>
              <h3 className="font-display text-base font-bold text-forest-deep">RAG AI Coach</h3>
              <p className="mt-1 text-xs leading-relaxed text-secondary">
                Choose from 6 AI models grounded in 146 curated exercise, food & equipment guides.
              </p>
            </div>

            <div className="rounded-[24px] border border-ink/10 bg-surface p-5 shadow-soft">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-forest-deep text-lime">
                <Camera className="h-5 w-5" />
              </div>
              <h3 className="font-display text-base font-bold text-forest-deep">Equipment Scanner</h3>
              <p className="mt-1 text-xs leading-relaxed text-secondary">
                Snap a photo of any gym machine to see target muscles, safe setup steps, and injury warnings.
              </p>
            </div>

            <div className="rounded-[24px] border border-ink/10 bg-surface p-5 shadow-soft">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-forest-deep text-lime">
                <Timer className="h-5 w-5" />
              </div>
              <h3 className="font-display text-base font-bold text-forest-deep">Smart In-Gym Chrono</h3>
              <p className="mt-1 text-xs leading-relaxed text-secondary">
                Guided sets & rest countdowns, Equipment-Busy pause/swap mode, voice cues, and rest-only water alerts.
              </p>
            </div>

            <div className="rounded-[24px] border border-ink/10 bg-surface p-5 shadow-soft">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-forest-deep text-lime">
                <Utensils className="h-5 w-5" />
              </div>
              <h3 className="font-display text-base font-bold text-forest-deep">Nutrition & Meal Prep</h3>
              <p className="mt-1 text-xs leading-relaxed text-secondary">
                Deterministic Mifflin-St Jeor macros, allergen-safe freezer recipes, and halal / Moroccan dishes.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 1: AI COACH & INTERACTIVE MUSCLE MAP */}
        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="grid grid-cols-1 items-center gap-8 rounded-[32px] border border-ink/10 bg-surface p-7 shadow-card lg:grid-cols-12 lg:p-10">
            <div className="lg:col-span-7">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-lime/70 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-forest-deep">
                Section 01 · AI Chatbot & Muscle Map
              </span>
              <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-forest-deep sm:text-4xl">
                Click any muscle. <span className="text-forest">See the exact form.</span>
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-secondary">
                No more guessing what to do on Push, Pull, or Leg day. Tap any of the 15 muscles on our front/back
                anatomical body map to inspect animated GIF guides filtered for your equipment, split, and
                injuries—then chat with our RAG coach or upload a machine photo.
              </p>

              <ul className="mt-5 space-y-2.5 text-sm text-secondary">
                <li className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-forest" />
                  <span>55 exercises with real animated GIF guides & step-by-step EN/FR instructions</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <Cpu className="h-4 w-4 shrink-0 text-forest" />
                  <span>Switch live between 6 AI models right under the chat composer</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-forest" />
                  <span>Strict safety guardrails: calorie floor, allergen exclusion, injury warnings & medical disclaimers</span>
                </li>
              </ul>

              <div className="mt-6">
                <Link
                  href="/coach"
                  className="inline-flex items-center gap-2 rounded-full bg-forest-deep px-6 py-3 text-sm font-bold text-lime shadow-soft transition hover:bg-forest"
                >
                  Open AI Coach Workspace <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-dark p-6 text-white lg:col-span-5">
              <div className="flex items-center justify-between text-xs">
                <span className="rounded-full bg-lime/15 px-3 py-1 font-bold text-lime">Live Preview</span>
                <span className="text-[#9AA5A0]">RAG + Vision AI</span>
              </div>
              <div className="mt-4 space-y-3 text-xs">
                <div className="ml-auto max-w-[85%] rounded-2xl bg-forest-deep px-3.5 py-2.5 text-white">
                  <div className="mb-1 text-[10px] font-bold uppercase text-lime">Muscle: Chest · Split: PPL</div>
                  What are the best dumbbell chest exercises for a beginner?
                </div>
                <div className="max-w-[92%] rounded-2xl bg-dark-2 p-3.5 text-[#D6E3DA] ring-1 ring-white/10">
                  <p className="font-semibold text-white">Here is your beginner dumbbell chest routine:</p>
                  <p className="mt-1.5">• <strong>Dumbbell Bench Press</strong> — 3×8–12 (rest 90s) <span className="rounded bg-lime/20 px-1 text-lime">[S1]</span></p>
                  <p className="mt-1">• <strong>Incline Dumbbell Press</strong> — 3×8–12 (rest 90s) <span className="rounded bg-lime/20 px-1 text-lime">[S2]</span></p>
                  <p className="mt-1">• <strong>Push-Up</strong> — 3 sets to 2 RIR <span className="rounded bg-lime/20 px-1 text-lime">[S3]</span></p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: IN-GYM SMART CHRONO (Dark Forest Showcase) */}
        <section className="mx-auto max-w-6xl px-4 py-10">
          <div className="grid grid-cols-1 items-center gap-8 rounded-[32px] border border-lime/20 bg-dark p-7 text-white shadow-card lg:grid-cols-12 lg:p-10">
            <div className="lg:col-span-7">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-lime/25 bg-lime/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-lime">
                Section 02 · In-Gym Session Chrono
              </span>
              <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
                Stay in the zone. <span className="text-lime">Even when the gym is packed.</span>
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#B4C5BA]">
                Our guided workout timer walks you through every set, logs your weight and reps, counts down your rest
                automatically with voice cues, and handles busy equipment without breaking your session.
              </p>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 text-xs text-[#D6E3DA]">
                <div className="flex items-start gap-2.5 rounded-2xl bg-dark-2 p-3.5 ring-1 ring-white/5">
                  <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                  <div>
                    <div className="font-bold text-white">Equipment Busy Mode</div>
                    <p className="mt-0.5 text-[#9AA5A0]">Freeze the clock, reorder the next exercise, or swap to a free machine.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-2xl bg-dark-2 p-3.5 ring-1 ring-white/5">
                  <Droplets className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
                  <div>
                    <div className="font-bold text-white">Rest-Only Hydration Cues</div>
                    <p className="mt-0.5 text-[#9AA5A0]">Reminds you to drink water between sets—never mid-rep—with 1-tap logging.</p>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <Link
                  href="/gym"
                  className="inline-flex items-center gap-2 rounded-full bg-lime px-6 py-3 text-sm font-extrabold text-forest-deep shadow-soft transition hover:brightness-95"
                >
                  Launch In-Gym Chrono <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/10 bg-dark-2 p-6 text-center lg:col-span-5">
              <span className="rounded-full bg-lime px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-forest-deep">
                Active Set · Push Day
              </span>
              <h3 className="mt-3 font-display text-xl font-bold text-white">Dumbbell Bench Press</h3>
              <p className="text-xs text-[#9AA5A0]">Set 2 / 4 · Target: 8–10 reps @ 24 kg</p>
              <div className="my-5 font-display text-6xl font-extrabold tracking-tight text-lime">01:30</div>
              <div className="flex justify-center gap-2 text-xs">
                <span className="rounded-full bg-white/10 px-3 py-1 text-[#C5D4CA]">🔊 Voice ON</span>
                <span className="rounded-full bg-sky-400/15 px-3 py-1 text-sky-300">💧 500 ml</span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 3: NUTRITION, RECIPES & MEAL PREP */}
        <section className="mx-auto max-w-6xl px-4 py-10 pb-20">
          <div className="grid grid-cols-1 items-center gap-8 rounded-[32px] border border-ink/10 bg-surface p-7 shadow-card lg:grid-cols-12 lg:p-10">
            <div className="lg:col-span-7">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-lime/70 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-forest-deep">
                Section 03 · Nutrition & Meal Prep
              </span>
              <h2 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-forest-deep sm:text-4xl">
                Real macros. <span className="text-forest">Halal & freezer-ready meals.</span>
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-secondary">
                Calories and protein targets are calculated deterministically with Mifflin-St Jeor (never guessed by an
                LLM). Browse high-protein recipes—including chicken tajine, harira, and batch-cooked meal prep bowls—all
                automatically filtered for your allergies and diet.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/nutrition"
                  className="inline-flex items-center gap-2 rounded-full bg-forest-deep px-6 py-3 text-sm font-bold text-lime shadow-soft transition hover:bg-forest"
                >
                  Explore Nutrition & Recipes <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-bg px-6 py-3 text-sm font-bold text-forest-deep transition hover:bg-forest-pale"
                >
                  <Crown className="h-4 w-4 text-forest" /> View Plans
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:col-span-5">
              <div className="rounded-2xl border border-ink/10 bg-bg p-4">
                <Flame className="h-5 w-5 text-forest" />
                <div className="mt-2 font-display text-2xl font-extrabold text-forest-deep">
                  {user ? `${user.targets.calories}` : "2,450"}
                </div>
                <div className="text-xs text-secondary">Daily kcal target</div>
              </div>
              <div className="rounded-2xl border border-ink/10 bg-bg p-4">
                <Utensils className="h-5 w-5 text-forest" />
                <div className="mt-2 font-display text-2xl font-extrabold text-forest-deep">12+</div>
                <div className="text-xs text-secondary">Meal-prep & MENA recipes</div>
              </div>
              <div className="col-span-2 rounded-2xl border border-forest/20 bg-forest-pale/60 p-4 text-xs text-forest-deep">
                <strong>Safety guaranteed:</strong> Recipes containing your declared allergies are automatically hidden,
                and calories never drop below healthy medical floors.
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink/10 bg-surface py-6 text-center text-xs text-tertiary">
        GymBuddy AI — Your AI Gym & Nutrition Partner ·{" "}
        <Link href="/coach" className="font-semibold text-forest hover:underline">AI Coach</Link> ·{" "}
        <Link href="/gym" className="font-semibold text-forest hover:underline">Chrono</Link> ·{" "}
        <Link href="/nutrition" className="font-semibold text-forest hover:underline">Nutrition</Link> ·{" "}
        <Link href="/pricing" className="font-semibold text-forest hover:underline">Pricing</Link> ·{" "}
        <Link href="/privacy" className="font-semibold text-forest hover:underline">Privacy Policy</Link> ·{" "}
        <Link href="/terms" className="font-semibold text-forest hover:underline">Terms</Link>
      </footer>
    </div>
  );
}

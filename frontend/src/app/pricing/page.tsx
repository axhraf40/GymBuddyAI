"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Crown, Sparkles, Zap } from "lucide-react";
import { api } from "@/lib/api";
import type { UserOut } from "@/lib/types";
import { Navbar } from "@/components/Navbar";

const STORAGE_USER_KEY = "gymbuddy_user_id";

const FREE_FEATURES = [
  "Personalized calorie & macro targets (Mifflin-St Jeor)",
  "Interactive Muscle Map (15 muscles, Front & Back)",
  "55 exercises with animated GIF guides & form instructions",
  "AI Gym & Nutrition Coach chatbot with RAG citations",
  "Basic In-Gym Session Chrono & set logging",
  "Safety guardrails (allergies, injuries, calorie floor)",
];

const PRO_FEATURES = [
  "Everything in Free, plus:",
  "Smart Gym Chrono Pro: Equipment-Busy pause, instant exercise swaps & voice coaching",
  "Gym Equipment Photo Scanner (snap any machine 📷)",
  "Daily AI morning coaching emails (n8n automation)",
  "Unlimited conversation history & adaptive coaching",
  "Priority access to upcoming Ramadan mode & mobile app",
];

export default function PricingPage() {
  const [user, setUser] = useState<UserOut | null>(null);
  const [annual, setAnnual] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const savedId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_USER_KEY) : null;
    if (savedId) {
      api.getUser(savedId).then(setUser).catch(() => {});
    }
  }, []);

  const switchPlan = async (plan: "free" | "pro") => {
    if (!user) {
      setToast("Please sign in or set up your profile first.");
      return;
    }
    setUpdating(true);
    setToast(null);
    try {
      const updated = await api.setPlan(user.user_id, plan);
      setUser(updated);
      setToast(
        plan === "pro"
          ? "🎉 GymBuddy Pro activated! Enjoy voice coaching, equipment swaps & photo scanner."
          : "Switched back to the Free plan."
      );
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Could not update plan");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12">
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-forest-deep/10 bg-lime/70 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-forest-deep">
            <Sparkles className="h-3.5 w-3.5" /> Simple, Fair Pricing
          </span>
          <h1 className="mt-4 font-display text-4xl font-extrabold tracking-tight text-forest-deep sm:text-5xl">
            One AI coach instead of <span className="text-forest">four apps.</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-secondary sm:text-base">
            Start free forever. Upgrade to Pro for less than a protein tub per month — regional pricing available for
            students & MENA.
          </p>

          {/* Billing toggle */}
          <div className="mt-6 inline-flex items-center gap-1 rounded-full border border-ink/10 bg-surface p-1 shadow-soft">
            <button
              onClick={() => setAnnual(false)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                !annual ? "bg-forest-deep text-lime" : "text-secondary hover:text-ink"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                annual ? "bg-forest-deep text-lime" : "text-secondary hover:text-ink"
              }`}
            >
              Annual <span className="ml-1 rounded-full bg-lime/30 px-1.5 py-0.5 text-[10px]">Save 38%</span>
            </button>
          </div>
        </div>

        {toast && (
          <div className="mx-auto mt-6 max-w-xl rounded-2xl border border-forest/20 bg-lime/40 px-4 py-3 text-center text-xs font-bold text-forest-deep">
            {toast}
          </div>
        )}

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Free Tier */}
          <div className="flex flex-col justify-between rounded-[28px] border border-ink/10 bg-surface p-7 shadow-soft">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-extrabold text-forest-deep">Free</h2>
                {user?.plan === "free" && (
                  <span className="rounded-full bg-forest-pale px-3 py-1 text-[11px] font-bold text-forest-deep">
                    Current plan
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-secondary">Everything you need to start training smarter.</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="font-display text-4xl font-extrabold text-forest-deep">$0</span>
                <span className="text-xs text-tertiary">/ forever</span>
              </div>
              <ul className="mt-6 space-y-2.5 text-sm text-secondary">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-forest" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8">
              {user?.plan === "pro" ? (
                <button
                  onClick={() => switchPlan("free")}
                  disabled={updating}
                  className="w-full rounded-full border border-ink/15 bg-bg py-3 text-sm font-bold text-secondary transition hover:bg-forest-pale"
                >
                  Switch to Free
                </button>
              ) : (
                <Link
                  href="/"
                  className="block w-full rounded-full border border-ink/15 bg-bg py-3 text-center text-sm font-bold text-forest-deep transition hover:bg-forest-pale"
                >
                  Continue on Free
                </Link>
              )}
            </div>
          </div>

          {/* Pro Tier (Dark Forest Hero Card) */}
          <div className="relative flex flex-col justify-between rounded-[28px] border border-lime/30 bg-dark p-7 text-white shadow-card">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold text-white">
                  <Crown className="h-6 w-6 text-lime" /> GymBuddy Pro
                </h2>
                <span className="rounded-full bg-lime px-3 py-1 text-[11px] font-extrabold text-forest-deep">
                  {user?.plan === "pro" ? "ACTIVE" : "MOST POPULAR"}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#A8BCB0]">Full AI coaching, vision scanner & smart in-gym chrono.</p>
              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="font-display text-4xl font-extrabold text-lime">
                  {annual ? "$4.90" : "$8"}
                </span>
                <span className="text-xs text-[#9AA5A0]">/ month {annual && "(billed $59/yr)"}</span>
              </div>
              <ul className="mt-6 space-y-2.5 text-sm text-[#D6E3DA]">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Zap className="mt-0.5 h-4 w-4 shrink-0 text-lime" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8">
              {user?.plan === "pro" ? (
                <Link
                  href="/gym"
                  className="block w-full rounded-full bg-lime py-3 text-center text-sm font-extrabold text-forest-deep shadow-soft transition hover:brightness-95"
                >
                  Launch Pro In-Gym Chrono →
                </Link>
              ) : (
                <button
                  onClick={() => switchPlan("pro")}
                  disabled={updating}
                  className="w-full rounded-full bg-lime py-3 text-sm font-extrabold text-forest-deep shadow-soft transition hover:brightness-95 disabled:opacity-50"
                >
                  {updating ? "Activating..." : "Start GymBuddy Pro"}
                </button>
              )}
              <p className="mt-2.5 text-center text-[11px] text-[#899E91]">
                Cancel anytime · Instant activation.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { Camera, User as UserIcon, X } from "lucide-react";
import type { Activity, Diet, Equipment, Experience, Goal, Profile, Sex, Split, UserOut } from "@/lib/types";

interface ProfileModalProps {
  initial?: UserOut | null;
  canClose: boolean;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    email: string;
    avatar_url?: string;
    daily_digest: boolean;
    profile: Profile;
  }) => Promise<void>;
}

const DEFAULT_PROFILE: Profile = {
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
};

export function ProfileModal({ initial, canClose, onClose, onSave }: ProfileModalProps) {
  const p0 = initial?.profile || DEFAULT_PROFILE;
  const [name, setName] = useState(initial?.name || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [avatarUrl, setAvatarUrl] = useState(initial?.avatar_url || "");
  const [dailyDigest, setDailyDigest] = useState(initial?.daily_digest || false);
  const [age, setAge] = useState(p0.age);
  const [sex, setSex] = useState<Sex>(p0.sex);
  const [heightCm, setHeightCm] = useState(p0.height_cm);
  const [weightKg, setWeightKg] = useState(p0.weight_kg);
  const [activity, setActivity] = useState<Activity>(p0.activity);
  const [goal, setGoal] = useState<Goal>(p0.goal);
  const [experience, setExperience] = useState<Experience>(p0.experience);
  const [daysPerWeek, setDaysPerWeek] = useState(p0.days_per_week);
  const [split, setSplit] = useState<Split>(p0.split || "auto");
  const [equipment, setEquipment] = useState<Equipment>(p0.equipment);
  const [diet, setDiet] = useState<Diet>(p0.diet);
  const [allergies, setAllergies] = useState(p0.allergies.join(", "));
  const [injuries, setInjuries] = useState(p0.injuries.join(", "));
  const [medical, setMedical] = useState(p0.medical_conditions.join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 160;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        setAvatarUrl(canvas.toDataURL("image/jpeg", 0.82));
      };
      if (typeof reader.result === "string") img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const splitList = (s: string) =>
    s
      .split(",")
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({
        name,
        email,
        avatar_url: avatarUrl,
        daily_digest: dailyDigest,
        profile: {
          age: Number(age),
          sex,
          height_cm: Number(heightCm),
          weight_kg: Number(weightKg),
          activity,
          goal,
          experience,
          days_per_week: Number(daysPerWeek),
          split,
          equipment,
          diet,
          allergies: splitList(allergies),
          injuries: splitList(injuries),
          medical_conditions: splitList(medical),
          language: "en",
        },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    "w-full rounded-xl border border-ink/15 bg-bg px-3 py-2 text-sm text-ink placeholder:text-tertiary focus:border-forest focus:bg-white focus:outline-none";
  const labelCls = "mb-1 block text-xs font-semibold text-secondary";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-ink/10 bg-surface p-6 shadow-card">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <span className="mb-2 inline-block rounded-full bg-lime/60 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-forest-deep">
              Personal Profile
            </span>
            <h2 className="font-display text-xl font-bold text-forest-deep">
              {initial ? "Edit Your Fitness Profile" : "Welcome to GymBuddy AI"}
            </h2>
            <p className="text-xs text-secondary">
              Your profile personalizes workouts, calorie/macro targets, and safety checks.
            </p>
          </div>
          {canClose && (
            <button onClick={onClose} className="rounded-full p-1.5 text-tertiary hover:bg-bg hover:text-ink">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-[#F16060]/40 bg-[#F16060]/10 p-3 text-xs text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar Upload */}
          <div className="flex items-center gap-4 rounded-2xl border border-ink/10 bg-bg p-3">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-forest bg-forest-pale">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile avatar" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-forest-deep">
                  <UserIcon className="h-7 w-7" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold text-forest-deep">Profile photo</div>
              <p className="text-[11px] text-secondary">Upload a square photo — shown in the navbar & chat.</p>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="inline-flex items-center gap-1 rounded-full bg-forest-deep px-3 py-1 text-[11px] font-bold text-lime hover:bg-forest"
                >
                  <Camera className="h-3 w-3" /> {avatarUrl ? "Change photo" : "Upload photo"}
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl("")}
                    className="text-[11px] font-semibold text-tertiary hover:text-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Name (optional)</label>
              <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="Achraf" />
            </div>
            <div>
              <label className={labelCls}>Email (optional, for daily n8n digest)</label>
              <input
                type="email"
                className={inputCls}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className={labelCls}>Age</label>
              <input type="number" min={14} max={90} className={inputCls} value={age} onChange={(e) => setAge(+e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Sex</label>
              <select className={inputCls} value={sex} onChange={(e) => setSex(e.target.value as Sex)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Height (cm)</label>
              <input
                type="number"
                min={120}
                max={230}
                className={inputCls}
                value={heightCm}
                onChange={(e) => setHeightCm(+e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Weight (kg)</label>
              <input
                type="number"
                min={30}
                max={250}
                className={inputCls}
                value={weightKg}
                onChange={(e) => setWeightKg(+e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Goal</label>
              <select className={inputCls} value={goal} onChange={(e) => setGoal(e.target.value as Goal)}>
                <option value="build_muscle">Build muscle</option>
                <option value="lose_fat">Lose fat</option>
                <option value="recomp">Body recomposition</option>
                <option value="maintain">Maintain</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Experience</label>
              <select className={inputCls} value={experience} onChange={(e) => setExperience(e.target.value as Experience)}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Activity level</label>
              <select className={inputCls} value={activity} onChange={(e) => setActivity(e.target.value as Activity)}>
                <option value="sedentary">Sedentary</option>
                <option value="light">Light (1-2x/wk)</option>
                <option value="moderate">Moderate (3-4x/wk)</option>
                <option value="active">Active (5-6x/wk)</option>
                <option value="very_active">Very active</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Current Gym Split</label>
              <select className={inputCls} value={split} onChange={(e) => setSplit(e.target.value as Split)}>
                <option value="auto">Auto (recommended for my days/wk)</option>
                <option value="push_pull_legs">Push / Pull / Legs (PPL — 3 or 6 days)</option>
                <option value="upper_lower">Upper / Lower (4 days)</option>
                <option value="full_body">Full Body (2–3 days)</option>
                <option value="arnold_split">Arnold Split (Chest+Back / Shoulders+Arms / Legs)</option>
                <option value="bro_split">Bro Split (5-day Body-Part)</option>
                <option value="phul">PHUL (Power Hypertrophy Upper Lower — 4 days)</option>
                <option value="phat">PHAT (Power Hypertrophy Adaptive — 5 days)</option>
                <option value="push_pull">Push / Pull (4 days)</option>
                <option value="torso_limbs">Torso / Limbs (4 days)</option>
                <option value="athletic_conditioning">Athletic & Conditioning</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Equipment</label>
              <select className={inputCls} value={equipment} onChange={(e) => setEquipment(e.target.value as Equipment)}>
                <option value="gym">Full gym</option>
                <option value="dumbbells">Home dumbbells</option>
                <option value="bodyweight">Bodyweight only</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Days / week</label>
              <input
                type="number"
                min={1}
                max={7}
                className={inputCls}
                value={daysPerWeek}
                onChange={(e) => setDaysPerWeek(+e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Diet preference</label>
              <select className={inputCls} value={diet} onChange={(e) => setDiet(e.target.value as Diet)}>
                <option value="none">No restriction</option>
                <option value="halal">Halal</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="vegan">Vegan</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>Allergies (comma-separated)</label>
              <input
                className={inputCls}
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="peanuts, dairy"
              />
            </div>
            <div>
              <label className={labelCls}>Injuries (comma-separated)</label>
              <input
                className={inputCls}
                value={injuries}
                onChange={(e) => setInjuries(e.target.value)}
                placeholder="knee, lower back"
              />
            </div>
            <div>
              <label className={labelCls}>Medical conditions</label>
              <input
                className={inputCls}
                value={medical}
                onChange={(e) => setMedical(e.target.value)}
                placeholder="asthma, none"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-secondary">
            <input
              type="checkbox"
              checked={dailyDigest}
              onChange={(e) => setDailyDigest(e.target.checked)}
              className="h-4 w-4 rounded border-ink/20 bg-bg accent-forest"
            />
            Opt in to the daily coaching email (powered by our n8n automation)
          </label>

          <p className="rounded-xl bg-forest-pale/70 p-3 text-[11px] text-secondary">
            ⚕️ Medical disclaimer: GymBuddy AI provides general fitness & nutrition guidance for educational purposes and
            is not a substitute for professional medical advice.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            {canClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-ink/15 px-4 py-2 text-sm font-medium text-secondary hover:bg-bg"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-forest-deep px-6 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-forest disabled:opacity-50"
            >
              {saving ? "Saving..." : initial ? "Save changes" : "Start coaching"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

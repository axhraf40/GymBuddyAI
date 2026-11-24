"use client";

import { useState } from "react";

interface MuscleMapProps {
  selectedMuscle: string | null;
  onSelect: (muscleId: string) => void;
}

const MUSCLE_LABELS: Record<string, string> = {
  chest: "Chest (Pectorals)",
  shoulders: "Shoulders (Deltoids)",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  abs: "Abs (Core)",
  obliques: "Obliques",
  quads: "Quadriceps",
  adductors: "Adductors (Inner Thigh)",
  calves: "Calves",
  traps: "Trapezius",
  upper_back: "Upper Back & Lats",
  lower_back: "Lower Back",
  glutes: "Glutes",
  hamstrings: "Hamstrings",
};

const FRONT_MUSCLES = ["chest", "shoulders", "biceps", "forearms", "abs", "obliques", "quads", "adductors", "calves"];
const BACK_MUSCLES = ["traps", "shoulders", "upper_back", "triceps", "forearms", "lower_back", "glutes", "hamstrings", "calves"];

export function MuscleMap({ selectedMuscle, onSelect }: MuscleMapProps) {
  const [view, setView] = useState<"front" | "back">("front");
  const [hovered, setHovered] = useState<string | null>(null);

  const cls = (id: string) => `muscle-region ${selectedMuscle === id ? "active" : ""}`;
  const bind = (id: string) => ({
    role: "button" as const,
    tabIndex: 0,
    "aria-label": MUSCLE_LABELS[id] || id,
    onClick: () => onSelect(id),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(id);
      }
    },
    onMouseEnter: () => setHovered(id),
    onMouseLeave: () => setHovered(null),
  });

  const activeLabel = hovered
    ? MUSCLE_LABELS[hovered]
    : selectedMuscle
    ? MUSCLE_LABELS[selectedMuscle]
    : "Click any muscle to inspect";

  return (
    <div className="flex flex-col items-center">
      {/* Front / Back toggle */}
      <div className="mb-3 flex w-full items-center justify-between gap-2">
        <div className="inline-flex rounded-full border border-white/10 bg-dark-2 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setView("front")}
            className={`rounded-full px-3.5 py-1 font-semibold transition ${
              view === "front" ? "bg-lime text-forest-deep shadow" : "text-[#9AA5A0] hover:text-white"
            }`}
          >
            Front
          </button>
          <button
            type="button"
            onClick={() => setView("back")}
            className={`rounded-full px-3.5 py-1 font-semibold transition ${
              view === "back" ? "bg-lime text-forest-deep shadow" : "text-[#9AA5A0] hover:text-white"
            }`}
          >
            Back
          </button>
        </div>
        <span
          className={`truncate rounded-full px-3 py-1 text-[11px] font-semibold ${
            hovered || selectedMuscle
              ? "bg-lime/15 text-lime ring-1 ring-lime/30"
              : "bg-white/5 text-[#9AA5A0]"
          }`}
        >
          {activeLabel}
        </span>
      </div>

      {/* Anatomical SVG */}
      <div className="relative flex w-full justify-center rounded-2xl border border-white/10 bg-gradient-to-b from-[#13291E] to-[#0A1811] p-3">
        <svg viewBox="0 0 260 470" className="h-[340px] w-auto select-none drop-shadow-[0_6px_20px_rgba(0,0,0,0.5)]">
          {/* Base anatomical silhouette (high-contrast light sage-silver so the body pops clearly) */}
          <g fill="#D5E3DA" stroke="#08130D" strokeWidth="1.8">
            {/* Head */}
            <ellipse cx="130" cy="34" rx="19" ry="24" />
            {/* Neck */}
            <path d="M120 56 L140 56 L144 74 L116 74 Z" />
            {/* Torso base */}
            <path d="M84 82 Q130 70 176 82 L166 218 L94 218 Z" />
            {/* Pelvis / athletic shorts */}
            <path d="M94 215 L166 215 L172 256 L136 258 L130 242 L124 258 L88 256 Z" fill="#1F3B2C" />
            {/* Hands */}
            <ellipse cx="44" cy="240" rx="8" ry="13" />
            <ellipse cx="216" cy="240" rx="8" ry="13" />
            {/* Knees */}
            <ellipse cx="105" cy="346" rx="13" ry="11" />
            <ellipse cx="155" cy="346" rx="13" ry="11" />
            {/* Feet */}
            <path d="M92 438 L112 438 L115 456 Q100 462 86 456 Z" />
            <path d="M148 438 L168 438 L174 456 Q160 462 145 456 Z" />
          </g>

          {view === "front" ? (
            <g>
              {/* Shoulders (Deltoids) */}
              <g className={cls("shoulders")} {...bind("shoulders")}>
                <path d="M84 78 C66 80 56 96 60 118 C68 122 80 116 88 104 Z" />
                <path d="M176 78 C194 80 204 96 200 118 C192 122 180 116 172 104 Z" />
              </g>

              {/* Chest (Pectorals) */}
              <g className={cls("chest")} {...bind("chest")}>
                <path d="M90 84 Q112 80 128 88 L128 128 Q106 134 88 118 Z" />
                <path d="M170 84 Q148 80 132 88 L132 128 Q154 134 172 118 Z" />
              </g>

              {/* Biceps */}
              <g className={cls("biceps")} {...bind("biceps")}>
                <path d="M60 120 C52 138 52 162 60 176 C70 178 78 164 80 138 C76 126 68 120 60 120 Z" />
                <path d="M200 120 C208 138 208 162 200 176 C190 178 182 164 180 138 C184 126 192 120 200 120 Z" />
              </g>

              {/* Forearms */}
              <g className={cls("forearms")} {...bind("forearms")}>
                <path d="M56 178 C48 196 42 214 42 230 L56 230 C62 212 68 194 68 178 Z" />
                <path d="M204 178 C212 196 218 214 218 230 L204 230 C198 212 192 194 192 178 Z" />
              </g>

              {/* Abs (Rectus Abdominis - 6-pack segments) */}
              <g className={cls("abs")} {...bind("abs")}>
                <rect x="112" y="133" width="16" height="17" rx="4" />
                <rect x="132" y="133" width="16" height="17" rx="4" />
                <rect x="112" y="153" width="16" height="17" rx="4" />
                <rect x="132" y="153" width="16" height="17" rx="4" />
                <rect x="113" y="173" width="15" height="17" rx="4" />
                <rect x="132" y="173" width="15" height="17" rx="4" />
                <path d="M114 193 L146 193 L140 214 L120 214 Z" />
              </g>

              {/* Obliques */}
              <g className={cls("obliques")} {...bind("obliques")}>
                <path d="M90 124 L109 134 L109 208 L95 204 C90 178 88 150 90 124 Z" />
                <path d="M170 124 L151 134 L151 208 L165 204 C170 178 172 150 170 124 Z" />
              </g>

              {/* Quadriceps */}
              <g className={cls("quads")} {...bind("quads")}>
                <path d="M90 250 C82 282 84 316 94 340 L114 340 C120 314 120 282 114 252 Z" />
                <path d="M170 250 C178 282 176 316 166 340 L146 340 C140 314 140 282 146 252 Z" />
              </g>

              {/* Adductors (Inner Thigh) */}
              <g className={cls("adductors")} {...bind("adductors")}>
                <path d="M116 254 L126 256 L122 326 L115 334 Z" />
                <path d="M144 254 L134 256 L138 326 L145 334 Z" />
              </g>

              {/* Calves (Front view) */}
              <g className={cls("calves")} {...bind("calves")}>
                <path d="M94 358 C86 380 88 408 95 436 L112 436 C118 408 118 380 112 358 Z" />
                <path d="M166 358 C174 380 172 408 165 436 L148 436 C142 408 142 380 148 358 Z" />
              </g>
            </g>
          ) : (
            <g>
              {/* Traps */}
              <g className={cls("traps")} {...bind("traps")}>
                <path d="M116 66 L144 66 L172 86 L130 124 L88 86 Z" />
              </g>

              {/* Rear Shoulders */}
              <g className={cls("shoulders")} {...bind("shoulders")}>
                <path d="M84 78 C66 80 56 96 60 118 C70 122 82 114 90 100 Z" />
                <path d="M176 78 C194 80 204 96 200 118 C190 122 178 114 170 100 Z" />
              </g>

              {/* Upper Back & Lats */}
              <g className={cls("upper_back")} {...bind("upper_back")}>
                <path d="M90 102 L128 128 L128 178 L96 172 C88 150 86 124 90 102 Z" />
                <path d="M170 102 L132 128 L132 178 L164 172 C172 150 174 124 170 102 Z" />
              </g>

              {/* Lower Back */}
              <g className={cls("lower_back")} {...bind("lower_back")}>
                <path d="M98 176 L162 176 L158 214 L102 214 Z" />
              </g>

              {/* Triceps */}
              <g className={cls("triceps")} {...bind("triceps")}>
                <path d="M60 120 C50 140 52 164 60 178 C72 178 80 164 82 138 C76 126 68 120 60 120 Z" />
                <path d="M200 120 C210 140 208 164 200 178 C188 178 180 164 178 138 C184 126 192 120 200 120 Z" />
              </g>

              {/* Forearms */}
              <g className={cls("forearms")} {...bind("forearms")}>
                <path d="M56 180 C48 198 42 214 42 230 L56 230 C62 212 68 196 68 180 Z" />
                <path d="M204 180 C212 198 218 214 218 230 L204 230 C198 212 192 196 192 180 Z" />
              </g>

              {/* Glutes */}
              <g className={cls("glutes")} {...bind("glutes")}>
                <path d="M96 216 Q114 212 128 220 L128 264 Q102 268 90 248 Z" />
                <path d="M164 216 Q146 212 132 220 L132 264 Q158 268 170 248 Z" />
              </g>

              {/* Hamstrings */}
              <g className={cls("hamstrings")} {...bind("hamstrings")}>
                <path d="M92 264 C86 292 88 320 96 342 L118 342 C124 316 124 290 122 266 Z" />
                <path d="M168 264 C174 292 172 320 164 342 L142 342 C136 316 136 290 138 266 Z" />
              </g>

              {/* Calves (Back view) */}
              <g className={cls("calves")} {...bind("calves")}>
                <path d="M94 356 C84 380 86 408 95 436 L112 436 C120 408 120 380 112 356 Z" />
                <path d="M166 356 C176 380 174 408 165 436 L148 436 C140 408 140 380 148 356 Z" />
              </g>
            </g>
          )}
        </svg>
      </div>

      {/* Quick muscle pills for accessibility / mobile */}
      <div className="mt-3 flex flex-wrap justify-center gap-1.5">
        {(view === "front" ? FRONT_MUSCLES : BACK_MUSCLES).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              selectedMuscle === id
                ? "bg-lime text-forest-deep shadow"
                : "bg-white/5 text-[#C5D4CA] hover:bg-white/10 hover:text-white"
            }`}
          >
            {MUSCLE_LABELS[id].split(" (")[0]}
          </button>
        ))}
      </div>
    </div>
  );
}

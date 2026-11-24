"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRightLeft,
  CheckCircle2,
  Droplets,
  FastForward,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SkipForward,
  Trophy,
  Volume2,
  VolumeX,
} from "lucide-react";
import { api } from "@/lib/api";
import type { SessionExercise, SessionExerciseAlt, UserOut } from "@/lib/types";
import { Navbar } from "@/components/Navbar";

const STORAGE_USER_KEY = "gymbuddy_user_id";

type Phase = "idle" | "active" | "rest" | "busy" | "finished";

interface LoggedSet {
  exercise: string;
  setNum: number;
  reps: number;
  weightKg: number;
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function GymChronoPage() {
  const [user, setUser] = useState<UserOut | null>(null);
  const [split, setSplit] = useState("push");
  const [splitTitle, setSplitTitle] = useState("Push Day");
  const [availableSplits, setAvailableSplits] = useState<{ id: string; title: string }[]>([]);
  const [queue, setQueue] = useState<SessionExercise[]>([]);
  const [loading, setLoading] = useState(true);

  const [phase, setPhase] = useState<Phase>("idle");
  const [prevPhaseBeforeBusy, setPrevPhaseBeforeBusy] = useState<"active" | "rest">("active");
  const [exIndex, setExIndex] = useState(0);
  const [setIndex, setSetIndex] = useState(1);
  // Sets completed per exercise (same order as `queue`), so the user can do exercises in any order
  const [doneSets, setDoneSets] = useState<number[]>([]);

  // Timers (in seconds)
  const [totalSec, setTotalSec] = useState(0);
  const [activeSec, setActiveSec] = useState(0);
  const [restTotalSec, setRestTotalSec] = useState(0);
  const [waitSec, setWaitSec] = useState(0);
  const [countdown, setCountdown] = useState(0);

  // Set logging inputs
  const [weightKg, setWeightKg] = useState(20);
  const [repsInput, setRepsInput] = useState(10);
  const [logs, setLogs] = useState<LoggedSet[]>([]);
  const [waterMl, setWaterMl] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  const [showSwapList, setShowSwapList] = useState(false);

  const voiceRef = useRef(voiceOn);
  voiceRef.current = voiceOn;

  const speak = useCallback((text: string) => {
    if (!voiceRef.current || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.05;
      window.speechSynthesis.speak(u);
    } catch {
      // ignore speech errors
    }
  }, []);

  const beep = useCallback((freq = 880, dur = 0.12) => {
    if (!voiceRef.current || typeof window === "undefined") return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = 0.08;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // ignore audio context errors
    }
  }, []);

  const loadSession = useCallback(async (splitId: string, uid?: string) => {
    setLoading(true);
    try {
      const res = await api.workoutSession(splitId, uid);
      setSplit(res.split);
      setSplitTitle(res.title);
      setAvailableSplits(res.available_splits);
      setQueue(res.exercises);
      setDoneSets(res.exercises.map(() => 0));
      setExIndex(0);
      setSetIndex(1);
      setPhase("idle");
      setTotalSec(0);
      setActiveSec(0);
      setRestTotalSec(0);
      setWaitSec(0);
      setCountdown(0);
      setLogs([]);
      setWaterMl(0);
      setShowSwapList(false);
      if (res.exercises[0]) {
        setWeightKg(res.exercises[0].default_weight_kg);
        setRepsInput(res.exercises[0].is_timed ? res.exercises[0].timed_sec : 10);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const savedId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_USER_KEY) : null;
    if (savedId) {
      api
        .getUser(savedId)
        .then((u) => {
          setUser(u);
          loadSession("push", u.user_id);
        })
        .catch(() => loadSession("push"));
    } else {
      loadSession("push");
    }
  }, [loadSession]);

  const currentEx = queue[exIndex];

  // Sync default weight/reps when exercise changes
  useEffect(() => {
    if (currentEx) {
      setWeightKg(currentEx.default_weight_kg);
      setRepsInput(currentEx.is_timed ? currentEx.timed_sec : 10);
    }
  }, [currentEx?.id]);

  // Main 1-second chrono loop
  useEffect(() => {
    if (phase === "idle" || phase === "finished") return;
    const id = setInterval(() => {
      setTotalSec((t) => t + 1);
      if (phase === "active") {
        setActiveSec((t) => t + 1);
        if (currentEx?.is_timed) {
          setCountdown((c) => {
            if (c <= 1) {
              beep(1040, 0.2);
              return 0;
            }
            if (c <= 4) beep(660, 0.08);
            return c - 1;
          });
        }
      } else if (phase === "rest") {
        setRestTotalSec((t) => t + 1);
        setCountdown((c) => {
          if (c === 11) speak("10 seconds left");
          if (c <= 4 && c > 1) beep(660, 0.08);
          if (c <= 1) {
            beep(1040, 0.2);
            speak("Rest over. Next set, let's go!");
            setPhase("active");
            if (currentEx?.is_timed) return currentEx.timed_sec;
            return 0;
          }
          return c - 1;
        });
      } else if (phase === "busy") {
        setWaitSec((t) => t + 1);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [phase, currentEx, beep, speak]);

  const startSession = () => {
    if (!currentEx) return;
    setPhase("active");
    setCountdown(currentEx.is_timed ? currentEx.timed_sec : 0);
    beep(880, 0.15);
    speak(`Starting ${splitTitle}. First up: ${currentEx.name}. Let's go!`);
  };

  /** Next exercise that still has sets left, searching forward and wrapping around. */
  const nextUnfinished = (done: number[], from: number): number => {
    for (let step = 1; step <= queue.length; step++) {
      const i = (from + step) % queue.length;
      if ((done[i] ?? 0) < queue[i].sets) return i;
    }
    return -1;
  };

  const completeSet = () => {
    if (!currentEx) return;
    setLogs((prev) => [
      ...prev,
      { exercise: currentEx.name, setNum: setIndex, reps: repsInput, weightKg },
    ]);
    const done = [...doneSets];
    done[exIndex] = (done[exIndex] ?? 0) + 1;
    setDoneSets(done);

    if (done[exIndex] < currentEx.sets) {
      setSetIndex(done[exIndex] + 1);
      setPhase("rest");
      setCountdown(currentEx.rest_sec);
      beep(520, 0.15);
      speak(`Set done. Rest ${currentEx.rest_sec} seconds. Good time for a sip of water.`);
      return;
    }
    const nextIdx = nextUnfinished(done, exIndex);
    if (nextIdx >= 0) {
      const next = queue[nextIdx];
      setExIndex(nextIdx);
      setSetIndex(done[nextIdx] + 1);
      setPhase("rest");
      setCountdown(currentEx.rest_sec);
      beep(740, 0.15);
      speak(`Exercise complete! Rest ${currentEx.rest_sec} seconds. Next up: ${next.name}.`);
    } else {
      setPhase("finished");
      beep(1040, 0.25);
      speak("Workout complete! Great job today.");
    }
  };

  /** Jump to any exercise in the queue (e.g. do exercise 2, then come back to exercise 1). */
  const jumpToExercise = (idx: number) => {
    if (idx === exIndex || phase === "finished" || !queue[idx]) return;
    if ((doneSets[idx] ?? 0) >= queue[idx].sets) return; // already finished
    const ex = queue[idx];
    setExIndex(idx);
    setSetIndex((doneSets[idx] ?? 0) + 1);
    setShowSwapList(false);
    if (phase === "busy" || phase === "active") {
      setPhase("active");
      setCountdown(ex.is_timed ? ex.timed_sec : 0);
    }
    if (phase !== "idle") speak(`Switching to ${ex.name}. Set ${(doneSets[idx] ?? 0) + 1} of ${ex.sets}.`);
  };

  const pauseEquipmentBusy = () => {
    if (phase === "active" || phase === "rest") {
      setPrevPhaseBeforeBusy(phase);
      setPhase("busy");
      setShowSwapList(false);
    }
  };

  const resumeFromBusy = () => {
    setPhase(prevPhaseBeforeBusy);
    setShowSwapList(false);
    speak("Resuming your workout.");
  };

  const doNextExerciseFirst = () => {
    if (queue.length <= 1 || exIndex >= queue.length - 1) return;
    const copy = [...queue];
    const [busyEx] = copy.splice(exIndex, 1);
    copy.push(busyEx);
    const done = [...doneSets];
    const [busyDone] = done.splice(exIndex, 1);
    done.push(busyDone ?? 0);
    setQueue(copy);
    setDoneSets(done);
    setSetIndex((done[exIndex] ?? 0) + 1);
    setPhase("active");
    setShowSwapList(false);
    speak(`Moved ${busyEx.name} to later. Switching to ${copy[exIndex].name}.`);
  };

  const swapWithAlt = (alt: SessionExerciseAlt) => {
    const copy = [...queue];
    const cur = copy[exIndex];
    copy[exIndex] = {
      ...cur,
      id: alt.id,
      name: alt.name,
      sets: alt.sets,
      target_reps: alt.target_reps,
      rest_sec: alt.rest_sec,
      gif_url: alt.gif_url,
      image_url: alt.image_url,
      tips: alt.tips,
      alternatives: cur.alternatives.filter((a) => a.id !== alt.id),
    };
    setQueue(copy);
    setDoneSets((d) => d.map((v, i) => (i === exIndex ? 0 : v)));
    setSetIndex(1);
    setPhase("active");
    setShowSwapList(false);
    speak(`Swapped to ${alt.name}. Let's go!`);
  };

  const totalVolume = logs.reduce((acc, l) => acc + l.reps * Math.max(l.weightKg, 0), 0);

  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <Navbar user={user} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {/* Header + Split picker */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-forest-deep/10 bg-lime/70 px-3 py-0.5 text-[11px] font-bold uppercase tracking-widest text-forest-deep">
              Smart In-Gym Session Chrono
            </span>
            <h1 className="mt-1 font-display text-2xl font-extrabold text-forest-deep sm:text-3xl">{splitTitle}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Choose gym split session"
              value={split}
              onChange={(e) => loadSession(e.target.value, user?.user_id)}
              className="rounded-full border border-ink/15 bg-surface px-4 py-2 text-xs font-bold text-forest-deep shadow-soft focus:border-forest focus:outline-none"
            >
              {availableSplits.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>

            <button
              onClick={() => setVoiceOn((v) => !v)}
              title="Toggle voice & sound cues"
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold shadow-soft transition ${
                voiceOn
                  ? "border-forest/20 bg-lime/60 text-forest-deep"
                  : "border-ink/15 bg-surface text-tertiary"
              }`}
            >
              {voiceOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              Voice {voiceOn ? "ON" : "OFF"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-[28px] border border-ink/10 bg-surface p-12 text-center text-sm text-secondary shadow-soft">
            Loading your workout session...
          </div>
        ) : phase === "finished" ? (
          /* SESSION SUMMARY CARD */
          <div className="mx-auto max-w-2xl rounded-[32px] border border-lime/30 bg-dark p-8 text-center text-white shadow-card">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-lime text-forest-deep">
              <Trophy className="h-9 w-9" />
            </div>
            <h2 className="font-display text-3xl font-extrabold text-white">Workout Complete!</h2>
            <p className="mt-1 text-sm text-[#A8BCB0]">{splitTitle} logged — great consistency today.</p>

            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl bg-dark-2 p-3.5">
                <div className="font-display text-2xl font-extrabold text-lime">{fmtTime(totalSec)}</div>
                <div className="text-[11px] text-[#9AA5A0]">Total time</div>
              </div>
              <div className="rounded-2xl bg-dark-2 p-3.5">
                <div className="font-display text-2xl font-extrabold text-white">{logs.length}</div>
                <div className="text-[11px] text-[#9AA5A0]">Sets done</div>
              </div>
              <div className="rounded-2xl bg-dark-2 p-3.5">
                <div className="font-display text-2xl font-extrabold text-white">{totalVolume} kg</div>
                <div className="text-[11px] text-[#9AA5A0]">Volume lifted</div>
              </div>
              <div className="rounded-2xl bg-dark-2 p-3.5">
                <div className="font-display text-2xl font-extrabold text-sky-300">{waterMl} ml</div>
                <div className="text-[11px] text-[#9AA5A0]">Water drunk</div>
              </div>
            </div>

            <div className="mt-4 flex justify-center gap-4 text-xs text-[#9AA5A0]">
              <span>Active: {fmtTime(activeSec)}</span>
              <span>Rest: {fmtTime(restTotalSec)}</span>
              <span>Waiting (busy): {fmtTime(waitSec)}</span>
            </div>

            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => loadSession(split, user?.user_id)}
                className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/10"
              >
                <RotateCcw className="h-4 w-4" /> New session
              </button>
              <Link
                href="/"
                className="rounded-full bg-lime px-6 py-2.5 text-sm font-extrabold text-forest-deep hover:brightness-95"
              >
                Back to AI Coach →
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* LEFT / MAIN: Big Dark-Forest Guided Chrono */}
            <section className="flex flex-col justify-between rounded-[32px] border border-white/10 bg-dark p-6 text-white shadow-card lg:col-span-7">
              {/* Top status strip */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wider ${
                    phase === "active"
                      ? "bg-lime text-forest-deep"
                      : phase === "rest"
                      ? "bg-sky-400/20 text-sky-300 ring-1 ring-sky-400/40"
                      : phase === "busy"
                      ? "bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40"
                      : "bg-white/10 text-[#C5D4CA]"
                  }`}
                >
                  {phase === "idle" && "Ready to start"}
                  {phase === "active" && "Active Set — Go!"}
                  {phase === "rest" && "Rest Period"}
                  {phase === "busy" && "Paused — Equipment Busy"}
                </span>

                <div className="flex items-center gap-4 text-xs text-[#9AA5A0]">
                  <span>Session: <strong className="text-white">{fmtTime(totalSec)}</strong></span>
                  <span>Water: <strong className="text-sky-300">{waterMl} ml</strong></span>
                </div>
              </div>

              {/* Big Clock + Current Exercise */}
              {currentEx && (
                <div className="my-6 flex flex-col items-center gap-5 sm:flex-row sm:items-center">
                  {currentEx.gif_url && (
                    <div className="flex h-36 w-36 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-white/10 bg-white p-2 shadow-lg">
                      <img src={currentEx.gif_url} alt={currentEx.name} className="h-full w-full object-contain" />
                    </div>
                  )}

                  <div className="flex-1 text-center sm:text-left">
                    <div className="text-xs font-bold uppercase tracking-wider text-lime">
                      Exercise {exIndex + 1}/{queue.length} · {currentEx.muscle_name}
                    </div>
                    <h2 className="mt-1 font-display text-2xl font-extrabold text-white sm:text-3xl">
                      {currentEx.name}
                    </h2>
                    <p className="mt-1 text-sm text-[#A8BCB0]">
                      Set <strong className="text-white">{setIndex} / {currentEx.sets}</strong> · Target:{" "}
                      <strong className="text-lime">{currentEx.target_reps}</strong>
                    </p>

                    {/* Big Chrono Display */}
                    <div className="mt-4 font-display text-6xl font-extrabold tracking-tight text-lime">
                      {phase === "rest"
                        ? fmtTime(countdown)
                        : phase === "busy"
                        ? fmtTime(waitSec)
                        : currentEx.is_timed && phase === "active"
                        ? fmtTime(countdown)
                        : fmtTime(activeSec)}
                    </div>
                    <p className="mt-0.5 text-[11px] uppercase tracking-widest text-[#899E91]">
                      {phase === "rest"
                        ? "Rest countdown"
                        : phase === "busy"
                        ? "Waiting for equipment"
                        : currentEx.is_timed
                        ? "Hold countdown"
                        : "Active lifting time"}
                    </p>
                  </div>
                </div>
              )}

              {/* Hydration Reminder — shown ONLY during REST (never mid-set!) */}
              {phase === "rest" && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-xs text-sky-200">
                  <span className="flex items-center gap-2 font-semibold">
                    <Droplets className="h-4 w-4 text-sky-300" /> Rest hydration cue: take a sip of water now!
                  </span>
                  <button
                    onClick={() => setWaterMl((w) => w + 250)}
                    className="rounded-full bg-sky-400 px-3 py-1 text-[11px] font-extrabold text-dark hover:bg-sky-300"
                  >
                    +250 ml logged
                  </button>
                </div>
              )}

              {/* Equipment Busy Panel */}
              {phase === "busy" && currentEx && (
                <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-xs">
                  <div className="font-bold text-amber-200">
                    Equipment busy? Workout clock is frozen while you decide:
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={resumeFromBusy}
                      className="flex items-center gap-1.5 rounded-full bg-lime px-4 py-2 font-extrabold text-forest-deep"
                    >
                      <Play className="h-3.5 w-3.5" /> Machine is free (Resume)
                    </button>
                    {exIndex < queue.length - 1 && (
                      <button
                        onClick={doNextExerciseFirst}
                        className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 font-bold text-white hover:bg-white/15"
                      >
                        <FastForward className="h-3.5 w-3.5" /> Do next exercise first
                      </button>
                    )}
                    {currentEx.alternatives.length > 0 && (
                      <button
                        onClick={() => setShowSwapList((s) => !s)}
                        className="flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-400/20 px-4 py-2 font-bold text-amber-200 hover:bg-amber-400/30"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" /> Swap exercise ({currentEx.alternatives.length})
                      </button>
                    )}
                  </div>

                  {showSwapList && (
                    <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                      <div className="text-[11px] text-amber-100">Pick a same-muscle alternative:</div>
                      {currentEx.alternatives.map((alt) => (
                        <div
                          key={alt.id}
                          className="flex items-center justify-between rounded-xl bg-dark-2 px-3 py-2"
                        >
                          <div>
                            <div className="font-bold text-white">{alt.name}</div>
                            <div className="text-[10px] text-[#9AA5A0]">Equipment: {alt.equipment.join(", ")}</div>
                          </div>
                          <button
                            onClick={() => swapWithAlt(alt)}
                            className="rounded-full bg-lime px-3 py-1 text-[11px] font-extrabold text-forest-deep"
                          >
                            Use this
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Inline Weight/Reps inputs + Action Controls */}
              <div className="space-y-3 border-t border-white/10 pt-4">
                {phase === "active" && currentEx && (
                  <div className="grid grid-cols-2 gap-3">
                    <label className="rounded-2xl bg-dark-2 px-3.5 py-2 text-xs">
                      <span className="block text-[10px] uppercase tracking-wider text-[#9AA5A0]">Weight (kg)</span>
                      <input
                        type="number"
                        min={0}
                        max={400}
                        step={2.5}
                        value={weightKg}
                        onChange={(e) => setWeightKg(Number(e.target.value))}
                        className="mt-0.5 w-full bg-transparent font-display text-lg font-bold text-white focus:outline-none"
                      />
                    </label>
                    <label className="rounded-2xl bg-dark-2 px-3.5 py-2 text-xs">
                      <span className="block text-[10px] uppercase tracking-wider text-[#9AA5A0]">
                        {currentEx.is_timed ? "Seconds" : "Reps"}
                      </span>
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={repsInput}
                        onChange={(e) => setRepsInput(Number(e.target.value))}
                        className="mt-0.5 w-full bg-transparent font-display text-lg font-bold text-white focus:outline-none"
                      />
                    </label>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2.5">
                  {phase === "idle" && (
                    <button
                      onClick={startSession}
                      className="flex flex-1 items-center justify-center gap-2 rounded-full bg-lime py-3.5 text-sm font-extrabold text-forest-deep shadow-soft transition hover:brightness-95"
                    >
                      <Play className="h-4 w-4 fill-forest-deep" /> Start Workout Chrono
                    </button>
                  )}

                  {phase === "active" && (
                    <>
                      <button
                        onClick={completeSet}
                        className="flex flex-1 items-center justify-center gap-2 rounded-full bg-lime py-3.5 text-sm font-extrabold text-forest-deep shadow-soft transition hover:brightness-95"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Set {setIndex} Done → Start Rest
                      </button>
                      <button
                        onClick={pauseEquipmentBusy}
                        className="flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/15 px-4 py-3.5 text-xs font-bold text-amber-200 hover:bg-amber-400/25"
                      >
                        <Pause className="h-4 w-4" /> Equipment Busy
                      </button>
                    </>
                  )}

                  {phase === "rest" && (
                    <>
                      <button
                        onClick={() => setCountdown((c) => c + 15)}
                        className="flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-4 py-3 text-xs font-bold text-white hover:bg-white/15"
                      >
                        <Plus className="h-3.5 w-3.5" /> +15 s
                      </button>
                      <button
                        onClick={() => {
                          setPhase("active");
                          setCountdown(currentEx?.is_timed ? currentEx.timed_sec : 0);
                          speak("Next set, let's go!");
                        }}
                        className="flex flex-1 items-center justify-center gap-2 rounded-full bg-lime py-3 text-sm font-extrabold text-forest-deep hover:brightness-95"
                      >
                        <SkipForward className="h-4 w-4" /> Skip Rest — Start Set {setIndex}
                      </button>
                      <button
                        onClick={pauseEquipmentBusy}
                        className="rounded-full border border-amber-400/40 bg-amber-400/15 px-4 py-3 text-xs font-bold text-amber-200 hover:bg-amber-400/25"
                      >
                        Busy
                      </button>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* RIGHT: Session Queue + Hydration Quick Log */}
            <aside className="flex flex-col gap-4 lg:col-span-5">
              <section className="rounded-[26px] border border-ink/10 bg-surface p-5 shadow-soft">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-base font-bold text-forest-deep">Today&apos;s Exercise Queue</h3>
                    <p className="text-[11px] text-secondary">Tap any exercise to do it now, then come back to the others.</p>
                  </div>
                  <span className="rounded-full bg-forest-pale px-2.5 py-0.5 text-[11px] font-bold text-forest-deep">
                    {logs.length} sets logged
                  </span>
                </div>
                <div className="space-y-2">
                  {queue.map((ex, idx) => {
                    const isCurrent = idx === exIndex;
                    const done = doneSets[idx] ?? 0;
                    const isDone = done >= ex.sets;
                    const canJump = !isCurrent && !isDone;
                    return (
                      <button
                        type="button"
                        key={`${ex.id}-${idx}`}
                        onClick={() => jumpToExercise(idx)}
                        disabled={!canJump}
                        title={canJump ? `Do ${ex.name} now` : undefined}
                        className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left text-xs transition ${
                          canJump ? "cursor-pointer hover:border-forest/50 hover:bg-forest-pale/40" : "cursor-default"
                        } ${
                          isCurrent
                            ? "border-forest bg-forest-pale/70 ring-1 ring-forest/20"
                            : isDone
                            ? "border-ink/5 bg-bg/60 opacity-65"
                            : "border-ink/10 bg-bg"
                        }`}
                      >
                        {ex.image_url && (
                          <img
                            src={ex.image_url}
                            alt={ex.name}
                            className="h-12 w-12 shrink-0 rounded-xl border border-ink/10 bg-white object-contain"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-bold text-forest-deep">{ex.name}</span>
                            {isDone && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-forest" />}
                          </div>
                          <div className="text-[11px] text-secondary">
                            {ex.sets} sets × {ex.target_reps} · Rest {ex.rest_sec}s
                            {done > 0 && !isDone && <span className="font-bold text-forest"> · {done}/{ex.sets} done</span>}
                          </div>
                        </div>
                        {isCurrent && (
                          <span className="rounded-full bg-forest-deep px-2.5 py-0.5 text-[10px] font-bold text-lime">
                            NOW
                          </span>
                        )}
                        {canJump && (
                          <span className="rounded-full border border-forest/30 px-2.5 py-0.5 text-[10px] font-bold text-forest-deep">
                            Do now
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="flex items-center justify-between rounded-[24px] border border-ink/10 bg-surface p-4 shadow-soft">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                    <Droplets className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="font-display text-sm font-bold text-forest-deep">Session Hydration</div>
                    <div className="text-xs text-secondary">{waterMl} ml drunk during this workout</div>
                  </div>
                </div>
                <button
                  onClick={() => setWaterMl((w) => w + 250)}
                  className="rounded-full bg-forest-deep px-3.5 py-1.5 text-xs font-bold text-lime hover:bg-forest"
                >
                  +250 ml
                </button>
              </section>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}

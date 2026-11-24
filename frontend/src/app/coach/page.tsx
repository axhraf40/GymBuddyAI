"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Camera,
  Check,
  ChevronUp,
  Cpu,
  MessageSquarePlus,
  Play,
  ScanBarcode,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import type {
  ChatMessage,
  ConversationSummary,
  ExerciseItem,
  HealthInfo,
  ModelOption,
  MuscleExercisesResponse,
  Profile,
  UserOut,
} from "@/lib/types";
import { MuscleMap } from "@/components/MuscleMap";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { ProfileModal } from "@/components/ProfileModal";
import { FeedbackModal } from "@/components/FeedbackModal";
import { MarkdownText } from "@/components/MarkdownText";
import { Navbar } from "@/components/Navbar";

const STORAGE_USER_KEY = "gymbuddy_user_id";
const STORAGE_MODEL_KEY = "gymbuddy_model_id";

export default function HomePage() {
  const [health, setHealth] = useState<HealthInfo | null>(null);
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("openrouter/free");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<UserOut | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([
    "Build me a weekly workout plan",
    "How much protein should I eat per day?",
    "Give me a meal-prep recipe I can freeze",
    "What should I eat before training?",
  ]);

  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [muscleData, setMuscleData] = useState<MuscleExercisesResponse | null>(null);
  const [loadingMuscle, setLoadingMuscle] = useState(false);
  const [activeExercise, setActiveExercise] = useState<ExerciseItem | null>(null);

  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<"auto" | "equipment" | "food" | "barcode">("auto");
  const [showBarcodeBox, setShowBarcodeBox] = useState(false);
  const [showLiveScanner, setShowLiveScanner] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async (userId: string) => {
    try {
      const list = await api.listConversations(userId);
      setConversations(list);
    } catch {
      // ignore
    }
  }, []);

  // Boot: check backend health + restore user from localStorage
  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch((e) => setError(e.message));

    api
      .listModels()
      .then((res) => {
        setModels(res.models);
        const savedModel = typeof window !== "undefined" ? localStorage.getItem(STORAGE_MODEL_KEY) : null;
        if (savedModel && res.models.some((m) => m.id === savedModel)) {
          setSelectedModel(savedModel);
        } else {
          setSelectedModel(res.default_model || "openrouter/free");
        }
      })
      .catch(() => {});

    const savedId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_USER_KEY) : null;
    if (savedId) {
      api
        .getUser(savedId)
        .then((u) => {
          setUser(u);
          loadConversations(u.user_id);
        })
        .catch(() => {
          localStorage.removeItem(STORAGE_USER_KEY);
          setShowProfile(true);
        });
    } else {
      setShowProfile(true);
    }
  }, [loadConversations]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  // Close model popover on outside click or Escape
  useEffect(() => {
    if (!modelMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModelMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [modelMenuOpen]);

  // Fetch muscle exercises whenever a muscle is selected
  useEffect(() => {
    if (!selectedMuscle) {
      setMuscleData(null);
      return;
    }
    setLoadingMuscle(true);
    api
      .muscleExercises(selectedMuscle, user?.user_id)
      .then((res) => {
        setMuscleData(res);
        setSuggestions(res.suggestions);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoadingMuscle(false));
  }, [selectedMuscle, user?.user_id]);

  const handleSaveProfile = async (payload: {
    name: string;
    email: string;
    avatar_url?: string;
    daily_digest: boolean;
    profile: Profile;
  }) => {
    const saved = user
      ? await api.updateUser(user.user_id, payload)
      : await api.createUser(payload);
    setUser(saved);
    localStorage.setItem(STORAGE_USER_KEY, saved.user_id);
    loadConversations(saved.user_id);
  };

  const openConversation = async (convId: string) => {
    if (!user) return;
    setError(null);
    setActiveConvId(convId);
    try {
      const msgs = await api.getMessages(convId, user.user_id);
      setMessages(msgs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load conversation");
    }
  };

  const startNewChat = () => {
    setActiveConvId(null);
    setMessages([]);
    setError(null);
  };

  const removeConversation = async (convId: string) => {
    if (!user) return;
    try {
      await api.deleteConversation(convId, user.user_id);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
      if (activeConvId === convId) startNewChat();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete conversation");
    }
  };

  const handlePhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file (JPG, PNG, WebP).");
      return;
    }
    // Compress & resize phone camera photos to max 1024px JPEG (~100 KB) so they always upload cleanly
    const reader = new FileReader();
    reader.onload = () => {
      const src = typeof reader.result === "string" ? reader.result : "";
      if (!src) return;
      const img = new Image();
      img.onload = () => {
        const maxSide = 1024;
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          const scale = maxSide / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          setPendingPhoto(src);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        setPendingPhoto(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => setPendingPhoto(src);
      img.src = src;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const scanBarcodeDirect = async (codeOverride?: string) => {
    const code = (codeOverride ?? barcodeInput).replace(/\D/g, "");
    if (code.length < 8) {
      setError("Enter a valid 8–14 digit product barcode (e.g., 3017620422003).");
      return;
    }
    if (!user) {
      setShowProfile(true);
      return;
    }
    setError(null);
    setShowBarcodeBox(false);
    setBarcodeInput("");
    setSending(true);
    const optimisticUser: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: `🏷️ Scan food barcode: ${code} (Yuka Health Score)`,
    };
    setMessages((prev) => [...prev, optimisticUser]);
    try {
      const res = await api.identifyEquipment({
        user_id: user.user_id,
        conversation_id: activeConvId,
        barcode: code,
        scan_mode: "barcode",
      });
      setActiveConvId(res.conversation_id);
      setMessages((prev) => [
        ...prev,
        {
          id: res.message_id,
          role: "assistant",
          content: res.reply,
          sources: res.sources,
          matched_exercises: res.matched_exercises,
          generated_image_url: res.generated_image_url || "",
          flags: res.flags,
          rating: 0,
          provider: res.provider,
          latency_ms: res.latency_ms,
        },
      ]);
      loadConversations(user.user_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Barcode scan failed");
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
    } finally {
      setSending(false);
    }
  };

  const sendMessage = async (textOverride?: string, muscleOverride?: string | null) => {
    if (!user) {
      setShowProfile(true);
      return;
    }
    const text = (textOverride ?? input).trim();
    const photoToSend = textOverride ? null : pendingPhoto;
    if ((!text && !photoToSend) || sending) return;

    const muscleToUse = muscleOverride !== undefined ? muscleOverride : selectedMuscle;
    setError(null);
    setInput("");
    if (photoToSend) setPendingPhoto(null);
    setSending(true);

    const defaultPhotoPrompt =
      scanMode === "food"
        ? "Calculate calories & macros of this meal (Cal AI style)."
        : scanMode === "barcode"
        ? "Scan this barcode / food label for a Yuka health score."
        : scanMode === "equipment"
        ? "Identify this gym equipment and show me how to use it safely."
        : "Analyze this photo (gym equipment, food macros, or product label).";
    const userText = text || defaultPhotoPrompt;
    const optimisticUser: ChatMessage = {
      id: `tmp-${Date.now()}`,
      role: "user",
      content: userText,
      muscle: photoToSend ? null : muscleToUse,
      image_preview: photoToSend,
    };
    setMessages((prev) => [...prev, optimisticUser]);

    try {
      const res = photoToSend
        ? await api.identifyEquipment({
            user_id: user.user_id,
            conversation_id: activeConvId,
            image_data_url: photoToSend,
            scan_mode: scanMode,
            question: userText,
          })
        : await api.sendChat({
            user_id: user.user_id,
            conversation_id: activeConvId,
            message: userText,
            muscle: muscleToUse,
            model: selectedModel,
          });
      setActiveConvId(res.conversation_id);
      setMessages((prev) => [
        ...prev,
        {
          id: res.message_id,
          role: "assistant",
          content: res.reply,
          sources: res.sources,
          matched_exercises: res.matched_exercises,
          generated_image_url: res.generated_image_url || "",
          flags: res.flags,
          rating: 0,
          provider: res.provider,
          latency_ms: res.latency_ms,
        },
      ]);
      if (res.suggestions?.length) setSuggestions(res.suggestions);
      loadConversations(user.user_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send message");
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUser.id));
    } finally {
      setSending(false);
    }
  };

  const handleRate = async (msgId: string, rating: 1 | -1) => {
    const current = messages.find((m) => m.id === msgId)?.rating || 0;
    const next: -1 | 0 | 1 = current === rating ? 0 : rating;
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, rating: next } : m)));
    try {
      await api.rateMessage(msgId, next);
    } catch {
      // revert silently if needed
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <Navbar
        user={user}
        health={health}
        onOpenProfile={() => setShowProfile(true)}
        onOpenFeedback={() => setShowFeedback(true)}
      />

      {/* Error banner */}
      {error && (
        <div className="mx-auto mt-3 flex w-full max-w-[1600px] items-center justify-between gap-2 px-4">
          <div className="flex w-full items-center justify-between rounded-2xl border border-[#F16060]/40 bg-[#F16060]/10 px-4 py-2.5 text-xs font-medium text-red-800">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-[#F16060]" />
              {error}
            </span>
            <button onClick={() => setError(null)} className="text-red-700 hover:text-red-950">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main 3-column workspace */}
      <main className="mx-auto grid w-full max-w-[1600px] flex-1 grid-cols-1 gap-5 p-4 lg:grid-cols-12">
        {/* LEFT: Daily Targets (Dark Forest Hero Card) + Conversations */}
        <aside className="flex flex-col gap-5 lg:col-span-3">
          {user && (
            <section className="rounded-[26px] border border-white/10 bg-dark p-5 text-white shadow-card">
              <div className="mb-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-lime/25 bg-lime/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-lime">
                  Daily Targets
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium capitalize text-[#C5D4CA]">
                  {user.profile.goal.replace("_", " ")}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 text-center">
                <div className="rounded-2xl bg-dark-2 p-3 ring-1 ring-white/5">
                  <div className="font-display text-2xl font-extrabold text-lime">{user.targets.calories}</div>
                  <div className="text-[11px] text-[#9AA5A0]">kcal / day</div>
                </div>
                <div className="rounded-2xl bg-dark-2 p-3 ring-1 ring-white/5">
                  <div className="font-display text-2xl font-extrabold text-white">{user.targets.protein_g} g</div>
                  <div className="text-[11px] text-[#9AA5A0]">Protein</div>
                </div>
                <div className="rounded-2xl bg-dark-2/80 p-2.5 ring-1 ring-white/5">
                  <div className="font-display text-base font-bold text-white">{user.targets.carbs_g} g</div>
                  <div className="text-[11px] text-[#9AA5A0]">Carbs</div>
                </div>
                <div className="rounded-2xl bg-dark-2/80 p-2.5 ring-1 ring-white/5">
                  <div className="font-display text-base font-bold text-white">
                    {user.targets.fat_g} g · {user.targets.water_l} L
                  </div>
                  <div className="text-[11px] text-[#9AA5A0]">Fat · Water</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] text-[#C5D4CA]">
                <span className="rounded-full bg-lime/15 px-2.5 py-0.5 font-semibold text-lime">
                  Split: {(user.profile.split || "auto").replace(/_/g, " ")}
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5">🏋️ {user.profile.equipment}</span>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5">{user.profile.days_per_week}d/wk</span>
                {user.profile.diet !== "none" && (
                  <span className="rounded-full bg-white/10 px-2.5 py-0.5 capitalize">{user.profile.diet}</span>
                )}
                {user.profile.injuries.length > 0 && (
                  <span className="rounded-full bg-amber-400/15 px-2.5 py-0.5 text-amber-300">
                    ⚠️ {user.profile.injuries.join(", ")}
                  </span>
                )}
              </div>
            </section>
          )}

          {/* Conversations */}
          <section className="flex flex-1 flex-col rounded-[26px] border border-ink/10 bg-surface p-4 shadow-soft">
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="font-display text-xs font-bold uppercase tracking-wider text-tertiary">Conversations</h2>
              <button
                onClick={startNewChat}
                className="flex items-center gap-1 rounded-full bg-lime/60 px-3 py-1 text-xs font-bold text-forest-deep transition hover:bg-lime"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" /> New
              </button>
            </div>
            <div className="max-h-60 space-y-1 overflow-y-auto lg:max-h-[420px]">
              {conversations.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-tertiary">No conversations yet. Ask your first question!</p>
              ) : (
                conversations.map((c) => (
                  <div
                    key={c.id}
                    className={`group flex items-center justify-between rounded-2xl px-3 py-2.5 text-xs font-medium transition ${
                      activeConvId === c.id
                        ? "bg-forest-pale text-forest-deep ring-1 ring-forest/20"
                        : "text-secondary hover:bg-bg"
                    }`}
                  >
                    <button onClick={() => openConversation(c.id)} className="flex-1 truncate text-left">
                      {c.title}
                    </button>
                    <button
                      onClick={() => removeConversation(c.id)}
                      title="Delete conversation"
                      className="ml-2 text-tertiary opacity-0 transition hover:text-[#F16060] group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>

        {/* CENTER: Chatbot */}
        <section className="flex min-h-[560px] flex-col rounded-[28px] border border-ink/10 bg-surface shadow-soft lg:col-span-5">
          {/* Chat Messages */}
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-8 text-center">
                <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-forest-deep/10 bg-lime/60 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-forest-deep">
                  <Sparkles className="h-3.5 w-3.5" /> AI Fitness Coach
                </span>
                <h2 className="font-display text-2xl font-extrabold text-forest-deep">
                  Your training & nutrition, <span className="text-forest">explained.</span>
                </h2>
                <p className="mt-2 max-w-sm text-xs leading-relaxed text-secondary">
                  Click any muscle on the interactive body map to view animated exercise guides, snap a photo of gym equipment 📷,
                  or ask anything about workouts, macros and meal prep.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="rounded-full border border-ink/10 bg-bg px-3.5 py-2 text-left text-xs font-medium text-forest-deep transition hover:border-forest hover:bg-forest-pale/70"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  {m.role === "assistant" && (
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-forest-deep text-lime">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-[22px] px-4 py-3 ${
                      m.role === "user"
                        ? "bg-forest-deep text-white shadow-soft"
                        : "border border-ink/10 bg-bg text-ink"
                    }`}
                  >
                    {m.role === "user" && m.muscle && (
                      <div className="mb-1 inline-block rounded-full bg-lime/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lime">
                        Muscle: {m.muscle.replace("_", " ")}
                      </div>
                    )}
                    {m.role === "user" && m.image_preview && (
                      <img
                        src={m.image_preview}
                        alt="Uploaded gym equipment"
                        className="mb-2 max-h-44 rounded-xl border border-white/20 object-cover"
                      />
                    )}
                    {m.role === "user" ? (
                      <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                    ) : (
                      <>
                        {m.generated_image_url && (
                          <div className="mb-3 overflow-hidden rounded-2xl border border-ink/10 bg-white">
                            <img
                              src={m.generated_image_url}
                              alt="AI generated meal plate"
                              className="max-h-60 w-full object-cover"
                            />
                          </div>
                        )}
                        <MarkdownText text={m.content} />
                        {m.matched_exercises && m.matched_exercises.length > 0 && (
                          <div className="mt-3 space-y-2 border-t border-ink/10 pt-2.5">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-forest">
                              Animated Exercise Guides for this Equipment
                            </div>
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              {m.matched_exercises.map((ex) => (
                                <div
                                  key={ex.id}
                                  className="flex items-center gap-2.5 rounded-2xl border border-ink/10 bg-surface p-2 text-xs shadow-soft"
                                >
                                  {ex.gif_url && (
                                    <img
                                      src={ex.gif_url}
                                      alt={ex.name}
                                      className="h-16 w-16 shrink-0 rounded-xl border border-ink/10 bg-white object-contain"
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <div className="truncate font-bold text-forest-deep">{ex.name}</div>
                                    <div className="text-[10px] text-secondary">{ex.sets_reps}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Sources + Ratings for assistant messages */}
                    {m.role === "assistant" && (
                      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 pt-2">
                        <div className="flex flex-wrap gap-1">
                          {m.provider && m.provider !== "guardrail" && (
                            <span
                              title={
                                m.provider.startsWith("mock")
                                  ? "The AI model could not be reached, so this answer was built from the knowledge base only."
                                  : "Written by the GymBuddy AI model, grounded in our knowledge base"
                              }
                              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${
                                m.provider.startsWith("mock")
                                  ? "bg-amber-100 text-amber-800 ring-amber-300"
                                  : "bg-lime/30 text-forest-deep ring-lime"
                              }`}
                            >
                              {m.provider.startsWith("mock")
                                ? "Offline answer (AI unavailable)"
                                : `AI: ${
                                    models.find((x) => x.id !== "openrouter/free" && m.provider?.endsWith(x.id))?.label || "GymBuddy AI"
                                  }`}
                            </span>
                          )}
                          {(m.sources || []).map((s, idx) => (
                            <span
                              key={s.id}
                              title={`${s.type}: ${s.title}`}
                              className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-secondary ring-1 ring-ink/10"
                            >
                              [S{idx + 1}] {s.title}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleRate(m.id, 1)}
                            title="Helpful"
                            className={`rounded-full p-1 transition ${
                              m.rating === 1 ? "bg-lime text-forest-deep" : "text-tertiary hover:bg-surface hover:text-forest-deep"
                            }`}
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleRate(m.id, -1)}
                            title="Not helpful"
                            className={`rounded-full p-1 transition ${
                              m.rating === -1 ? "bg-[#F16060]/20 text-red-700" : "text-tertiary hover:bg-surface hover:text-red-600"
                            }`}
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {m.role === "user" && (
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-forest-pale text-forest-deep">
                      {user?.avatar_url ? (
                        <img src={user.avatar_url} alt="You" className="h-full w-full object-cover" />
                      ) : (
                        <UserIcon className="h-4 w-4" />
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
            {sending && (
              <div className="flex items-center gap-2 text-xs font-medium text-secondary">
                <Bot className="h-4 w-4 animate-pulse text-forest" /> Coach is thinking...
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick suggestions bar when chatting */}
          {messages.length > 0 && suggestions.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto border-t border-ink/10 px-4 py-2.5">
              {suggestions.slice(0, 3).map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="shrink-0 rounded-full border border-ink/10 bg-bg px-3 py-1 text-[11px] font-medium text-forest-deep transition hover:border-forest hover:bg-forest-pale"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Chat Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="border-t border-ink/10 p-3.5"
          >
            {selectedMuscle && (
              <div className="mb-2 flex items-center gap-1.5 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-forest-deep/10 bg-lime/70 px-3 py-0.5 font-bold text-forest-deep">
                  Target muscle: {muscleData?.muscle.name || selectedMuscle}
                  <button
                    type="button"
                    onClick={() => setSelectedMuscle(null)}
                    className="ml-0.5 hover:text-forest"
                    title="Clear muscle context"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              </div>
            )}
            {pendingPhoto && (
              <div className="mb-2 space-y-2 rounded-2xl border border-forest/20 bg-forest-pale/60 p-2.5">
                <div className="flex items-center gap-2.5">
                  <img src={pendingPhoto} alt="Photo preview" className="h-12 w-12 rounded-xl object-cover" />
                  <div className="flex-1 text-xs">
                    <div className="font-bold text-forest-deep">Photo ready (compressed)</div>
                    <div className="text-[11px] text-secondary">Choose scan mode or keep Auto</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingPhoto(null)}
                    className="rounded-full p-1 text-secondary hover:bg-white hover:text-ink"
                    title="Remove photo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      ["auto", "✨ Auto"],
                      ["equipment", "🏋️ Equipment + GIF"],
                      ["food", "🍽️ Food (Cal AI)"],
                      ["barcode", "🏷️ Barcode (Yuka)"],
                    ] as const
                  ).map(([k, lbl]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setScanMode(k)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${
                        scanMode === k
                          ? "bg-forest-deep text-lime"
                          : "bg-surface text-secondary hover:text-forest-deep"
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {showBarcodeBox && (
              <div className="mb-2 flex items-center gap-2 rounded-2xl border border-forest/20 bg-forest-pale/60 p-2">
                <input
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      scanBarcodeDirect();
                    }
                  }}
                  placeholder="Enter product barcode (e.g. 3017620422003)..."
                  className="flex-1 rounded-full border border-ink/15 bg-surface px-3 py-1.5 font-mono text-xs text-ink focus:border-forest focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => scanBarcodeDirect()}
                  className="rounded-full bg-forest-deep px-3 py-1.5 text-[11px] font-bold text-lime hover:bg-forest"
                >
                  Yuka Scan
                </button>
                <button
                  type="button"
                  onClick={() => setShowBarcodeBox(false)}
                  className="rounded-full p-1 text-secondary hover:text-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {/* Antigravity-style composer box: text input on top, camera + animated model selector + send below */}
            <div className="rounded-[22px] border border-ink/15 bg-bg p-2 transition-colors focus-within:border-forest focus-within:bg-white">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoPick}
                className="hidden"
              />
              <textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder={
                  pendingPhoto
                    ? "Ask about this equipment (or just press Enter)..."
                    : selectedMuscle
                    ? `Ask about ${muscleData?.muscle.name || selectedMuscle} workouts...`
                    : "Ask anything about workouts, calories, or snap a machine photo..."
                }
                maxLength={2000}
                className="w-full resize-none bg-transparent px-2.5 pt-1 text-sm text-ink placeholder-tertiary focus:outline-none"
              />

              {/* Bottom toolbar under the text input */}
              <div className="mt-1 flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    title="Take or upload a photo (gym machine, food plate, or barcode)"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-secondary transition hover:bg-forest-pale hover:text-forest-deep"
                  >
                    <Camera className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLiveScanner(true)}
                    title="Scan a barcode with the live camera (Yuka style)"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime/70 text-forest-deep transition hover:bg-lime"
                  >
                    <ScanBarcode className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBarcodeBox((b) => !b)}
                    title="Type a barcode number manually"
                    className={`flex h-8 shrink-0 items-center justify-center rounded-full px-2 text-[10px] font-bold transition ${
                      showBarcodeBox
                        ? "bg-forest-deep text-lime"
                        : "text-secondary hover:bg-forest-pale hover:text-forest-deep"
                    }`}
                  >
                    123
                  </button>

                  {/* Animated upward Model Picker (Antigravity-style) */}
                  {models.length > 0 && (
                    <div ref={modelMenuRef} className="relative">
                      <button
                        type="button"
                        onClick={() => setModelMenuOpen((o) => !o)}
                        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                          modelMenuOpen
                            ? "bg-forest-deep text-lime shadow-soft"
                            : "text-secondary hover:bg-forest-pale/80 hover:text-forest-deep"
                        }`}
                      >
                        <ChevronUp
                          className={`h-3.5 w-3.5 transition-transform duration-200 ${
                            modelMenuOpen ? "rotate-180" : ""
                          }`}
                        />
                        <span className="max-w-[165px] truncate">
                          {models.find((m) => m.id === selectedModel)?.label || "Auto"}
                        </span>
                      </button>

                      {modelMenuOpen && (
                        <div className="animate-popover-up absolute bottom-full left-0 z-40 mb-2 w-72 overflow-hidden rounded-2xl border border-ink/15 bg-surface p-1.5 shadow-card">
                          <div className="flex items-center justify-between px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-tertiary">
                            <span className="flex items-center gap-1">
                              <Cpu className="h-3 w-3 text-forest" /> AI models
                            </span>
                          </div>
                          <div className="space-y-0.5">
                            {models.map((m) => {
                              const active = m.id === selectedModel;
                              return (
                                <button
                                  key={m.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedModel(m.id);
                                    localStorage.setItem(STORAGE_MODEL_KEY, m.id);
                                    setModelMenuOpen(false);
                                  }}
                                  className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-xs transition ${
                                    active
                                      ? "bg-forest-pale font-bold text-forest-deep"
                                      : "text-ink hover:bg-bg"
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="truncate">{m.label}</div>
                                    <div className="text-[10px] font-medium text-tertiary">{m.tag}</div>
                                  </div>
                                  {active && <Check className="h-4 w-4 shrink-0 text-forest" />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={sending || (!input.trim() && !pendingPhoto)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-deep text-lime shadow-soft transition hover:bg-forest disabled:opacity-35"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </form>
        </section>

        {/* RIGHT: Interactive Muscle Map (Dark Forest Showcase) + Exercises */}
        <aside className="flex flex-col gap-5 lg:col-span-4">
          <section className="rounded-[28px] border border-white/10 bg-dark p-5 text-white shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-lime/25 bg-lime/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-lime">
                Interactive Muscle Map
              </span>
              {selectedMuscle && (
                <button
                  onClick={() => setSelectedMuscle(null)}
                  className="text-[11px] font-medium text-[#9AA5A0] hover:text-lime"
                >
                  Clear
                </button>
              )}
            </div>
            <MuscleMap selectedMuscle={selectedMuscle} onSelect={setSelectedMuscle} />
          </section>

          {/* Selected muscle exercises */}
          {selectedMuscle && (
            <section className="rounded-[26px] border border-ink/10 bg-surface p-4 shadow-soft">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-base font-bold text-forest-deep">
                  {muscleData?.muscle.name || selectedMuscle} Exercises
                </h3>
                <button
                  onClick={() =>
                    sendMessage(
                      `Build me a ${muscleData?.muscle.name || selectedMuscle} workout for my profile.`,
                      selectedMuscle
                    )
                  }
                  className="rounded-full bg-forest-deep px-3.5 py-1 text-[11px] font-bold text-lime transition hover:bg-forest"
                >
                  Ask coach
                </button>
              </div>
              {loadingMuscle ? (
                <p className="text-xs text-tertiary">Loading exercises...</p>
              ) : (
                <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
                  {(muscleData?.exercises || []).map((ex) => (
                    <div
                      key={ex.id}
                      className="flex gap-3 rounded-2xl border border-ink/10 bg-bg p-2.5 text-xs transition hover:border-forest/30"
                    >
                      {(ex.image_url || ex.gif_url) && (
                        <button
                          type="button"
                          onClick={() => setActiveExercise(ex)}
                          title="View animated exercise guide"
                          className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-ink/10 bg-white"
                        >
                          <img
                            src={ex.image_url || ex.gif_url}
                            alt={ex.name}
                            className="h-full w-full object-contain"
                          />
                          <span className="absolute inset-0 flex items-center justify-center bg-dark/40 opacity-0 transition group-hover:opacity-100">
                            <Play className="h-5 w-5 fill-lime text-lime" />
                          </span>
                        </button>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveExercise(ex)}
                            className="truncate text-left font-bold text-forest-deep hover:text-forest"
                          >
                            {ex.name}
                          </button>
                          <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold capitalize text-secondary ring-1 ring-ink/10">
                            {ex.level}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-secondary">{ex.sets_reps}</p>
                        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1">
                          <div className="flex flex-wrap gap-1">
                            {ex.fits_equipment ? (
                              <span className="rounded-full bg-lime/60 px-2 py-0.5 text-[10px] font-bold text-forest-deep">
                                Fits equipment
                              </span>
                            ) : (
                              <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] text-tertiary ring-1 ring-ink/10">
                                Needs: {ex.equipment.join("/")}
                              </span>
                            )}
                            {ex.injury_warning.length > 0 && (
                              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                                ⚠️ {ex.injury_warning.join(", ")}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {ex.gif_url && (
                              <button
                                type="button"
                                onClick={() => setActiveExercise(ex)}
                                className="text-[11px] font-semibold text-secondary hover:text-forest-deep"
                              >
                                Watch
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                sendMessage(`How do I perform ${ex.name} with proper form?`, selectedMuscle)
                              }
                              className="text-[11px] font-bold text-forest hover:underline"
                            >
                              Ask →
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </aside>
      </main>

      {showProfile && (
        <ProfileModal
          initial={user}
          canClose={Boolean(user)}
          onClose={() => setShowProfile(false)}
          onSave={handleSaveProfile}
        />
      )}
      {showFeedback && <FeedbackModal userId={user?.user_id} onClose={() => setShowFeedback(false)} />}
      {showLiveScanner && (
        <BarcodeScanner
          onClose={() => setShowLiveScanner(false)}
          onDetected={(code) => {
            setShowLiveScanner(false);
            scanBarcodeDirect(code);
          }}
        />
      )}

      {/* Exercise Demo Modal (Animated GIF + step-by-step instructions) */}
      {activeExercise && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-dark/60 p-4 backdrop-blur-sm"
          onClick={() => setActiveExercise(null)}
        >
          <div
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[28px] border border-ink/10 bg-surface p-6 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-lg font-extrabold text-forest-deep">{activeExercise.name}</h3>
                <p className="text-xs font-medium text-secondary">{activeExercise.sets_reps}</p>
              </div>
              <button
                onClick={() => setActiveExercise(null)}
                className="rounded-full p-1.5 text-tertiary hover:bg-bg hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {activeExercise.gif_url && (
              <div className="mb-4 flex justify-center rounded-2xl border border-ink/10 bg-white p-3">
                <img
                  src={activeExercise.gif_url}
                  alt={`${activeExercise.name} animation`}
                  className="h-52 w-52 object-contain"
                />
              </div>
            )}

            <div className="space-y-3 text-xs text-ink">
              <div>
                <h4 className="mb-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-tertiary">
                  How to perform
                </h4>
                {activeExercise.steps_en && activeExercise.steps_en.length > 0 ? (
                  <ol className="list-decimal space-y-1 pl-4 text-secondary">
                    {activeExercise.steps_en.map((step, i) => (
                      <li key={i}>{step}</li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-secondary">{activeExercise.instructions}</p>
                )}
              </div>
              <div className="rounded-2xl bg-forest-pale/70 p-3 text-forest-deep">
                <span className="font-bold">Coach tip: </span>
                {activeExercise.tips}
              </div>
              {activeExercise.injury_warning.length > 0 && (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-100 p-3 text-amber-900">
                  ⚠️ Caution: conflicts with your declared injury ({activeExercise.injury_warning.join(", ")}).
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setActiveExercise(null)}
                className="rounded-full border border-ink/15 px-4 py-2 text-xs font-semibold text-secondary hover:bg-bg"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const name = activeExercise.name;
                  setActiveExercise(null);
                  sendMessage(`Give me form cues and a beginner progression for ${name}.`, selectedMuscle);
                }}
                className="rounded-full bg-forest-deep px-5 py-2 text-xs font-bold text-lime shadow-soft hover:bg-forest"
              >
                Ask coach about this exercise
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

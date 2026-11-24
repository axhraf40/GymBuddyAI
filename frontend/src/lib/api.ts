import type {
  ChatMessage,
  ConversationSummary,
  FridgeMealsResponse,
  HealthInfo,
  ModelsResponse,
  MuscleExercisesResponse,
  NearbyRestaurantsResponse,
  NutritionOverviewResponse,
  Profile,
  UserOut,
  WorkoutSessionResponse,
} from "./types";

const BASE = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
const TOKEN_KEY = "gymbuddy_auth_token";
const VAULT_KEY = "gymbuddy_account_vault";

function getVaultTokens(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    return Object.values(map);
  } catch {
    return [];
  }
}

export function rememberUserToken(u?: { user_id?: string; email?: string; username?: string; auth_token?: string }) {
  if (typeof window === "undefined" || !u?.auth_token) return;
  localStorage.setItem(TOKEN_KEY, u.auth_token);
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    const map: Record<string, string> = raw ? JSON.parse(raw) : {};
    const key = (u.email || u.username || u.user_id || "default").toLowerCase();
    map[key] = u.auth_token;
    localStorage.setItem(VAULT_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) || "" : "";
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { "X-Auth-Token": token } : {}),
        ...(init?.headers || {}),
      },
    });
  } catch {
    throw new Error(`Cannot reach the GymBuddy API at ${BASE}. Make sure the backend is running.`);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = Array.isArray(data?.detail) ? data.detail.join("; ") : data?.detail;
    throw new Error(detail || `API error (${res.status})`);
  }
  if (data && typeof data === "object" && "auth_token" in data && data.auth_token) {
    rememberUserToken(data);
  }
  return data as T;
}

export const api = {
  health: () => req<HealthInfo>("/api/health"),

  listModels: () => req<ModelsResponse>("/api/models"),

  register: (payload: { username?: string; name: string; email: string; password: string; profile?: Profile }) =>
    req<UserOut & { verification_required?: boolean; email_sent?: boolean; verification_code?: string }>(
      "/api/auth/register",
      { method: "POST", body: JSON.stringify(payload) }
    ),

  verifyEmail: (payload: { email: string; code: string }) =>
    req<UserOut>("/api/auth/verify-email", { method: "POST", body: JSON.stringify(payload) }),

  login: (payload: { email: string; password: string }) =>
    req<UserOut>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ ...payload, vault_tokens: getVaultTokens() }),
    }),

  googleLogin: (payload: {
    id_token?: string;
    access_token?: string;
    email?: string;
    name?: string;
    avatar_url?: string;
  }) =>
    req<UserOut & { verification_required?: boolean; email_sent?: boolean; verification_code?: string }>(
      "/api/auth/google",
      { method: "POST", body: JSON.stringify({ ...payload, vault_tokens: getVaultTokens() }) }
    ),

  forgotPassword: (email: string) =>
    req<{ ok: boolean; email_sent?: boolean; message: string; verification_code?: string }>(
      "/api/auth/forgot-password",
      {
        method: "POST",
        body: JSON.stringify({ email, vault_tokens: getVaultTokens() }),
      }
    ),

  resetPassword: (payload: { email: string; code: string; new_password: string }) =>
    req<{ ok: boolean; message: string; auth_token?: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ ...payload, vault_tokens: getVaultTokens() }),
    }),

  nutritionOverview: (userId?: string) =>
    req<NutritionOverviewResponse>(
      `/api/nutrition/overview${userId ? `?user_id=${encodeURIComponent(userId)}` : ""}`
    ),

  nearbyRestaurants: (payload: { lat?: number; lon?: number; city?: string; user_id?: string | null }) =>
    req<NearbyRestaurantsResponse>("/api/restaurants/nearby", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  fridgeMeals: (payload: { user_id?: string | null; ingredients: string; currency_code?: string }) =>
    req<FridgeMealsResponse>("/api/nutrition/fridge-meals", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  setPlan: (userId: string, plan: "free" | "pro") =>
    req<UserOut>(`/api/users/${userId}/plan`, { method: "POST", body: JSON.stringify({ plan }) }),

  workoutSession: (split: string, userId?: string) =>
    req<WorkoutSessionResponse>(
      `/api/workouts/session?split=${encodeURIComponent(split)}${userId ? `&user_id=${encodeURIComponent(userId)}` : ""}`
    ),

  createUser: (payload: { name: string; email: string; avatar_url?: string; daily_digest: boolean; profile: Profile }) =>
    req<UserOut>("/api/users", { method: "POST", body: JSON.stringify(payload) }),

  getUser: (userId: string) => req<UserOut>(`/api/users/${userId}`),

  updateUser: (
    userId: string,
    payload: { name: string; email: string; avatar_url?: string; daily_digest: boolean; profile: Profile }
  ) => req<UserOut>(`/api/users/${userId}`, { method: "PUT", body: JSON.stringify(payload) }),

  muscleExercises: (muscleId: string, userId?: string) =>
    req<MuscleExercisesResponse>(
      `/api/muscles/${muscleId}/exercises${userId ? `?user_id=${encodeURIComponent(userId)}` : ""}`
    ),

  sendChat: (payload: {
    user_id: string;
    conversation_id?: string | null;
    message: string;
    muscle?: string | null;
    model?: string | null;
  }) =>
    req<{
      conversation_id: string;
      message_id: string;
      reply: string;
      sources: { id: string; title: string; type: string }[];
      matched_exercises?: {
        id: string;
        name: string;
        muscle: string;
        sets_reps: string;
        gif_url?: string;
        image_url?: string;
        tips?: string;
      }[];
      flags: string[];
      suggestions: string[];
      generated_image_url?: string;
      provider: string;
      latency_ms: number;
    }>("/api/chat", { method: "POST", body: JSON.stringify(payload) }),

  identifyEquipment: (payload: {
    user_id: string;
    conversation_id?: string | null;
    image_data_url?: string;
    barcode?: string | null;
    scan_mode?: "auto" | "equipment" | "food" | "barcode";
    question?: string;
  }) =>
    req<{
      conversation_id: string;
      message_id: string;
      reply: string;
      sources: { id: string; title: string; type: string }[];
      matched_exercises?: {
        id: string;
        name: string;
        muscle: string;
        sets_reps: string;
        gif_url?: string;
        image_url?: string;
        tips?: string;
      }[];
      flags: string[];
      suggestions: string[];
      generated_image_url?: string;
      provider: string;
      latency_ms: number;
    }>("/api/equipment/identify", { method: "POST", body: JSON.stringify(payload) }),

  listConversations: (userId: string) =>
    req<ConversationSummary[]>(`/api/users/${userId}/conversations`),

  getMessages: (convId: string, userId: string) =>
    req<ChatMessage[]>(`/api/conversations/${convId}/messages?user_id=${encodeURIComponent(userId)}`),

  deleteConversation: (convId: string, userId: string) =>
    req<{ ok: boolean }>(`/api/conversations/${convId}?user_id=${encodeURIComponent(userId)}`, {
      method: "DELETE",
    }),

  rateMessage: (messageId: string, rating: -1 | 0 | 1) =>
    req<{ ok: boolean }>(`/api/messages/${messageId}/rating`, {
      method: "POST",
      body: JSON.stringify({ rating }),
    }),

  sendFeedback: (payload: {
    user_id?: string | null;
    kind: "bug" | "wrong_answer" | "idea" | "other";
    text: string;
    page?: string;
  }) => req<{ ok: boolean; id: string }>("/api/feedback", { method: "POST", body: JSON.stringify(payload) }),
};

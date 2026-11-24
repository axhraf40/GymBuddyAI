"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Script from "next/script";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Crown,
  KeyRound,
  LogOut,
  MailCheck,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import { api, rememberUserToken } from "@/lib/api";
import type { UserOut } from "@/lib/types";

const STORAGE_USER_KEY = "gymbuddy_user_id";
const STORAGE_TOKEN_KEY = "gymbuddy_auth_token";
const GOOGLE_CLIENT_ID = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();

type AuthMode = "login" | "register" | "verify" | "forgot";

interface GoogleIdApi {
  initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleIdApi } };
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [shownCode, setShownCode] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserOut | null>(null);
  const [gsiReady, setGsiReady] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedId = typeof window !== "undefined" ? localStorage.getItem(STORAGE_USER_KEY) : null;
    if (savedId) {
      api
        .getUser(savedId)
        .then(setCurrentUser)
        .catch(() => localStorage.removeItem(STORAGE_USER_KEY));
    }
  }, []);

  const finishSignIn = useCallback(
    (u: UserOut) => {
      rememberUserToken(u);
      localStorage.setItem(STORAGE_USER_KEY, u.user_id);
      router.push("/coach");
    },
    [router]
  );

  // Official "Sign in with Google" button (Google Identity Services): opens Google's own account picker.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !gsiReady || currentUser) return;
    if (mode !== "login" && mode !== "register") return;
    const gid = window.google?.accounts?.id;
    const el = googleBtnRef.current;
    if (!gid || !el) return;
    gid.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (resp) => {
        setLoading(true);
        setError(null);
        try {
          const u = await api.googleLogin({ id_token: resp.credential });
          finishSignIn(u);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Google sign-in failed");
        } finally {
          setLoading(false);
        }
      },
    });
    el.innerHTML = "";
    gid.renderButton(el, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: "continue_with",
      width: Math.min(el.clientWidth || 360, 400),
    });
  }, [gsiReady, mode, currentUser, finishSignIn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfoMsg(null);
    try {
      if (mode === "register") {
        const res = await api.register({ username, name: name || username, email, password });
        if (res.verification_required) {
          setMode("verify");
          setShownCode(res.verification_code || null);
          setInfoMsg(`We sent a 6-digit verification code to ${email}. Enter it below to confirm your email.`);
        } else {
          finishSignIn(res);
        }
      } else if (mode === "verify") {
        const u = await api.verifyEmail({ email, code: verifyCode });
        finishSignIn(u);
      } else if (mode === "login") {
        const u = await api.login({ email, password });
        finishSignIn(u);
      } else if (mode === "forgot") {
        if (!codeSent) {
          const res = await api.forgotPassword(email);
          setCodeSent(true);
          setShownCode(res.verification_code || null);
          setInfoMsg(res.message);
        } else {
          const res = await api.resetPassword({ email, code: resetCode, new_password: newPassword });
          if (res.auth_token) {
            rememberUserToken({ email, auth_token: res.auth_token });
          }
          setInfoMsg(res.message);
          setMode("login");
          setCodeSent(false);
          setResetCode("");
          setNewPassword("");
          setShownCode(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem(STORAGE_USER_KEY);
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    setCurrentUser(null);
  };

  const inputCls =
    "w-full rounded-2xl border border-ink/15 bg-bg px-4 py-3 text-sm text-ink placeholder:text-tertiary focus:border-forest focus:bg-white focus:outline-none";

  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink lg:flex-row">
      {GOOGLE_CLIENT_ID && (
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
          onLoad={() => setGsiReady(true)}
          onReady={() => setGsiReady(true)}
        />
      )}

      {/* Left Brand Showcase (Metrya Dark Forest) */}
      <div className="relative flex flex-col justify-between bg-dark p-8 text-white lg:w-[46%] lg:p-12">
        <div>
          <Link href="/" className="inline-block">
            <img src="/logo.png" alt="GymBuddy App" className="h-14 w-auto object-contain" />
          </Link>
          <div className="mt-10">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-lime/25 bg-lime/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-lime">
              <Sparkles className="h-3.5 w-3.5" /> AI Gym & Nutrition Coach
            </span>
            <h1 className="mt-4 font-display text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-4xl">
              Your entire gym life, <span className="text-lime">guided in one app.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-[#B4C5BA]">
              Click any muscle on the interactive map, scan meals, barcodes, or gym machines, run your live in-gym
              chrono, and discover healthy restaurants near you.
            </p>
          </div>

          <div className="mt-8 space-y-3 text-sm text-[#D6E3DA]">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-lime" />
              <span>Interactive Muscle Map + 55 animated exercise GIFs</span>
            </div>
            <div className="flex items-center gap-3">
              <Timer className="h-5 w-5 shrink-0 text-lime" />
              <span>Smart In-Gym Chrono across 15 workout splits</span>
            </div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 shrink-0 text-lime" />
              <span>Live barcode scanner (Yuka) + Cal AI food scan + Fridge AI Chef</span>
            </div>
          </div>
        </div>

        <div className="mt-10 flex items-center justify-between border-t border-white/10 pt-5 text-xs text-[#899E91]">
          <span>Free forever tier · Pro from $8/mo</span>
          <Link href="/pricing" className="font-bold text-lime hover:underline">
            View pricing →
          </Link>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md rounded-[28px] border border-ink/10 bg-surface p-7 shadow-card">
          {currentUser && currentUser.email ? (
            <div className="space-y-5 text-center">
              {currentUser.avatar_url && (
                <img
                  src={currentUser.avatar_url}
                  alt={currentUser.name}
                  className="mx-auto h-16 w-16 rounded-full border-2 border-forest object-cover"
                />
              )}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-lime/70 px-3 py-1 text-xs font-bold text-forest-deep">
                <Crown className="h-3.5 w-3.5" /> {currentUser.plan.toUpperCase()} PLAN
              </span>
              <h2 className="font-display text-2xl font-extrabold text-forest-deep">
                Signed in as {currentUser.name || currentUser.username || "Athlete"}
              </h2>
              <p className="text-xs font-semibold text-forest">
                @{currentUser.username || currentUser.email.split("@")[0]} · {currentUser.email}
              </p>
              <div className="flex flex-col gap-2.5 pt-2">
                <Link
                  href="/coach"
                  className="flex items-center justify-center gap-2 rounded-full bg-forest-deep px-5 py-3 text-sm font-bold text-lime shadow-soft transition hover:bg-forest"
                >
                  Open AI Coach <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/gym"
                  className="flex items-center justify-center gap-2 rounded-full border border-ink/15 bg-bg px-5 py-3 text-sm font-semibold text-forest-deep transition hover:bg-forest-pale"
                >
                  Launch In-Gym Chrono
                </Link>
                <button
                  onClick={handleSignOut}
                  className="mt-2 inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-tertiary hover:text-red-600"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign out & switch account
                </button>
              </div>
            </div>
          ) : (
            <>
              {(mode === "login" || mode === "register") && (
                <div className="mb-5 flex rounded-full border border-ink/10 bg-bg p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError(null);
                      setInfoMsg(null);
                    }}
                    className={`flex-1 rounded-full py-2 text-xs font-bold transition ${
                      mode === "login" ? "bg-forest-deep text-lime shadow-soft" : "text-secondary hover:text-ink"
                    }`}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("register");
                      setError(null);
                      setInfoMsg(null);
                    }}
                    className={`flex-1 rounded-full py-2 text-xs font-bold transition ${
                      mode === "register" ? "bg-forest-deep text-lime shadow-soft" : "text-secondary hover:text-ink"
                    }`}
                  >
                    Create account
                  </button>
                </div>
              )}

              <h2 className="font-display text-2xl font-extrabold text-forest-deep">
                {mode === "login" && "Sign in to your account"}
                {mode === "register" && "Create your personal account"}
                {mode === "verify" && "Verify your email"}
                {mode === "forgot" && "Reset your password"}
              </h2>
              <p className="mt-1 text-xs text-secondary">
                {mode === "login" && "Enter your email or username and password to access your account."}
                {mode === "register" && "Each account has its own username, email, password, and workout profile."}
                {mode === "verify" && `Enter the 6-digit code sent to ${email}.`}
                {mode === "forgot" &&
                  (codeSent
                    ? "Enter the 6-digit code and choose a new password."
                    : "Enter your account email or username to receive a 6-digit reset code.")}
              </p>

              {/* Official Google button (opens Google's own account picker) */}
              {(mode === "login" || mode === "register") && (
                <div className="mt-4">
                  {GOOGLE_CLIENT_ID ? (
                    <div ref={googleBtnRef} className="flex min-h-[44px] w-full justify-center" />
                  ) : (
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-900">
                      <strong>Google sign-in is not configured yet.</strong> Add{" "}
                      <code className="rounded bg-white px-1">NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> (Vercel → Project →
                      Settings → Environment Variables) and{" "}
                      <code className="rounded bg-white px-1">GOOGLE_CLIENT_ID</code> on the API, then redeploy. Email &
                      password sign-in works meanwhile.
                    </div>
                  )}
                  <p className="mt-2 text-center text-[10px] text-tertiary">
                    By continuing you agree to our{" "}
                    <Link href="/privacy" className="font-semibold text-forest hover:underline">
                      Privacy Policy
                    </Link>
                    .
                  </p>
                  <div className="my-4 flex items-center gap-3 text-[11px] text-tertiary">
                    <span className="h-px flex-1 bg-ink/10" />
                    <span>or with email / username</span>
                    <span className="h-px flex-1 bg-ink/10" />
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-3 rounded-2xl border border-[#F16060]/40 bg-[#F16060]/10 p-3 text-xs font-medium text-red-800">
                  {error}
                </div>
              )}

              {infoMsg && (
                <div className="mt-3 rounded-2xl border border-forest/20 bg-lime/40 p-3 text-xs font-semibold text-forest-deep">
                  {infoMsg}
                  {shownCode && (
                    <div className="mt-1.5 rounded-xl bg-forest-deep px-3 py-1.5 text-center font-mono text-base font-extrabold tracking-widest text-lime">
                      CODE: {shownCode}
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
                {mode === "register" && (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-secondary">Username</label>
                      <input
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value.replace(/\s+/g, "").toLowerCase())}
                        placeholder="achraf_fit"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-secondary">Full name</label>
                      <input
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Achraf"
                        className={inputCls}
                      />
                    </div>
                  </div>
                )}

                {mode !== "verify" && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-secondary">
                      {mode === "register" ? "Email address" : "Email or Username"}
                    </label>
                    <input
                      required
                      type={mode === "register" ? "email" : "text"}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={mode === "register" ? "you@gmail.com" : "you@gmail.com or achraf_fit"}
                      className={inputCls}
                    />
                  </div>
                )}

                {mode === "verify" && (
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-secondary">6-Digit Verification Code</label>
                    <input
                      required
                      maxLength={6}
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value)}
                      placeholder="123456"
                      className={`${inputCls} font-mono text-center text-base tracking-widest`}
                    />
                  </div>
                )}

                {(mode === "login" || mode === "register") && (
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-xs font-semibold text-secondary">Password</label>
                      {mode === "login" && (
                        <button
                          type="button"
                          onClick={() => {
                            setMode("forgot");
                            setCodeSent(false);
                            setShownCode(null);
                            setError(null);
                            setInfoMsg(null);
                          }}
                          className="text-[11px] font-bold text-forest hover:underline"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <input
                      required
                      type="password"
                      minLength={mode === "register" ? 6 : 1}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === "register" ? "At least 6 characters" : "••••••••"}
                      className={inputCls}
                    />
                  </div>
                )}

                {mode === "forgot" && codeSent && (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-secondary">6-Digit Code</label>
                      <input
                        required
                        maxLength={6}
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value)}
                        placeholder="123456"
                        className={`${inputCls} font-mono tracking-widest`}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-secondary">New Password</label>
                      <input
                        required
                        type="password"
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className={inputCls}
                      />
                    </div>
                  </>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-forest-deep py-3 text-sm font-bold text-lime shadow-soft transition hover:bg-forest disabled:opacity-50"
                >
                  {mode === "forgot" && <KeyRound className="h-4 w-4" />}
                  {mode === "verify" && <MailCheck className="h-4 w-4" />}
                  {loading
                    ? "Please wait..."
                    : mode === "login"
                    ? "Sign in"
                    : mode === "register"
                    ? "Create account"
                    : mode === "verify"
                    ? "Verify email & continue"
                    : codeSent
                    ? "Verify code & reset password"
                    : "Send 6-digit reset code"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              {(mode === "forgot" || mode === "verify") && (
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                    setInfoMsg(null);
                    setCodeSent(false);
                    setShownCode(null);
                  }}
                  className="mt-4 block w-full text-center text-xs font-semibold text-secondary hover:text-forest-deep"
                >
                  ← Back to sign in
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

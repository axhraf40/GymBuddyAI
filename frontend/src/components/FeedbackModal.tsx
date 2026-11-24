"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/api";

interface FeedbackModalProps {
  userId?: string | null;
  onClose: () => void;
}

export function FeedbackModal({ userId, onClose }: FeedbackModalProps) {
  const [kind, setKind] = useState<"bug" | "wrong_answer" | "idea" | "other">("bug");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api.sendFeedback({
        user_id: userId || null,
        kind,
        text,
        page: typeof window !== "undefined" ? window.location.pathname : "/",
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send feedback");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-dark/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[28px] border border-ink/10 bg-surface p-6 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-forest-deep">Report a Problem / Feedback</h3>
          <button onClick={onClose} className="rounded-full p-1.5 text-tertiary hover:bg-bg hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="space-y-4 py-4 text-center">
            <p className="text-sm font-medium text-forest">Thanks! Your report has been recorded.</p>
            <button onClick={onClose} className="rounded-full bg-forest-deep px-5 py-2 text-sm font-semibold text-white">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {error && <p className="rounded-xl bg-[#F16060]/10 p-2.5 text-xs text-red-700">{error}</p>}
            <div>
              <label className="mb-1 block text-xs font-semibold text-secondary">Category</label>
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
                className="w-full rounded-xl border border-ink/15 bg-bg px-3 py-2 text-sm text-ink focus:border-forest focus:bg-white focus:outline-none"
              >
                <option value="bug">Bug / Technical issue</option>
                <option value="wrong_answer">Wrong or unsafe AI answer</option>
                <option value="idea">Feature idea</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-secondary">Describe what happened</label>
              <textarea
                required
                minLength={3}
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Tell us what you tried and what went wrong..."
                className="w-full rounded-xl border border-ink/15 bg-bg px-3 py-2 text-sm text-ink focus:border-forest focus:bg-white focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-ink/15 px-4 py-1.5 text-sm font-medium text-secondary hover:bg-bg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="rounded-full bg-forest-deep px-5 py-1.5 text-sm font-semibold text-white hover:bg-forest disabled:opacity-50"
              >
                {sending ? "Sending..." : "Submit"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

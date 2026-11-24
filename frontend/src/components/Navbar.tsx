"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bug, Crown, Flame, Home, LogIn, MessageSquare, Settings2, Timer, Utensils } from "lucide-react";
import type { HealthInfo, UserOut } from "@/lib/types";

interface NavbarProps {
  user: UserOut | null;
  health?: HealthInfo | null;
  onOpenProfile?: () => void;
  onOpenFeedback?: () => void;
}

export function Navbar({ user, health, onOpenProfile, onOpenFeedback }: NavbarProps) {
  const pathname = usePathname();

  const navLink = (href: string, label: string, Icon: React.ComponentType<{ className?: string }>) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition ${
          active
            ? "bg-forest-deep text-lime shadow-soft"
            : "text-secondary hover:bg-forest-pale/70 hover:text-forest-deep"
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-bg/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 transition hover:opacity-90">
            <img src="/logo.png" alt="GymBuddy App" className="h-10 w-auto object-contain" />
          </Link>

          <nav className="hidden items-center gap-1 rounded-full border border-ink/10 bg-surface p-1 shadow-soft md:flex">
            {navLink("/", "Home", Home)}
            {navLink("/coach", "AI Coach", MessageSquare)}
            {navLink("/gym", "In-Gym Chrono", Timer)}
            {navLink("/nutrition", "Nutrition", Utensils)}
            {navLink("/pricing", "Pro", Crown)}
          </nav>

          {health && !health.mock_mode && (
            <span className="hidden rounded-full border border-forest-deep/10 bg-lime/60 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-forest-deep 2xl:inline-block">
              AI online
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <div className="hidden items-center gap-2 rounded-full border border-ink/10 bg-surface px-3 py-1.5 text-xs shadow-soft 2xl:flex">
              <span className="flex items-center gap-1 font-bold text-forest-deep">
                <Flame className="h-3.5 w-3.5 text-forest" /> {user.targets.calories} kcal
              </span>
              <span className="text-secondary">P {user.targets.protein_g}g</span>
            </div>
          )}

          {user?.plan === "pro" && (
            <Link
              href="/pricing"
              className="hidden items-center gap-1 rounded-full bg-lime px-2.5 py-1.5 text-[11px] font-extrabold text-forest-deep shadow-soft sm:flex"
            >
              <Crown className="h-3.5 w-3.5" /> PRO
            </Link>
          )}

          {onOpenProfile && (
            <button
              onClick={onOpenProfile}
              className="flex items-center gap-1.5 rounded-full border border-ink/15 bg-surface py-1 pl-1.5 pr-3 text-xs font-semibold text-forest-deep shadow-soft transition hover:border-forest hover:bg-forest-pale/50"
            >
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name || "Profile"}
                  className="h-6 w-6 rounded-full object-cover ring-1 ring-forest/30"
                />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forest-pale text-forest-deep">
                  <Settings2 className="h-3.5 w-3.5" />
                </span>
              )}
              <span className="max-w-[90px] truncate">{user ? user.name || "Profile" : "Profile"}</span>
            </button>
          )}

          <Link
            href="/login"
            className="flex items-center gap-1.5 rounded-full border border-ink/15 bg-surface px-3 py-1.5 text-xs font-semibold text-secondary shadow-soft transition hover:border-forest hover:text-forest-deep"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{user?.email ? "Account" : "Sign in"}</span>
          </Link>

          {onOpenFeedback && (
            <button
              onClick={onOpenFeedback}
              title="Report a problem"
              className="flex items-center gap-1.5 rounded-full bg-forest-deep px-3 py-1.5 text-xs font-semibold text-white shadow-soft transition hover:bg-forest"
            >
              <Bug className="h-3.5 w-3.5 text-lime" />
              <span className="hidden lg:inline">Report</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile nav strip */}
      <div className="flex items-center justify-center gap-1 overflow-x-auto border-t border-ink/10 bg-surface/90 px-2 py-1.5 md:hidden">
        {navLink("/", "Home", Home)}
        {navLink("/coach", "Coach", MessageSquare)}
        {navLink("/gym", "Chrono", Timer)}
        {navLink("/nutrition", "Nutrition", Utensils)}
        {navLink("/pricing", "Pro", Crown)}
      </div>
    </header>
  );
}

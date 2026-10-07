"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "@/lib/store";
import { FeatureId } from "@/lib/intent";
import { GoogleTranslateWidget } from "@/components/translation/GoogleTranslateWidget";
import {
  Bot,
  Map,
  Code2,
  Briefcase,
  FileText,
  Settings,
  LogOut,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";

export type NavTabId = "assistant" | "roadmap" | "practice" | "jobs" | "resume";

interface NavLinkItem {
  id: NavTabId;
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV_LINKS: NavLinkItem[] = [
  { id: "assistant", label: "Assistant", href: "/", icon: <Bot size={15} strokeWidth={2} /> },
  { id: "roadmap", label: "Roadmap", href: "/roadmap", icon: <Map size={15} strokeWidth={2} /> },
  { id: "practice", label: "Practice", href: "/practice", icon: <Code2 size={15} strokeWidth={2} /> },
  { id: "jobs", label: "Jobs", href: "/jobs", icon: <Briefcase size={15} strokeWidth={2} /> },
  { id: "resume", label: "Resume", href: "/resume", icon: <FileText size={15} strokeWidth={2} /> },
];

export function TopNav() {
  const pathname = usePathname() || "/";
  const { user, signOut } = useApp();

  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const getActiveTab = (): NavTabId => {
    if (pathname.startsWith("/roadmap") || pathname.startsWith("/journey") || pathname.startsWith("/learning") || pathname.startsWith("/courses") || pathname.startsWith("/progress")) {
      return "roadmap";
    }
    if (pathname.startsWith("/practice")) {
      return "practice";
    }
    if (pathname.startsWith("/jobs") || pathname.startsWith("/opportunities") || pathname.startsWith("/local")) {
      return "jobs";
    }
    if (pathname.startsWith("/resume")) {
      return "resume";
    }
    return "assistant";
  };
  const activeTab = getActiveTab();

  // Close profile dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleNavClick = (id: NavTabId | FeatureId | "progress") => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("careerforge:navigate", { detail: { feature: id } })
      );
    }
  };

  const avatarChar = user?.name ? user.name.charAt(0).toUpperCase() : "U";

  // Section 3 & 19: Do NOT show main application navigation on auth / sign-in pages
  const isAuthPage = (!user && pathname === "/") || pathname.startsWith("/auth") || pathname.startsWith("/login") || pathname.startsWith("/signup");
  if (isAuthPage) {
    return null;
  }

  return (
    <header
      className="sticky top-0 z-40 w-full"
      role="banner"
    >
      {/* Main navbar strip */}
      <div className="border-b border-white/[0.08] bg-bg/80 backdrop-blur-xl">
        <div className="app-shell flex items-center justify-between h-14 gap-4">

          {/* Left: Brand Wordmark */}
          <Link
            href="/"
            onClick={() => handleNavClick("assistant")}
            className="flex items-center gap-2.5 shrink-0 group focus-visible:outline-offset-4"
            aria-label="ubix — home"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/40 flex items-center justify-center shadow-[0_0_12px_rgba(34,211,238,0.25)]">
              <span className="font-display font-bold text-accent text-xs">u</span>
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-white select-none group-hover:text-accent transition-colors">
              ubix
            </span>
          </Link>

          {/* Center: Weightless refined nav — desktop only */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex absolute left-1/2 -translate-x-1/2"
            onKeyDown={(e) => {
              const anchors = Array.from(e.currentTarget.querySelectorAll<HTMLAnchorElement>("a"));
              const idx = anchors.indexOf(document.activeElement as HTMLAnchorElement);
              if (idx !== -1) {
                if (e.key === "ArrowRight") { e.preventDefault(); anchors[(idx + 1) % anchors.length].focus(); }
                if (e.key === "ArrowLeft") { e.preventDefault(); anchors[(idx - 1 + anchors.length) % anchors.length].focus(); }
              }
            }}
          >
            <div className="flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1 backdrop-blur-lg shadow-inner">
              {NAV_LINKS.map((link) => {
                const isActive = activeTab === link.id;
                return (
                  <Link
                    key={link.id}
                    href={link.href}
                    onClick={() => handleNavClick(link.id)}
                    aria-current={isActive ? "page" : undefined}
                    title={link.label}
                    className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium tracking-wide transition-all ${
                      isActive
                        ? "text-white bg-white/[0.08] shadow-[inset_0_1px_1px_rgba(255,255,255,0.15)] border border-white/[0.1]"
                        : "text-ink/65 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`transition-colors ${
                        isActive ? "text-accent" : "text-ink/40"
                      }`}
                    >
                      {link.icon}
                    </span>
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Right: Language + Profile */}
          <div className="flex items-center gap-2.5 shrink-0">

            {/* Language widget — small */}
            <div className="hidden sm:block scale-90 origin-right opacity-80 hover:opacity-100 transition-opacity">
              <GoogleTranslateWidget id="google_translate_element_desktop" />
            </div>

            {/* Profile or Sign In */}
            {user ? (
              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  id="profile-menu-trigger"
                  aria-haspopup="true"
                  aria-expanded={profileOpen}
                  aria-controls="profile-menu"
                  onClick={() => setProfileOpen((o) => !o)}
                  className="flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-2.5 py-1 hover:border-white/[0.2] hover:bg-white/[0.08] transition-all duration-150 cursor-pointer"
                >
                  {user?.picture ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.picture}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-6 w-6 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white text-[10px] font-bold">
                      {avatarChar}
                    </span>
                  )}
                  <span className="hidden sm:inline text-xs font-medium text-ink/75 max-w-[90px] truncate">
                    {user?.name?.split(" ")[0] ?? "Account"}
                  </span>
                  <ChevronDown
                    size={12}
                    strokeWidth={2.5}
                    className={`text-ink/40 transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>

                {/* Dropdown menu */}
                {profileOpen && (
                  <div
                    id="profile-menu"
                    role="menu"
                    aria-label="Account menu"
                    className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-ink/12 bg-bg/98 shadow-lg shadow-ink/8 backdrop-blur-md py-1.5 animate-fadeIn"
                  >
                    {/* User info */}
                    <div className="px-3 py-2 border-b border-ink/8 mb-1">
                      <p className="text-xs font-semibold text-ink truncate">{user?.name}</p>
                      <p className="text-[11px] text-ink/50 truncate">{user?.email}</p>
                    </div>

                    <Link
                      href="/local"
                      role="menuitem"
                      onClick={() => { handleNavClick("local" as FeatureId); setProfileOpen(false); }}
                      className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-ink/70 hover:text-ink hover:bg-surface/60 transition-colors rounded-lg mx-1"
                    >
                      <Briefcase size={13} strokeWidth={2} aria-hidden="true" />
                      Job Discovery
                    </Link>

                    <Link
                      href="/settings"
                      role="menuitem"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-ink/70 hover:text-ink hover:bg-surface/60 transition-colors rounded-lg mx-1"
                    >
                      <Settings size={13} strokeWidth={2} aria-hidden="true" />
                      Settings & Privacy
                    </Link>

                    <div className="border-t border-ink/8 mt-1 pt-1">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => { signOut(); setProfileOpen(false); }}
                        className="flex w-full items-center gap-2.5 px-3 py-1.5 text-xs text-danger/80 hover:text-danger hover:bg-danger/8 transition-colors rounded-lg mx-1 cursor-pointer"
                      >
                        <LogOut size={13} strokeWidth={2} aria-hidden="true" />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/"
                onClick={() => handleNavClick("assistant")}
                className="flex items-center gap-1.5 rounded-full bg-accent text-white px-3.5 py-1.5 text-xs font-semibold hover:bg-accent-soft transition-all shadow-sm cursor-pointer"
              >
                Sign In
              </Link>
            )}

            {/* Mobile hamburger */}
            <button
              type="button"
              aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              onClick={() => setMobileOpen((o) => !o)}
              className="md:hidden flex items-center justify-center h-8 w-8 rounded-full border border-ink/12 bg-surface/80 text-ink hover:border-ink/25 transition-all cursor-pointer"
            >
              {mobileOpen ? <X size={14} strokeWidth={2.5} /> : <Menu size={14} strokeWidth={2.5} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <nav
          id="mobile-nav"
          aria-label="Mobile navigation"
          className="md:hidden border-b border-ink/10 bg-bg/98 backdrop-blur-md animate-fadeIn"
        >
          <div className="app-shell py-2 flex flex-col gap-0.5">
            {NAV_LINKS.map((link) => {
              const isActive = activeTab === link.id;
              return (
                <Link
                  key={link.id}
                  href={link.href}
                  onClick={() => handleNavClick(link.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-surface text-ink font-semibold"
                      : "text-ink/60 hover:text-ink hover:bg-surface/50"
                  }`}
                >
                  <span aria-hidden="true" className={isActive ? "text-accent" : "text-ink/40"}>
                    {link.icon}
                  </span>
                  {link.label}
                </Link>
              );
            })}

            <div className="mt-2 pt-2 border-t border-ink/8">
              <div className="px-3 pb-2 flex items-center gap-2">
                <GoogleTranslateWidget id="google_translate_element_mobile" />
              </div>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}

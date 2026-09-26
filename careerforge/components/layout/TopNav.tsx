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
  FileText,
  Settings,
  LogOut,
  FolderOpen,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";

interface NavLinkItem {
  id: FeatureId | "assistant";
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV_LINKS: NavLinkItem[] = [
  { id: "assistant", label: "Assistant", href: "/", icon: <Bot size={15} strokeWidth={2} /> },
  { id: "roadmap", label: "Roadmap", href: "/roadmap", icon: <Map size={15} strokeWidth={2} /> },
  { id: "practice", label: "Practice", href: "/practice", icon: <Code2 size={15} strokeWidth={2} /> },
  { id: "resume", label: "Resume", href: "/resume", icon: <FileText size={15} strokeWidth={2} /> },
];

export function TopNav() {
  const pathname = usePathname() || "/";
  const { user, signOut } = useApp();

  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const getActiveTab = (): FeatureId | "assistant" => {
    if (pathname.startsWith("/resume")) return "resume";
    if (pathname.startsWith("/roadmap")) return "roadmap";
    if (pathname.startsWith("/practice")) return "practice";
    if (pathname.startsWith("/local")) return "local" as FeatureId;
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

  const handleNavClick = (id: FeatureId | "assistant") => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("careerforge:navigate", { detail: { feature: id } })
      );
    }
  };

  const avatarChar = user?.name ? user.name.charAt(0).toUpperCase() : "U";

  return (
    <header
      className="sticky top-0 z-40 w-full"
      role="banner"
    >
      {/* Main navbar strip */}
      <div className="border-b border-ink/8 bg-bg/95 backdrop-blur-md">
        <div className="app-shell flex items-center justify-between h-12 gap-4">

          {/* Left: Brand */}
          <Link
            href="/"
            onClick={() => handleNavClick("assistant")}
            className="flex items-center gap-2 shrink-0 group"
            aria-label="CareerForge — home"
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white text-[11px] font-bold tracking-tight shadow-sm group-hover:bg-accent-soft transition-colors"
              aria-hidden="true"
            >
              CF
            </span>
            <span className="hidden sm:inline text-sm font-semibold tracking-tight text-ink group-hover:text-accent transition-colors">
              CareerForge
            </span>
          </Link>

          {/* Center: Floating pill nav — desktop only */}
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
            <div className="flex items-center gap-0.5 rounded-full border border-ink/10 bg-surface/70 px-1 py-1 shadow-sm backdrop-blur-xs">
              {NAV_LINKS.map((link) => {
                const isActive = activeTab === link.id;
                return (
                  <Link
                    key={link.id}
                    href={link.href}
                    onClick={() => handleNavClick(link.id)}
                    aria-current={isActive ? "page" : undefined}
                    title={link.label}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-bg text-ink shadow-sm border border-ink/12 font-semibold"
                        : "text-ink/55 hover:text-ink hover:bg-bg/60"
                    }`}
                  >
                    <span aria-hidden="true" className={isActive ? "text-accent" : ""}>{link.icon}</span>
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          {/* Right: Language + Profile */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Language widget — small */}
            <div className="hidden sm:block scale-90 origin-right opacity-80 hover:opacity-100 transition-opacity">
              <GoogleTranslateWidget />
            </div>

            {/* Profile dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                id="profile-menu-trigger"
                aria-haspopup="true"
                aria-expanded={profileOpen}
                aria-controls="profile-menu"
                onClick={() => setProfileOpen((o) => !o)}
                className="flex items-center gap-1.5 rounded-full border border-ink/12 bg-surface/80 px-2 py-1 hover:border-ink/25 hover:bg-surface transition-all duration-150 cursor-pointer"
              >
                {user?.picture ? (
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
                    <FolderOpen size={13} strokeWidth={2} aria-hidden="true" />
                    Local Files
                  </Link>

                  <Link
                    href="#settings"
                    role="menuitem"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-ink/70 hover:text-ink hover:bg-surface/60 transition-colors rounded-lg mx-1"
                  >
                    <Settings size={13} strokeWidth={2} aria-hidden="true" />
                    Settings
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
                <GoogleTranslateWidget />
              </div>
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}

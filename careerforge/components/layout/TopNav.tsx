"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useApp } from "@/lib/store";
import { FeatureId } from "@/lib/intent";
import { GoogleTranslateWidget } from "@/components/translation/GoogleTranslateWidget";

interface NavLinkItem {
  id: FeatureId | "assistant";
  label: string;
  href: string;
}

const NAV_LINKS: NavLinkItem[] = [
  { id: "assistant", label: "Assistant", href: "/" },
  { id: "resume", label: "Resume", href: "/resume" },
  { id: "roadmap", label: "Roadmap", href: "/roadmap" },
  { id: "practice", label: "Practice", href: "/practice" },
  { id: "local", label: "Local", href: "/local" },
];

export function TopNav() {
  const pathname = usePathname() || "/";
  const router = useRouter();
  const { user, signOut } = useApp();

  const getActiveTab = (): FeatureId | "assistant" => {
    if (pathname.startsWith("/resume")) return "resume";
    if (pathname.startsWith("/roadmap")) return "roadmap";
    if (pathname.startsWith("/practice")) return "practice";
    if (pathname.startsWith("/local")) return "local";
    return "assistant";
  };

  const activeTab = getActiveTab();

  const handleNavClick = (link: NavLinkItem, e: React.MouseEvent) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("careerforge:navigate", {
          detail: { feature: link.id },
        })
      );
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-ink/10 bg-bg/95 backdrop-blur-md text-ink transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 relative flex items-center justify-between h-16">
        {/* Left: Brand Logo */}
        <div className="flex items-center">
          <Link
            href="/"
            onClick={(e) => handleNavClick(NAV_LINKS[0], e)}
            className="group flex items-center gap-2.5 text-left cursor-pointer"
            aria-label="CareerForge Home"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface text-ink font-bold text-xs tracking-tight border border-ink/15 shadow-xs group-hover:border-accent/40 transition-colors">
              CF
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-sans text-lg font-bold tracking-tight text-ink group-hover:text-accent transition-colors">
                CareerForge
              </span>
            </div>
          </Link>
        </div>

        {/* Center: Segmented Navigation Pill */}
        <nav
          aria-label="Primary navigation"
          className="absolute left-1/2 -translate-x-1/2 hidden md:flex items-center"
          onKeyDown={(e) => {
            const anchors = Array.from(e.currentTarget.querySelectorAll<HTMLAnchorElement>("a"));
            const currentIndex = anchors.indexOf(document.activeElement as HTMLAnchorElement);
            if (currentIndex !== -1) {
              if (e.key === "ArrowRight") {
                e.preventDefault();
                anchors[(currentIndex + 1) % anchors.length].focus();
              } else if (e.key === "ArrowLeft") {
                e.preventDefault();
                anchors[(currentIndex - 1 + anchors.length) % anchors.length].focus();
              }
            }
          }}
        >
          <div className="flex items-center gap-1 rounded-full border border-ink/15 bg-surface/80 p-1 shadow-xs backdrop-blur-xs">
            {NAV_LINKS.map((link) => {
              const isActive = activeTab === link.id;
              return (
                <Link
                  key={link.id}
                  href={link.href}
                  onClick={(e) => handleNavClick(link, e)}
                  aria-current={isActive ? "page" : undefined}
                  className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "bg-bg text-ink shadow-xs border border-ink/20 font-bold"
                      : "text-ink/70 hover:text-ink hover:bg-bg/50"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Right: Language Selector, User Profile & Sign Out */}
        <div className="flex items-center gap-3">
          <GoogleTranslateWidget />

          {user?.picture ? (
            <div className="relative hidden sm:block">
              <img
                src={user.picture}
                alt=""
                referrerPolicy="no-referrer"
                className="h-8 w-8 rounded-full border border-ink/15 object-cover"
              />
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-success ring-2 ring-bg" />
            </div>
          ) : (
            <div className="hidden h-8 w-8 items-center justify-center rounded-full bg-surface text-xs font-bold text-ink border border-ink/15 sm:flex">
              {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
            </div>
          )}

          <span className="hidden text-xs font-medium text-ink/80 sm:inline truncate max-w-[120px]">
            {user?.name}
          </span>

          <button
            type="button"
            onClick={signOut}
            className="rounded-lg border border-ink/15 bg-surface px-2.5 py-1 text-xs font-medium text-ink/80 hover:border-danger/40 hover:bg-danger/10 hover:text-danger transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Mobile Horizontal Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="flex items-center justify-center gap-1.5 overflow-x-auto border-t border-ink/10 px-4 py-2 md:hidden bg-surface/60"
      >
        {NAV_LINKS.map((link) => {
          const isActive = activeTab === link.id;
          return (
            <Link
              key={link.id}
              href={link.href}
              onClick={(e) => handleNavClick(link, e)}
              aria-current={isActive ? "page" : undefined}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-bg text-ink font-bold border border-ink/20 shadow-xs"
                  : "text-ink/70 hover:text-ink"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

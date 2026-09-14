"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DailyPracticeDocument } from "@/types/practice";
import { fetchDailyPractice } from "@/lib/cdn-fetch";
import { formatDisplayDate } from "@/lib/dates";
import { DailyPracticeList } from "@/components/practice/DailyPracticeList";
import { Skeleton } from "@/components/shared/Skeleton";

const TRACK_LIST = [
  { id: "frontend", label: "Frontend" },
  { id: "backend", label: "Backend" },
  { id: "mobile", label: "Mobile" },
  { id: "fullstack", label: "Fullstack" },
];

export default function PracticeTrackPage() {
  const params = useParams();
  const router = useRouter();

  const track = (params?.track as string) || "frontend";

  const [documentData, setDocumentData] = useState<DailyPracticeDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [resolvedDate, setResolvedDate] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchDailyPractice(track)
      .then((res) => {
        if (cancelled) return;
        if (res.status === "success") {
          setDocumentData(res.data);
          setIsFallback(res.isFallback);
          setResolvedDate(res.resolvedDate);
        } else {
          setError(res.error);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[PracticePage] Failed to fetch:", err);
        setError("Unable to load daily practice questions.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [track]);

  if (loading) {
    return (
      <main className="min-h-screen bg-charcoal-950 text-charcoal-200 p-6 flex flex-col items-center justify-center gap-6">
        <div className="flex flex-col items-center gap-3">
          <Skeleton variant="badge" className="w-48 h-6" />
          <Skeleton variant="text" className="w-64 h-4" />
        </div>
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="w-full h-36 rounded-2xl" />
          <Skeleton className="w-full h-36 rounded-2xl" />
        </div>
      </main>
    );
  }

  if (error || !documentData) {
    return (
      <main className="min-h-screen bg-charcoal-950 text-charcoal-200 p-8 flex flex-col items-center justify-center text-center">
        <div className="max-w-md p-8 rounded-2xl bg-charcoal-900 border border-hairline space-y-4">
          <div className="text-3xl">⚠️</div>
          <h1 className="text-xl font-bold text-white">Daily Practice Unavailable</h1>
          <p className="text-sm text-charcoal-400">
            {error || "Daily questions for this track are currently being generated."}
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <Link
              href={`/roadmap/${track}`}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-accent-500 hover:bg-accent-600 text-charcoal-950 transition-colors"
            >
              View {track} Roadmap
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-charcoal-950 text-charcoal-200 selection:bg-accent-500 selection:text-charcoal-950 flex flex-col">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 border-b border-hairline bg-charcoal-900/90 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-xs font-semibold text-charcoal-400 hover:text-white transition-colors"
            >
              <span>←</span>
              <span className="hidden sm:inline">Workspace</span>
            </Link>
            <div className="h-4 w-[1px] bg-charcoal-700 hidden sm:block" />
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-white tracking-tight capitalize">
                {track} Daily Practice
              </h1>
              <span className="text-xs font-mono text-charcoal-400 hidden sm:inline">
                · {formatDisplayDate(resolvedDate)}
              </span>
            </div>
          </div>

          <Link
            href={`/roadmap/${track}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-charcoal-300 hover:text-white border border-hairline hover:bg-charcoal-800 transition-colors"
          >
            <span>Roadmap Tree</span>
            <span>↗</span>
          </Link>
        </div>
      </header>

      {/* Track Selector Bar */}
      <section className="border-b border-hairline bg-charcoal-900/40 py-3 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-charcoal-900 border border-hairline p-1 rounded-xl">
            {TRACK_LIST.map((t) => {
              const isActive = track.toLowerCase() === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => router.push(`/practice/${t.id}`)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-charcoal-800 text-white font-semibold border border-hairline shadow-xs"
                      : "text-charcoal-400 hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {isFallback && (
            <span className="text-xs font-mono text-amber-400/90 bg-amber-950/40 border border-amber-900/60 px-2.5 py-1 rounded-lg">
              Showing prior day questions (latest available)
            </span>
          )}
        </div>
      </section>

      {/* Main Content Area */}
      <div className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 py-8">
        <DailyPracticeList documentData={documentData} />
      </div>
    </main>
  );
}

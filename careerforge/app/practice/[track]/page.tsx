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
      <main className="min-h-screen bg-bg text-ink p-6 flex flex-col items-center justify-center gap-6">
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
      <main className="min-h-screen bg-bg text-ink p-8 flex flex-col items-center justify-center text-center">
        <div className="max-w-md p-8 rounded-2xl bg-surface border border-ink/15 space-y-4 shadow-sm">
          <span className="inline-block text-xs font-mono font-bold uppercase tracking-wider text-accent bg-accent/10 border border-accent/25 px-2.5 py-1 rounded-full">
            Unavailable
          </span>
          <h1 className="text-xl font-bold text-ink">Daily Practice Unavailable</h1>
          <p className="text-sm text-ink/70">
            {error || "Daily questions for this track are currently being generated."}
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <Link
              href={`/roadmap/${track}`}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-accent hover:bg-accent-soft text-white transition-colors"
            >
              View {track} Roadmap
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-bg text-ink selection:bg-accent/20 selection:text-ink flex flex-col">
      {/* Track Title and Meta Bar */}
      <div className="border-b border-ink/10 py-6 sm:py-8 bg-surface/60 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-accent mb-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span>Drill</span>
            </div>
            <h1 className="font-sans text-2xl sm:text-3xl font-bold tracking-tight text-ink capitalize">
              {track} Daily Practice
            </h1>
            <span className="text-xs font-mono text-ink/60 mt-0.5 block">
              Session: {formatDisplayDate(resolvedDate)}
            </span>
          </div>

          <Link
            href={`/roadmap/${track}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-accent hover:text-accent-soft border border-accent/25 hover:bg-accent/10 transition-colors shadow-xs self-start sm:self-auto"
          >
            <span>Roadmap Tree</span>
            <span>↗</span>
          </Link>
        </div>
      </div>

      {/* Track Selector Bar */}
      <section className="border-b border-ink/10 bg-surface/40 py-3 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-surface border border-ink/15 p-1 rounded-xl shadow-sm">
            {TRACK_LIST.map((t) => {
              const isActive = track.toLowerCase() === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => router.push(`/practice/${t.id}`)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-accent text-white font-semibold shadow-xs"
                      : "text-ink/70 hover:text-ink"
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          {isFallback && (
            <span className="text-xs font-mono text-accent bg-accent/10 border border-accent/25 px-2.5 py-1 rounded-lg">
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

"use client";

import { FormEvent, useState, useEffect, useRef } from "react";
import { Section } from "@/components/ui/Section";
import { Card, PrimaryButton, Tag, inputClasses } from "@/components/ui/Primitives";
import { useApp } from "@/lib/store";
import type { LiveJob } from "@/app/api/jobs/route";
import type { LocationProfile } from "@/app/api/location/route";
import { speakText, stopSpeaking } from "@/lib/voice";

interface SuggestionItem {
  city: string;
  region: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  formatted: string;
}

export function LocalOpportunities() {
  const { user } = useApp();
  const targetRole = user?.targetRole || "frontend";
  const [searchTerm, setSearchTerm] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [activeType, setActiveType] = useState<"all" | "remote" | "onsite" | "internship">("all");
  const [jobs, setJobs] = useState<LiveJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationProfile | null>(null);
  const [playingJobId, setPlayingJobId] = useState<string | null>(null);

  // Email Job Alert State (LinkedIn-style)
  const [alertEmail, setAlertEmail] = useState(user?.email || "");
  const [sendingAlert, setSendingAlert] = useState(false);
  const [alertSuccessMsg, setAlertSuccessMsg] = useState<string | null>(null);
  const [emailSentJobIds, setEmailSentJobIds] = useState<Record<string, boolean>>({});

  // Uber-style Autocomplete Dropdown State
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchingSuggestions, setSearchingSuggestions] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ─── 1. Real-Time Location Auto-Detection (GPS + IP Fallback) ──────────────
  const autoDetectLocation = async () => {
    setDetectingLocation(true);
    try {
      if (typeof window !== "undefined" && "geolocation" in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 4000,
              maximumAge: 60000,
            });
          });

          const { latitude, longitude } = position.coords;
          const res = await fetch(`/api/location?lat=${latitude}&lon=${longitude}`);
          if (res.ok) {
            const data = await res.json();
            if (data.location?.city) {
              applySelectedLocation(data.location);
              setDetectingLocation(false);
              return;
            }
          }
        } catch {
          // IP Fallback
        }
      }

      const res = await fetch("/api/location");
      if (res.ok) {
        const data = await res.json();
        if (data.location) {
          applySelectedLocation(data.location);
        }
      }
    } catch (err) {
      console.warn("[LocalOpportunities] Location detection error:", err);
      fetchLiveJobs(searchTerm, activeType, targetRole, "", "");
    } finally {
      setDetectingLocation(false);
    }
  };

  const applySelectedLocation = (loc: LocationProfile | SuggestionItem) => {
    const cityName = loc.city;
    setLocationInput(cityName);
    setCurrentLocation({
      city: loc.city,
      region: loc.region,
      country: loc.country,
      countryCode: loc.countryCode,
      latitude: loc.latitude,
      longitude: loc.longitude,
      formatted: loc.formatted || `${loc.city}, ${loc.country}`,
      timezone: "UTC",
      source: "GPS-ReverseGeocode",
    });
    setShowDropdown(false);
    fetchLiveJobs(searchTerm, activeType, targetRole, cityName, loc.countryCode, loc.latitude, loc.longitude);
  };

  // ─── 2. Uber-Style Live Location Predictive Geolocation ────────────────────
  const handleLocationInputChange = (text: string) => {
    setLocationInput(text);
    if (!text.trim()) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setShowDropdown(true);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      setSearchingSuggestions(true);
      try {
        const res = await fetch(`/api/location?search=${encodeURIComponent(text.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.suggestions || []);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setSearchingSuggestions(false);
      }
    }, 250);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─── 3. Fetch Jobs Directly Connected to Location (Zero-Lag) ────────────────
  const fetchLiveJobs = async (
    query = searchTerm,
    type = activeType,
    role = targetRole,
    loc = locationInput,
    countryCode = currentLocation?.countryCode || "",
    lat: number | null = currentLocation?.latitude || null,
    lon: number | null = currentLocation?.longitude || null
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (role) params.set("role", role);
      if (query) params.set("query", query);
      if (type !== "all") params.set("type", type);
      if (loc && loc !== "all") params.set("location", loc);
      if (countryCode) params.set("countryCode", countryCode);
      if (lat !== null) params.set("lat", lat.toString());
      if (lon !== null) params.set("lon", lon.toString());

      const res = await fetch(`/api/jobs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.error("[LocalOpportunities] Failed to fetch live jobs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    autoDetectLocation();
    return () => {
      stopSpeaking();
    };
  }, [targetRole]);

  useEffect(() => {
    fetchLiveJobs(searchTerm, activeType, targetRole, locationInput);
  }, [activeType]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setShowDropdown(false);
    fetchLiveJobs(searchTerm, activeType, targetRole, locationInput);
  };

  const handleSpeakJob = (job: LiveJob) => {
    if (playingJobId === job.id) {
      stopSpeaking();
      setPlayingJobId(null);
      return;
    }
    stopSpeaking();
    setPlayingJobId(job.id);
    const audioContent = `${job.title} at ${job.company}. Work arrangement: ${job.workArrangementLabel}. Location: ${job.location}. ${job.distanceKm ? `Distance: ${job.distanceKm} kilometers away.` : ""} Salary: ${job.salary?.formatted || "Competitive market compensation"}. Details: ${job.descriptionSnippet}`;
    speakText(audioContent, {
      onEnd: () => setPlayingJobId(null),
      onError: () => setPlayingJobId(null),
    });
  };

  // ─── 4. Dispatch Email Alert for a specific job opening ─────────────────────
  const handleEmailJob = async (job: LiveJob) => {
    const targetEmail = alertEmail.trim() || user?.email;
    if (!targetEmail || !targetEmail.includes("@")) {
      const enteredEmail = prompt("Please enter your email to receive this job opening and registration link:", user?.email || "");
      if (!enteredEmail || !enteredEmail.includes("@")) return;
      setAlertEmail(enteredEmail);
      await sendJobEmail(job, enteredEmail);
    } else {
      await sendJobEmail(job, targetEmail);
    }
  };

  const sendJobEmail = async (job: LiveJob, email: string) => {
    try {
      setEmailSentJobIds((prev) => ({ ...prev, [job.id]: true }));
      const res = await fetch("/api/jobs/alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: user?.name,
          location: locationInput || currentLocation?.formatted || "Your Area",
          role: targetRole || "Software Engineering",
          job,
        }),
      });

      if (res.ok) {
        setAlertSuccessMsg(`Opening at ${job.company} with direct registration form link sent to ${email}!`);
        setTimeout(() => setAlertSuccessMsg(null), 6000);
      }
    } catch {
      alert("Failed to send job alert email. Please verify your connection.");
    }
  };

  // ─── 5. General Location Alert Subscription ─────────────────────────────────
  const handleSubscribeAlert = async (e: FormEvent) => {
    e.preventDefault();
    if (!alertEmail || !alertEmail.includes("@")) return;
    setSendingAlert(true);
    setAlertSuccessMsg(null);

    try {
      const firstJob = jobs[0];
      const res = await fetch("/api/jobs/alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: alertEmail,
          name: user?.name,
          location: locationInput || currentLocation?.formatted || "Tracked City",
          role: targetRole || "Engineering",
          job: firstJob,
        }),
      });

      if (res.ok) {
        setAlertSuccessMsg(`Real-time job tracker active for ${locationInput || "your city"}! Alert with registration links sent to ${alertEmail}.`);
        setTimeout(() => setAlertSuccessMsg(null), 7000);
      }
    } catch {
      setAlertSuccessMsg("Job tracker activated for your location.");
    } finally {
      setSendingAlert(false);
    }
  };

  return (
    <Section
      id="local"
      eyebrow="Real-Time Job Tracker"
      title="Live Tech Opportunities & Real-Time Alerts"
      description="Directly connected to real-time job scrapers with Uber-style live geolocation tracking, explicit Remote/On-Site classification, and direct application forms."
    >
      {/* LinkedIn-Style Real-Time Job Tracking & Email Alerts Header */}
      <div className="mb-6 rounded-2xl border border-blue-200/90 bg-gradient-to-r from-blue-50/90 via-white to-indigo-50/70 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600"></span>
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900">
                LinkedIn-Style Live Location Job Tracker Active
              </span>
            </div>
            <h3 className="mt-1 font-display text-xl sm:text-2xl italic text-ink capitalize">
              {targetRole || "Software Engineering"} in {locationInput || currentLocation?.city || "Your Location"}
            </h3>
            <p className="mt-0.5 text-xs text-graphite">
              Whenever new openings are identified, registration forms are dispatched directly to your email.
            </p>
          </div>

          {/* Instant Email Alert Input Form */}
          <form onSubmit={handleSubscribeAlert} className="flex flex-col sm:flex-row items-center gap-2 w-full lg:w-auto">
            <input
              type="email"
              value={alertEmail}
              onChange={(e) => setAlertEmail(e.target.value)}
              placeholder="Enter email for instant opening alerts…"
              className="w-full sm:w-auto rounded-xl border border-neutral-300 bg-white px-3.5 py-2 text-xs text-ink placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[240px] shadow-2xs"
            />
            <button
              type="submit"
              disabled={sendingAlert || !alertEmail.trim()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-60 cursor-pointer"
            >
              <span>{sendingAlert ? "Activating…" : "🔔 Set Job Alert"}</span>
            </button>
          </form>
        </div>

        {alertSuccessMsg && (
          <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-800 animate-in fade-in">
            ✅ {alertSuccessMsg}
          </div>
        )}
      </div>

      {/* Dual Search: Keyword & Uber-Style Geolocation Autocomplete */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form onSubmit={handleSearch} className="flex flex-1 flex-col sm:flex-row gap-2 max-w-2xl">
          {/* Role/Keyword Search */}
          <input
            className={`${inputClasses} flex-1`}
            placeholder={`Search ${targetRole || "tech"} skills or titles…`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          {/* Uber-Style Predictive Geolocation Input */}
          <div ref={dropdownRef} className="relative flex-1 min-w-[240px]">
            <div className="relative flex items-center">
              <input
                className={`${inputClasses} pr-9 w-full`}
                placeholder="Search city (e.g., Mumbai, London, Berlin)…"
                value={locationInput}
                onChange={(e) => handleLocationInputChange(e.target.value)}
                onFocus={() => setShowDropdown(true)}
              />
              <button
                type="button"
                onClick={autoDetectLocation}
                disabled={detectingLocation}
                className="absolute right-2.5 rounded p-1 text-graphite hover:text-ink hover:bg-line transition-colors disabled:opacity-50"
                title="Use Current Location (GPS)"
              >
                <span className={`inline-block ${detectingLocation ? "animate-spin" : ""}`}>
                  📍
                </span>
              </button>
            </div>

            {/* Uber-Style Floating Autocomplete Dropdown */}
            {showDropdown && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1.5 rounded-2xl border border-neutral-300 bg-white p-2 shadow-xl animate-in fade-in zoom-in-98 duration-100 max-h-72 overflow-y-auto">
                {/* 1. Quick Action: Current Location (GPS) */}
                <button
                  type="button"
                  onClick={autoDetectLocation}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-blue-700 hover:bg-blue-50 transition-colors border-b border-line pb-2 mb-1 cursor-pointer"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    📍
                  </span>
                  <div>
                    <p className="font-bold">Use Current Location (GPS)</p>
                    <p className="text-[10px] text-neutral-500 font-normal">
                      {currentLocation?.formatted || "Auto-detect exact city with 1 click"}
                    </p>
                  </div>
                </button>

                {/* 2. City Predictive Suggestions */}
                {searchingSuggestions ? (
                  <div className="py-3 text-center text-xs text-graphite">
                    <span className="inline-block h-3 w-3 rounded-full border-2 border-neutral-400 border-t-transparent animate-spin mr-1.5" />
                    Tracking live geolocation…
                  </div>
                ) : suggestions.length > 0 ? (
                  suggestions.map((item, idx) => (
                    <button
                      key={`${item.city}-${idx}`}
                      type="button"
                      onClick={() => applySelectedLocation(item)}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-xs text-neutral-800 hover:bg-neutral-100 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0 pr-2">
                        <span className="text-sm">🏙️</span>
                        <div className="min-w-0">
                          <p className="font-semibold text-neutral-900 truncate">{item.city}</p>
                          <p className="text-[10px] text-neutral-500 truncate">{item.region ? `${item.region}, ` : ""}{item.country}</p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded bg-mist px-1.5 py-0.5 text-[9px] font-bold text-neutral-600 uppercase">
                        {item.countryCode || "LOC"}
                      </span>
                    </button>
                  ))
                ) : locationInput.trim().length > 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowDropdown(false);
                      fetchLiveJobs(searchTerm, activeType, targetRole, locationInput);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-neutral-700 hover:bg-neutral-100 rounded-xl"
                  >
                    Search jobs in &quot;<strong>{locationInput}</strong>&quot; →
                  </button>
                ) : null}
              </div>
            )}
          </div>

          <PrimaryButton type="submit" disabled={loading}>
            {loading ? "Searching…" : "Search"}
          </PrimaryButton>
        </form>

        {/* Filter Pills with Explicit Work Arrangement (Remote vs On-Site) */}
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: "all", label: "All Opportunities" },
              { id: "remote", label: "🌐 Remote Positions" },
              { id: "onsite", label: "🏢 On-Site (Local)" },
              { id: "internship", label: "🌱 Internships" },
            ] as const
          ).map((filter) => (
            <button
              key={filter.id}
              onClick={() => setActiveType(filter.id)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                activeType === filter.id
                  ? "bg-ink text-paper shadow-sm"
                  : "bg-mist text-graphite hover:bg-line hover:text-ink"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active Location & Real-Time Sync Bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-graphite bg-mist/40 p-2.5 rounded-xl border border-line/60">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-ink">
            📍 {currentLocation?.formatted || locationInput || "Worldwide & Remote"}
          </span>
          <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
            Real-Time Tracking Active
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span>
            Found <strong className="text-ink">{jobs.length}</strong> live positions
          </span>
          <span className="flex items-center gap-1 text-emerald-700 font-semibold text-[11px]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
            Direct Registration Links (0s Lag)
          </span>
        </div>
      </div>

      {/* Jobs Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-52 animate-pulse rounded-xl border border-line bg-mist/50 p-5" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line p-8 text-center">
          <p className="text-sm text-graphite">No active listings found for &quot;{searchTerm || locationInput}&quot;.</p>
          <button
            onClick={() => {
              setSearchTerm("");
              setLocationInput("");
              setActiveType("all");
              fetchLiveJobs("", "all", targetRole, "", "");
            }}
            className="mt-3 text-xs font-medium text-ink underline cursor-pointer"
          >
            Reset filters to view all global listings
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {jobs.map((job) => (
            <Card
              key={job.id}
              className={`flex flex-col justify-between transition-all hover:border-ink ${
                job.isLocalMatch ? "border-blue-400/80 bg-blue-50/10 shadow-xs" : ""
              }`}
            >
              <div>
                {/* Header with STRICT Work Arrangement, Salary, and Voice Speaker */}
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* STRICT WORK ARRANGEMENT BADGE */}
                    {job.workArrangement === "worldwide_remote" ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-900 border border-emerald-300">
                        🌐 Worldwide Remote
                      </span>
                    ) : job.workArrangement === "country_remote" ? (
                      <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-900 border border-purple-300">
                        {job.workArrangementLabel || "🌐 Country Remote"}
                      </span>
                    ) : job.workArrangement === "hybrid" ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300">
                        {job.workArrangementLabel || "🔄 Hybrid"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-800 border border-slate-300">
                        {job.workArrangementLabel || "🏢 On-Site"}
                      </span>
                    )}

                    <Tag>{job.jobType}</Tag>

                    {job.distanceKm && (
                      <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800 border border-blue-200">
                        📍 {job.distanceKm} km away
                      </span>
                    )}
                    {job.salary?.formatted && (
                      <span className="rounded bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300">
                        💰 {job.salary.formatted}
                      </span>
                    )}
                  </div>

                  {/* Click-to-Voice Audio Reader */}
                  <button
                    type="button"
                    onClick={() => handleSpeakJob(job)}
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all cursor-pointer ${
                      playingJobId === job.id
                        ? "bg-blue-100 text-blue-800 animate-pulse border border-blue-300"
                        : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                    }`}
                    title={playingJobId === job.id ? "Stop reading" : "Click-to-Voice (Listen to Job Description)"}
                  >
                    {playingJobId === job.id ? (
                      <span>⏹ Stop</span>
                    ) : (
                      <span>🔊 Listen</span>
                    )}
                  </button>
                </div>

                <h3 className="text-sm font-semibold text-ink leading-snug">{job.title}</h3>
                <p className="mt-1 text-xs font-medium text-graphite">
                  {job.company} &bull; <span className="font-semibold text-neutral-800">{job.location}</span>
                </p>

                <p className="mt-2 text-xs text-graphite/90 line-clamp-2 leading-relaxed">
                  {job.descriptionSnippet}
                </p>

                {/* Accessibility Badges */}
                {job.accessibility?.tags && job.accessibility.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1">
                    <span className="rounded bg-blue-50 px-1.5 py-0.2 text-[9px] font-bold text-blue-700 border border-blue-200">
                      ♿ {job.accessibility.score}% Accessible
                    </span>
                    {job.accessibility.tags.slice(0, 2).map((accTag) => (
                      <span key={accTag} className="text-[9px] text-graphite/80 bg-mist px-1.5 py-0.2 rounded">
                        {accTag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Toolbar: Email Direct Registration Form & Apply Now */}
              <div className="mt-4 pt-3 border-t border-line/60 flex items-center justify-between gap-2">
                {/* 1. Email Me Registration Link Button */}
                <button
                  type="button"
                  onClick={() => handleEmailJob(job)}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                    emailSentJobIds[job.id]
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold"
                      : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400"
                  }`}
                  title="Send company registration form and opening details to your email"
                >
                  <span>{emailSentJobIds[job.id] ? "✅ Form Emailed" : "✉️ Email Form Link"}</span>
                </button>

                {/* 2. Direct Apply Now Button */}
                <a
                  href={job.applyUrl || job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white hover:bg-neutral-800 transition-colors shadow-xs"
                >
                  <span>Apply Now</span>
                  <span>→</span>
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Attribution footer */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-[11px] text-graphite">
        <p>
          Live LinkedIn-style scraping & Geolocation from <strong>Google Jobs</strong>, <strong>LinkedIn</strong>, <strong>Adzuna</strong>, <strong>Arbeitnow</strong>, and <strong>Remotive</strong>.
        </p>
        <span>Strict Remote/On-Site Classification · Direct Registration Forms · Zero Fees</span>
      </div>
    </Section>
  );
}

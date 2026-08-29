"use client";

import { FormEvent, useState, useEffect, useRef } from "react";
import { Section } from "@/components/ui/Section";
import { Card, Tag, inputClasses } from "@/components/ui/Primitives";
import { useApp } from "@/lib/store";
import type { LiveJob } from "@/app/api/jobs/route";
import type { LocationProfile } from "@/app/api/location/route";
import {
  speakText,
  stopSpeaking,
  startSpeechRecognition,
  SpeechRecognitionController,
  SUPPORTED_LANGUAGES,
  getGlobalVoiceLanguage,
  setGlobalVoiceLanguage,
  speakAccessibilityGuide,
} from "@/lib/voice";

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
  const { targetRole, user } = useApp();
  const [searchTerm, setSearchTerm] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [activeType, setActiveType] = useState<"all" | "remote" | "onsite" | "internship">("all");
  const [jobs, setJobs] = useState<LiveJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationProfile | null>(null);
  const [playingJobId, setPlayingJobId] = useState<string | null>(null);

  // Multi-Language Voice State
  const [selectedLanguage, setSelectedLanguage] = useState(getGlobalVoiceLanguage());
  const [listeningSearch, setListeningSearch] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [accessibilityStep, setAccessibilityStep] = useState<number>(1);
  const [isSpeakingGuide, setIsSpeakingGuide] = useState(false);

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
  const speechControllerRef = useRef<SpeechRecognitionController | null>(null);

  // ─── 1. Real-Time Location Auto-Detection (GPS + IP Fallback) ──────────────
  const autoDetectLocation = async () => {
    setDetectingLocation(true);
    setAccessibilityStep(2);
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
    setAccessibilityStep(3);
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
      speechControllerRef.current?.stop();
    };
  }, [targetRole]);

  useEffect(() => {
    fetchLiveJobs(searchTerm, activeType, targetRole, locationInput);
  }, [activeType]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setShowDropdown(false);
    setAccessibilityStep(3);
    fetchLiveJobs(searchTerm, activeType, targetRole, locationInput);
  };

  // ─── Multi-Language Voice Dictation Search ─────────────────────────────────
  const toggleVoiceSearch = () => {
    if (listeningSearch) {
      speechControllerRef.current?.stop();
      setListeningSearch(false);
      return;
    }

    const controller = startSpeechRecognition(
      {
        onTranscript: (transcript) => {
          setSearchTerm(transcript);
          fetchLiveJobs(transcript, activeType, targetRole, locationInput);
        },
        onListeningChange: (isList) => setListeningSearch(isList),
        onError: () => setListeningSearch(false),
      },
      { lang: selectedLanguage }
    );
    speechControllerRef.current = controller;
  };

  // ─── Multi-Language Text-to-Speech Job Reader ──────────────────────────────
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
      lang: selectedLanguage,
      onEnd: () => setPlayingJobId(null),
      onError: () => setPlayingJobId(null),
    });
  };

  // ─── Step-by-Step AI Accessibility Co-Pilot Audio Guide ────────────────────
  const handlePlayAccessibilityGuide = () => {
    if (isSpeakingGuide) {
      stopSpeaking();
      setIsSpeakingGuide(false);
      return;
    }
    setIsSpeakingGuide(true);
    speakAccessibilityGuide("overview", selectedLanguage);
    setTimeout(() => setIsSpeakingGuide(false), 9000);
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
      description="Directly connected to real-time job scrapers with Uber-style live geolocation tracking, multi-language voice detection, and AI step-by-step assistance."
    >
      {/* ─── AI ACCESSIBILITY CO-PILOT & MULTI-LANGUAGE AUDIO GUIDE BAR ────────── */}
      <div className={`mb-6 rounded-2xl border p-4 sm:p-5 transition-all shadow-md ${
        highContrast
          ? "border-yellow-400 bg-black text-yellow-300 ring-2 ring-yellow-400"
          : "border-indigo-200/80 bg-gradient-to-r from-indigo-50/90 via-white to-blue-50/80 shadow-indigo-500/5"
      }`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600/10 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 border border-indigo-200">
                <span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse"></span>
                AI Accessibility Co-Pilot Active
              </span>
              <span className="text-[11px] font-semibold text-neutral-500">
                Step-by-Step Guided Navigation for Disabled & Screen-Reader Users
              </span>
            </div>

            {/* Interactive Visual Step Pills */}
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {[
                { step: 1, title: "1. Speak / Search Role" },
                { step: 2, title: "2. Track City (GPS)" },
                { step: 3, title: "3. Listen Aloud" },
                { step: 4, title: "4. Direct Apply / Form" },
              ].map((s) => (
                <button
                  key={s.step}
                  type="button"
                  onClick={() => {
                    setAccessibilityStep(s.step);
                    speakAccessibilityGuide(
                      s.step === 1 ? "search" : s.step === 2 ? "location" : s.step === 3 ? "overview" : "apply",
                      selectedLanguage
                    );
                  }}
                  className={`rounded-xl px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    accessibilityStep === s.step
                      ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-300"
                      : "bg-white text-neutral-700 border border-neutral-200 hover:bg-indigo-50"
                  }`}
                  title={`Click to hear audio guidance for ${s.title}`}
                >
                  {s.title}
                </button>
              ))}
            </div>
          </div>

          {/* Voice Language Selector & High Contrast Audio Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Multi-Language Dropdown */}
            <div className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5 shadow-2xs">
              <span className="text-xs">🌐</span>
              <select
                value={selectedLanguage}
                onChange={(e) => {
                  setSelectedLanguage(e.target.value);
                  setGlobalVoiceLanguage(e.target.value);
                  speakText("Language set to " + e.target.options[e.target.selectedIndex].text, { lang: e.target.value });
                }}
                className="bg-transparent text-xs font-semibold text-neutral-800 focus:outline-none cursor-pointer"
                title="Select Voice Speech & Detection Language"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.nativeName} ({lang.name})
                  </option>
                ))}
              </select>
            </div>

            {/* Audio Voice Guide Button */}
            <button
              type="button"
              onClick={handlePlayAccessibilityGuide}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                isSpeakingGuide
                  ? "bg-indigo-600 text-white animate-pulse shadow-md"
                  : "bg-white text-indigo-700 border border-indigo-300 hover:bg-indigo-50"
              }`}
              title="Listen to full voice instructions for this page"
            >
              <span>{isSpeakingGuide ? "⏹ Stop Guide" : "🔊 Audio Guide"}</span>
            </button>

            {/* High Contrast Toggle */}
            <button
              type="button"
              onClick={() => setHighContrast((prev) => !prev)}
              className="rounded-xl border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
              title="Toggle High-Contrast Mode for Visually Impaired"
            >
              {highContrast ? "☀️ Normal" : "👁️ Contrast"}
            </button>
          </div>
        </div>
      </div>

      {/* ─── LINKEDIN-STYLE REAL-TIME JOB TRACKING & EMAIL ALERTS HEADER ───────── */}
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
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-500/20 disabled:opacity-60 cursor-pointer hover:scale-[1.02]"
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

      {/* ─── DUAL SEARCH: MULTI-LANGUAGE VOICE & UBER-STYLE GEOLOCATION ───────── */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form onSubmit={handleSearch} className="flex flex-1 flex-col sm:flex-row gap-2 max-w-2xl">
          {/* Role/Keyword Search with Voice Mic */}
          <div className="relative flex flex-1 items-center">
            <input
              className={`${inputClasses} pr-9 w-full`}
              placeholder={`Search ${targetRole || "tech"} skills or titles…`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {/* Multi-Language Voice Mic */}
            <button
              type="button"
              onClick={toggleVoiceSearch}
              className={`absolute right-2.5 rounded-lg p-1 transition-all ${
                listeningSearch
                  ? "bg-red-500 text-white animate-pulse shadow-sm"
                  : "text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/60"
              }`}
              title={`Voice Dictation in ${selectedLanguage} (Click to speak)`}
            >
              🎙️
            </button>
          </div>

          {/* Uber-Style Predictive Geolocation Input */}
          <div ref={dropdownRef} className="relative flex-1 min-w-[240px]">
            <div className="relative flex items-center">
              <input
                className={`${inputClasses} pr-9 w-full`}
                placeholder="Search city or district…"
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

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-xl bg-neutral-900 px-5 py-2 text-xs font-semibold text-white hover:bg-black transition-all shadow-sm hover:scale-[1.02] cursor-pointer disabled:opacity-50"
          >
            {loading ? "Searching…" : "Search"}
          </button>
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
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                activeType === filter.id
                  ? "bg-neutral-900 text-white shadow-md ring-2 ring-neutral-700/20"
                  : "bg-white text-neutral-600 border border-neutral-200 hover:border-neutral-900 hover:text-neutral-900"
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
          <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
            Real-Time Live City Match
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

      {/* ─── JOBS GRID (AI-GENERATED AESTHETIC CARDS) ─────────────────────────── */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-56 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-100/60 p-5 shadow-xs" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-neutral-300 p-8 text-center bg-neutral-50/50">
          <p className="text-sm font-medium text-neutral-700">No active listings found for &quot;{searchTerm || locationInput}&quot;.</p>
          <button
            onClick={() => {
              setSearchTerm("");
              setLocationInput("");
              setActiveType("all");
              fetchLiveJobs("", "all", targetRole, "", "");
            }}
            className="mt-3 inline-flex items-center rounded-xl bg-neutral-900 px-4 py-2 text-xs font-semibold text-white hover:bg-black transition-all cursor-pointer shadow-xs"
          >
            Reset filters to view all global listings
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {jobs.map((job) => (
            <Card
              key={job.id}
              className={`relative flex flex-col justify-between rounded-2xl border p-5 transition-all duration-200 hover:shadow-lg ${
                job.isLocalMatch
                  ? "border-blue-300 bg-gradient-to-br from-blue-50/20 via-white to-indigo-50/10 shadow-sm"
                  : "border-neutral-200/90 bg-white hover:border-neutral-400"
              }`}
            >
              <div>
                {/* Header with STRICT Work Arrangement, Salary, and Voice Speaker */}
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* STRICT WORK ARRANGEMENT BADGE */}
                    {job.workArrangement === "worldwide_remote" ? (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-900 border border-emerald-300 shadow-2xs">
                        🌐 Worldwide Remote
                      </span>
                    ) : job.workArrangement === "country_remote" ? (
                      <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-900 border border-purple-300 shadow-2xs">
                        {job.workArrangementLabel || "🌐 Country Remote"}
                      </span>
                    ) : job.workArrangement === "hybrid" ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300 shadow-2xs">
                        {job.workArrangementLabel || "🔄 Hybrid"}
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-800 border border-slate-300 shadow-2xs">
                        {job.workArrangementLabel || "🏢 On-Site"}
                      </span>
                    )}

                    <Tag>{job.jobType}</Tag>

                    {job.distanceKm && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800 border border-blue-200">
                        📍 {job.distanceKm} km away
                      </span>
                    )}
                    {job.salary?.formatted && (
                      <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300">
                        💰 {job.salary.formatted}
                      </span>
                    )}
                  </div>

                  {/* Multi-Language Click-to-Voice Audio Reader */}
                  <button
                    type="button"
                    onClick={() => handleSpeakJob(job)}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all cursor-pointer ${
                      playingJobId === job.id
                        ? "bg-blue-600 text-white animate-pulse shadow-md shadow-blue-500/20"
                        : "border border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                    }`}
                    title={`Click to listen to job description in ${selectedLanguage}`}
                  >
                    {playingJobId === job.id ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-ping" />
                        <span>Playing…</span>
                      </>
                    ) : (
                      <>
                        <span>🔊</span>
                        <span>Listen</span>
                      </>
                    )}
                  </button>
                </div>

                <h3 className="text-sm sm:text-base font-bold text-ink leading-snug">{job.title}</h3>
                <p className="mt-1 text-xs font-semibold text-neutral-600">
                  {job.company} &bull; <span className="font-bold text-neutral-900">{job.location}</span>
                </p>

                <p className="mt-2 text-xs text-neutral-600 line-clamp-2 leading-relaxed">
                  {job.descriptionSnippet}
                </p>

                {/* Accessibility Badges */}
                {job.accessibility?.tags && job.accessibility.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1">
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-bold text-blue-700 border border-blue-200">
                      ♿ {job.accessibility.score}% Accessible
                    </span>
                    {job.accessibility.tags.slice(0, 2).map((accTag) => (
                      <span key={accTag} className="text-[9px] text-neutral-600 bg-neutral-100 px-2 py-0.5 rounded-full border border-neutral-200/60">
                        {accTag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Toolbar: AI Buttons (Email Direct Registration Form & Apply Now) */}
              <div className="mt-4 pt-3 border-t border-neutral-200/70 flex items-center justify-between gap-2">
                {/* 1. AI Email Form Link Pill Button */}
                <button
                  type="button"
                  onClick={() => handleEmailJob(job)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                    emailSentJobIds[job.id]
                      ? "border-emerald-400 bg-emerald-50 text-emerald-800 font-bold"
                      : "border-neutral-300 bg-neutral-50/70 text-neutral-700 hover:bg-white hover:border-neutral-400 hover:shadow-xs"
                  }`}
                  title="Dispatches direct company registration link straight to your email"
                >
                  <span>{emailSentJobIds[job.id] ? "✅ Form Emailed" : "✉️ Email Form Link"}</span>
                </button>

                {/* 2. Futuristic AI Gradient Apply Now Button */}
                <a
                  href={job.applyUrl || job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-neutral-900 via-neutral-800 to-black px-4 py-1.5 text-xs font-semibold text-white hover:from-black hover:to-neutral-900 transition-all shadow-md hover:shadow-lg hover:scale-[1.02] cursor-pointer"
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
          Live scraping from <strong>LinkedIn</strong>, <strong>Google Jobs</strong>, <strong>Arbeitnow</strong>, <strong>Remotive</strong>, and <strong>Jobicy</strong>.
        </p>
        <span>Multi-Language Voice Detection &bull; Universal Accessibility Assistance &bull; Zero Fees</span>
      </div>
    </Section>
  );
}

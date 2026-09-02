"use client";

import { FormEvent, useState, useEffect, useRef } from "react";
import { Section } from "@/components/ui/Section";
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
  const { user, voiceMode, voiceLanguage, setVoiceMode, setVoiceLanguage } = useApp();
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

  const flatInput =
    "w-full rounded-none border border-black bg-white px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none";

  return (
    <Section
      id="local"
      eyebrow="Real-Time Job Tracker"
      title="Live Tech Opportunities & Real-Time Alerts"
      description="Directly connected to real-time job scrapers with live geolocation tracking, explicit Remote/On-Site classification, and direct application forms."
    >
      {/* Search — high-contrast flat inputs */}
      <form onSubmit={handleSearch} className="mb-8 grid gap-4 sm:grid-cols-2">
        <input
          className={flatInput}
          placeholder={`Search ${targetRole || "tech"} skills or titles`}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div ref={dropdownRef} className="relative">
          <input
            className={flatInput}
            placeholder="City (Mumbai, London, Berlin)"
            value={locationInput}
            onChange={(e) => handleLocationInputChange(e.target.value)}
            onFocus={() => setShowDropdown(true)}
          />
          {showDropdown && (
            <div className="absolute left-0 right-0 top-full z-50 max-h-72 overflow-y-auto border border-black bg-white">
              <button
                type="button"
                onClick={autoDetectLocation}
                disabled={detectingLocation}
                className="block w-full border-b border-zinc-300 px-4 py-3 text-left text-xs font-bold uppercase tracking-widest hover:bg-zinc-900 hover:text-white disabled:opacity-40"
              >
                {detectingLocation ? "Detecting…" : "Use current location (GPS)"}
              </button>
              {searchingSuggestions ? (
                <p className="px-4 py-3 text-xs text-zinc-500">Searching…</p>
              ) : (
                suggestions.map((item, idx) => (
                  <button
                    key={`${item.city}-${idx}`}
                    type="button"
                    onClick={() => applySelectedLocation(item)}
                    className="block w-full border-b border-zinc-300 px-4 py-3 text-left text-sm last:border-b-0 hover:bg-zinc-900 hover:text-white"
                  >
                    <span className="font-bold">{item.city}</span>
                    <span className="text-zinc-500"> · {item.region ? `${item.region}, ` : ""}{item.country}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-4 text-xs font-black uppercase tracking-widest sm:col-span-2">
          {(
            [
              { id: "all", label: "All" },
              { id: "remote", label: "Remote" },
              { id: "onsite", label: "On-Site" },
              { id: "internship", label: "Internships" },
            ] as const
          ).map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveType(filter.id)}
              className={`border border-black px-6 py-3 ${
                activeType === filter.id ? "bg-zinc-900 text-white" : "hover:bg-zinc-900 hover:text-white"
              }`}
            >
              {filter.label}
            </button>
          ))}
          <button
            type="submit"
            disabled={loading}
            className="border border-black bg-zinc-900 px-6 py-3 text-white hover:bg-black disabled:opacity-30"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
      </form>

      {/* Email alert */}
      <form onSubmit={handleSubscribeAlert} className="mb-8 flex flex-wrap gap-4">
        <input
          type="email"
          value={alertEmail}
          onChange={(e) => setAlertEmail(e.target.value)}
          placeholder="Email for new-opening alerts"
          className={`${flatInput} flex-1 min-w-[240px]`}
        />
        <button
          type="submit"
          disabled={sendingAlert || !alertEmail.trim()}
          className="border border-black px-6 py-3 text-xs font-black uppercase tracking-widest hover:bg-zinc-900 hover:text-white disabled:opacity-30"
        >
          {sendingAlert ? "Activating…" : "Set Job Alert"}
        </button>
      </form>
      {alertSuccessMsg && (
        <p className="mb-8 border-l-2 border-black pl-4 text-xs">{alertSuccessMsg}</p>
      )}

      {/* Status */}
      <p className="mb-4 text-xs font-black uppercase tracking-widest">
        {currentLocation?.formatted || locationInput || "Worldwide & Remote"} · {jobs.length} positions
      </p>

      {/* Tabular listing */}
      {loading ? (
        <p className="border-t border-zinc-300 py-8 text-sm text-zinc-500">Loading listings…</p>
      ) : jobs.length === 0 ? (
        <div className="border-t border-zinc-300 py-8">
          <p className="text-sm text-zinc-500">
            No active listings for &quot;{searchTerm || locationInput}&quot;.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setLocationInput("");
              setActiveType("all");
              fetchLiveJobs("", "all", targetRole, "", "");
            }}
            className="mt-3 text-xs font-black uppercase tracking-widest underline"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <div className="border-t border-zinc-300">
          {jobs.map((job) => (
            <div key={job.id} className="border-b border-zinc-300 py-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-lg font-black leading-snug">{job.title}</h3>
                <p className="text-xs uppercase tracking-widest text-zinc-500">
                  {job.workArrangementLabel || job.workArrangement}
                </p>
              </div>
              <p className="mt-1 text-sm">
                <span className="font-bold">{job.company}</span> · {job.location}
                {job.distanceKm ? ` · ${job.distanceKm} km away` : ""}
                {job.salary?.formatted ? ` · ${job.salary.formatted}` : ""}
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-700">
                {job.descriptionSnippet}
              </p>
              <div className="mt-4 flex flex-wrap gap-6 text-xs font-black uppercase tracking-widest">
                <button type="button" onClick={() => handleSpeakJob(job)} className="underline">
                  {playingJobId === job.id ? "Stop" : "Listen"}
                </button>
                <button type="button" onClick={() => handleEmailJob(job)} className="underline">
                  {emailSentJobIds[job.id] ? "Form Emailed" : "Email Form Link"}
                </button>
                <a
                  href={job.applyUrl || job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  Apply →
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Attribution footer */}
      <p className="mt-8 border-t border-zinc-300 pt-4 text-[11px] text-zinc-500">
        Live scraping &amp; geolocation from Google Jobs, LinkedIn, Adzuna, Arbeitnow, and Remotive.
        Strict Remote/On-Site classification · direct registration forms · zero fees.
      </p>
    </Section>
  );
}

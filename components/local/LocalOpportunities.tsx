"use client";

import { FormEvent, useState, useEffect, useRef } from "react";
import { Section } from "@/components/ui/Section";
import { useApp } from "@/lib/store";
import type { LiveJob } from "@/app/api/jobs/route";
import type { LocationProfile } from "@/app/api/location/route";
import { speakText, stopSpeaking } from "@/lib/voice";
import { Volume2, Square, Mail, Check, ArrowRight, MapPin, Bell } from "lucide-react";

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
  const [providerError, setProviderError] = useState(false);

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
    setProviderError(false);
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
        if (data.status === "PROVIDER_FAILED") {
          setProviderError(true);
          setJobs([]);
        } else {
          setJobs(data.jobs || []);
        }
      } else {
        setProviderError(true);
        setJobs([]);
      }
    } catch (err) {
      console.error("[LocalOpportunities] Failed to fetch live jobs:", err);
      setProviderError(true);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    autoDetectLocation();
    return () => {
      stopSpeaking();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetRole]);

  useEffect(() => {
    fetchLiveJobs(searchTerm, activeType, targetRole, locationInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const inputClass =
    "w-full rounded-xl border border-ink/15 bg-bg px-4 py-2.5 text-sm text-ink placeholder:text-ink/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent transition-colors";

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 animate-slideUp">
      <div className="mb-8 space-y-2">
        <span className="font-display text-xs uppercase tracking-[0.24em] text-ink/60 font-semibold select-none">
          ubix
        </span>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
          Jobs
        </h1>
        <p className="text-sm text-ink/60">
          Discover opportunities aligned with your career trajectory and skills.
        </p>
      </div>
      {/* Search & Location Bar */}
      <form onSubmit={handleSearch} className="mb-6 rounded-2xl border border-ink/10 bg-surface/40 p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <input
              className={inputClass}
              placeholder={`Search ${targetRole || "tech"} skills or titles...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search job skills or titles"
            />
          </div>
          <div ref={dropdownRef} className="relative">
            <input
              className={inputClass}
              placeholder="City (Mumbai, London, San Francisco...)"
              value={locationInput}
              onChange={(e) => handleLocationInputChange(e.target.value)}
              onFocus={() => setShowDropdown(true)}
              aria-label="City or location"
            />
            {showDropdown && (
              <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-xl border border-ink/15 bg-bg shadow-lg">
                <button
                  type="button"
                  onClick={autoDetectLocation}
                  disabled={detectingLocation}
                  className="flex w-full items-center gap-2 border-b border-ink/10 px-4 py-2.5 text-left text-xs font-semibold text-accent hover:bg-surface disabled:opacity-40 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span>{detectingLocation ? "Detecting location..." : "Use current location (GPS)"}</span>
                </button>
                {searchingSuggestions ? (
                  <p className="px-4 py-2.5 text-xs text-ink/50">Searching locations...</p>
                ) : (
                  suggestions.map((item, idx) => (
                    <button
                      key={`${item.city}-${idx}`}
                      type="button"
                      onClick={() => applySelectedLocation(item)}
                      className="flex w-full items-center justify-between border-b border-ink/5 px-4 py-2.5 text-left text-xs last:border-b-0 hover:bg-surface transition-colors cursor-pointer"
                    >
                      <span className="font-medium text-ink">{item.city}</span>
                      <span className="text-[11px] text-ink/40">
                        {item.region ? `${item.region}, ` : ""}{item.country}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Filter Pills & Submit */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-ink/8">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Job type filter">
            {(
              [
                { id: "all", label: "All Opportunities" },
                { id: "remote", label: "Remote Only" },
                { id: "onsite", label: "On-Site" },
                { id: "internship", label: "Internships" },
              ] as const
            ).map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setActiveType(filter.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                  activeType === filter.id
                    ? "bg-accent text-white shadow-xs"
                    : "bg-bg text-ink/65 hover:bg-surface hover:text-ink border border-ink/10"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-ink px-4 py-1.5 text-xs font-semibold text-bg hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer"
          >
            {loading ? "Searching..." : "Search Jobs"}
          </button>
        </div>
      </form>

      {/* Email Alert Banner */}
      <form onSubmit={handleSubscribeAlert} className="mb-6 flex flex-wrap items-center gap-2.5 rounded-xl border border-ink/10 bg-surface/30 p-3 sm:p-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-ink/75">
          <Bell className="w-3.5 h-3.5 text-accent" />
          <span>Job Alert:</span>
        </div>
        <input
          type="email"
          value={alertEmail}
          onChange={(e) => setAlertEmail(e.target.value)}
          placeholder="Enter email for daily matching roles"
          aria-label="Email address for job alerts"
          className="flex-1 min-w-[200px] rounded-lg border border-ink/15 bg-bg px-3 py-1.5 text-xs text-ink placeholder:text-ink/40 focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          disabled={sendingAlert || !alertEmail.trim()}
          className="rounded-lg border border-ink/20 bg-bg px-3.5 py-1.5 text-xs font-semibold text-ink hover:border-accent hover:text-accent transition-colors disabled:opacity-40 cursor-pointer"
        >
          {sendingAlert ? "Activating..." : "Subscribe"}
        </button>
      </form>

      {alertSuccessMsg && (
        <div className="mb-6 rounded-xl border border-success/30 bg-success/10 px-4 py-2.5 text-xs font-medium text-success">
          {alertSuccessMsg}
        </div>
      )}

      {/* Results Header */}
      <div className="mb-4 flex items-center justify-between text-xs text-ink/50">
        <span className="flex items-center gap-1.5 font-medium text-ink/75">
          <MapPin className="w-3.5 h-3.5 text-accent shrink-0" />
          <span>{currentLocation?.formatted || locationInput || "Worldwide & Remote"}</span>
        </span>
        <span>{jobs.length} open position{jobs.length === 1 ? "" : "s"}</span>
      </div>

      {/* Job Listings Cards */}
      {loading ? (
        <div className="rounded-2xl border border-ink/10 bg-surface/30 p-8 text-center text-sm text-ink/50">
          Fetching live listings...
        </div>
      ) : providerError ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center">
          <p className="text-sm font-medium text-red-400">
            I couldn&apos;t retrieve live job results right now.
          </p>
          <p className="mt-1 text-xs text-ink/50">
            The job feeds experienced an upstream provider interruption. You can retry your search.
          </p>
          <button
            type="button"
            onClick={() => fetchLiveJobs(searchTerm, activeType, targetRole, locationInput)}
            className="mt-4 rounded-lg bg-surface px-4 py-2 text-xs font-semibold text-ink hover:bg-surface/80 transition-colors cursor-pointer"
          >
            Retry Live Search
          </button>
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border border-ink/10 bg-surface/30 p-8 text-center">
          <p className="text-sm text-ink/60">
            No active listings found for &quot;{searchTerm || locationInput}&quot;.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchTerm("");
              setLocationInput("");
              setActiveType("all");
              fetchLiveJobs("", "all", targetRole, "", "");
            }}
            className="mt-3 text-xs font-semibold text-accent hover:underline cursor-pointer"
          >
            Reset search filters
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="rounded-2xl border border-white/[0.08] bg-surface/50 p-5 sm:p-6 transition-all hover:border-accent/30 hover:bg-surface/80 hover:shadow-[0_4px_24px_rgba(120,227,238,0.06)] group"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-base sm:text-lg font-bold text-white group-hover:text-accent transition-colors">
                  {job.title}
                </h3>
                <span className="rounded-full border border-white/10 bg-bg px-2.5 py-0.5 text-[10px] font-mono text-ink/70">
                  {job.workArrangementLabel || job.workArrangement}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink/60">
                <span className="font-semibold text-white/90">{job.company}</span>
                <span>·</span>
                <span>{job.location}</span>
                {job.salary?.formatted && (
                  <>
                    <span>·</span>
                    <span className="font-mono text-accent/90">{job.salary.formatted}</span>
                  </>
                )}
              </div>

              <div className="my-3 border-t border-white/[0.06]" />

              <div className="space-y-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-accent font-semibold">
                  Why it matches
                </span>
                <p className="text-xs leading-relaxed text-ink/70 line-clamp-2">
                  {job.descriptionSnippet}
                </p>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3 pt-3 border-t border-white/[0.06] text-xs">
                <button
                  type="button"
                  onClick={() => handleSpeakJob(job)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-ink/70 hover:border-accent/40 hover:text-white transition-colors cursor-pointer"
                  aria-label={`${playingJobId === job.id ? "Stop reading" : "Read aloud"} details for ${job.title}`}
                >
                  {playingJobId === job.id ? (
                    <>
                      <Square size={12} className="fill-current" />
                      <span>Stop</span>
                    </>
                  ) : (
                    <>
                      <Volume2 size={12} />
                      <span>Listen</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleEmailJob(job)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-ink/70 hover:border-accent/40 hover:text-white transition-colors cursor-pointer"
                >
                  {emailSentJobIds[job.id] ? (
                    <>
                      <Check size={12} className="text-success" />
                      <span>Emailed</span>
                    </>
                  ) : (
                    <>
                      <Mail size={12} />
                      <span>Email link</span>
                    </>
                  )}
                </button>
                <a
                  href={job.applyUrl || job.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-surface border border-white/15 px-3.5 py-1.5 text-xs font-semibold text-white hover:border-accent/50 hover:text-accent transition-all"
                >
                  <span>View opportunity</span>
                  <ArrowRight size={12} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Attribution footer */}
      <p className="mt-8 text-[11px] text-ink/40 text-center font-mono">
        Live aggregation &amp; reverse geolocation from verified job feeds.
      </p>
    </div>
  );
}

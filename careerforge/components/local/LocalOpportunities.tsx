"use client";

import { FormEvent, useState } from "react";
import { Section } from "@/components/ui/Section";
import { Card, PrimaryButton, Tag, inputClasses } from "@/components/ui/Primitives";
import { LocalOpportunity } from "@/lib/types";

const mockOpportunities: LocalOpportunity[] = [
  { title: "Frontend Intern", org: "Lumen Labs", type: "Internship", distanceKm: 1.2, address: "BKC, Mumbai" },
  { title: "Junior Software Engineer", org: "Fieldstone Analytics", type: "Job", distanceKm: 3.4, address: "Andheri East, Mumbai" },
  { title: "Product Design Meetup", org: "Design Mumbai Collective", type: "Meetup", distanceKm: 2.1, address: "Lower Parel, Mumbai" },
  { title: "Data Science Bootcamp Info Session", org: "Metric & Co.", type: "Meetup", distanceKm: 4.8, address: "Powai, Mumbai" },
];

/**
 * Real integration: with NEXT_PUBLIC_GOOGLE_MAPS_API_KEY set, replace the
 * setTimeout mock below with a call to the Places API, e.g.:
 *
 *   const res = await fetch(
 *     `https://places.googleapis.com/v1/places:searchText`,
 *     {
 *       method: "POST",
 *       headers: {
 *         "Content-Type": "application/json",
 *         "X-Goog-Api-Key": process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
 *         "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
 *       },
 *       body: JSON.stringify({ textQuery: `internships and tech meetups near ${location}` }),
 *     }
 *   );
 *
 * Map the response into LocalOpportunity[] and drop the mock array above.
 */
export function LocalOpportunities() {
  const [location, setLocation] = useState("");
  const [results, setResults] = useState<LocalOpportunity[] | null>(null);
  const [loading, setLoading] = useState(false);

  const search = (e: FormEvent) => {
    e.preventDefault();
    if (!location.trim()) return;
    setLoading(true);
    setTimeout(() => {
      setResults(mockOpportunities);
      setLoading(false);
    }, 500);
  };

  return (
    <Section
      id="local"
      eyebrow="Local Opportunities"
      title="What's near you"
      description="Jobs, internships, and meetups close to a location you choose."
    >
      <form onSubmit={search} className="mb-8 flex max-w-md gap-3">
        <input
          className={inputClasses}
          placeholder="Enter a city or address…"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <PrimaryButton type="submit" disabled={loading || !location.trim()}>
          {loading ? "Searching…" : "Search"}
        </PrimaryButton>
      </form>

      {!results ? (
        <p className="text-sm text-graphite">
          Enter a location to see nearby opportunities.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {results.map((op) => (
            <Card key={op.title}>
              <div className="mb-2 flex items-center justify-between">
                <Tag>{op.type}</Tag>
                <span className="text-xs text-graphite">{op.distanceKm} km away</span>
              </div>
              <p className="text-sm font-medium text-ink">{op.title}</p>
              <p className="mt-1 text-xs text-graphite">{op.org} · {op.address}</p>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-graphite">
        Showing sample results. Add a Google Maps Places API key in
        <code className="mx-1 rounded bg-mist px-1.5 py-0.5">.env.local</code>
        to pull live nearby listings.
      </p>
    </Section>
  );
}

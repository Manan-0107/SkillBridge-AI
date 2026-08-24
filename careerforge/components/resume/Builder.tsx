"use client";

import { useState } from "react";
import { Card, FieldLabel, GhostButton, inputClasses } from "@/components/ui/Primitives";

interface Experience {
  role: string;
  company: string;
  period: string;
  outcome: string;
}

const emptyExperience: Experience = { role: "", company: "", period: "", outcome: "" };

export function Builder() {
  const [fullName, setFullName] = useState("");
  const [headline, setHeadline] = useState("");
  const [contact, setContact] = useState("");
  const [skills, setSkills] = useState("");
  const [experiences, setExperiences] = useState<Experience[]>([emptyExperience]);

  const updateExperience = (i: number, field: keyof Experience, value: string) => {
    setExperiences((prev) =>
      prev.map((exp, idx) => (idx === i ? { ...exp, [field]: value } : exp))
    );
  };

  const addExperience = () => setExperiences((prev) => [...prev, emptyExperience]);
  const removeExperience = (i: number) =>
    setExperiences((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-5">
        <div>
          <FieldLabel>Full name</FieldLabel>
          <input className={inputClasses} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jordan Lee" />
        </div>
        <div>
          <FieldLabel>Headline</FieldLabel>
          <input className={inputClasses} value={headline} onChange={(e) => setHeadline(e.target.value)} placeholder="Frontend Engineer" />
        </div>
        <div>
          <FieldLabel>Contact (email · phone · location)</FieldLabel>
          <input className={inputClasses} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="jordan@email.com · (555) 010-2200 · Mumbai" />
        </div>
        <div>
          <FieldLabel>Skills (comma separated)</FieldLabel>
          <input className={inputClasses} value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, TypeScript, Accessibility" />
        </div>

        <div className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-wide text-graphite">Experience</p>
          {experiences.map((exp, i) => (
            <div key={i} className="rounded-md border border-line p-4">
              <div className="grid grid-cols-2 gap-3">
                <input className={inputClasses} placeholder="Role" value={exp.role} onChange={(e) => updateExperience(i, "role", e.target.value)} />
                <input className={inputClasses} placeholder="Company" value={exp.company} onChange={(e) => updateExperience(i, "company", e.target.value)} />
              </div>
              <input className={`${inputClasses} mt-3`} placeholder="Period (e.g. 2023–Present)" value={exp.period} onChange={(e) => updateExperience(i, "period", e.target.value)} />
              <textarea className={`${inputClasses} mt-3`} rows={2} placeholder="Outcome-led bullet, e.g. 'Cut page load time 40% by...'" value={exp.outcome} onChange={(e) => updateExperience(i, "outcome", e.target.value)} />
              {experiences.length > 1 && (
                <button onClick={() => removeExperience(i)} className="mt-2 text-xs text-graphite underline underline-offset-4 hover:text-ink">
                  Remove
                </button>
              )}
            </div>
          ))}
          <GhostButton onClick={addExperience} className="text-xs">+ Add role</GhostButton>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs uppercase tracking-wide text-graphite">Preview</p>
        <Card className="bg-white">
          <p className="font-display text-2xl italic text-ink">{fullName || "Your Name"}</p>
          <p className="text-sm text-graphite">{headline || "Target role headline"}</p>
          <p className="mt-1 text-xs text-graphite">{contact || "email · phone · location"}</p>

          {skills && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink">Skills</p>
              <p className="mt-1 text-sm text-graphite">{skills}</p>
            </div>
          )}

          <div className="mt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink">Experience</p>
            <div className="mt-2 space-y-3">
              {experiences.filter((e) => e.role || e.company).map((exp, i) => (
                <div key={i}>
                  <p className="text-sm font-medium text-ink">
                    {exp.role || "Role"} <span className="font-normal text-graphite">— {exp.company || "Company"}</span>
                  </p>
                  <p className="text-xs text-graphite">{exp.period}</p>
                  {exp.outcome && <p className="mt-1 text-sm text-ink">{exp.outcome}</p>}
                </div>
              ))}
              {experiences.every((e) => !e.role && !e.company) && (
                <p className="text-sm text-graphite">Fill in the form to see your resume take shape.</p>
              )}
            </div>
          </div>
        </Card>
        <p className="mt-3 text-xs text-graphite">
          This preview renders live from the form — hook up a PDF export
          (e.g. via a headless print route) when ready for download.
        </p>
      </div>
    </div>
  );
}

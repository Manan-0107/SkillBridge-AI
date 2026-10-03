"use client";

import React, { useState, useEffect } from "react";
import type { OfferRecord } from "@/lib/career/types";
import {
  Award,
  Plus,
  Scale,
  Calendar,
  DollarSign,
  MapPin,
  CheckCircle2,
  Trash2,
  AlertCircle,
  HelpCircle,
  Sparkles,
} from "lucide-react";

interface OfferWorkspaceProps {
  initialOffers?: OfferRecord[];
}

export function OfferWorkspace({ initialOffers }: OfferWorkspaceProps) {
  const [offers, setOffers] = useState<OfferRecord[]>(initialOffers || []);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // New offer form
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [baseCompensation, setBaseCompensation] = useState("");
  const [bonus, setBonus] = useState("");
  const [equity, setEquity] = useState("");
  const [benefits, setBenefits] = useState("");
  const [location, setLocation] = useState("");
  const [remoteType, setRemoteType] = useState("Remote");
  const [deadline, setDeadline] = useState("");
  const [startDate, setStartDate] = useState("");
  const [customCriteriaKey, setCustomCriteriaKey] = useState("");
  const [customCriteriaVal, setCustomCriteriaVal] = useState("");
  const [userCriteria, setUserCriteria] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/offers");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.offers)) {
          setOffers(data.offers);
        }
      }
    } catch (err) {
      console.error("[OfferWorkspace] Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCriteria = () => {
    if (!customCriteriaKey.trim()) return;
    setUserCriteria((prev) => ({
      ...prev,
      [customCriteriaKey.trim()]: customCriteriaVal.trim(),
    }));
    setCustomCriteriaKey("");
    setCustomCriteriaVal("");
  };

  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !role.trim()) return;

    const newOffer: Partial<OfferRecord> = {
      company: company.trim(),
      role: role.trim(),
      baseCompensation: baseCompensation.trim() || undefined,
      bonus: bonus.trim() || undefined,
      equity: equity.trim() || undefined,
      benefits: benefits.trim() || undefined,
      location: location.trim() || undefined,
      remoteType: remoteType.trim() || undefined,
      deadline: deadline.trim() || undefined,
      startDate: startDate.trim() || undefined,
      userCriteria,
    };

    try {
      const res = await fetch("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record_offer",
          offer: newOffer,
        }),
      });

      if (res.ok) {
        fetchOffers();
        setShowAddModal(false);
        // Reset form
        setCompany("");
        setRole("");
        setBaseCompensation("");
        setBonus("");
        setEquity("");
        setBenefits("");
        setLocation("");
        setDeadline("");
        setStartDate("");
        setUserCriteria({});
      }
    } catch (err) {
      console.error("[OfferWorkspace] Error saving offer:", err);
    }
  };

  // Extract all unique user criteria keys across recorded offers
  const allCriteriaKeys = Array.from(
    new Set(offers.flatMap((o) => Object.keys(o.userCriteria || {})))
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
            <Scale size={20} className="text-accent" />
            <span>Offer Comparison Workspace</span>
          </h2>
          <p className="text-xs text-ink/60 mt-0.5">
            Factual side-by-side comparison of your recorded opportunities. Zero automated ranking.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-1.5 text-xs font-bold text-bg hover:bg-accent/90 transition-colors cursor-pointer"
        >
          <Plus size={14} />
          <span>Record New Offer</span>
        </button>
      </div>

      {loading ? (
        <div className="p-8 text-center text-xs text-ink/50 bg-surface/20 rounded-2xl border border-white/5">
          Loading recorded offers...
        </div>
      ) : offers.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-surface/30 p-8 sm:p-12 text-center space-y-3">
          <Award size={36} className="mx-auto text-ink/40" />
          <h3 className="text-base font-semibold text-white">No Offers Recorded Yet</h3>
          <p className="text-xs text-ink/60 max-w-md mx-auto">
            When you receive job offers, log them here to compare compensation, benefits, and user-defined criteria side by side.
          </p>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="rounded-lg bg-surface border border-white/15 px-4 py-2 text-xs font-semibold text-white hover:border-accent transition-colors cursor-pointer"
          >
            Record Your First Offer
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Side-by-Side Comparison Matrix */}
          <div className="rounded-2xl border border-white/10 bg-surface/30 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-white/10 bg-surface/60 font-mono text-[11px] text-ink/50 uppercase">
                  <th className="p-4 w-48">Decision Dimension</th>
                  {offers.map((o) => (
                    <th key={o.id} className="p-4 text-white font-bold border-l border-white/5">
                      <p className="text-sm font-bold text-accent">{o.company}</p>
                      <p className="text-[11px] font-normal text-ink/70">{o.role}</p>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs text-ink/80">
                <tr>
                  <td className="p-4 font-semibold text-ink/60">Base Compensation</td>
                  {offers.map((o) => (
                    <td key={o.id} className="p-4 border-l border-white/5 font-semibold text-white">
                      {o.baseCompensation || <span className="text-ink/30 italic">Not provided</span>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-ink/60">Bonus / Incentives</td>
                  {offers.map((o) => (
                    <td key={o.id} className="p-4 border-l border-white/5">
                      {o.bonus || <span className="text-ink/30 italic">Not provided</span>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-ink/60">Equity / Options</td>
                  {offers.map((o) => (
                    <td key={o.id} className="p-4 border-l border-white/5">
                      {o.equity || <span className="text-ink/30 italic">Not provided</span>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-ink/60">Work Arrangement</td>
                  {offers.map((o) => (
                    <td key={o.id} className="p-4 border-l border-white/5">
                      {o.remoteType || <span className="text-ink/30 italic">Unspecified</span>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-ink/60">Location</td>
                  {offers.map((o) => (
                    <td key={o.id} className="p-4 border-l border-white/5">
                      {o.location || <span className="text-ink/30 italic">Unspecified</span>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-ink/60">Benefits &amp; Perks</td>
                  {offers.map((o) => (
                    <td key={o.id} className="p-4 border-l border-white/5">
                      {o.benefits || <span className="text-ink/30 italic">Not provided</span>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-ink/60">Decision Deadline</td>
                  {offers.map((o) => (
                    <td key={o.id} className="p-4 border-l border-white/5 font-mono text-[11px]">
                      {o.deadline || <span className="text-ink/30 italic">None recorded</span>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-semibold text-ink/60">Target Start Date</td>
                  {offers.map((o) => (
                    <td key={o.id} className="p-4 border-l border-white/5 font-mono text-[11px]">
                      {o.startDate || <span className="text-ink/30 italic">Unspecified</span>}
                    </td>
                  ))}
                </tr>

                {/* User-Defined Criteria Rows */}
                {allCriteriaKeys.map((key) => (
                  <tr key={key} className="bg-white/[0.02]">
                    <td className="p-4 font-semibold text-accent/80 flex items-center gap-1.5">
                      <Sparkles size={12} className="text-accent" />
                      <span>{key} (User Priority)</span>
                    </td>
                    {offers.map((o) => (
                      <td key={o.id} className="p-4 border-l border-white/5">
                        {o.userCriteria?.[key] || <span className="text-ink/30 italic">Not assessed</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Record Offer Modal */}
      {showAddModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="record-offer-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto"
        >
          <div className="relative w-full max-w-xl rounded-2xl border border-white/10 bg-surface-elevated shadow-2xl p-6 space-y-4 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 id="record-offer-title" className="text-base font-bold text-white">
                Record Job Offer
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-ink/50 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveOffer} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-ink/60 mb-1">Company *</label>
                  <input
                    required
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Acme Cloud"
                    className="w-full rounded-lg border border-white/10 bg-bg px-3 py-1.5 text-white focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-ink/60 mb-1">Role *</label>
                  <input
                    required
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Senior Software Engineer"
                    className="w-full rounded-lg border border-white/10 bg-bg px-3 py-1.5 text-white focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-ink/60 mb-1">Base Salary</label>
                  <input
                    type="text"
                    value={baseCompensation}
                    onChange={(e) => setBaseCompensation(e.target.value)}
                    placeholder="$140,000 / ₹28L"
                    className="w-full rounded-lg border border-white/10 bg-bg px-3 py-1.5 text-white focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-ink/60 mb-1">Bonus</label>
                  <input
                    type="text"
                    value={bonus}
                    onChange={(e) => setBonus(e.target.value)}
                    placeholder="15% Annual"
                    className="w-full rounded-lg border border-white/10 bg-bg px-3 py-1.5 text-white focus:border-accent focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-ink/60 mb-1">Equity</label>
                  <input
                    type="text"
                    value={equity}
                    onChange={(e) => setEquity(e.target.value)}
                    placeholder="0.05% / 10k RSUs"
                    className="w-full rounded-lg border border-white/10 bg-bg px-3 py-1.5 text-white focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-ink/60 mb-1">Work Mode</label>
                  <select
                    value={remoteType}
                    onChange={(e) => setRemoteType(e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-bg px-3 py-1.5 text-white focus:border-accent focus:outline-none cursor-pointer"
                  >
                    <option value="Worldwide Remote">Worldwide Remote</option>
                    <option value="Country Remote">Country Remote</option>
                    <option value="Hybrid">Hybrid</option>
                    <option value="On-site">On-site</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-ink/60 mb-1">Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Seattle, WA / Bengaluru"
                    className="w-full rounded-lg border border-white/10 bg-bg px-3 py-1.5 text-white focus:border-accent focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-ink/60 mb-1">Benefits Summary</label>
                <input
                  type="text"
                  value={benefits}
                  onChange={(e) => setBenefits(e.target.value)}
                  placeholder="Comprehensive Health, 401(k) Match, $2k Learning Budget"
                  className="w-full rounded-lg border border-white/10 bg-bg px-3 py-1.5 text-white focus:border-accent focus:outline-none"
                />
              </div>

              {/* Custom Criteria builder */}
              <div className="rounded-xl border border-white/10 bg-surface/30 p-3 space-y-2">
                <span className="font-bold text-accent text-[11px] uppercase tracking-wider block">
                  Add Custom Personal Priorities
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customCriteriaKey}
                    onChange={(e) => setCustomCriteriaKey(e.target.value)}
                    placeholder="Criteria (e.g. Commute, Team Culture)"
                    className="flex-1 rounded-lg border border-white/10 bg-bg px-2.5 py-1 text-white focus:border-accent focus:outline-none"
                  />
                  <input
                    type="text"
                    value={customCriteriaVal}
                    onChange={(e) => setCustomCriteriaVal(e.target.value)}
                    placeholder="Value (e.g. 15 mins, High Mentorship)"
                    className="flex-1 rounded-lg border border-white/10 bg-bg px-2.5 py-1 text-white focus:border-accent focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleAddCriteria}
                    className="rounded-lg bg-surface border border-white/15 px-3 py-1 text-white hover:border-accent cursor-pointer"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-ink/70 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-accent px-4 py-2 font-bold text-bg hover:bg-accent/90 cursor-pointer"
                >
                  Save Offer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

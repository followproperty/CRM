"use client";

import React, { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { SiteVisitStatus, LeadStatus, ILead, LEAD_STATUS_LABELS, getWhatsAppUrl } from "@/types/lead";
import { startNegotiationAction, markCustomerWonAction, markCustomerLostAction } from "@/app/actions/leads";
import LeadDetailsModal from "@/components/leads/LeadDetailsModal";

interface PopulatedSiteVisitLead {
  _id: string;
  name: string;
  phone: string;
  status: LeadStatus;
  siteVisitDate?: string | Date;
  siteVisitStatus?: SiteVisitStatus;
  siteVisitNotes?: string;
  assignedTo?: {
    name: string;
    email: string;
  } | null;
  source: string;
  email?: string;
  city?: string;
  state?: string;
  wonAt?: string | Date;
  lostAt?: string | Date;
  lostReason?: string;
}

interface SiteVisitsDashboardViewProps {
  upcomingVisits: PopulatedSiteVisitLead[];
  completedVisits: PopulatedSiteVisitLead[];
  cancelledVisits: PopulatedSiteVisitLead[];
}

function getSiteVisitStatusStyles(status?: SiteVisitStatus) {
  switch (status) {
    case SiteVisitStatus.SCHEDULED:
      return "bg-purple-50 text-purple-755 border-purple-200";
    case SiteVisitStatus.COMPLETED:
      return "bg-emerald-50 text-emerald-755 border-emerald-200";
    case SiteVisitStatus.CANCELLED:
      return "bg-rose-50 text-rose-700 border-rose-200";
    case SiteVisitStatus.NO_SHOW:
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

function getLeadStatusStyles(status: LeadStatus) {
  switch (status) {
    case LeadStatus.NEW:
      return "bg-blue-50 text-blue-700 border-blue-200";
    case LeadStatus.CALLED:
      return "bg-slate-50 text-slate-650 border-slate-200";
    case LeadStatus.INTERESTED:
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case LeadStatus.WHATSAPP_SHARED:
      return "bg-teal-50 text-teal-700 border-teal-200";
    case LeadStatus.FOLLOW_UP:
      return "bg-indigo-50 text-indigo-755 border-indigo-200";
    case LeadStatus.SITE_VISIT:
      return "bg-purple-50 text-purple-700 border-purple-200";
    case LeadStatus.NEGOTIATION:
      return "bg-amber-50 text-amber-700 border-amber-200 animate-pulse";
    case LeadStatus.CUSTOMER:
      return "bg-emerald-50 text-emerald-700 border-emerald-250 font-bold";
    case LeadStatus.LOST:
      return "bg-rose-50 text-rose-700 border-rose-200";
    case LeadStatus.ADMIN_FOLLOWUP:
      return "bg-cyan-50 text-cyan-700 border-cyan-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

export default function SiteVisitsDashboardView({
  upcomingVisits,
  completedVisits,
  cancelledVisits,
}: SiteVisitsDashboardViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const [activeTab, setActiveTab] = useState<"upcoming" | "completed" | "cancelled">("upcoming");

  // Modal State
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<ILead | null>(null);

  // Lost Reason confirmation state
  const [lostReasonLeadId, setLostReasonLeadId] = useState<string | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>("Price Issue");

  const currentSearch = searchParams.get("search") || "";
  const currentVisitStatus = searchParams.get("visitStatus") || "ALL";

  const showMessage = (text: string, isError = false) => {
    setMessage({ text, isError });
    setTimeout(() => {
      setMessage(null);
    }, 5000);
  };

  function handleFilterChange(name: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "ALL") {
      params.set(name, value);
    } else {
      params.delete(name);
    }

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  const handleStartNegotiation = (leadId: string) => {
    startTransition(async () => {
      const result = await startNegotiationAction(leadId);
      if (result.success) {
        showMessage("Lead workflow status updated to Negotiation.");
      } else {
        showMessage(result.error || "Failed to update status.", true);
      }
    });
  };

  const handleMarkWon = (leadId: string) => {
    startTransition(async () => {
      const result = await markCustomerWonAction(leadId);
      if (result.success) {
        showMessage("Congratulations! Customer has been Won!");
      } else {
        showMessage(result.error || "Failed to update status.", true);
      }
    });
  };

  const handleConfirmLost = (leadId: string) => {
    startTransition(async () => {
      const result = await markCustomerLostAction(leadId, selectedReason);
      if (result.success) {
        showMessage(`Lead marked as Lost (${selectedReason}).`);
        setLostReasonLeadId(null);
      } else {
        showMessage(result.error || "Failed to update status.", true);
      }
    });
  };

  // Get active list based on activeTab
  const activeVisits = {
    upcoming: upcomingVisits,
    completed: completedVisits,
    cancelled: cancelledVisits,
  }[activeTab];

  return (
    <div className="space-y-6">
      {/* Toast Alert Messaging */}
      {message && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3.5 rounded-xl border shadow-xl transition-all duration-300 animate-slide-in ${
            message.isError
              ? "bg-white border-red-200 text-red-800"
              : "bg-white border-emerald-200 text-emerald-800"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${message.isError ? "bg-red-500" : "bg-emerald-500"} animate-pulse`} />
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        {/* Search */}
        <div className="w-full sm:max-w-xs relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-450 pointer-events-none">
            {isPending ? (
              <span className="w-4 h-4 border-2 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </span>
          <input
            type="text"
            placeholder="Search leads..."
            defaultValue={currentSearch}
            onChange={(e) => handleFilterChange("search", e.target.value)}
            className="w-full bg-white border border-slate-200 focus:border-purple-500/50 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
          />
        </div>

        {/* Status Filter */}
        <div className="w-full sm:w-auto flex items-center gap-2">
          <label htmlFor="visit-status-select" className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
            Visit Status:
          </label>
          <select
            id="visit-status-select"
            value={currentVisitStatus}
            onChange={(e) => handleFilterChange("visitStatus", e.target.value)}
            className="bg-white border border-slate-200 focus:border-purple-500/50 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none transition-all cursor-pointer min-w-[160px]"
          >
            <option value="ALL">All Visit Statuses</option>
            {Object.values(SiteVisitStatus).map((status) => (
              <option key={status} value={status}>
                {status.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs Menu Navigation */}
      <div className="border-b border-slate-200">
        <div className="flex flex-wrap gap-2 -mb-px">
          {/* Tab 1: Upcoming */}
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`flex items-center gap-2 px-5 py-3.5 border-b-2 text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "upcoming"
                ? "border-purple-650 text-purple-755"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Upcoming Visits
            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
              activeTab === "upcoming" ? "bg-purple-50 text-purple-755 border border-purple-200" : "bg-slate-100 text-slate-500"
            }`}>
              {upcomingVisits.length}
            </span>
          </button>

          {/* Tab 2: Completed */}
          <button
            onClick={() => setActiveTab("completed")}
            className={`flex items-center gap-2 px-5 py-3.5 border-b-2 text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "completed"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Completed Visits
            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
              activeTab === "completed" ? "bg-emerald-50 text-emerald-755 border border-emerald-200" : "bg-slate-100 text-slate-500"
            }`}>
              {completedVisits.length}
            </span>
          </button>

          {/* Tab 3: Cancelled */}
          <button
            onClick={() => setActiveTab("cancelled")}
            className={`flex items-center gap-2 px-5 py-3.5 border-b-2 text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "cancelled"
                ? "border-rose-600 text-rose-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Cancelled & No-Show
            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
              activeTab === "cancelled" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-slate-100 text-slate-500"
            }`}>
              {cancelledVisits.length}
            </span>
          </button>
        </div>
      </div>

      {/* Leads Registry Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Desktop Site Visits Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider bg-slate-50/70">
                <th className="px-6 py-4">Lead Name</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">Assigned Caller</th>
                <th className="px-6 py-4">Visit Date & Time</th>
                <th className="px-6 py-4">Status Summary</th>
                <th className="px-6 py-4">Workflow Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {activeVisits.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                    No site visits found matching current criteria.
                  </td>
                </tr>
              ) : (
                activeVisits.map((lead) => {
                  const leadId = lead._id;
                  const isEligibleForConversion = 
                    lead.status === LeadStatus.SITE_VISIT || 
                    lead.status === LeadStatus.NEGOTIATION;

                  const wonDateStr = lead.wonAt ? new Date(lead.wonAt).toLocaleDateString() : "";
                  const lostDateStr = lead.lostAt ? new Date(lead.lostAt).toLocaleDateString() : "";

                  return (
                    <tr key={leadId} className="hover:bg-slate-50/50 transition-colors">
                      {/* Name (Clickable trigger for LeadDetailsModal) */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start">
                          <button
                            onClick={() => {
                              setSelectedLeadId(leadId);
                              setSelectedLead(lead as unknown as ILead);
                            }}
                            className="font-semibold text-slate-800 hover:text-purple-650 hover:underline text-left transition-colors cursor-pointer"
                          >
                            {lead.name}
                          </button>
                          {lead.siteVisitNotes && (
                            <span className="text-[11px] text-slate-500 mt-0.5 max-w-xs truncate" title={lead.siteVisitNotes}>
                              Note: {lead.siteVisitNotes}
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Phone */}
                      <td className="px-6 py-4 font-mono text-slate-605">
                        <div className="flex items-center gap-2">
                          <a href={`tel:${lead.phone}`} className="hover:text-purple-650 transition-colors">
                            {lead.phone}
                          </a>
                          <a
                            href={getWhatsAppUrl(lead.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded text-[10px] font-bold transition-all active:scale-[0.97]"
                          >
                            WhatsApp
                          </a>
                        </div>
                      </td>
                      {/* Assigned */}
                      <td className="px-6 py-4">
                        {lead.assignedTo ? (
                          <div className="flex flex-col">
                            <span className="text-slate-700 font-semibold">{lead.assignedTo.name}</span>
                            <span className="text-[10px] text-slate-450">{lead.assignedTo.email}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>
                      {/* Visit Date */}
                      <td className="px-6 py-4 font-mono text-slate-600">
                        {lead.siteVisitDate ? (
                          new Date(lead.siteVisitDate).toLocaleString()
                        ) : (
                          <span className="text-slate-400 italic">Not Scheduled</span>
                        )}
                      </td>
                      {/* Statuses (Double badge display) */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`px-2 py-0.5 rounded-full border text-[10.5px] font-semibold tracking-wide ${getSiteVisitStatusStyles(lead.siteVisitStatus)}`}>
                            Visit: {lead.siteVisitStatus ? lead.siteVisitStatus.replace("_", " ") : "UNKNOWN"}
                          </span>
                          <span className={`px-2 py-0.2 rounded border text-[9.5px] font-extrabold uppercase ${getLeadStatusStyles(lead.status)}`}>
                            Lead: {LEAD_STATUS_LABELS[lead.status] || lead.status}
                          </span>
                        </div>
                      </td>
                      {/* Workflow conversion action cells */}
                      <td className="px-6 py-4">
                        {isEligibleForConversion ? (
                          lostReasonLeadId === leadId ? (
                            /* Inline Lost Reason Confirmation Form */
                            <div className="flex flex-col gap-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 min-w-[170px] animate-fade-in">
                              <label htmlFor={`lost-select-${leadId}`} className="text-[9px] font-extrabold text-rose-600 uppercase tracking-widest">
                                Lost Reason
                              </label>
                              <select
                                id={`lost-select-${leadId}`}
                                value={selectedReason}
                                onChange={(e) => setSelectedReason(e.target.value)}
                                className="bg-white border border-slate-200 focus:border-rose-500/50 rounded px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none cursor-pointer"
                              >
                                <option value="Price Issue">Price Issue</option>
                                <option value="Competitor">Competitor</option>
                                <option value="No Response">No Response</option>
                                <option value="Budget Issue">Budget Issue</option>
                                <option value="Other">Other</option>
                              </select>
                              <div className="flex gap-1.5 justify-end mt-1.5">
                                <button
                                  type="button"
                                  onClick={() => setLostReasonLeadId(null)}
                                  className="px-2.5 py-0.5 text-slate-650 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded text-[10px] font-semibold cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={isPending}
                                  onClick={() => handleConfirmLost(leadId)}
                                  className="px-2.5 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[10px] font-bold cursor-pointer"
                                >
                                  Confirm
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Standard conversion status buttons */
                            <div className="flex flex-wrap items-center gap-1.5">
                              {/* 1. Negotiation button (only shown if lead is in SITE_VISIT status) */}
                              {lead.status === LeadStatus.SITE_VISIT && (
                                <button
                                  onClick={() => handleStartNegotiation(leadId)}
                                  disabled={isPending}
                                  className="text-xs px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-350 text-slate-700 hover:text-slate-900 transition-all font-medium rounded-lg cursor-pointer"
                                >
                                  Send Payment Plan
                                </button>
                              )}

                              {/* 2. Customer Won button */}
                              <button
                                  onClick={() => handleMarkWon(leadId)}
                                  disabled={isPending}
                                  className="text-xs px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-350 text-slate-700 hover:text-slate-900 transition-all font-medium rounded-lg cursor-pointer"
                              >
                                Sale Done
                              </button>

                              {/* 3. Customer Lost button */}
                              <button
                                onClick={() => {
                                  setLostReasonLeadId(leadId);
                                  setSelectedReason("Price Issue");
                                }}
                                disabled={isPending}
                                className="text-xs px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-350 text-slate-700 hover:text-slate-900 transition-all font-medium rounded-lg cursor-pointer"
                              >
                                Sale Not Done
                              </button>
                            </div>
                          )
                        ) : lead.status === LeadStatus.CUSTOMER ? (
                          <div className="flex flex-col items-start text-emerald-650">
                            <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1">
                              ✔ Sale Done
                            </span>
                            {wonDateStr && (
                              <span className="text-[10px] text-slate-400 font-mono">Completed at: {wonDateStr}</span>
                            )}
                          </div>
                        ) : lead.status === LeadStatus.LOST ? (
                          <div className="flex flex-col items-start text-rose-650">
                            <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                              ✘ Sale Not Done
                            </span>
                            <span className="text-[10.5px] text-slate-450 italic">
                              Reason: {lead.lostReason || "Other"}
                            </span>
                            {lostDateStr && (
                              <span className="text-[10px] text-slate-400 font-mono">Lost at: {lostDateStr}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Actions Unavailable</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Site Visits Card Layout */}
        <div className="md:hidden divide-y divide-slate-100">
          {activeVisits.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-400 italic text-sm">
              No site visits found matching current criteria.
            </div>
          ) : (
            activeVisits.map((lead) => {
              const leadId = lead._id;
              const isEligibleForConversion = 
                lead.status === LeadStatus.SITE_VISIT || 
                lead.status === LeadStatus.NEGOTIATION;

              const wonDateStr = lead.wonAt ? new Date(lead.wonAt).toLocaleDateString() : "";
              const lostDateStr = lead.lostAt ? new Date(lead.lostAt).toLocaleDateString() : "";
              const visitDateStr = lead.siteVisitDate ? (
                new Date(lead.siteVisitDate).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              ) : (
                "Not Scheduled"
              );

              return (
                <div key={leadId} className="p-4 space-y-3.5">
                  <div className="flex justify-between items-start gap-2">
                    {/* Lead Name (clickable modal trigger) */}
                    <button
                      onClick={() => {
                        setSelectedLeadId(leadId);
                        setSelectedLead(lead as unknown as ILead);
                      }}
                      className="font-bold text-slate-900 hover:text-purple-655 hover:underline text-left text-sm transition-colors cursor-pointer"
                    >
                      {lead.name}
                    </button>
                    
                    {/* Statuses (Double badge display) */}
                    <div className="flex flex-col gap-1 items-end shrink-0">
                      <span className={`px-2 py-0.5 rounded-full border text-[9.5px] font-semibold tracking-wide ${getSiteVisitStatusStyles(lead.siteVisitStatus)}`}>
                        Visit: {lead.siteVisitStatus ? lead.siteVisitStatus.replace("_", " ") : "UNKNOWN"}
                      </span>
                      <span className={`px-2 py-0.2 rounded border text-[8.5px] font-extrabold uppercase ${getLeadStatusStyles(lead.status)}`}>
                        Lead: {LEAD_STATUS_LABELS[lead.status] || lead.status}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-slate-450 block mb-0.5 font-medium">Caller</span>
                      <span className="font-semibold text-slate-850 truncate block">
                        {lead.assignedTo ? lead.assignedTo.name : <span className="text-slate-400 italic">Unassigned</span>}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-450 block mb-0.5 font-medium">Visit Date</span>
                      <span className="font-mono text-slate-800 font-semibold block">
                        {visitDateStr}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-450 block mb-0.5 font-medium">Phone</span>
                      <div className="flex items-center gap-1 mt-0.5">
                        <a href={`tel:${lead.phone}`} className="font-mono text-slate-800 hover:text-purple-650 font-semibold truncate block">
                          {lead.phone}
                        </a>
                        <a
                          href={getWhatsAppUrl(lead.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-1 py-0.2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-emerald-700 rounded text-[9px] font-extrabold transition-all"
                        >
                          WA
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Workflow conversion actions on mobile card */}
                  <div className="pt-3 border-t border-slate-100/70">
                    {isEligibleForConversion ? (
                      lostReasonLeadId === leadId ? (
                        /* Inline Lost Reason Confirmation Form */
                        <div className="flex flex-col gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 w-full animate-fade-in">
                          <label htmlFor={`lost-select-mobile-${leadId}`} className="text-[9.5px] font-extrabold text-rose-600 uppercase tracking-widest">
                            Lost Reason
                          </label>
                          <select
                            id={`lost-select-mobile-${leadId}`}
                            value={selectedReason}
                            onChange={(e) => setSelectedReason(e.target.value)}
                            className="bg-white border border-slate-200 focus:border-rose-500/50 rounded px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none cursor-pointer"
                          >
                            <option value="Price Issue">Price Issue</option>
                            <option value="Competitor">Competitor</option>
                            <option value="No Response">No Response</option>
                            <option value="Budget Issue">Budget Issue</option>
                            <option value="Other">Other</option>
                          </select>
                          <div className="flex gap-2 justify-end mt-1">
                            <button
                              type="button"
                              onClick={() => setLostReasonLeadId(null)}
                              className="px-3 py-1 text-slate-650 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded text-xs font-semibold cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleConfirmLost(leadId)}
                              className="px-3.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold cursor-pointer"
                            >
                              Confirm
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Standard conversion status buttons on mobile */
                        <div className="flex items-center gap-2">
                          {/* 1. Negotiation button */}
                          {lead.status === LeadStatus.SITE_VISIT && (
                            <button
                              onClick={() => handleStartNegotiation(leadId)}
                              disabled={isPending}
                              className="flex-1 text-center text-xs py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-350 text-slate-700 hover:text-slate-900 transition-all font-medium rounded-lg cursor-pointer"
                            >
                              Send Payment Plan
                            </button>
                          )}

                          {/* 2. Customer Won button */}
                          <button
                            onClick={() => handleMarkWon(leadId)}
                            disabled={isPending}
                            className="flex-1 text-center text-xs py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-350 text-slate-700 hover:text-slate-900 transition-all font-medium rounded-lg cursor-pointer"
                          >
                            Sale Done
                          </button>

                          {/* 3. Customer Lost button */}
                          <button
                            onClick={() => {
                              setLostReasonLeadId(leadId);
                              setSelectedReason("Price Issue");
                            }}
                            disabled={isPending}
                            className="flex-1 text-center text-xs py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-350 text-slate-700 hover:text-slate-900 transition-all font-medium rounded-lg cursor-pointer"
                          >
                            Sale Not Done
                          </button>
                        </div>
                      )
                    ) : lead.status === LeadStatus.CUSTOMER ? (
                      <div className="flex flex-col items-start text-emerald-650">
                        <span className="text-xs font-extrabold uppercase tracking-wider flex items-center gap-1">
                          ✔ Sale Done
                        </span>
                        {wonDateStr && (
                          <span className="text-[10px] text-slate-450 font-mono mt-0.5">Completed at: {wonDateStr}</span>
                        )}
                      </div>
                    ) : lead.status === LeadStatus.LOST ? (
                      <div className="flex flex-col items-start text-rose-650">
                        <span className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                          ✘ Sale Not Done
                        </span>
                        <span className="text-[11px] text-slate-500 italic mt-0.5">
                          Reason: {lead.lostReason || "Other"}
                        </span>
                        {lostDateStr && (
                          <span className="text-[10px] text-slate-450 font-mono mt-0.5">Lost at: {lostDateStr}</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Actions Unavailable</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Reusable LeadDetailsModal */}
      {selectedLeadId && selectedLead && (
        <LeadDetailsModal
          leadId={selectedLeadId}
          lead={selectedLead}
          isOpen={!!selectedLeadId}
          onClose={() => {
            setSelectedLeadId(null);
            setSelectedLead(null);
          }}
        />
      )}
    </div>
  );
}

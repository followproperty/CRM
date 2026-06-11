"use client";

import React, { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { LeadStatus, ILead } from "@/types/lead";
import LeadDetailsModal from "@/components/leads/LeadDetailsModal";

interface PopulatedLead {
  _id: string;
  name: string;
  phone: string;
  status: LeadStatus;
  nextFollowUp?: string | Date;
  assignedTo?: {
    name: string;
    email: string;
  } | null;
  source: string;
  email?: string;
  city?: string;
  state?: string;
}

interface FollowupsDashboardViewProps {
  interestedLeads: PopulatedLead[];
  callLaterLeads: PopulatedLead[];
  todaysFollowups: PopulatedLead[];
  overdueFollowups: PopulatedLead[];
}

function getStatusStyles(status: LeadStatus) {
  switch (status) {
    case LeadStatus.NEW:
      return "bg-blue-50 text-blue-700 border-blue-200";
    case LeadStatus.CALLED:
      return "bg-slate-55 text-slate-650 border-slate-200";
    case LeadStatus.INTERESTED:
      return "bg-emerald-50 text-emerald-755 border-emerald-200";
    case LeadStatus.WHATSAPP_SHARED:
      return "bg-teal-50 text-teal-700 border-teal-200";
    case LeadStatus.FOLLOW_UP:
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case LeadStatus.SITE_VISIT:
      return "bg-purple-50 text-purple-700 border-purple-200";
    case LeadStatus.CUSTOMER:
      return "bg-amber-55 text-amber-755 border-amber-250";
    case LeadStatus.NOT_INTERESTED:
      return "bg-rose-50 text-rose-700 border-rose-200";
    case LeadStatus.DND:
      return "bg-red-50 text-red-700 border-red-200";
    case LeadStatus.WRONG_NUMBER:
      return "bg-orange-50 text-orange-700 border-orange-200";
    case LeadStatus.ADMIN_FOLLOWUP:
      return "bg-cyan-50 text-cyan-755 border-cyan-200";
    case LeadStatus.NEGOTIATION:
      return "bg-amber-50 text-amber-700 border-amber-200";
    case LeadStatus.LOST:
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

export default function FollowupsDashboardView({
  interestedLeads,
  callLaterLeads,
  todaysFollowups,
  overdueFollowups,
}: FollowupsDashboardViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<"today" | "overdue" | "interested" | "callLater">("today");

  // Modal State
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<ILead | null>(null);

  const currentSearch = searchParams.get("search") || "";
  const currentStatus = searchParams.get("status") || "ALL";

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

  // Get active list
  const activeLeads = {
    today: todaysFollowups,
    overdue: overdueFollowups,
    interested: interestedLeads,
    callLater: callLaterLeads,
  }[activeTab];

  return (
    <div className="space-y-6">
      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        {/* Search */}
        <div className="w-full sm:max-w-xs relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-450 pointer-events-none">
            {isPending ? (
              <span className="w-4 h-4 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
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
            className="w-full bg-white border border-slate-200 focus:border-indigo-500/50 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
          />
        </div>

        {/* Status */}
        <div className="w-full sm:w-auto flex items-center gap-2">
          <label htmlFor="status-select" className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
            Status:
          </label>
          <select
            id="status-select"
            value={currentStatus}
            onChange={(e) => handleFilterChange("status", e.target.value)}
            className="bg-white border border-slate-200 focus:border-indigo-500/50 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none transition-all cursor-pointer min-w-[150px]"
          >
            <option value="ALL">All Statuses</option>
            {Object.values(LeadStatus).map((status) => (
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
          {/* Tab 1: Today's */}
          <button
            onClick={() => setActiveTab("today")}
            className={`flex items-center gap-2 px-5 py-3.5 border-b-2 text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "today"
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Today&apos;s Follow-ups
            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
              activeTab === "today" ? "bg-indigo-50 text-indigo-755 border border-indigo-200" : "bg-slate-100 text-slate-500"
            }`}>
              {todaysFollowups.length}
            </span>
          </button>

          {/* Tab 2: Overdue */}
          <button
            onClick={() => setActiveTab("overdue")}
            className={`flex items-center gap-2 px-5 py-3.5 border-b-2 text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "overdue"
                ? "border-rose-500 text-rose-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Overdue Follow-ups
            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
              activeTab === "overdue" ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-slate-100 text-slate-500"
            }`}>
              {overdueFollowups.length}
            </span>
          </button>

          {/* Tab 3: Interested */}
          <button
            onClick={() => setActiveTab("interested")}
            className={`flex items-center gap-2 px-5 py-3.5 border-b-2 text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "interested"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Interested Leads
            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
              activeTab === "interested" ? "bg-emerald-50 text-emerald-755 border border-emerald-200" : "bg-slate-100 text-slate-500"
            }`}>
              {interestedLeads.length}
            </span>
          </button>

          {/* Tab 4: Call Later */}
          <button
            onClick={() => setActiveTab("callLater")}
            className={`flex items-center gap-2 px-5 py-3.5 border-b-2 text-sm font-semibold transition-all cursor-pointer ${
              activeTab === "callLater"
                ? "border-violet-600 text-violet-700"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Call Later Leads
            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${
              activeTab === "callLater" ? "bg-violet-50 text-violet-755 border border-violet-200" : "bg-slate-100 text-slate-500"
            }`}>
              {callLaterLeads.length}
            </span>
          </button>
        </div>
      </div>

      {/* Leads Registry Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider bg-slate-50/70">
                <th className="px-6 py-4">Lead Name</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">Assigned Caller</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Next Follow-up Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {activeLeads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                    No leads found matching current criteria.
                  </td>
                </tr>
              ) : (
                activeLeads.map((lead) => (
                  <tr key={lead._id} className="hover:bg-slate-50/50 transition-colors">
                    {/* Name (Clickable trigger for LeadDetailsModal) */}
                    <td className="px-6 py-4">
                      <button
                        onClick={() => {
                          setSelectedLeadId(lead._id);
                          setSelectedLead(lead as unknown as ILead);
                        }}
                        className="font-semibold text-slate-800 hover:text-indigo-650 hover:underline text-left transition-colors cursor-pointer"
                      >
                        {lead.name}
                      </button>
                    </td>
                    {/* Phone */}
                    <td className="px-6 py-4 font-mono text-slate-600">
                      <a href={`tel:${lead.phone}`} className="hover:text-indigo-600 transition-colors">
                        {lead.phone}
                      </a>
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
                    {/* Status */}
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold ${getStatusStyles(lead.status)}`}>
                        {lead.status.replace("_", " ")}
                      </span>
                    </td>
                    {/* Next Followup */}
                    <td className="px-6 py-4 font-mono text-slate-500">
                      {lead.nextFollowUp ? (
                        new Date(lead.nextFollowUp).toLocaleString()
                      ) : (
                        <span className="text-slate-400 italic">None Scheduled</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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

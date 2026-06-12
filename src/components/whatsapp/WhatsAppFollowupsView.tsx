"use client";

import React, { useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { LeadStatus, ILead, LEAD_STATUS_LABELS, getWhatsAppUrl } from "@/types/lead";
import { markWhatsAppDetailsSentAction, startAdminFollowupAction } from "@/app/actions/leads";
import LeadDetailsModal from "@/components/leads/LeadDetailsModal";

export interface PopulatedWhatsAppLead {
  _id: string;
  name: string;
  phone: string;
  status: LeadStatus;
  handedOffAt?: string | Date;
  assignedTo?: {
    name: string;
    email: string;
  } | null;
  projectId?: {
    name: string;
  } | null;
  source: string;
  email?: string;
  city?: string;
  state?: string;
}

interface WhatsAppFollowupsViewProps {
  leads: PopulatedWhatsAppLead[];
}

function getStatusStyles(status: LeadStatus) {
  switch (status) {
    case LeadStatus.ADMIN_FOLLOWUP:
      return "bg-cyan-50 text-cyan-755 border-cyan-200";
    case LeadStatus.WHATSAPP_SHARED:
      return "bg-teal-50 text-teal-700 border-teal-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

export default function WhatsAppFollowupsView({ leads }: WhatsAppFollowupsViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Modal State
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<ILead | null>(null);

  const currentSearch = searchParams.get("search") || "";
  const currentStatus = searchParams.get("status") || "ALL";

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

  const handleMarkDetailsSent = (leadId: string) => {
    startTransition(async () => {
      const result = await markWhatsAppDetailsSentAction(leadId);
      if (result.success) {
        showMessage("Lead status updated: WhatsApp details successfully sent.");
      } else {
        showMessage(result.error || "Failed to update status.", true);
      }
    });
  };

  const handleStartFollowup = (leadId: string) => {
    startTransition(async () => {
      const result = await startAdminFollowupAction(leadId);
      if (result.success) {
        showMessage("Lead status updated: Admin WhatsApp follow-up started.");
      } else {
        showMessage(result.error || "Failed to update status.", true);
      }
    });
  };

  // Filter leads client-side if needed (search & status parameters are also fetched server-side)
  const filteredLeads = leads.filter((lead) => {
    // 1. Search filter
    const matchesSearch =
      !currentSearch ||
      lead.name.toLowerCase().includes(currentSearch.toLowerCase()) ||
      lead.phone.toLowerCase().includes(currentSearch.toLowerCase());

    // 2. Status filter
    const matchesStatus =
      currentStatus === "ALL" || lead.status === currentStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Toast Alert Messaging */}
      {message && (
        <div
          className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 px-4 py-3.5 rounded-xl border shadow-xl transition-all duration-300 animate-slide-in ${
            message.isError
              ? "bg-white border-red-200 text-red-800"
              : "bg-white border-cyan-200 text-cyan-800"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${message.isError ? "bg-red-500" : "bg-cyan-500"} animate-pulse`} />
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        {/* Search */}
        <div className="w-full sm:max-w-xs relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-450 pointer-events-none">
            {isPending ? (
              <span className="w-4 h-4 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            )}
          </span>
          <input
            type="text"
            placeholder="Search handoffs..."
            defaultValue={currentSearch}
            onChange={(e) => handleFilterChange("search", e.target.value)}
            className="w-full bg-white border border-slate-200 focus:border-cyan-500/50 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
          />
        </div>

        {/* Status Filter */}
        <div className="w-full sm:w-auto flex items-center gap-2">
          <label htmlFor="whatsapp-status-select" className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0">
            Handoff Status:
          </label>
          <select
            id="whatsapp-status-select"
            value={currentStatus}
            onChange={(e) => handleFilterChange("status", e.target.value)}
            className="bg-white border border-slate-200 focus:border-cyan-500/50 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none transition-all cursor-pointer min-w-[170px]"
          >
            <option value="ALL">All Handoff States</option>
            <option value={LeadStatus.ADMIN_FOLLOWUP}>Admin Follow-up</option>
            <option value={LeadStatus.WHATSAPP_SHARED}>WhatsApp Shared</option>
          </select>
        </div>
      </div>

      {/* Leads Registry Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider bg-slate-50/70">
                <th className="px-6 py-4">Lead Name</th>
                <th className="px-6 py-4">Phone</th>
                <th className="px-6 py-4">Project</th>
                <th className="px-6 py-4">Caller Name</th>
                <th className="px-6 py-4">Handoff Date</th>
                <th className="px-6 py-4">Current Status</th>
                <th className="px-6 py-4">Handoff Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400 italic">
                    No WhatsApp follow-up handoffs found.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const leadId = lead._id;
                  const handoffDateStr = lead.handedOffAt
                    ? new Date(lead.handedOffAt).toLocaleString()
                    : "Unknown Date";

                  return (
                    <tr key={leadId} className="hover:bg-slate-50/50 transition-colors">
                      {/* Name (Clickable trigger for LeadDetailsModal) */}
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
                            setSelectedLeadId(leadId);
                            setSelectedLead(lead as unknown as ILead);
                          }}
                          className="font-semibold text-slate-800 hover:text-cyan-650 hover:underline text-left transition-colors cursor-pointer"
                        >
                          {lead.name}
                        </button>
                      </td>
                      {/* Phone */}
                      <td className="px-6 py-4 font-mono text-slate-600">
                        <div className="flex items-center gap-2">
                          <a href={`tel:${lead.phone}`} className="hover:text-cyan-655 transition-colors">
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
                      {/* Project */}
                      <td className="px-6 py-4 text-slate-700 font-medium">
                        {lead.projectId?.name || <span className="text-slate-400 italic">No project</span>}
                      </td>
                      {/* Caller */}
                      <td className="px-6 py-4 text-slate-700">
                        {lead.assignedTo?.name || <span className="text-slate-455 italic">Unassigned</span>}
                      </td>
                      {/* Handoff Date */}
                      <td className="px-6 py-4 font-mono text-slate-500">
                        {handoffDateStr}
                      </td>
                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded border text-[10.5px] font-semibold tracking-wide ${getStatusStyles(lead.status)}`}>
                          {LEAD_STATUS_LABELS[lead.status] || lead.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col sm:flex-row items-center gap-2">
                          <button
                            onClick={() => handleMarkDetailsSent(leadId)}
                            disabled={isPending || lead.status === LeadStatus.WHATSAPP_SHARED}
                            className="text-xs px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-350 text-slate-700 hover:text-slate-900 transition-all font-medium rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                          >
                            Mark Brochure Sent
                          </button>
                          <button
                            onClick={() => handleStartFollowup(leadId)}
                            disabled={isPending || lead.status === LeadStatus.ADMIN_FOLLOWUP}
                            className="text-xs px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-350 text-slate-700 hover:text-slate-900 transition-all font-medium rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                          >
                            Start WhatsApp Follow Up
                          </button>
                          <a
                            href={getWhatsAppUrl(lead.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-center text-xs px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 hover:text-emerald-900 transition-all font-medium rounded-lg w-full sm:w-auto"
                          >
                            WhatsApp
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredLeads.length === 0 ? (
            <div className="px-6 py-12 text-center text-slate-400 italic text-sm">
              No WhatsApp follow-up handoffs found.
            </div>
          ) : (
            filteredLeads.map((lead) => {
              const leadId = lead._id;
              const handoffDateStr = lead.handedOffAt
                ? new Date(lead.handedOffAt).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Unknown Date";

              return (
                <div key={leadId} className="p-4 space-y-3.5">
                  <div className="flex justify-between items-start gap-2">
                    {/* Lead Name (clickable modal trigger) */}
                    <button
                      onClick={() => {
                        setSelectedLeadId(leadId);
                        setSelectedLead(lead as unknown as ILead);
                      }}
                      className="font-bold text-slate-900 hover:text-cyan-650 hover:underline text-left text-sm transition-colors cursor-pointer"
                    >
                      {lead.name}
                    </button>
                    {/* Status Badge */}
                    <span className={`px-2 py-0.5 rounded border text-[10px] font-bold tracking-wide shrink-0 ${getStatusStyles(lead.status)}`}>
                      {LEAD_STATUS_LABELS[lead.status] || lead.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-450 block mb-0.5 font-medium">Phone</span>
                      <div className="flex items-center gap-2">
                        <a href={`tel:${lead.phone}`} className="font-mono text-slate-800 hover:text-cyan-655 font-semibold flex items-center gap-1">
                          <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {lead.phone}
                        </a>
                        <a
                          href={getWhatsAppUrl(lead.phone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-1.5 py-0.2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded text-[9px] font-extrabold transition-all active:scale-[0.97]"
                        >
                          WhatsApp
                        </a>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-450 block mb-0.5 font-medium">Project Context</span>
                      <span className="font-semibold text-slate-850 truncate block">
                        {lead.projectId?.name || <span className="text-slate-400 italic">No project</span>}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Handoff By</span>
                      <span className="font-semibold text-slate-750">
                        {lead.assignedTo?.name || "Unassigned"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px] uppercase font-bold tracking-wider">Handoff Time</span>
                      <span className="font-mono text-slate-755">{handoffDateStr}</span>
                    </div>
                  </div>

                  {/* WhatsApp actions directly on mobile card */}
                  <div className="flex items-center gap-2 pt-2.5 border-t border-slate-100/70">
                    <button
                      onClick={() => handleMarkDetailsSent(leadId)}
                      disabled={isPending || lead.status === LeadStatus.WHATSAPP_SHARED}
                      className="flex-1 text-center text-xs py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-350 text-slate-700 hover:text-slate-900 transition-all font-medium rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Mark Brochure Sent
                    </button>
                    <button
                      onClick={() => handleStartFollowup(leadId)}
                      disabled={isPending || lead.status === LeadStatus.ADMIN_FOLLOWUP}
                      className="flex-1 text-center text-xs py-2 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-350 text-slate-700 hover:text-slate-900 transition-all font-medium rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Start WhatsApp Follow Up
                    </button>
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

"use client";

import React, { useState, useTransition } from "react";
import { ILead, LEAD_STATUS_LABELS, getWhatsAppUrl } from "@/types/lead";
import AssigneeSelect from "./AssigneeSelect";
import LeadDetailsModal from "@/components/leads/LeadDetailsModal";
import { bulkAssignLeadsAction, autoDistributeLeadsAction } from "../../actions/leads";

interface PopulatedLead extends Omit<ILead, "assignedTo"> {
  assignedTo?: {
    _id: string;
    name: string;
  } | null;
}

interface EligibleUser {
  _id: string;
  name: string;
  role: string;
  activeCount: number;
}

interface SuperAdminLeadsTableProps {
  leads: PopulatedLead[];
  eligibleUsers: EligibleUser[];
}

function getStatusStyles(status: string) {
  switch (status) {
    case "NEW":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "CALLED":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "INTERESTED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "WHATSAPP_SHARED":
      return "bg-teal-50 text-teal-700 border-teal-200";
    case "FOLLOW_UP":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "SITE_VISIT":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "CUSTOMER":
      return "bg-amber-50 text-amber-805 border-amber-200";
    case "NOT_INTERESTED":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "DND":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export default function SuperAdminLeadsTable({ leads, eligibleUsers }: SuperAdminLeadsTableProps) {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<ILead | null>(null);

  // Allocation State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeCap, setActiveCap] = useState<number>(80);
  const [bulkAssigneeId, setBulkAssigneeId] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(leads.map(lead => lead._id ? lead._id.toString() : "").filter(Boolean));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (leadId: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, leadId]);
    } else {
      setSelectedIds(prev => prev.filter(id => id !== leadId));
    }
  };

  const handleBulkAssign = () => {
    if (selectedIds.length === 0) return;
    startTransition(async () => {
      const result = await bulkAssignLeadsAction(selectedIds, bulkAssigneeId === "" ? null : bulkAssigneeId);
      if (result.success) {
        setMessage({ text: `Successfully updated ${selectedIds.length} lead(s).`, isError: false });
        setSelectedIds([]);
      } else {
        setMessage({ text: result.error || "Failed to bulk assign leads.", isError: true });
      }
    });
  };

  const handleAutoDistribute = () => {
    let leadsToDistribute = selectedIds;
    if (leadsToDistribute.length === 0) {
      // Auto distribute all unassigned leads currently visible
      leadsToDistribute = leads
        .filter(l => !l.assignedTo?._id)
        .map(l => l._id ? l._id.toString() : "")
        .filter(Boolean);
    }

    if (leadsToDistribute.length === 0) {
      setMessage({ text: "No unassigned leads found in current view to distribute.", isError: true });
      return;
    }

    startTransition(async () => {
      const result = await autoDistributeLeadsAction(leadsToDistribute, activeCap);
      if (result.success) {
        let text = `Auto-distribution complete! Assigned: ${result.assignedCount}.`;
        if (result.unassignedCount > 0) {
          text += ` Remaining Unassigned: ${result.unassignedCount}. Reason: ${result.reason || "All callers at capacity."}`;
        }
        setMessage({
          text,
          isError: result.unassignedCount > 0,
        });
        setSelectedIds([]);
      } else {
        setMessage({ text: result.error || "Failed to auto-distribute leads.", isError: true });
      }
    });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm relative">
      {/* Toast Alert Messaging */}
      {message && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl border shadow-2xl transition-all duration-300 animate-slide-in min-w-[280px] max-w-md ${
            message.isError
              ? "bg-red-50 border-red-200 text-red-800"
              : "bg-emerald-50 border-emerald-200 text-emerald-805"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${message.isError ? "bg-red-500" : "bg-emerald-500"} animate-pulse`} />
            <p className="text-xs font-semibold leading-relaxed">{message.text}</p>
          </div>
          <button 
            onClick={() => setMessage(null)} 
            className="text-slate-400 hover:text-slate-700 font-bold text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Card Header with count */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-805">Leads Registry ({leads.length})</h2>
        <span className="text-xs text-slate-400 font-medium font-mono">Real-time DB query</span>
      </div>

      {/* Bulk Allocation Controls Panel */}
      <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col md:flex-row gap-4 items-center justify-between text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-semibold text-slate-705">
            Selected Leads: <span className="bg-indigo-50 text-indigo-705 px-2 py-0.5 rounded border border-indigo-200 font-mono font-bold">{selectedIds.length}</span>
          </span>
          <button
            onClick={() => setSelectedIds([])}
            disabled={selectedIds.length === 0 || isPending}
            className="text-indigo-600 hover:underline hover:text-indigo-800 font-semibold disabled:opacity-50 disabled:no-underline cursor-pointer"
          >
            Clear Selection
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-end">
          {/* Active Capacity Cap */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-505">Active Cap:</span>
            <input
              type="number"
              value={activeCap}
              min={1}
              disabled={isPending}
              onChange={(e) => setActiveCap(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 bg-white border border-slate-200 rounded px-2.5 py-1 font-bold text-slate-800 text-center focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Caller assignment selector */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-505">Assign to:</span>
            <select
              value={bulkAssigneeId}
              disabled={isPending}
              onChange={(e) => setBulkAssigneeId(e.target.value)}
              className="bg-white border border-slate-200 rounded px-2 py-1.5 focus:outline-none focus:border-indigo-550 max-w-[200px] cursor-pointer"
            >
              <option value="">Unassigned / Remove</option>
              {eligibleUsers.map((user) => {
                const isCaller = user.role === "CALLER";
                const isFull = isCaller && user.activeCount >= activeCap;
                return (
                  <option key={user._id} value={user._id} disabled={isFull}>
                    {user.name} ({user.activeCount}/{isCaller ? activeCap : "∞"}{isFull ? " FULL" : ""})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleBulkAssign}
              disabled={isPending || selectedIds.length === 0}
              className="flex-1 sm:flex-initial px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-lg font-bold shadow-sm transition-all cursor-pointer active:scale-[0.98]"
            >
              {isPending ? "Assigning..." : "Assign Selected"}
            </button>
            <button
              onClick={handleAutoDistribute}
              disabled={isPending}
              className="flex-1 sm:flex-initial px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-lg font-bold shadow-sm transition-all cursor-pointer active:scale-[0.98]"
              title={selectedIds.length === 0 ? "Distribute ALL unassigned leads currently shown in the list" : "Distribute only the selected unassigned leads"}
            >
              {isPending ? "Distributing..." : selectedIds.length === 0 ? "Auto Distribute All" : "Auto Distribute"}
            </button>
          </div>
        </div>
      </div>

      {leads.length === 0 ? (
        /* Empty State */
        <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 border border-slate-200">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5a2 2 0 012-2h2a2 2 0 002-2V7a2 2 0 012-2h4a2 2 0 012 2v2a2 2 0 002 2h2a2 2 0 012 2z" />
            </svg>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-750">No leads found</p>
            <p className="text-xs text-slate-500 max-w-sm">
              Try adjusting your search criteria or removing active filters.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Leads Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === leads.length && leads.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-4">Name</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4">Source</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Assigned To</th>
                  <th className="px-6 py-4">Created Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 text-sm text-slate-700">
                {leads.map((lead) => {
                  const formattedDate = lead.createdAt
                    ? new Date(lead.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "N/A";

                  const leadId = lead._id ? lead._id.toString() : "";
                  const isChecked = selectedIds.includes(leadId);

                  return (
                    <tr key={leadId || Math.random().toString()} className={`hover:bg-slate-50 transition-colors ${isChecked ? "bg-indigo-50/20" : ""}`}>
                      <td className="px-6 py-4">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleSelectOne(leadId, e.target.checked)}
                          className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>
                      {/* Name (Clickable trigger for LeadDetailsModal) */}
                      <td className="px-4 py-4">
                        <button
                          onClick={() => {
                            setSelectedLeadId(leadId);
                            setSelectedLead(lead as unknown as ILead);
                          }}
                          className="font-semibold text-slate-900 hover:text-purple-600 hover:underline text-left transition-colors cursor-pointer"
                        >
                          {lead.name}
                        </button>
                      </td>
                      <td className="px-6 py-4 font-mono text-slate-605">
                        <div className="flex items-center gap-2">
                          <span>{lead.phone}</span>
                          <a
                            href={getWhatsAppUrl(lead.phone, lead.country)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-1.5 py-0.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded text-[10px] font-bold transition-all active:scale-[0.97]"
                          >
                            WhatsApp
                          </a>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-slate-800 font-medium">
                            {lead.sourceType || "DIRECT"}
                          </span>
                          {lead.sourceName && (
                            <span className="text-xs text-slate-400">
                              {lead.sourceName}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusStyles(lead.status)}`}>
                          {LEAD_STATUS_LABELS[lead.status] || lead.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <AssigneeSelect
                          leadId={leadId}
                          currentAssigneeId={lead.assignedTo?._id?.toString() || ""}
                          eligibleUsers={eligibleUsers}
                          activeCap={activeCap}
                        />
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400 font-medium">{formattedDate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Leads Card Layout */}
          <div className="md:hidden divide-y divide-slate-100">
            {leads.map((lead) => {
              const formattedDate = lead.createdAt
                ? new Date(lead.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "N/A";

              const leadId = lead._id ? lead._id.toString() : "";
              const isChecked = selectedIds.includes(leadId);

              return (
                <div key={leadId || Math.random().toString()} className={`p-4 space-y-3.5 ${isChecked ? "bg-indigo-50/10" : ""}`}>
                  <div className="flex justify-between items-start gap-2.5">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => handleSelectOne(leadId, e.target.checked)}
                        className="w-4.5 h-4.5 mt-0.5 text-indigo-600 border-slate-350 rounded focus:ring-indigo-500 cursor-pointer"
                      />
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
                    </div>
                    {/* Status */}
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${getStatusStyles(lead.status)}`}>
                      {LEAD_STATUS_LABELS[lead.status] || lead.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs pl-7.5">
                    <div>
                      <span className="text-slate-450 block mb-0.5 font-medium">Phone</span>
                      <div className="flex items-center gap-2">
                        <a href={`tel:${lead.phone}`} className="font-mono text-slate-800 hover:text-purple-655 font-semibold flex items-center gap-1">
                          <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                          </svg>
                          {lead.phone}
                        </a>
                        <a
                          href={getWhatsAppUrl(lead.phone, lead.country)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center px-1.5 py-0.2 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded text-[9px] font-extrabold transition-all active:scale-[0.97]"
                        >
                          WhatsApp
                        </a>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-455 block mb-0.5 font-medium">Source</span>
                      <span className="font-semibold text-slate-850 truncate block">
                        {lead.sourceType || "DIRECT"} {lead.sourceName && `(${lead.sourceName})`}
                      </span>
                    </div>
                  </div>

                  {/* Assignment Control */}
                  <div className="pt-2.5 border-t border-slate-100/70 space-y-1.5 pl-7.5">
                    <span className="text-[10px] uppercase font-bold text-slate-455 tracking-wider block">Assigned Caller</span>
                    <AssigneeSelect
                      leadId={leadId}
                      currentAssigneeId={lead.assignedTo?._id?.toString() || ""}
                      eligibleUsers={eligibleUsers}
                      activeCap={activeCap}
                    />
                  </div>

                  <div className="text-[10px] text-slate-400 font-mono flex justify-between items-center pt-1 border-t border-slate-50 pl-7.5">
                    <span>Created Date</span>
                    <span>{formattedDate}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

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

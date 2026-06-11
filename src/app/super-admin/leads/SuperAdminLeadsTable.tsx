"use client";

import React, { useState } from "react";
import { ILead } from "@/types/lead";
import AssigneeSelect from "./AssigneeSelect";
import LeadDetailsModal from "@/components/leads/LeadDetailsModal";

interface PopulatedLead extends Omit<ILead, "assignedTo"> {
  assignedTo?: {
    _id: string;
    name: string;
  } | null;
}

interface SuperAdminLeadsTableProps {
  leads: PopulatedLead[];
  eligibleUsers: { _id: string; name: string; role: string }[];
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
      return "bg-amber-50 text-amber-800 border-amber-200";
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

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      {/* Card Header with count */}
      <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800">Leads ({leads.length})</h2>
        <span className="text-xs text-slate-400 font-medium font-mono">Real-time DB query</span>
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
        /* Leads Table */
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <th className="px-6 py-4">Name</th>
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

                return (
                  <tr key={leadId || Math.random().toString()} className="hover:bg-slate-50 transition-colors">
                    {/* Name (Clickable trigger for LeadDetailsModal) */}
                    <td className="px-6 py-4">
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
                    <td className="px-6 py-4 font-mono text-slate-600">{lead.phone}</td>
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
                        {lead.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <AssigneeSelect
                        leadId={leadId}
                        currentAssigneeId={lead.assignedTo?._id?.toString() || ""}
                        eligibleUsers={eligibleUsers}
                      />
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400 font-medium">{formattedDate}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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

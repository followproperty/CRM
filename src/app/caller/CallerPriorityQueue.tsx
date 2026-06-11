"use client";

import React, { useState } from "react";
import { LeadStatus, FollowUpStatus, ILead } from "@/types/lead";
import LeadDetailsModal from "@/components/leads/LeadDetailsModal";

interface CallerPriorityQueueProps {
  leads: ILead[];
}

export default function CallerPriorityQueue({ leads }: CallerPriorityQueueProps) {
  // LeadDetailsModal state
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<ILead | null>(null);

  // 1. Calculate Stats
  const totalAssigned = leads.length;
  const completedCalls = leads.filter((l: ILead) => l.status !== LeadStatus.NEW).length;
  const progressPct = totalAssigned > 0 ? Math.round((completedCalls / totalAssigned) * 100) : 0;

  const pendingCallbacks = leads.filter(
    (l: ILead) => l.followUp && l.followUp.status === FollowUpStatus.PENDING && l.followUp.date
  ).length;

  const interestedCount = leads.filter((l: ILead) => l.status === LeadStatus.INTERESTED).length;

  // 2. Build Priority Queue
  const priorityQueue = leads
    .filter(
      (l: ILead) =>
        l.status !== LeadStatus.CUSTOMER &&
        l.status !== LeadStatus.NOT_INTERESTED &&
        l.status !== LeadStatus.DND &&
        l.status !== LeadStatus.ADMIN_FOLLOWUP &&
        l.status !== LeadStatus.WHATSAPP_SHARED
    )
    .map((lead: ILead) => {
      let label = "General";
      if (
        lead.status === LeadStatus.FOLLOW_UP ||
        (lead.followUp && lead.followUp.status === FollowUpStatus.PENDING)
      ) {
        label = "Callback";
      } else if (lead.status === LeadStatus.NEW) {
        label = "New Lead";
      } else if (lead.status === LeadStatus.INTERESTED) {
        label = "Warm";
      }
      return {
        id: lead._id ? lead._id.toString() : "",
        name: lead.name,
        phone: lead.phone,
        status: lead.status,
        source: lead.source,
        lastNote: lead.followUp?.notes || `Source: ${lead.source}`,
        label,
        leadObject: lead,
      };
    });

  // 3. Build Upcoming Reminders
  const reminders = leads
    .filter((l: ILead) => l.followUp && l.followUp.status === FollowUpStatus.PENDING && l.followUp.date)
    .sort((a: ILead, b: ILead) => {
      const dateA = a.followUp?.date ? new Date(a.followUp.date).getTime() : 0;
      const dateB = b.followUp?.date ? new Date(b.followUp.date).getTime() : 0;
      return dateA - dateB;
    })
    .slice(0, 5)
    .map((lead: ILead) => {
      const dateObj = new Date(lead.followUp!.date!);
      const timeString = dateObj.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const dateString = dateObj.toLocaleDateString([], { month: "short", day: "numeric" });
      return {
        id: lead._id ? lead._id.toString() : "",
        time: `${dateString} at ${timeString}`,
        text: `Callback ${lead.name} (${lead.phone})`,
      };
    });

  return (
    <div className="space-y-6">
      {/* Grid Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Calls Completed */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Queue Progress</span>
            <span className="text-emerald-600 bg-emerald-50 p-1.5 rounded-lg border border-emerald-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{completedCalls} / {totalAssigned}</p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mt-3">
            <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">{progressPct}% of assigned leads contacted</p>
        </div>

        {/* Pending Followups */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scheduled Callback</span>
            <span className="text-amber-600 bg-amber-50 p-1.5 rounded-lg border border-amber-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{pendingCallbacks} Pending</p>
          <div className="flex items-center gap-1.5 mt-2.5">
            {pendingCallbacks > 0 ? (
              <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 animate-pulse font-semibold">
                ACTION REQUIRED
              </span>
            ) : (
              <span className="text-xs text-slate-400">No pending follow-ups</span>
            )}
          </div>
        </div>

        {/* Interested Count */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 hover:shadow-md transition-all duration-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Interested Clients</span>
            <span className="text-indigo-600 bg-indigo-50 p-1.5 rounded-lg border border-indigo-100">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-800 mt-2">{interestedCount}</p>
          <div className="flex items-center gap-1 mt-2.5 text-xs text-slate-400">
            <span>Leads marked as Interested</span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Next Leads to Call */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 lg:col-span-2 space-y-4 shadow-sm">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-slate-800">Call Priority Queue</h2>
            <span className="text-xs text-slate-450 font-mono">Assigned Allocation</span>
          </div>

          <div className="space-y-3">
            {priorityQueue.length === 0 ? (
              <div className="p-8 rounded-xl bg-slate-50 border border-slate-200 border-dashed text-center">
                <p className="text-sm text-slate-500">No active leads assigned to you in the queue.</p>
                <p className="text-xs text-slate-400 mt-1">Once administrator assigns leads, they will appear here dynamically.</p>
              </div>
            ) : (
              priorityQueue.slice(0, 10).map((lead) => (
                <div key={lead.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row justify-between sm:items-center gap-4 hover:shadow-xs hover:border-slate-300 transition-all animate-fade-in">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-800 text-sm">{lead.name}</h3>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        lead.label === "Callback" ? "bg-amber-50 text-amber-700 border border-amber-200" :
                        lead.label === "Warm" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                        lead.label === "New Lead" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" :
                        "bg-blue-50 text-blue-700 border border-blue-200"
                      }`}>
                        {lead.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">Phone: {lead.phone}</p>
                    <p className="text-xs text-slate-450 italic truncate max-w-md" title={lead.lastNote}>{lead.lastNote}</p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setSelectedLeadId(lead.id);
                        setSelectedLead(lead.leadObject);
                      }}
                      className="flex-1 sm:flex-initial text-xs px-3 py-2 bg-white border border-slate-250 text-slate-700 hover:bg-slate-50 hover:text-slate-900 rounded-lg transition-all font-medium cursor-pointer"
                    >
                      Profile
                    </button>
                    <a
                      href={`tel:${lead.phone}`}
                      className="flex-1 sm:flex-initial text-xs px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors font-semibold shadow-sm flex items-center justify-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Call
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Callback reminder list */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 lg:col-span-1 space-y-4 shadow-sm">
          <h2 className="text-base font-bold text-slate-800">Reminders</h2>
          <div className="space-y-3">
            {reminders.length === 0 ? (
              <div className="text-slate-400 italic py-4 text-center text-xs">No pending reminders.</div>
            ) : (
              reminders.map((reminder) => (
                <div key={reminder.id} className="flex gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <span className="font-mono text-emerald-700 font-bold shrink-0">{reminder.time}</span>
                  <span className="text-slate-655">{reminder.text}</span>
                </div>
              ))
            )}
          </div>
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

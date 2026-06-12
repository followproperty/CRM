"use client";

import React, { useState, useTransition } from "react";
import { LeadStatus, FollowUpStatus, ILead } from "@/types/lead";
import { updateLeadStatusAction, requestWhatsAppFollowupAction, scheduleSiteVisitAction } from "@/app/actions/leads";
import { UserRole } from "@/types/user";
import LeadDetailsModal from "@/components/leads/LeadDetailsModal";

interface CallerPriorityQueueProps {
  leads: ILead[];
}

export default function CallerPriorityQueue({ leads }: CallerPriorityQueueProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  // Modals & Popups State
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<ILead | null>(null);

  // Outcome Selection State
  const [activeOutcomeLead, setActiveOutcomeLead] = useState<ILead | null>(null);
  const [outcomeNote, setOutcomeNote] = useState("");

  // Callback Scheduling State
  const [callbackLead, setCallbackLead] = useState<ILead | null>(null);
  const [callbackDate, setCallbackDate] = useState("");
  const [callbackNote, setCallbackNote] = useState("");

  // Site Visit Scheduling State
  const [siteVisitLead, setSiteVisitLead] = useState<ILead | null>(null);
  const [siteVisitDate, setSiteVisitDate] = useState("");
  const [siteVisitNotes, setSiteVisitNotes] = useState("");

  const showMessage = (text: string, isError = false) => {
    setMessage({ text, isError });
    setTimeout(() => setMessage(null), 4000);
  };

  // Stats
  const totalAssigned = leads.length;
  const completedCalls = leads.filter((l: ILead) => l.status !== LeadStatus.NEW).length;
  const progressPct = totalAssigned > 0 ? Math.round((completedCalls / totalAssigned) * 100) : 0;
  
  const pendingCallbacks = leads.filter(
    (l: ILead) => l.followUp && l.followUp.status === FollowUpStatus.PENDING && l.followUp.date
  ).length;

  const interestedCount = leads.filter((l: ILead) => l.status === LeadStatus.INTERESTED).length;

  // Build Priority Queue (filtering out terminal and admin statuses)
  const priorityQueue = leads.filter(
    (l: ILead) =>
      l.status !== LeadStatus.CUSTOMER &&
      l.status !== LeadStatus.NOT_INTERESTED &&
      l.status !== LeadStatus.LOST
  );

  // Reminders List
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
        name: lead.name,
        phone: lead.primaryPhone || lead.phone,
        leadObject: lead,
      };
    });

  // Action execution helpers
  const handleQuickStatusUpdate = (lead: ILead, status: LeadStatus) => {
    const leadId = lead._id ? lead._id.toString() : "";
    
    // For Follow Up, bridge to the Callback Modal
    if (status === LeadStatus.FOLLOW_UP) {
      setCallbackLead(lead);
      setCallbackDate("");
      setCallbackNote(outcomeNote);
      setActiveOutcomeLead(null);
      return;
    }

    startTransition(async () => {
      const result = await updateLeadStatusAction(leadId, status, null, outcomeNote);
      if (result.success) {
        showMessage(`Status logged as ${status.replace("_", " ")}.`);
        setActiveOutcomeLead(null);
        setOutcomeNote("");
      } else {
        showMessage(result.error || "Failed to update lead status.", true);
      }
    });
  };

  const handleRequestWhatsApp = (lead: ILead) => {
    const leadId = lead._id ? lead._id.toString() : "";
    startTransition(async () => {
      const result = await requestWhatsAppFollowupAction(leadId);
      if (result.success) {
        showMessage("WhatsApp follow-up requested with Admin.");
        setActiveOutcomeLead(null);
        setOutcomeNote("");
      } else {
        showMessage(result.error || "Failed to request WhatsApp.", true);
      }
    });
  };

  const handleConfirmCallback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!callbackLead || !callbackDate) return;
    
    const leadId = callbackLead._id ? callbackLead._id.toString() : "";
    startTransition(async () => {
      const result = await updateLeadStatusAction(leadId, LeadStatus.FOLLOW_UP, callbackDate, callbackNote);
      if (result.success) {
        showMessage("Follow-up callback scheduled successfully.");
        setCallbackLead(null);
        setCallbackDate("");
        setCallbackNote("");
      } else {
        showMessage(result.error || "Failed to schedule callback.", true);
      }
    });
  };

  const handleConfirmSiteVisit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteVisitLead || !siteVisitDate) return;

    const leadId = siteVisitLead._id ? siteVisitLead._id.toString() : "";
    startTransition(async () => {
      const result = await scheduleSiteVisitAction(leadId, siteVisitDate, siteVisitNotes);
      if (result.success) {
        showMessage("Site visit scheduled successfully.");
        setSiteVisitLead(null);
        setSiteVisitDate("");
        setSiteVisitNotes("");
      } else {
        showMessage(result.error || "Failed to schedule site visit.", true);
      }
    });
  };

  const isHandoffLocked = (status: LeadStatus) => {
    return status === LeadStatus.ADMIN_FOLLOWUP || status === LeadStatus.WHATSAPP_SHARED;
  };

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

      {/* Grid Stats - Focused & Simplified (4 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Assigned */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Leads</span>
          <p className="text-2xl font-black text-slate-800 mt-1">{totalAssigned}</p>
        </div>

        {/* Pending Callbacks */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending Callbacks</span>
          <p className="text-2xl font-black text-slate-800 mt-1">{pendingCallbacks}</p>
        </div>

        {/* Interested Leads */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Interested</span>
          <p className="text-2xl font-black text-slate-800 mt-1">{interestedCount}</p>
        </div>

        {/* Progress */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Queue Progress</span>
            <span className="text-xs font-bold text-emerald-600">{progressPct}%</span>
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority Queue cards list */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-6 lg:col-span-2 space-y-4 shadow-sm">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-800">Priority Queue ({priorityQueue.length})</h2>
            <span className="text-[10px] text-slate-400 font-mono font-bold">CALLING FLOW</span>
          </div>

          <div className="space-y-4">
            {priorityQueue.length === 0 ? (
              <div className="p-8 rounded-xl bg-slate-50 border border-slate-200 border-dashed text-center">
                <p className="text-sm text-slate-500">No active leads assigned to you in the queue.</p>
              </div>
            ) : (
              priorityQueue.slice(0, 15).map((lead) => {
                const leadId = lead._id ? lead._id.toString() : "";
                const isLocked = isHandoffLocked(lead.status);
                const contactNumber = lead.primaryPhone || lead.phone;

                return (
                  <div
                    key={leadId}
                    className={`p-4 rounded-xl border transition-all animate-fade-in ${
                      isLocked
                        ? "bg-slate-50 border-slate-200 opacity-60"
                        : "bg-white border-slate-200 hover:shadow-md hover:border-slate-300"
                    }`}
                  >
                    {/* Card Header: Name & Phone & Status */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        {/* Name triggers Lead Details profile modal */}
                        <button
                          onClick={() => {
                            setSelectedLeadId(leadId);
                            setSelectedLead(lead);
                          }}
                          className="font-bold text-slate-900 hover:text-indigo-650 hover:underline text-left text-base block truncate cursor-pointer"
                        >
                          {lead.name}
                        </button>
                        <a
                          href={`tel:${contactNumber}`}
                          className="text-sm text-slate-550 font-mono font-medium mt-0.5 hover:text-indigo-600 inline-block"
                        >
                          {contactNumber}
                        </a>
                      </div>
                      <span
                        className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          lead.status === LeadStatus.NEW
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : lead.status === LeadStatus.FOLLOW_UP
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : lead.status === LeadStatus.INTERESTED
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-50 text-slate-605 border border-slate-200"
                        }`}
                      >
                        {lead.status.replace("_", " ")}
                      </span>
                    </div>

                    {/* Card Actions Stack */}
                    <div className="mt-4">
                      {isLocked ? (
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-100 p-2.5 rounded-lg border border-slate-200">
                          <span>🔒</span>
                          <div className="flex flex-col">
                            <span>Lead Handed To Admin</span>
                            <span className="text-[10px] text-slate-400 font-medium">Caller actions disabled</span>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          {/* Prominent green CALL button */}
                          <a
                            href={`tel:${contactNumber}`}
                            className="flex items-center justify-center gap-1.5 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm shadow-sm transition-colors active:scale-[0.99] touch-manipulation"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                            Call
                          </a>

                          {/* Log Outcome button */}
                          <button
                            onClick={() => {
                              setActiveOutcomeLead(lead);
                              setOutcomeNote("");
                            }}
                            className="flex items-center justify-center py-3 px-4 border border-slate-250 bg-white hover:bg-slate-50 text-slate-700 rounded-lg font-bold text-sm transition-all active:scale-[0.99] cursor-pointer touch-manipulation"
                          >
                            Log Outcome
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Reminders / Callbacks Side Panel */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 md:p-6 lg:col-span-1 space-y-4 shadow-sm">
          <h2 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-3">Upcoming Callbacks</h2>
          <div className="space-y-3">
            {reminders.length === 0 ? (
              <p className="text-slate-400 italic text-center text-xs py-4">No pending reminders.</p>
            ) : (
              reminders.map((reminder) => (
                <div key={reminder.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs hover:border-slate-350 transition-all flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <span className="font-mono text-indigo-650 font-bold">{reminder.time}</span>
                    <a href={`tel:${reminder.phone}`} className="p-1 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </a>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedLeadId(reminder.id);
                      setSelectedLead(reminder.leadObject);
                    }}
                    className="text-slate-705 font-bold hover:underline hover:text-indigo-600 text-left cursor-pointer"
                  >
                    Callback: {reminder.name}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Outcome Selection Modal/Drawer */}
      {activeOutcomeLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-600/40 backdrop-blur-xs animate-fade-in" onClick={() => setActiveOutcomeLead(null)}>
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
              <div>
                <h3 className="text-base font-bold text-slate-800">Log Outcome</h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">Lead: {activeOutcomeLead.name}</p>
              </div>
              <button onClick={() => setActiveOutcomeLead(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 cursor-pointer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Optional Outcome Note input */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="priority-outcome-note" className="text-[10px] font-bold text-slate-550 uppercase tracking-wider">Remark / Note (Optional)</label>
                <input
                  id="priority-outcome-note"
                  type="text"
                  placeholder="e.g. Discussed size preferences, call later..."
                  value={outcomeNote}
                  onChange={(e) => setOutcomeNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500/50 focus:bg-white rounded-lg px-3 py-2 text-sm text-slate-850 focus:outline-none transition-all placeholder-slate-400"
                />
              </div>

              {/* Large Touch-friendly grid outcomes buttons */}
              <div className="grid grid-cols-1 gap-2">
                <button
                  onClick={() => handleQuickStatusUpdate(activeOutcomeLead, LeadStatus.INTERESTED)}
                  disabled={isPending}
                  className="flex items-center gap-3 w-full py-3 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-bold text-sm border border-emerald-200 cursor-pointer transition-all active:scale-[0.99] touch-manipulation"
                >
                  <span className="text-base">🟢</span>
                  Interested
                </button>

                {/* Show Site Visit Scheduling button if status is INTERESTED */}
                {activeOutcomeLead.status === LeadStatus.INTERESTED && (
                  <button
                    onClick={() => {
                      setSiteVisitLead(activeOutcomeLead);
                      setSiteVisitDate("");
                      setSiteVisitNotes(outcomeNote);
                      setActiveOutcomeLead(null);
                    }}
                    disabled={isPending}
                    className="flex items-center gap-3 w-full py-3 px-4 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-xl font-bold text-sm border border-purple-200 cursor-pointer transition-all active:scale-[0.99] touch-manipulation"
                  >
                    <span className="text-base">🏠</span>
                    Schedule Site Visit
                  </button>
                )}

                <button
                  onClick={() => handleRequestWhatsApp(activeOutcomeLead)}
                  disabled={isPending}
                  className="flex items-center gap-3 w-full py-3 px-4 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl font-bold text-sm border border-teal-200 cursor-pointer transition-all active:scale-[0.99] touch-manipulation"
                >
                  <span className="text-base">💬</span>
                  Request WhatsApp Follow-up
                </button>

                <button
                  onClick={() => handleQuickStatusUpdate(activeOutcomeLead, LeadStatus.FOLLOW_UP)}
                  disabled={isPending}
                  className="flex items-center gap-3 w-full py-3 px-4 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl font-bold text-sm border border-amber-200 cursor-pointer transition-all active:scale-[0.99] touch-manipulation"
                >
                  <span className="text-base">📅</span>
                  Call Later (Schedule Callback)
                </button>

                <button
                  onClick={() => handleQuickStatusUpdate(activeOutcomeLead, LeadStatus.NOT_INTERESTED)}
                  disabled={isPending}
                  className="flex items-center gap-3 w-full py-3 px-4 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-xl font-bold text-sm border border-rose-200 cursor-pointer transition-all active:scale-[0.99] touch-manipulation"
                >
                  <span className="text-base">🔴</span>
                  Not Interested
                </button>

                <button
                  onClick={() => handleQuickStatusUpdate(activeOutcomeLead, LeadStatus.WRONG_NUMBER)}
                  disabled={isPending}
                  className="flex items-center gap-3 w-full py-3 px-4 bg-orange-50 hover:bg-orange-100 text-orange-855 rounded-xl font-bold text-sm border border-orange-200 cursor-pointer transition-all active:scale-[0.99] touch-manipulation"
                >
                  <span className="text-base">⚠️</span>
                  Wrong Number
                </button>

                <button
                  onClick={() => handleQuickStatusUpdate(activeOutcomeLead, LeadStatus.DND)}
                  disabled={isPending}
                  className="flex items-center gap-3 w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-xl font-bold text-sm border border-slate-200 cursor-pointer transition-all active:scale-[0.99] touch-manipulation"
                >
                  <span className="text-base">🚫</span>
                  DND (Do Not Disturb)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Callback Scheduling Modal (Call Later Dialog) */}
      {callbackLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-600/40 backdrop-blur-xs animate-fade-in" onClick={() => setCallbackLead(null)}>
          <form
            onSubmit={handleConfirmCallback}
            className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
              <div>
                <h3 className="text-base font-bold text-slate-800">Schedule Callback</h3>
                <p className="text-xs text-slate-505 font-semibold mt-0.5">Lead: {callbackLead.name}</p>
              </div>
              <button type="button" onClick={() => setCallbackLead(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 cursor-pointer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Date selection */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="priority-callback-datetime" className="text-[10px] font-bold text-slate-550 uppercase tracking-wider">Callback Date & Time</label>
                <input
                  id="priority-callback-datetime"
                  type="datetime-local"
                  required
                  value={callbackDate}
                  onChange={(e) => setCallbackDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500/50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none transition-all touch-manipulation"
                />
              </div>

              {/* Note selection */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="priority-callback-note" className="text-[10px] font-bold text-slate-550 uppercase tracking-wider">Remarks / Notes</label>
                <textarea
                  id="priority-callback-note"
                  rows={3}
                  placeholder="Record call discussion outcome..."
                  value={callbackNote}
                  onChange={(e) => setCallbackNote(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500/50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none transition-all placeholder-slate-400 resize-none"
                />
              </div>

              {/* Modal footer actions */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCallbackLead(null)}
                  className="py-3 px-4 border border-slate-200 bg-white hover:bg-slate-50 text-slate-705 rounded-lg font-bold text-sm cursor-pointer transition-all active:scale-[0.99]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !callbackDate}
                  className="py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg font-bold text-sm shadow-sm cursor-pointer transition-all active:scale-[0.99]"
                >
                  {isPending ? "Scheduling..." : "Schedule"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Site Visit Scheduling Modal */}
      {siteVisitLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-600/40 backdrop-blur-xs animate-fade-in" onClick={() => setSiteVisitLead(null)}>
          <form
            onSubmit={handleConfirmSiteVisit}
            className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
              <div>
                <h3 className="text-base font-bold text-slate-800">Schedule Site Visit</h3>
                <p className="text-xs text-slate-505 font-semibold mt-0.5">Lead: {siteVisitLead.name}</p>
              </div>
              <button type="button" onClick={() => setSiteVisitLead(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 cursor-pointer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="priority-sitevisit-date" className="text-[10px] font-bold text-slate-550 uppercase tracking-wider">Visit Date & Time</label>
                <input
                  id="priority-sitevisit-date"
                  type="datetime-local"
                  required
                  value={siteVisitDate}
                  onChange={(e) => setSiteVisitDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-purple-500/50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none transition-all touch-manipulation"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="priority-sitevisit-notes" className="text-[10px] font-bold text-slate-550 uppercase tracking-wider">Notes / Remarks</label>
                <textarea
                  id="priority-sitevisit-notes"
                  rows={3}
                  placeholder="Record site visit details..."
                  value={siteVisitNotes}
                  onChange={(e) => setSiteVisitNotes(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-purple-500/50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none transition-all placeholder-slate-400 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSiteVisitLead(null)}
                  className="py-3 px-4 border border-slate-200 bg-white hover:bg-slate-50 text-slate-705 rounded-lg font-bold text-sm cursor-pointer transition-all active:scale-[0.99]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !siteVisitDate}
                  className="py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg font-bold text-sm shadow-sm cursor-pointer transition-all active:scale-[0.99]"
                >
                  {isPending ? "Scheduling..." : "Schedule Visit"}
                </button>
              </div>
            </div>
          </form>
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
          role={UserRole.CALLER}
        />
      )}
    </div>
  );
}

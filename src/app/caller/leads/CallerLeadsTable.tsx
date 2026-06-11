"use client";

import React, { useState, useTransition } from "react";
import { updateLeadStatusAction, scheduleSiteVisitAction, requestWhatsAppFollowupAction } from "@/app/actions/leads";
import { LeadStatus, ILead } from "@/types/lead";
import LeadDetailsModal from "@/components/leads/LeadDetailsModal";

interface CallerLeadsTableProps {
  leads: ILead[];
}

function getStatusStyles(status: LeadStatus) {
  switch (status) {
    case LeadStatus.NEW:
      return "bg-blue-50 text-blue-700 border-blue-200";
    case LeadStatus.CALLED:
      return "bg-slate-50 text-slate-700 border-slate-200";
    case LeadStatus.INTERESTED:
      return "bg-emerald-50 text-emerald-700 border-emerald-250";
    case LeadStatus.WHATSAPP_SHARED:
      return "bg-teal-50 text-teal-700 border-teal-200";
    case LeadStatus.FOLLOW_UP:
      return "bg-indigo-50 text-indigo-755 border-indigo-200";
    case LeadStatus.SITE_VISIT:
      return "bg-purple-50 text-purple-705 border-purple-200";
    case LeadStatus.CUSTOMER:
      return "bg-amber-50 text-amber-755 border-amber-200";
    case LeadStatus.NOT_INTERESTED:
      return "bg-rose-50 text-rose-700 border-rose-200";
    case LeadStatus.DND:
      return "bg-red-50 text-red-700 border-red-200";
    case LeadStatus.WRONG_NUMBER:
      return "bg-orange-50 text-orange-705 border-orange-200";
    case LeadStatus.ADMIN_FOLLOWUP:
      return "bg-cyan-50 text-cyan-705 border-cyan-200";
    default:
      return "bg-slate-55 text-slate-600 border-slate-200";
  }
}

export default function CallerLeadsTable({ leads }: CallerLeadsTableProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  
  // Track scheduling callback state
  const [schedulingLeadId, setSchedulingLeadId] = useState<string | null>(null);
  const [followUpDate, setFollowUpDate] = useState<string>("");
  const [followUpNote, setFollowUpNote] = useState<string>("");

  // Track scheduling site visit state
  const [siteVisitLeadId, setSiteVisitLeadId] = useState<string | null>(null);
  const [siteVisitDate, setSiteVisitDate] = useState<string>("");
  const [siteVisitNotes, setSiteVisitNotes] = useState<string>("");

  // Track status update confirmation state (prompts for note/remark)
  const [confirmStatusUpdate, setConfirmStatusUpdate] = useState<{ leadId: string; status: LeadStatus } | null>(null);
  const [statusNote, setStatusNote] = useState<string>("");

  // LeadDetailsModal state
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<ILead | null>(null);

  const showMessage = (text: string, isError = false) => {
    setMessage({ text, isError });
    setTimeout(() => {
      setMessage(null);
    }, 5000);
  };

  const handleRequestWhatsAppFollowup = (leadId: string) => {
    startTransition(async () => {
      const result = await requestWhatsAppFollowupAction(leadId);
      if (result.success) {
        showMessage("WhatsApp follow-up successfully requested with Admin.");
      } else {
        showMessage(result.error || "Failed to request WhatsApp follow-up.", true);
      }
    });
  };

  const handleStatusUpdate = (leadId: string, status: LeadStatus) => {
    // If scheduling followup, open selector
    if (status === LeadStatus.FOLLOW_UP) {
      setSchedulingLeadId(leadId);
      setFollowUpDate("");
      setFollowUpNote("");
      setSiteVisitLeadId(null);
      setConfirmStatusUpdate(null);
      return;
    }

    // Otherwise, show the note/remark confirmation prompt first
    setConfirmStatusUpdate({ leadId, status });
    setStatusNote("");
    setSchedulingLeadId(null);
    setSiteVisitLeadId(null);
  };

  const handleConfirmStatusUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmStatusUpdate) return;

    const { leadId, status } = confirmStatusUpdate;
    startTransition(async () => {
      const result = await updateLeadStatusAction(leadId, status, null, statusNote);
      if (result.success) {
        showMessage(`Lead status updated to ${status.replace("_", " ")} successfully.`);
        setConfirmStatusUpdate(null);
        setStatusNote("");
      } else {
        showMessage(result.error || "Failed to update lead status.", true);
      }
    });
  };

  const handleConfirmFollowUp = (e: React.FormEvent, leadId: string) => {
    e.preventDefault();
    if (!followUpDate) return;

    startTransition(async () => {
      const result = await updateLeadStatusAction(leadId, LeadStatus.FOLLOW_UP, followUpDate, followUpNote);
      if (result.success) {
        showMessage("Follow-up callback scheduled successfully.");
        setSchedulingLeadId(null);
        setFollowUpDate("");
        setFollowUpNote("");
      } else {
        showMessage(result.error || "Failed to schedule follow-up.", true);
      }
    });
  };

  const handleConfirmSiteVisit = (e: React.FormEvent, leadId: string) => {
    e.preventDefault();
    if (!siteVisitDate) return;

    startTransition(async () => {
      const result = await scheduleSiteVisitAction(leadId, siteVisitDate, siteVisitNotes);
      if (result.success) {
        showMessage("Site visit scheduled successfully.");
        setSiteVisitLeadId(null);
        setSiteVisitDate("");
        setSiteVisitNotes("");
      } else {
        showMessage(result.error || "Failed to schedule site visit.", true);
      }
    });
  };

  return (
    <div className="space-y-4">
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

      {/* Leads Table Container */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider bg-slate-50/70">
                <th className="px-6 py-4">Lead Name</th>
                <th className="px-6 py-4">Contact Detail</th>
                <th className="px-6 py-4">Source</th>
                <th className="px-6 py-4">Current Status</th>
                <th className="px-6 py-4">Status Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-105 text-sm">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                    No leads currently assigned to you.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const leadId = lead._id ? lead._id.toString() : "";
                  return (
                    <tr key={leadId} className="hover:bg-slate-50/50 transition-colors">
                      {/* Name (Clickable trigger for LeadDetailsModal) */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-start">
                          <button
                            onClick={() => {
                              setSelectedLeadId(leadId);
                              setSelectedLead(lead);
                            }}
                            className="font-semibold text-slate-800 hover:text-purple-650 hover:underline text-left transition-colors cursor-pointer"
                          >
                            {lead.name}
                          </button>
                          {lead.dnd && (
                            <span className="mt-1 inline-flex items-center text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-rose-50 border border-rose-200 text-rose-700 uppercase tracking-widest">
                              DND Set
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Contact */}
                      <td className="px-6 py-4 text-slate-600 font-mono">
                        <a href={`tel:${lead.phone}`} className="hover:text-indigo-600 transition-colors">
                          {lead.phone}
                        </a>
                      </td>
                      {/* Source */}
                      <td className="px-6 py-4 text-slate-500">{lead.source}</td>
                      {/* Current Status */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold ${getStatusStyles(lead.status)}`}>
                            {lead.status.replace("_", " ")}
                          </span>
                          {lead.status === LeadStatus.FOLLOW_UP && lead.nextFollowUp && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              Next: {new Date(lead.nextFollowUp).toLocaleString()}
                            </span>
                          )}
                          {lead.status === LeadStatus.SITE_VISIT && lead.siteVisitDate && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              Visit: {new Date(lead.siteVisitDate).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </td>
                      {/* Actions */}
                      <td className="px-6 py-4">
                        {lead.status === LeadStatus.ADMIN_FOLLOWUP || lead.status === LeadStatus.WHATSAPP_SHARED ? (
                          <div className="flex flex-col gap-1 items-start">
                            <span className="text-xs font-semibold text-cyan-600 uppercase tracking-wider flex items-center gap-1">
                              ✔ Admin Follow-up Active
                            </span>
                            <span className="text-[10px] text-slate-400">Actions Locked (Managed by Admin)</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {/* Action 1: Interested */}
                              <button
                                onClick={() => handleStatusUpdate(leadId, LeadStatus.INTERESTED)}
                                disabled={isPending || lead.status === LeadStatus.INTERESTED}
                                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                              >
                                Interested
                              </button>

                              {/* Schedule Site Visit Action */}
                              {lead.status === LeadStatus.INTERESTED && (
                                <button
                                  onClick={() => {
                                    setSiteVisitLeadId(leadId);
                                    setSiteVisitDate("");
                                    setSiteVisitNotes("");
                                    setSchedulingLeadId(null);
                                    setConfirmStatusUpdate(null);
                                  }}
                                  disabled={isPending || siteVisitLeadId === leadId}
                                  className="text-xs px-2.5 py-1.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100/70 text-purple-755 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                                >
                                  Schedule Site Visit
                                </button>
                              )}

                              {/* Request WhatsApp Follow-up Action */}
                              <button
                                onClick={() => handleRequestWhatsAppFollowup(leadId)}
                                disabled={isPending}
                                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                              >
                                Request WhatsApp
                              </button>

                              {/* Action 2: Not Interested */}
                              <button
                                onClick={() => handleStatusUpdate(leadId, LeadStatus.NOT_INTERESTED)}
                                disabled={isPending || lead.status === LeadStatus.NOT_INTERESTED}
                                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                              >
                                Not Interested
                              </button>

                              {/* Action 3: Call Later */}
                              <button
                                onClick={() => handleStatusUpdate(leadId, LeadStatus.FOLLOW_UP)}
                                disabled={isPending || schedulingLeadId === leadId}
                                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                              >
                                Call Later
                              </button>

                              {/* Action 4: Wrong Number */}
                              <button
                                onClick={() => handleStatusUpdate(leadId, LeadStatus.WRONG_NUMBER)}
                                disabled={isPending || lead.status === LeadStatus.WRONG_NUMBER}
                                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                              >
                                Wrong Number
                              </button>

                              {/* Action 5: DND */}
                              <button
                                onClick={() => handleStatusUpdate(leadId, LeadStatus.DND)}
                                disabled={isPending || lead.status === LeadStatus.DND}
                                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                              >
                                DND
                              </button>
                            </div>

                          {/* Inline Status Update Note Prompt */}
                          {confirmStatusUpdate && confirmStatusUpdate.leadId === leadId && (
                            <form
                              onSubmit={(e) => handleConfirmStatusUpdate(e)}
                              className="flex flex-col gap-2.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200 mt-2 animate-fade-in"
                            >
                              <div className="flex flex-col gap-1.5">
                                <label htmlFor={`status-note-${leadId}`} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                  Add Remark / Note for status: <span className="text-slate-800 font-bold">{confirmStatusUpdate.status.replace("_", " ")}</span>
                                </label>
                                <input
                                  id={`status-note-${leadId}`}
                                  type="text"
                                  placeholder="e.g. Interested in 3BHK, Family discussion pending..."
                                  value={statusNote}
                                  onChange={(e) => setStatusNote(e.target.value)}
                                  className="w-full bg-white border border-slate-200 focus:border-indigo-500/50 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
                                />
                              </div>
                              <div className="flex gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmStatusUpdate(null);
                                    setStatusNote("");
                                  }}
                                  className="px-3 py-1.5 text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  disabled={isPending}
                                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
                                >
                                  {isPending ? "Confirming..." : "Confirm Status"}
                                </button>
                              </div>
                            </form>
                          )}

                          {/* Inline Timepicker Scheduling for Follow Up */}
                          {schedulingLeadId === leadId && (
                            <form
                              onSubmit={(e) => handleConfirmFollowUp(e, leadId)}
                              className="flex flex-col gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2 animate-fade-in"
                            >
                              <h4 className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                                Call Later Callback
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                  <label htmlFor={`callback-date-${leadId}`} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    Callback Date & Time
                                  </label>
                                  <input
                                    id={`callback-date-${leadId}`}
                                    type="datetime-local"
                                    required
                                    value={followUpDate}
                                    onChange={(e) => setFollowUpDate(e.target.value)}
                                    className="w-full bg-white border border-slate-205 focus:border-indigo-500/50 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none transition-all"
                                  />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                  <label htmlFor={`callback-remark-${leadId}`} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    Remark / Note (Optional)
                                  </label>
                                  <input
                                    id={`callback-remark-${leadId}`}
                                    type="text"
                                    placeholder="e.g. Call after salary credit..."
                                    value={followUpNote}
                                    onChange={(e) => setFollowUpNote(e.target.value)}
                                    className="w-full bg-white border border-slate-205 focus:border-indigo-500/50 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSchedulingLeadId(null);
                                    setFollowUpDate("");
                                    setFollowUpNote("");
                                  }}
                                  className="px-3 py-1.5 text-slate-655 hover:text-slate-800 bg-white border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  disabled={isPending}
                                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
                                >
                                  {isPending ? "Scheduling..." : "Schedule Callback"}
                                </button>
                              </div>
                            </form>
                          )}

                          {/* Inline Site Visit Scheduling Form */}
                          {siteVisitLeadId === leadId && (
                            <form
                              onSubmit={(e) => handleConfirmSiteVisit(e, leadId)}
                              className="flex flex-col gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 mt-2 animate-fade-in"
                            >
                              <h4 className="text-xs font-bold text-purple-755 uppercase tracking-wider">
                                Schedule Site Visit
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                  <label htmlFor={`sitevisit-date-${leadId}`} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    Visit Date & Time
                                  </label>
                                  <input
                                    id={`sitevisit-date-${leadId}`}
                                    type="datetime-local"
                                    required
                                    value={siteVisitDate}
                                    onChange={(e) => setSiteVisitDate(e.target.value)}
                                    className="w-full bg-white border border-slate-205 focus:border-purple-500/50 rounded-lg px-3 py-1.5 text-xs text-slate-800 focus:outline-none transition-all"
                                  />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                  <label htmlFor={`sitevisit-notes-${leadId}`} className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    Notes / Remarks (Optional)
                                  </label>
                                  <input
                                    id={`sitevisit-notes-${leadId}`}
                                    type="text"
                                    placeholder="Enter visit notes..."
                                    value={siteVisitNotes}
                                    onChange={(e) => setSiteVisitNotes(e.target.value)}
                                    className="w-full bg-white border border-slate-205 focus:border-purple-500/50 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSiteVisitLeadId(null);
                                    setSiteVisitDate("");
                                    setSiteVisitNotes("");
                                  }}
                                  className="px-3 py-1.5 text-slate-655 hover:text-slate-800 bg-white border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="submit"
                                  disabled={isPending}
                                  className="px-3.5 py-1.5 bg-purple-650 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
                                >
                                  {isPending ? "Scheduling..." : "Schedule Visit"}
                                </button>
                              </div>
                            </form>
                          )}
                        </div>
                      )}
                      </td>
                    </tr>
                  );
                })
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

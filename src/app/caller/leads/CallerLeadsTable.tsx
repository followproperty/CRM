"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateLeadStatusAction, scheduleSiteVisitAction, requestWhatsAppFollowupAction } from "@/app/actions/leads";
import { LeadStatus, ILead, LEAD_STATUS_LABELS } from "@/types/lead";
import { UserRole } from "@/types/user";
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
    case LeadStatus.MAYBE_LATER:
      return "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200";
    case LeadStatus.DND:
      return "bg-red-50 text-red-700 border-red-200";
    case LeadStatus.WRONG_NUMBER:
      return "bg-orange-50 text-orange-705 border-orange-200";
    case LeadStatus.ADMIN_FOLLOWUP:
      return "bg-cyan-50 text-cyan-755 border-cyan-200";
    case LeadStatus.NOT_ANSWERED:
      return "bg-yellow-50 text-yellow-700 border-yellow-250";
    default:
      return "bg-slate-50 text-slate-650 border-slate-200";
  }
}

export default function CallerLeadsTable({ leads }: CallerLeadsTableProps) {
  const router = useRouter();
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

  // Sub-form details state
  const [selectedSubStatus, setSelectedSubStatus] = useState<LeadStatus | null>(null);
  const [interestedProject, setInterestedProject] = useState("");
  const [interestedCity, setInterestedCity] = useState("");
  const [interestedBudgetValue, setInterestedBudgetValue] = useState("");
  const [interestedBudgetUnit, setInterestedBudgetUnit] = useState("Lakh");
  const [interestedConfig, setInterestedConfig] = useState("");
  const [interestedTimeline, setInterestedTimeline] = useState("");
  const [interestedNote, setInterestedNote] = useState("");

  const [maybeLaterTimeframe, setMaybeLaterTimeframe] = useState("");
  const [maybeLaterDate, setMaybeLaterDate] = useState("");
  const [maybeLaterNote, setMaybeLaterNote] = useState("");

  const [callState, setCallState] = useState<{ lead: ILead; startTime: number } | null>(null);

  // Hydrate state from sessionStorage on load
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = sessionStorage.getItem("active_call");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const elapsed = Date.now() - parsed.startTime;
        if (elapsed < 15000) {
          setCallState(parsed);
        } else {
          sessionStorage.removeItem("active_call");
        }
      } catch {
        sessionStorage.removeItem("active_call");
      }
    }
  }, []);

  // Manage countdown timer and auto-opening modal
  useEffect(() => {
    if (!callState) return;

    // Set up a 1-second interval to update the countdown display
    const interval = setInterval(() => {
      // Force a state update to trigger re-render
      setCallState((current) => current ? { ...current } : null);
    }, 1000);

    const elapsed = Date.now() - callState.startTime;
    const remaining = 15000 - elapsed;
    if (remaining <= 0) {
      clearInterval(interval);
      // Auto-open modal when timer finishes
      setActiveOutcomeLead((curr) => curr || callState.lead);
      setOutcomeNote("");
      return;
    }

    const timer = setTimeout(() => {
      clearInterval(interval);
      // Force re-render to update disabled button state
      setCallState((current) => current ? { ...current } : null);
      setActiveOutcomeLead((curr) => curr || callState.lead);
      setOutcomeNote("");
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("active_call");
      }
    }, remaining);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [callState]);

  const getCallStatus = (leadId: string) => {
    if (callState) {
      const stateLeadId = callState.lead._id ? callState.lead._id.toString() : "";
      if (stateLeadId === leadId) {
        const elapsed = Date.now() - callState.startTime;
        return elapsed >= 15000 ? "verified" : "calling";
      }
    }
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("active_call");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const parsedLeadId = parsed.lead._id ? parsed.lead._id.toString() : "";
          if (parsedLeadId === leadId) {
            const elapsed = Date.now() - parsed.startTime;
            return elapsed >= 15000 ? "verified" : "calling";
          }
        } catch {}
      }
    }
    return "idle";
  };

  const getRemainingSeconds = (leadId: string) => {
    if (callState) {
      const stateLeadId = callState.lead._id ? callState.lead._id.toString() : "";
      if (stateLeadId === leadId) {
        const elapsed = Date.now() - callState.startTime;
        const remaining = Math.max(0, Math.ceil((15000 - elapsed) / 1000));
        return remaining;
      }
    }
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("active_call");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const parsedLeadId = parsed.lead._id ? parsed.lead._id.toString() : "";
          if (parsedLeadId === leadId) {
            const elapsed = Date.now() - parsed.startTime;
            const remaining = Math.max(0, Math.ceil((15000 - elapsed) / 1000));
            return remaining;
          }
        } catch {}
      }
    }
    return 0;
  };

  const showMessage = (text: string, isError = false) => {
    setMessage({ text, isError });
    setTimeout(() => setMessage(null), 4000);
  };

  const refreshPage = () => {
    const params = new URLSearchParams(window.location.search);
    params.set("_t", Date.now().toString());
    router.replace(`${window.location.pathname}?${params.toString()}`);
  };

  const triggerDialer = (phoneNumber: string) => {
    if (typeof window === "undefined") return;
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = `tel:${phoneNumber}`;
    document.body.appendChild(iframe);
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 300);
  };

  const handleInitiateCall = (lead: ILead) => {
    const startTime = Date.now();
    const newState = { lead, startTime };
    setCallState(newState);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("active_call", JSON.stringify(newState));
      triggerDialer(lead.primaryPhone || lead.phone);
    }
  };

  const handleQuickStatusUpdate = (lead: ILead, status: LeadStatus) => {
    const leadId = lead._id ? lead._id.toString() : "";

    // For Follow Up (Call Later), bridge to the Callback Modal
    if (status === LeadStatus.FOLLOW_UP) {
      setCallbackLead(lead);
      setCallbackDate("");
      setCallbackNote(outcomeNote);
      setActiveOutcomeLead(null);
      return;
    }

    // Close modal immediately for instant UI response
    setActiveOutcomeLead(null);
    setOutcomeNote("");

    startTransition(async () => {
      const result = await updateLeadStatusAction(leadId, status, null, outcomeNote, lead.collectionType);
      if (result.success) {
        showMessage(`Status logged as ${LEAD_STATUS_LABELS[status] || status}.`);
        refreshPage();
      } else {
        showMessage(result.error || "Failed to update lead status.", true);
      }
    });
  };

  const handleRequestWhatsApp = (lead: ILead) => {
    const leadId = lead._id ? lead._id.toString() : "";

    // Close modal immediately for instant UI response
    setActiveOutcomeLead(null);
    setOutcomeNote("");

    startTransition(async () => {
      const result = await requestWhatsAppFollowupAction(leadId, lead.collectionType);
      if (result.success) {
        showMessage("WhatsApp follow-up requested with Admin.");
        refreshPage();
      } else {
        showMessage(result.error || "Failed to request WhatsApp.", true);
      }
    });
  };

  const handleConfirmCallback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!callbackLead || !callbackDate) return;
    
    const leadId = callbackLead._id ? callbackLead._id.toString() : "";

    // Close modal immediately for instant UI response
    setCallbackLead(null);
    setCallbackDate("");
    setCallbackNote("");

    startTransition(async () => {
      const result = await updateLeadStatusAction(leadId, LeadStatus.FOLLOW_UP, callbackDate, callbackNote, callbackLead.collectionType);
      if (result.success) {
        showMessage("Follow-up callback scheduled successfully.");
        refreshPage();
      } else {
        showMessage(result.error || "Failed to schedule callback.", true);
      }
    });
  };

  const handleConfirmSiteVisit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteVisitLead || !siteVisitDate) return;

    const leadId = siteVisitLead._id ? siteVisitLead._id.toString() : "";

    // Close modal immediately for instant UI response
    setSiteVisitLead(null);
    setSiteVisitDate("");
    setSiteVisitNotes("");

    startTransition(async () => {
      const result = await scheduleSiteVisitAction(leadId, siteVisitDate, siteVisitNotes, siteVisitLead.collectionType);
      if (result.success) {
        showMessage("Site visit scheduled successfully.");
        refreshPage();
      } else {
        showMessage(result.error || "Failed to schedule site visit.", true);
      }
    });
  };

  const closeOutcomeModal = () => {
    setActiveOutcomeLead(null);
    setOutcomeNote("");
    setCallState(null);
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("active_call");
    }
    setSelectedSubStatus(null);
    setInterestedProject("");
    setInterestedCity("");
    setInterestedBudgetValue("");
    setInterestedBudgetUnit("Lakh");
    setInterestedConfig("");
    setInterestedTimeline("");
    setInterestedNote("");
    setMaybeLaterTimeframe("");
    setMaybeLaterDate("");
    setMaybeLaterNote("");
  };

  const handleDetailedStatusUpdate = (e: React.FormEvent, lead: ILead, status: LeadStatus) => {
    e.preventDefault();
    const leadId = lead._id ? lead._id.toString() : "";

    const extraDetails = status === LeadStatus.INTERESTED ? {
      projectName: interestedProject,
      city: interestedCity,
      budgetValue: interestedBudgetValue,
      budgetUnit: interestedBudgetUnit,
      configuration: interestedConfig,
      possessionTimeline: interestedTimeline,
    } : status === LeadStatus.MAYBE_LATER ? {
      maybeLaterTimeframe,
      maybeLaterDate,
    } : undefined;

    const noteText = status === LeadStatus.INTERESTED ? interestedNote : status === LeadStatus.MAYBE_LATER ? maybeLaterNote : outcomeNote;

    closeOutcomeModal();

    startTransition(async () => {
      const result = await updateLeadStatusAction(leadId, status, null, noteText, lead.collectionType, extraDetails);
      if (result.success) {
        showMessage(`Status logged as ${LEAD_STATUS_LABELS[status] || status}.`);
        refreshPage();
      } else {
        showMessage(result.error || "Failed to update lead status.", true);
      }
    });
  };

  const isHandoffLocked = (status: LeadStatus) => {
    return status === LeadStatus.ADMIN_FOLLOWUP || status === LeadStatus.WHATSAPP_SHARED;
  };

  return (
    <div className="space-y-4">
      {/* Toast Alert Messaging */}
      {message && (
        <div
          className={`fixed bottom-6 right-6 z-[9999] flex items-center gap-2.5 px-4 py-3.5 rounded-xl border shadow-xl transition-all duration-300 animate-slide-in ${
            message.isError
              ? "bg-white border-red-200 text-red-800"
              : "bg-white border-emerald-200 text-emerald-800"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${message.isError ? "bg-red-500" : "bg-emerald-500"} animate-pulse`} />
          <p className="text-sm font-medium">{message.text}</p>
        </div>
      )}

      {/* Desktop Table View (hidden on mobile, visible from md up) */}
      <div className="hidden md:block bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] uppercase font-bold text-slate-500 tracking-wider bg-slate-50/70">
                <th className="px-6 py-4">Lead Name</th>
                <th className="px-6 py-4">Phone Number</th>
                <th className="px-6 py-4">Current Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                    No leads currently assigned to you.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const leadId = lead._id ? lead._id.toString() : "";
                  const isLocked = isHandoffLocked(lead.status);
                  const contactNumber = lead.primaryPhone || lead.phone;

                  return (
                    <tr key={leadId} className="hover:bg-slate-50/50 transition-colors">
                      {/* Name */}
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
                            setSelectedLeadId(leadId);
                            setSelectedLead(lead);
                          }}
                          className="font-bold text-slate-800 hover:text-indigo-650 hover:underline text-left transition-colors cursor-pointer"
                        >
                          {lead.name}
                        </button>
                      </td>
                      {/* Contact */}
                      <td className="px-6 py-4 text-slate-655 font-mono">
                        <a
                          href="javascript:void(0)"
                          onClick={(e) => {
                            e.preventDefault();
                            handleInitiateCall(lead);
                          }}
                          className="hover:text-indigo-600 transition-colors font-medium"
                        >
                          {contactNumber}
                        </a>
                      </td>
                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-extrabold uppercase tracking-wider ${getStatusStyles(lead.status)}`}>
                          {LEAD_STATUS_LABELS[lead.status] || lead.status}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        {isLocked ? (
                          <span className="text-xs font-semibold text-slate-400">Locked (Admin)</span>
                        ) : (
                          <div className="flex justify-end gap-2">
                            <a
                              href="javascript:void(0)"
                              onClick={(e) => {
                                e.preventDefault();
                                handleInitiateCall(lead);
                              }}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all active:scale-[0.98] inline-flex items-center gap-1 shadow-xs"
                            >
                              Call
                            </a>
                            <button
                              disabled={getCallStatus(leadId) !== "verified"}
                              onClick={() => {
                                setActiveOutcomeLead(lead);
                                setOutcomeNote("");
                              }}
                              className="px-3.5 py-1.5 border border-slate-250 bg-white hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed text-slate-705 rounded-lg text-xs font-bold transition-all active:scale-[0.98] cursor-pointer shadow-xs animate-pulse-subtle"
                            >
                              {getCallStatus(leadId) === "calling" ? `Log Outcome (${getRemainingSeconds(leadId)}s)` : "Log Outcome"}
                            </button>
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

      {/* Mobile Card List View (hidden on desktop, visible on screens < 768px) */}
      <div className="block md:hidden space-y-4">
        {leads.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-50 border border-slate-200 border-dashed text-center">
            <p className="text-sm text-slate-500">No leads currently assigned to you.</p>
          </div>
        ) : (
          leads.map((lead) => {
            const leadId = lead._id ? lead._id.toString() : "";
            const isLocked = isHandoffLocked(lead.status);
            const contactNumber = lead.primaryPhone || lead.phone;

            return (
              <div
                key={leadId}
                className={`p-4 rounded-xl border transition-all ${
                  isLocked ? "bg-slate-50 border-slate-200 opacity-60" : "bg-white border-slate-200 shadow-sm"
                }`}
              >
                {/* Header Section: Name, Phone Link, and Status */}
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
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
                      href="javascript:void(0)"
                      onClick={(e) => {
                        e.preventDefault();
                        handleInitiateCall(lead);
                      }}
                      className="text-sm text-slate-555 font-mono font-medium mt-0.5 hover:text-indigo-650 inline-block"
                    >
                      {contactNumber}
                    </a>
                  </div>
                  <span className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-full border uppercase tracking-wider ${getStatusStyles(lead.status)}`}>
                    {LEAD_STATUS_LABELS[lead.status] || lead.status}
                  </span>
                </div>

                {/* Actions Stack */}
                <div className="mt-4">
                  {isLocked ? (
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400 bg-slate-100 p-2.5 rounded-lg border border-slate-200">
                      <span>🔒</span>
                      <div className="flex flex-col text-left">
                        <span>Lead Handed To Admin</span>
                        <span className="text-[10px] text-slate-400 font-medium">Caller actions disabled</span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {/* Prominent green Call button */}
                      <a
                        href="javascript:void(0)"
                        onClick={(e) => {
                          e.preventDefault();
                          handleInitiateCall(lead);
                        }}
                        className="flex items-center justify-center gap-1.5 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm shadow-sm transition-colors active:scale-[0.99] touch-manipulation"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        Call
                      </a>
                      <button
                        disabled={getCallStatus(leadId) !== "verified"}
                        onClick={() => {
                          setActiveOutcomeLead(lead);
                          setOutcomeNote("");
                        }}
                        className="flex items-center justify-center py-3 px-4 border border-slate-250 bg-white hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed text-slate-700 rounded-lg font-bold text-sm transition-all active:scale-[0.99] cursor-pointer touch-manipulation"
                      >
                        {getCallStatus(leadId) === "calling" ? `Log Outcome (${getRemainingSeconds(leadId)}s)` : "Log Outcome"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Outcome Selection Overlay Modal */}
      {activeOutcomeLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-600/40 backdrop-blur-xs animate-fade-in" onClick={closeOutcomeModal}>
          <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
              <div>
                <h3 className="text-base font-bold text-slate-800">Log Outcome</h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">Lead: {activeOutcomeLead.name}</p>
              </div>
              <button onClick={closeOutcomeModal} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 cursor-pointer">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {selectedSubStatus === LeadStatus.INTERESTED ? (
              <form onSubmit={(e) => handleDetailedStatusUpdate(e, activeOutcomeLead, LeadStatus.INTERESTED)} className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Interested Details Form</span>
                  <button type="button" onClick={() => setSelectedSubStatus(null)} className="text-xs text-indigo-600 hover:text-indigo-850 font-bold transition-all">← Back to List</button>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-555 uppercase tracking-wider">Remark / Note (Required) <span className="text-red-500">*</span></label>
                  <textarea required rows={3} placeholder="Please write something which can help admin to get some context" value={interestedNote} onChange={(e) => setInterestedNote(e.target.value)} className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500/50 focus:bg-white rounded-lg px-3 py-2 text-xs text-slate-850 focus:outline-none transition-all placeholder-slate-400 resize-none" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-555 uppercase tracking-wider">Project Interested (Optional)</label>
                  <input type="text" placeholder="e.g. DLF Heights..." value={interestedProject} onChange={(e) => setInterestedProject(e.target.value)} className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500/50 focus:bg-white rounded-lg px-3 py-2 text-xs text-slate-850 focus:outline-none transition-all" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-555 uppercase tracking-wider">City (Optional)</label>
                  <input type="text" placeholder="e.g. Gurugram..." value={interestedCity} onChange={(e) => setInterestedCity(e.target.value)} className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500/50 focus:bg-white rounded-lg px-3 py-2 text-xs text-slate-850 focus:outline-none transition-all" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-555 uppercase tracking-wider">Budget (Optional)</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="e.g. 80" value={interestedBudgetValue} onChange={(e) => setInterestedBudgetValue(e.target.value)} className="flex-1 bg-slate-50 border border-slate-200 focus:border-indigo-500/50 focus:bg-white rounded-lg px-3 py-2 text-xs text-slate-850 focus:outline-none transition-all" />
                    <select value={interestedBudgetUnit} onChange={(e) => setInterestedBudgetUnit(e.target.value)} className="bg-slate-50 border border-slate-200 focus:border-indigo-500/50 focus:bg-white rounded-lg px-3 py-2 text-xs text-slate-850 focus:outline-none transition-all">
                      <option value="Lakh">Lakh</option>
                      <option value="Cr">Cr</option>
                      <option value="Rupees">Rupees</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-555 uppercase tracking-wider">Config (Optional)</label>
                    <input type="text" placeholder="e.g. 2 BHK, Plot" value={interestedConfig} onChange={(e) => setInterestedConfig(e.target.value)} className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500/50 focus:bg-white rounded-lg px-3 py-2 text-xs text-slate-850 focus:outline-none transition-all" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-slate-555 uppercase tracking-wider">Timeline (Optional)</label>
                    <select value={interestedTimeline} onChange={(e) => setInterestedTimeline(e.target.value)} className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500/50 focus:bg-white rounded-lg px-3 py-2 text-xs text-slate-850 focus:outline-none transition-all">
                      <option value="">Select Timeline</option>
                      <option value="Immediate">Immediate</option>
                      <option value="Ready to Move">Ready to Move</option>
                      <option value="6 Months">6 Months</option>
                      <option value="1 Year">1 Year</option>
                      <option value="Under Construction">Under Construction</option>
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button type="button" onClick={closeOutcomeModal} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Cancel</button>
                  <button type="submit" disabled={isPending || !interestedNote.trim()} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed text-white rounded-lg text-xs font-bold">{isPending ? "Saving..." : "Submit Log"}</button>
                </div>
              </form>
            ) : selectedSubStatus === LeadStatus.MAYBE_LATER ? (
              <form onSubmit={(e) => handleDetailedStatusUpdate(e, activeOutcomeLead, LeadStatus.MAYBE_LATER)} className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Maybe Later Details Form</span>
                  <button type="button" onClick={() => setSelectedSubStatus(null)} className="text-xs text-indigo-600 hover:text-indigo-850 font-bold transition-all">← Back to List</button>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-555 uppercase tracking-wider">Timeframe (Optional)</label>
                  <select value={maybeLaterTimeframe} onChange={(e) => setMaybeLaterTimeframe(e.target.value)} className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500/50 focus:bg-white rounded-lg px-3 py-2 text-xs text-slate-850 focus:outline-none transition-all">
                    <option value="">Select Timeframe</option>
                    <option value="Next month">Next month</option>
                    <option value="In 3 months">In 3 months</option>
                    <option value="In 6 months">In 6 months</option>
                    <option value="Next year">Next year</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-555 uppercase tracking-wider">Future Date (Optional)</label>
                  <input type="date" min={new Date().toISOString().split("T")[0]} value={maybeLaterDate} onChange={(e) => setMaybeLaterDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500/50 focus:bg-white rounded-lg px-3 py-2 text-xs text-slate-850 focus:outline-none transition-all" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-555 uppercase tracking-wider">Remark / Note (Optional)</label>
                  <textarea rows={2} placeholder="Add a note..." value={maybeLaterNote} onChange={(e) => setMaybeLaterNote(e.target.value)} className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500/50 focus:bg-white rounded-lg px-3 py-2 text-xs text-slate-850 focus:outline-none transition-all placeholder-slate-400 resize-none" />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button type="button" onClick={closeOutcomeModal} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold">Cancel</button>
                  <button type="submit" disabled={isPending} className="px-4 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-lg text-xs font-bold">{isPending ? "Saving..." : "Submit Log"}</button>
                </div>
              </form>
            ) : (
              <div className="p-5 space-y-4">
              {/* Optional Outcome Note input */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="outcome-note-leads" className="text-[10px] font-bold text-slate-550 uppercase tracking-wider">Remark / Note (Optional)</label>
                <input
                  id="outcome-note-leads"
                  type="text"
                  placeholder="e.g. Discussed property specifications..."
                  value={outcomeNote}
                  onChange={(e) => setOutcomeNote(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500/50 focus:bg-white rounded-lg px-3 py-2 text-sm text-slate-850 focus:outline-none transition-all placeholder-slate-400"
                />
              </div>

              {/* Grid of Outcome Buttons */}
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedSubStatus(LeadStatus.INTERESTED)}
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
                  onClick={() => handleQuickStatusUpdate(activeOutcomeLead, LeadStatus.NOT_ANSWERED)}
                  disabled={isPending}
                  className="flex items-center gap-3 w-full py-3 px-4 bg-yellow-50 hover:bg-yellow-100 text-yellow-800 rounded-xl font-bold text-sm border border-yellow-200 cursor-pointer transition-all active:scale-[0.99] touch-manipulation"
                >
                  <span className="text-base">📳</span>
                  Not Answered
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
                  type="button"
                  onClick={() => setSelectedSubStatus(LeadStatus.MAYBE_LATER)}
                  disabled={isPending}
                  className="flex items-center gap-3 w-full py-3 px-4 bg-fuchsia-50 hover:bg-fuchsia-100 text-fuchsia-800 rounded-xl font-bold text-sm border border-fuchsia-200 cursor-pointer transition-all active:scale-[0.99] touch-manipulation"
                >
                  <span className="text-base">⏳</span>
                  Maybe Later
                </button>

                <button
                  onClick={() => handleQuickStatusUpdate(activeOutcomeLead, LeadStatus.WRONG_NUMBER)}
                  disabled={isPending}
                  className="flex items-center gap-3 w-full py-3 px-4 bg-orange-50 hover:bg-orange-100 text-orange-850 rounded-xl font-bold text-sm border border-orange-200 cursor-pointer transition-all active:scale-[0.99] touch-manipulation"
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
          )}
        </div>
      </div>
    )}

      {/* Callback Scheduling Picker Modal */}
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
              <div className="flex flex-col gap-1.5">
                <label htmlFor="callback-datetime-leads" className="text-[10px] font-bold text-slate-550 uppercase tracking-wider">Callback Date & Time</label>
                <input
                  id="callback-datetime-leads"
                  type="datetime-local"
                  required
                  value={callbackDate}
                  onChange={(e) => setCallbackDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500/50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none transition-all touch-manipulation"
                />
                <div className="flex gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      const yyyy = tomorrow.getFullYear();
                      const mm = String(tomorrow.getMonth() + 1).padStart(2, "0");
                      const dd = String(tomorrow.getDate()).padStart(2, "0");
                      setCallbackDate(`${yyyy}-${mm}-${dd}T11:00`);
                    }}
                    className="flex-1 py-1.5 px-3 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg font-bold text-[10px] transition-colors cursor-pointer text-center"
                  >
                    📅 Tomorrow (11 AM)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const dayAfter = new Date();
                      dayAfter.setDate(dayAfter.getDate() + 2);
                      const yyyy = dayAfter.getFullYear();
                      const mm = String(dayAfter.getMonth() + 1).padStart(2, "0");
                      const dd = String(dayAfter.getDate()).padStart(2, "0");
                      setCallbackDate(`${yyyy}-${mm}-${dd}T11:00`);
                    }}
                    className="flex-1 py-1.5 px-3 border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg font-bold text-[10px] transition-colors cursor-pointer text-center"
                  >
                    📅 Day After (11 AM)
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="callback-note-leads" className="text-[10px] font-bold text-slate-550 uppercase tracking-wider">Remarks / Notes</label>
                <textarea
                  id="callback-note-leads"
                  rows={3}
                  placeholder="Record callback details..."
                  value={callbackNote}
                  onChange={(e) => setCallbackNote(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-indigo-500/50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none transition-all placeholder-slate-400 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setCallbackLead(null)}
                  className="py-3 px-4 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg font-bold text-sm cursor-pointer transition-all active:scale-[0.99]"
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
                <label htmlFor="sitevisit-datetime-leads" className="text-[10px] font-bold text-slate-550 uppercase tracking-wider">Visit Date & Time</label>
                <input
                  id="sitevisit-datetime-leads"
                  type="datetime-local"
                  required
                  value={siteVisitDate}
                  onChange={(e) => setSiteVisitDate(e.target.value)}
                  className="w-full bg-white border border-slate-200 focus:border-purple-500/50 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none transition-all touch-manipulation"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="sitevisit-note-leads" className="text-[10px] font-bold text-slate-550 uppercase tracking-wider">Notes / Remarks</label>
                <textarea
                  id="sitevisit-note-leads"
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

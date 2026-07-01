"use client";

import React, { useState, useTransition, useEffect } from "react";
import { LeadStatus, FollowUpStatus, SiteVisitStatus, ILead, LEAD_STATUS_LABELS } from "@/types/lead";
import { updateLeadStatusAction, requestWhatsAppFollowupAction, scheduleSiteVisitAction } from "@/app/actions/leads";
import { UserRole } from "@/types/user";
import LeadDetailsModal from "@/components/leads/LeadDetailsModal";

interface CallerPriorityQueueProps {
  leads: ILead[];
}

const sortLeadsClientSide = (leads: ILead[]): ILead[] => {
  const now = new Date();
  const offset = 5.5 * 60 * 60 * 1000; // IST is UTC+5:30
  const todayIST = new Date(now.getTime() + offset);
  todayIST.setUTCHours(0, 0, 0, 0);

  return [...leads].sort((a, b) => {
    const isNewOrCalledA = a.status === LeadStatus.NEW || a.status === LeadStatus.CALLED;
    const isNewOrCalledB = b.status === LeadStatus.NEW || b.status === LeadStatus.CALLED;

    const updatedAtA = a.updatedAt ? new Date(a.updatedAt) : null;
    const updatedAtB = b.updatedAt ? new Date(b.updatedAt) : null;

    const wasCalledTodayA = !isNewOrCalledA && updatedAtA && (updatedAtA.getTime() + offset) >= todayIST.getTime();
    const wasCalledTodayB = !isNewOrCalledB && updatedAtB && (updatedAtB.getTime() + offset) >= todayIST.getTime();

    if (wasCalledTodayA && !wasCalledTodayB) return 1;
    if (!wasCalledTodayA && wasCalledTodayB) return -1;

    if (!wasCalledTodayA) {
      if (isNewOrCalledA && !isNewOrCalledB) return -1;
      if (!isNewOrCalledA && isNewOrCalledB) return 1;

      const dateA = updatedAtA ? updatedAtA.getTime() : 0;
      const dateB = updatedAtB ? updatedAtB.getTime() : 0;
      return dateB - dateA;
    } else {
      const dateA = updatedAtA ? updatedAtA.getTime() : 0;
      const dateB = updatedAtB ? updatedAtB.getTime() : 0;
      return dateA - dateB;
    }
  });
};

export default function CallerPriorityQueue({ leads }: CallerPriorityQueueProps) {
  const [leadsList, setLeadsList] = useState<ILead[]>(() => sortLeadsClientSide(leads));
  const [activeCallLeadId, setActiveCallLeadId] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

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

  useEffect(() => {
    setLeadsList(sortLeadsClientSide(leads));
  }, [leads]);

  const getStartOfTodayIST = () => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(new Date());
    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;
    return new Date(`${year}-${month}-${day}T00:00:00+05:30`);
  };

  // Hydrate active call state from sessionStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = sessionStorage.getItem("active_call");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const elapsed = Date.now() - parsed.startTime;
        const leadId = parsed.leadId;
        const collectionType = parsed.collectionType;

        if (elapsed < 9000) {
          setActiveCallLeadId(leadId);
          setSecondsLeft(Math.max(0, Math.ceil((9000 - elapsed) / 1000)));
        } else {
          sessionStorage.removeItem("active_call");
          // If the lead status was NEW, update it to CALLED since the call is finished
          const leadObj = leads.find(l => (l._id ? l._id.toString() : "") === leadId);
          if (leadObj && leadObj.status === LeadStatus.NEW) {
            setLeadsList(prev => prev.map(l =>
              (l._id ? l._id.toString() : "") === leadId ? { ...l, status: LeadStatus.CALLED } : l
            ));
            startTransition(async () => {
              await updateLeadStatusAction(leadId, LeadStatus.CALLED, null, "Call duration completed (9s)", collectionType);
            });
          }
        }
      } catch {
        sessionStorage.removeItem("active_call");
      }
    }
  }, [leads]);

  // Handle side-effects when active call countdown reaches 0
  useEffect(() => {
    if (activeCallLeadId && secondsLeft === 0) {
      // Find the active lead details
      const activeLead = leadsList.find(l => (l._id ? l._id.toString() : "") === activeCallLeadId);
      if (activeLead) {
        const leadId = activeCallLeadId;
        const collectionType = activeLead.collectionType;

        // 1. Update local state to CALLED
        setLeadsList(prevList => prevList.map(l => 
          (l._id ? l._id.toString() : "") === leadId ? { ...l, status: LeadStatus.CALLED } : l
        ));

        // 2. Auto-open modal when timer finishes
        setActiveOutcomeLead({ ...activeLead, status: LeadStatus.CALLED });
        setOutcomeNote("");

        // 3. Update database in background
        startTransition(async () => {
          await updateLeadStatusAction(leadId, LeadStatus.CALLED, null, "Call duration completed (9s)", collectionType);
        });
      }

      // Clear active call state
      setActiveCallLeadId(null);
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("active_call");
      }
    }
  }, [activeCallLeadId, secondsLeft, leadsList]);

  // Manage countdown timer decrement
  useEffect(() => {
    if (!activeCallLeadId || secondsLeft <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeCallLeadId, secondsLeft]);

  const getCallStatus = (leadId: string) => {
    // Check if the lead is in CALLED status in the local state
    const leadObj = leadsList.find((l) => (l._id ? l._id.toString() : "") === leadId);
    if (leadObj && leadObj.status === LeadStatus.CALLED) {
      return "verified";
    }

    if (activeCallLeadId === leadId) {
      return secondsLeft <= 0 ? "verified" : "calling";
    }
    return "idle";
  };

  const getRemainingSeconds = (leadId: string) => {
    if (activeCallLeadId === leadId) {
      return secondsLeft;
    }
    return 0;
  };

  const showMessage = (text: string, isError = false) => {
    setMessage({ text, isError });
    setTimeout(() => setMessage(null), 4000);
  };

  // Stats
  const totalAssigned = leadsList.length;
  const completedCalls = leadsList.filter((l: ILead) => l.status !== LeadStatus.NEW && l.status !== LeadStatus.CALLED).length;
  const progressPct = totalAssigned > 0 ? Math.round((completedCalls / totalAssigned) * 100) : 0;
  
  const pendingCallbacks = leadsList.filter(
    (l: ILead) => l.followUp && l.followUp.status === FollowUpStatus.PENDING && l.followUp.date
  ).length;

  const interestedCount = leadsList.filter((l: ILead) => l.status === LeadStatus.INTERESTED).length;

  // Build Priority Queue (filtering out terminal and admin statuses)
  const priorityQueue = leadsList.filter(
    (l: ILead) =>
      l.status !== LeadStatus.CUSTOMER &&
      l.status !== LeadStatus.NOT_INTERESTED &&
      l.status !== LeadStatus.LOST &&
      l.status !== LeadStatus.MAYBE_LATER &&
      l.status !== LeadStatus.DND &&
      l.status !== LeadStatus.WRONG_NUMBER
  );

  // Client-side sort to keep NEW/CALLED at top and called-today at bottom instantly
  const startOfTodayIST = getStartOfTodayIST();
  priorityQueue.sort((a, b) => {
    const isNewOrCalledA = a.status === LeadStatus.NEW || a.status === LeadStatus.CALLED;
    const isNewOrCalledB = b.status === LeadStatus.NEW || b.status === LeadStatus.CALLED;

    const wasCalledTodayA = !isNewOrCalledA && a.updatedAt && new Date(a.updatedAt) >= startOfTodayIST;
    const wasCalledTodayB = !isNewOrCalledB && b.updatedAt && new Date(b.updatedAt) >= startOfTodayIST;

    // Group 1: Not called today; Group 2: Called today (should go to bottom)
    if (wasCalledTodayA && !wasCalledTodayB) return 1;
    if (!wasCalledTodayA && wasCalledTodayB) return -1;

    // If both are in the same group (both not called today, or both called today)
    if (!wasCalledTodayA) {
      // Pinned NEW and CALLED leads at the top of Group 1
      if (isNewOrCalledA && !isNewOrCalledB) return -1;
      if (!isNewOrCalledA && isNewOrCalledB) return 1;

      // Otherwise sort Group 1 by updatedAt descending (newest first)
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateB - dateA;
    } else {
      // Group 2 (called today): Sort by updatedAt ascending (oldest first, so newest drops to bottom)
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateA - dateB;
    }
  });
  
  // Reminders List
  const reminders = leadsList
    .filter((l: ILead) => l.followUp && l.followUp.status === FollowUpStatus.PENDING && l.followUp.date)
    .sort((a: ILead, b: ILead) => {
      const dateA = a.followUp?.date ? new Date(a.followUp.date).getTime() : 0;
      const dateB = b.followUp?.date ? new Date(b.followUp.date).getTime() : 0;
      return dateA - dateB;
    })
    .slice(0, 5)
    .map((lead: ILead) => {
      const dateObj = new Date(lead.followUp!.date!);
      const timeString = dateObj.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true });
      const dateString = dateObj.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", month: "short", day: "numeric" });
      return {
        id: lead._id ? lead._id.toString() : "",
        time: `${dateString} at ${timeString}`,
        name: lead.name,
        phone: lead.primaryPhone || lead.phone,
        leadObject: lead,
      };
    });

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
    const leadId = lead._id ? lead._id.toString() : "";
    
    // Check if there is any lead with status CALLED
    const hasUnmarkedLead = leadsList.some((l) => l.status === LeadStatus.CALLED);
    if (hasUnmarkedLead) {
      showMessage("Please log the status of your previous call before starting a new one.", true);
      return;
    }

    // Check if there is a call currently in progress
    if (activeCallLeadId) {
      showMessage("A call is already in progress. Please wait.", true);
      return;
    }

    const startTime = Date.now();
    setActiveCallLeadId(leadId);
    setSecondsLeft(9);

    if (typeof window !== "undefined") {
      const sessionState = { leadId, startTime, collectionType: lead.collectionType };
      sessionStorage.setItem("active_call", JSON.stringify(sessionState));
      triggerDialer(lead.primaryPhone || lead.phone);
    }
  };

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

    // Close modal immediately for instant UX!
    setActiveOutcomeLead(null);
    setOutcomeNote("");

    // Update locally first for instant UI response!
    setLeadsList(prev => {
      const updated = prev.map(l =>
        (l._id ? l._id.toString() : "") === leadId ? { ...l, status, updatedAt: new Date() } : l
      );
      return sortLeadsClientSide(updated);
    });

    startTransition(async () => {
      const result = await updateLeadStatusAction(leadId, status, null, outcomeNote, lead.collectionType);
      if (result.success) {
        showMessage(`Status logged as ${LEAD_STATUS_LABELS[status] || status}.`);
      } else {
        showMessage(result.error || "Failed to update lead status.", true);
        // Rollback
        setLeadsList(prev => {
          const rolledBack = prev.map(l =>
            (l._id ? l._id.toString() : "") === leadId ? { ...l, status: LeadStatus.CALLED } : l
          );
          return sortLeadsClientSide(rolledBack);
        });
      }
    });
  };

  const handleRequestWhatsApp = (lead: ILead) => {
    const leadId = lead._id ? lead._id.toString() : "";

    // Close modal immediately for instant UX!
    setActiveOutcomeLead(null);
    setOutcomeNote("");

    // Update locally first for instant UI response!
    setLeadsList(prev => {
      const updated = prev.map(l =>
        (l._id ? l._id.toString() : "") === leadId ? { ...l, status: LeadStatus.ADMIN_FOLLOWUP, handedOffToAdmin: true, updatedAt: new Date() } : l
      );
      return sortLeadsClientSide(updated);
    });

    startTransition(async () => {
      const result = await requestWhatsAppFollowupAction(leadId, lead.collectionType);
      if (result.success) {
        showMessage("WhatsApp follow-up requested with Admin.");
      } else {
        showMessage(result.error || "Failed to request WhatsApp.", true);
        // Rollback
        setLeadsList(prev => {
          const rolledBack = prev.map(l =>
            (l._id ? l._id.toString() : "") === leadId ? { ...l, status: LeadStatus.CALLED, handedOffToAdmin: false } : l
          );
          return sortLeadsClientSide(rolledBack);
        });
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

    // Update locally first for instant UI response!
    setLeadsList(prev => prev.map(l =>
      (l._id ? l._id.toString() : "") === leadId ? {
        ...l,
        status: LeadStatus.FOLLOW_UP,
        updatedAt: new Date(),
        followUp: { date: new Date(callbackDate), status: FollowUpStatus.PENDING, notes: callbackNote }
      } : l
    ));

    startTransition(async () => {
      const result = await updateLeadStatusAction(leadId, LeadStatus.FOLLOW_UP, callbackDate, callbackNote, callbackLead.collectionType);
      if (result.success) {
        showMessage("Follow-up callback scheduled successfully.");
      } else {
        showMessage(result.error || "Failed to schedule callback.", true);
        // Rollback
        setLeadsList(prev => prev.map(l =>
          (l._id ? l._id.toString() : "") === leadId ? { ...l, status: LeadStatus.CALLED, followUp: undefined } : l
        ));
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

    // Update locally first for instant UI response!
    setLeadsList(prev => prev.map(l =>
      (l._id ? l._id.toString() : "") === leadId ? {
        ...l,
        status: LeadStatus.SITE_VISIT,
        updatedAt: new Date(),
        siteVisitDate: new Date(siteVisitDate),
        siteVisitStatus: SiteVisitStatus.SCHEDULED,
        siteVisitNotes
      } : l
    ));

    startTransition(async () => {
      const result = await scheduleSiteVisitAction(leadId, siteVisitDate, siteVisitNotes, siteVisitLead.collectionType);
      if (result.success) {
        showMessage("Site visit scheduled successfully.");
      } else {
        showMessage(result.error || "Failed to schedule site visit.", true);
        // Rollback
        setLeadsList(prev => prev.map(l =>
          (l._id ? l._id.toString() : "") === leadId ? { ...l, status: LeadStatus.CALLED, siteVisitDate: undefined, siteVisitStatus: undefined, siteVisitNotes: undefined } : l
        ));
      }
    });
  };

  const closeOutcomeModal = () => {
    setActiveOutcomeLead(null);
    setOutcomeNote("");
    setActiveCallLeadId(null);
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

    // Close modal immediately for instant UX!
    closeOutcomeModal();

    // Update locally first for instant UI response!
    setLeadsList(prev => {
      const updated = prev.map(l =>
        (l._id ? l._id.toString() : "") === leadId ? {
          ...l,
          status,
          updatedAt: new Date(),
          projectName: extraDetails?.projectName || l.projectName,
          city: extraDetails?.city || l.city,
          budgetValue: extraDetails?.budgetValue || l.budgetValue,
          budgetUnit: extraDetails?.budgetUnit || l.budgetUnit,
          configuration: extraDetails?.configuration || l.configuration,
          possessionTimeline: extraDetails?.possessionTimeline || l.possessionTimeline,
          maybeLaterTimeframe: extraDetails?.maybeLaterTimeframe || l.maybeLaterTimeframe,
          maybeLaterDate: extraDetails?.maybeLaterDate || l.maybeLaterDate
        } : l
      );
      return sortLeadsClientSide(updated);
    });

    startTransition(async () => {
      const result = await updateLeadStatusAction(leadId, status, null, noteText, lead.collectionType, extraDetails);
      if (result.success) {
        showMessage(`Status logged as ${LEAD_STATUS_LABELS[status] || status}.`);
      } else {
        showMessage(result.error || "Failed to update lead status.", true);
        // Rollback
        setLeadsList(prev => {
          const rolledBack = prev.map(l =>
            (l._id ? l._id.toString() : "") === leadId ? { ...l, status: LeadStatus.CALLED } : l
          );
          return sortLeadsClientSide(rolledBack);
        });
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
                      <span
                        className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                          lead.status === LeadStatus.NEW
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : lead.status === LeadStatus.FOLLOW_UP
                            ? "bg-amber-50 text-amber-700 border border-amber-200"
                            : lead.status === LeadStatus.INTERESTED
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : lead.status === LeadStatus.NOT_ANSWERED
                            ? "bg-yellow-50 text-yellow-700 border border-yellow-250"
                            : lead.status === LeadStatus.MAYBE_LATER
                            ? "bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200"
                            : "bg-slate-50 text-slate-605 border border-slate-200"
                        }`}
                      >
                        {LEAD_STATUS_LABELS[lead.status] || lead.status}
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

                          {/* Log Outcome button */}
                          <button
                            disabled={getCallStatus(leadId) !== "verified"}
                            onClick={() => {
                              setActiveOutcomeLead(lead);
                              setOutcomeNote("");
                            }}
                            className="flex items-center justify-center py-3 px-1.5 border border-slate-250 bg-white hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed text-slate-705 rounded-lg font-bold text-xs sm:text-sm transition-all active:scale-[0.99] cursor-pointer touch-manipulation truncate w-full"
                          >
                            {getCallStatus(leadId) === "calling" ? `Outcome ${getRemainingSeconds(leadId)}s` : "Log Outcome"}
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
                    <a
                      href="javascript:void(0)"
                      onClick={(e) => {
                        e.preventDefault();
                        handleInitiateCall(reminder.leadObject);
                      }}
                      className="p-1 rounded-full bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200"
                    >
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-600/40 backdrop-blur-xs animate-fade-in" onClick={(e) => e.target === e.currentTarget && closeOutcomeModal()}>
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
                  type="button"
                  onClick={() => setSelectedSubStatus(LeadStatus.INTERESTED)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    setSelectedSubStatus(LeadStatus.INTERESTED);
                  }}
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
                    onTouchStart={() => (document.activeElement as HTMLElement)?.blur()}
                    disabled={isPending}
                    className="flex items-center gap-3 w-full py-3 px-4 bg-purple-50 hover:bg-purple-100 text-purple-800 rounded-xl font-bold text-sm border border-purple-200 cursor-pointer transition-all active:scale-[0.99] touch-manipulation"
                  >
                    <span className="text-base">🏠</span>
                    Schedule Site Visit
                  </button>
                )}

                <button
                  onClick={() => handleRequestWhatsApp(activeOutcomeLead)}
                  onTouchStart={() => (document.activeElement as HTMLElement)?.blur()}
                  disabled={isPending}
                  className="flex items-center gap-3 w-full py-3 px-4 bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl font-bold text-sm border border-teal-200 cursor-pointer transition-all active:scale-[0.99] touch-manipulation"
                >
                  <span className="text-base">💬</span>
                  Request WhatsApp Follow-up
                </button>

                <button
                  onClick={() => handleQuickStatusUpdate(activeOutcomeLead, LeadStatus.FOLLOW_UP)}
                  onTouchStart={() => (document.activeElement as HTMLElement)?.blur()}
                  disabled={isPending}
                  className="flex items-center gap-3 w-full py-3 px-4 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl font-bold text-sm border border-amber-200 cursor-pointer transition-all active:scale-[0.99] touch-manipulation"
                >
                  <span className="text-base">📅</span>
                  Call Later (Schedule Callback)
                </button>

                <button
                  onClick={() => handleQuickStatusUpdate(activeOutcomeLead, LeadStatus.NOT_ANSWERED)}
                  onTouchStart={() => (document.activeElement as HTMLElement)?.blur()}
                  disabled={isPending}
                  className="flex items-center gap-3 w-full py-3 px-4 bg-yellow-50 hover:bg-yellow-100 text-yellow-800 rounded-xl font-bold text-sm border border-yellow-200 cursor-pointer transition-all active:scale-[0.99] touch-manipulation"
                >
                  <span className="text-base">📳</span>
                  Not Answered
                </button>

                <button
                  onClick={() => handleQuickStatusUpdate(activeOutcomeLead, LeadStatus.NOT_INTERESTED)}
                  onTouchStart={() => (document.activeElement as HTMLElement)?.blur()}
                  disabled={isPending}
                  className="flex items-center gap-3 w-full py-3 px-4 bg-rose-50 hover:bg-rose-100 text-rose-800 rounded-xl font-bold text-sm border border-rose-200 cursor-pointer transition-all active:scale-[0.99] touch-manipulation"
                >
                  <span className="text-base">🔴</span>
                  Not Interested
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedSubStatus(LeadStatus.MAYBE_LATER)}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    setSelectedSubStatus(LeadStatus.MAYBE_LATER);
                  }}
                  disabled={isPending}
                  className="flex items-center gap-3 w-full py-3 px-4 bg-fuchsia-50 hover:bg-fuchsia-100 text-fuchsia-800 rounded-xl font-bold text-sm border border-fuchsia-200 cursor-pointer transition-all active:scale-[0.99] touch-manipulation"
                >
                  <span className="text-base">⏳</span>
                  Maybe Later
                </button>

                <button
                  onClick={() => handleQuickStatusUpdate(activeOutcomeLead, LeadStatus.WRONG_NUMBER)}
                  onTouchStart={() => (document.activeElement as HTMLElement)?.blur()}
                  disabled={isPending}
                  className="flex items-center gap-3 w-full py-3 px-4 bg-orange-50 hover:bg-orange-100 text-orange-855 rounded-xl font-bold text-sm border border-orange-200 cursor-pointer transition-all active:scale-[0.99] touch-manipulation"
                >
                  <span className="text-base">⚠️</span>
                  Wrong Number
                </button>

                <button
                  onClick={() => handleQuickStatusUpdate(activeOutcomeLead, LeadStatus.DND)}
                  onTouchStart={() => (document.activeElement as HTMLElement)?.blur()}
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

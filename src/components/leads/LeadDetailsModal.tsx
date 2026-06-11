"use client";

import React, { useState, useEffect, useTransition } from "react";
import { getLeadNotesAction, addLeadNoteAction, PopulatedNote } from "@/app/actions/notes";
import { ILead, LeadStatus } from "@/types/lead";

interface LeadDetailsModalProps {
  leadId: string;
  lead: ILead;
  isOpen: boolean;
  onClose: () => void;
}

function getStatusStyles(status: LeadStatus) {
  switch (status) {
    case LeadStatus.NEW:
      return "bg-blue-50 text-blue-700 border-blue-200";
    case LeadStatus.CALLED:
      return "bg-slate-100 text-slate-700 border-slate-200";
    case LeadStatus.INTERESTED:
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case LeadStatus.WHATSAPP_SHARED:
      return "bg-teal-50 text-teal-700 border-teal-200";
    case LeadStatus.FOLLOW_UP:
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case LeadStatus.SITE_VISIT:
      return "bg-purple-50 text-purple-700 border-purple-200";
    case LeadStatus.CUSTOMER:
      return "bg-amber-50 text-amber-800 border-amber-200";
    case LeadStatus.NOT_INTERESTED:
      return "bg-rose-50 text-rose-700 border-rose-200";
    case LeadStatus.DND:
      return "bg-red-50 text-red-700 border-red-200";
    case LeadStatus.WRONG_NUMBER:
      return "bg-orange-50 text-orange-700 border-orange-200";
    case LeadStatus.ADMIN_FOLLOWUP:
      return "bg-cyan-50 text-cyan-700 border-cyan-200";
    case LeadStatus.NEGOTIATION:
      return "bg-amber-50 text-amber-700 border-amber-200";
    case LeadStatus.LOST:
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export default function LeadDetailsModal({ leadId, lead, isOpen, onClose }: LeadDetailsModalProps) {
  const [notes, setNotes] = useState<PopulatedNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);

  // Load notes when modal opens or leadId changes
  useEffect(() => {
    if (isOpen && leadId) {
      setIsLoadingNotes(true);
      setErrorMessage(null);
      getLeadNotesAction(leadId)
        .then((fetchedNotes) => {
          setNotes(fetchedNotes);
        })
        .catch((err) => {
          console.error("Failed to fetch notes:", err);
          setErrorMessage("Failed to load historical remarks.");
        })
        .finally(() => {
          setIsLoadingNotes(false);
        });
    }
  }, [isOpen, leadId]);

  if (!isOpen) return null;

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setErrorMessage(null);
    startTransition(async () => {
      const result = await addLeadNoteAction(leadId, newNote);
      if (result.success) {
        setNewNote("");
        // Reload notes list
        const updatedNotes = await getLeadNotesAction(leadId);
        setNotes(updatedNotes);
      } else {
        setErrorMessage(result.error || "Failed to add note.");
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-600/50 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-bold text-slate-855">Lead Details</h2>
            <p className="text-xs text-slate-450 font-mono">ID: {leadId}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-colors cursor-pointer"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Body Container */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Section 1: Lead Profile */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
            <h3 className="text-xs font-bold text-purple-700 uppercase tracking-wider">Profile Information</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Full Name</label>
                <p className="text-slate-900 font-medium">{lead.name}</p>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Phone</label>
                <p className="font-mono text-slate-700">
                  <a href={`tel:${lead.phone}`} className="hover:text-purple-650 hover:underline transition-all">{lead.phone}</a>
                </p>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Email</label>
                <p className="text-slate-700 truncate">{lead.email || <span className="text-slate-400 italic">Not provided</span>}</p>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Source</label>
                <p className="text-slate-700">{lead.sourceType || "DIRECT"} ({lead.source})</p>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Status</label>
                <div className="mt-0.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusStyles(lead.status)}`}>
                    {lead.status.replace("_", " ")}
                  </span>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Location</label>
                <p className="text-slate-700">
                  {lead.city || lead.state 
                    ? [lead.city, lead.state].filter(Boolean).join(", ") 
                    : <span className="text-slate-400 italic">Not set</span>
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Section 2: Remarks Timeline & Addition */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-purple-700 uppercase tracking-wider">Historical Remarks Timeline</h3>

            {/* Error Message */}
            {errorMessage && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-lg flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Add Note Form */}
            <form onSubmit={handleAddNote} className="space-y-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="remark-textarea" className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">New Remark / Notes</label>
                <textarea
                  id="remark-textarea"
                  rows={2}
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Record conversation outcome, requirements, or callback detail..."
                  className="w-full bg-slate-555 border border-slate-200 focus:border-purple-500 focus:bg-white rounded-xl px-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition-all resize-none"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isPending || !newNote.trim()}
                  className="px-4 py-1.5 bg-purple-650 hover:bg-purple-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-lg text-xs font-bold shadow-md shadow-purple-200 cursor-pointer transition-colors"
                >
                  {isPending ? "Adding remark..." : "Save Remark"}
                </button>
              </div>
            </form>

            {/* Timeline Notes List */}
            <div className="border-t border-slate-200 pt-4">
              {isLoadingNotes ? (
                <div className="flex justify-center items-center py-10 space-x-2">
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-bounce" />
                </div>
              ) : notes.length === 0 ? (
                <div className="p-8 bg-slate-50 border border-slate-200 border-dashed rounded-xl text-center italic text-slate-400 text-xs">
                  No historical remarks found for this lead.
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-200 ml-3.5 pl-6 space-y-5">
                  {notes.map((note) => {
                    const formattedTime = new Date(note.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    const roleBadgeColor = note.user?.role === "SUPER_ADMIN" ? "bg-purple-50 text-purple-700 border border-purple-200" :
                                           note.user?.role === "ADMIN" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" :
                                           "bg-emerald-50 text-emerald-700 border border-emerald-200";

                    return (
                      <div key={note._id} className="relative group">
                        {/* Timeline Node Icon/Dot */}
                        <span className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full border border-purple-500 bg-white flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                        </span>
                        
                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-2 hover:border-slate-300 transition-all">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800">
                                {note.user?.name || "System User"}
                              </span>
                              {note.user?.role && (
                                <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded uppercase tracking-wider ${roleBadgeColor}`}>
                                  {note.user.role.replace("_", " ")}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {formattedTime}
                            </span>
                          </div>
                          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{note.note}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-800 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

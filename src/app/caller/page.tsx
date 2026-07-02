import React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import dbConnect from "@/lib/db";
import { getLeadModel } from "@/models/lead.model";
import { ILead, LeadStatus, FollowUpStatus, SiteVisitStatus } from "@/types/lead";
import CallerPriorityQueue from "./CallerPriorityQueue";

export const revalidate = 0;

export default async function CallerDashboard() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  await dbConnect();

  // 1. Fetch leads assigned to this caller from the central container
  const callerLeadsRaw = await getLeadModel("lead_container").find({ assignedTo: session.userId }).lean();

  interface DBLeadType {
    _id: { toString(): string };
    name: string;
    phone: string;
    primaryPhone?: string;
    secondaryPhone?: string;
    projectName?: string;
    address?: string;
    country?: string;
    email?: string;
    source: string;
    sourceType?: string;
    sourceName?: string;
    projectId?: { toString(): string };
    assignedTo?: { toString(): string };
    assignedAt?: Date | string;
    assignedBy?: { toString(): string };
    status: LeadStatus;
    followUp?: {
      date?: Date | string;
      status: FollowUpStatus;
      notes?: string;
    };
    siteVisit?: {
      date?: Date | string;
      status: SiteVisitStatus;
      notes?: string;
    };
    dnd?: boolean;
    nextFollowUp?: Date | string;
    city?: string;
    state?: string;
    siteVisitDate?: Date | string;
    siteVisitStatus?: SiteVisitStatus;
    siteVisitNotes?: string;
    handedOffToAdmin?: boolean;
    handedOffAt?: Date | string;
    handedOffBy?: { toString(): string };
    updatedBy?: { toString(): string };
    createdAt?: Date | string;
    collectionType?: string;
    updatedAt?: Date;
  }

  // Map and tag each lead with its collectionType
  const callerLeads = (callerLeadsRaw as unknown as DBLeadType[]).map((l) => ({
    ...l,
    collectionType: l.collectionType || (l as { sourceCollection?: string }).sourceCollection || "leads"
  }));

  // Get start of today in Indian Standard Time (IST) for called-today checks
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
  const startOfTodayIST = new Date(`${year}-${month}-${day}T00:00:00+05:30`);

  // Sort: NEW/CALLED leads at the top, and leads called & marked today at the bottom
  callerLeads.sort((a, b) => {
    const isNewOrCalledA = a.status === LeadStatus.NEW || a.status === LeadStatus.CALLED;
    const isNewOrCalledB = b.status === LeadStatus.NEW || b.status === LeadStatus.CALLED;

    const wasCalledTodayA = !isNewOrCalledA && a.updatedAt && new Date(a.updatedAt) >= startOfTodayIST;
    const wasCalledTodayB = !isNewOrCalledB && b.updatedAt && new Date(b.updatedAt) >= startOfTodayIST;

    // Group 1: Not called/marked today; Group 2: Called and marked today (should go to bottom)
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

  // 2. Serialize database models to plain objects to avoid NextJS SSR warnings
  const serializedLeads: ILead[] = (callerLeads as unknown as DBLeadType[]).map((lead) => ({
    _id: lead._id ? lead._id.toString() : "",
    name: lead.name,
    phone: lead.phone,
    primaryPhone: lead.primaryPhone,
    secondaryPhone: lead.secondaryPhone,
    projectName: lead.projectName,
    address: lead.address,
    country: lead.country,
    email: lead.email,
    source: lead.source,
    sourceType: lead.sourceType,
    sourceName: lead.sourceName,
    projectId: lead.projectId ? lead.projectId.toString() : undefined,
    assignedTo: lead.assignedTo ? lead.assignedTo.toString() : undefined,
    assignedAt: lead.assignedAt ? new Date(lead.assignedAt) : undefined,
    assignedBy: lead.assignedBy ? lead.assignedBy.toString() : undefined,
    status: lead.status,
    followUp: lead.followUp
      ? {
          date: lead.followUp.date ? new Date(lead.followUp.date) : undefined,
          status: lead.followUp.status,
          notes: lead.followUp.notes,
        }
      : undefined,
    siteVisit: lead.siteVisit
      ? {
          date: lead.siteVisit.date ? new Date(lead.siteVisit.date) : undefined,
          status: lead.siteVisit.status,
          notes: lead.siteVisit.notes,
        }
      : undefined,
    dnd: lead.dnd,
    nextFollowUp: lead.nextFollowUp ? new Date(lead.nextFollowUp) : undefined,
    city: lead.city,
    state: lead.state,
    siteVisitDate: lead.siteVisitDate ? new Date(lead.siteVisitDate) : undefined,
    siteVisitStatus: lead.siteVisitStatus,
    siteVisitNotes: lead.siteVisitNotes,
    handedOffToAdmin: lead.handedOffToAdmin,
    handedOffAt: lead.handedOffAt ? new Date(lead.handedOffAt) : undefined,
    handedOffBy: lead.handedOffBy ? lead.handedOffBy.toString() : undefined,
    updatedBy: lead.updatedBy ? lead.updatedBy.toString() : undefined,
    createdAt: lead.createdAt ? new Date(lead.createdAt) : undefined,
    updatedAt: lead.updatedAt ? new Date(lead.updatedAt) : undefined,
    collectionType: lead.collectionType,
    sourceDetails: (lead as any).sourceDetails,
  }));


  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Calling Desk & Lead Queue</h1>
        <p className="text-sm text-slate-500 mt-1">Contact assigned clients, log response status, and note site interest.</p>
      </div>

      {/* Render Client Side Priority Queue Dashboard */}
      <CallerPriorityQueue leads={serializedLeads} />
    </div>
  );
}

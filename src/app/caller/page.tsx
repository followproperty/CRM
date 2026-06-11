import React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import dbConnect from "@/lib/db";
import Lead from "@/models/lead.model";
import { ILead } from "@/types/lead";
import CallerPriorityQueue from "./CallerPriorityQueue";

export const revalidate = 0;

export default async function CallerDashboard() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  await dbConnect();

  // 1. Fetch leads assigned to this caller
  const callerLeads = (await Lead.find({ assignedTo: session.userId })
    .sort({ updatedAt: -1 })
    .lean()) as unknown as ILead[];

  // 2. Serialize database models to plain objects to avoid NextJS SSR warnings
  const serializedLeads: ILead[] = callerLeads.map((lead) => ({
    _id: lead._id ? lead._id.toString() : "",
    name: lead.name,
    phone: lead.phone,
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

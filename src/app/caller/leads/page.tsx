import React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import dbConnect from "@/lib/db";
import { Lead, UploadedLead } from "@/models/lead.model";
import { ILead, LeadStatus, FollowUpStatus, SiteVisitStatus } from "@/types/lead";
import LeadsFilters from "./LeadsFilters";
import CallerLeadsTable from "./CallerLeadsTable";

export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
  }>;
}

export default async function CallerLeadsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const params = await searchParams;
  const search = params.search || "";
  const statusFilter = params.status || "ALL";

  let leads: ILead[] = [];
  let error: string | null = null;

  try {
    await dbConnect();

    // Construct Mongo query
    const query: Record<string, unknown> = {
      assignedTo: session.userId,
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    if (statusFilter && statusFilter !== "ALL") {
      query.status = statusFilter;
    }

    // Query both collections concurrently
    const [leadsRaw, uploadedLeadsRaw] = await Promise.all([
      Lead.find(query).lean(),
      UploadedLead.find(query).lean()
    ]);

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
      collectionType?: string;
      updatedAt?: Date;
      updatedBy?: { toString(): string };
      createdAt?: Date | string;
    }

    // Tag and merge
    const mergedLeads = [
      ...(leadsRaw as unknown as DBLeadType[]).map(l => ({ ...l, collectionType: "leads" })),
      ...(uploadedLeadsRaw as unknown as DBLeadType[]).map(l => ({ ...l, collectionType: "uploaded_leads" }))
    ];

    // Get start of today in Indian Standard Time (IST) for called-today checks
    const now = new Date();
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istTime = new Date(utcTime + (330 * 60000));
    const istMidnight = new Date(
      istTime.getFullYear(),
      istTime.getMonth(),
      istTime.getDate(),
      0, 0, 0, 0
    );
    const startOfTodayIST = new Date(istMidnight.getTime() - (330 * 60000));

    // Sort: NEW and uncalled-today leads at the top, called-today leads at the bottom
    mergedLeads.sort((a, b) => {
      const isNewA = a.status === LeadStatus.NEW;
      const isNewB = b.status === LeadStatus.NEW;

      const wasCalledTodayA = !isNewA && a.updatedAt && new Date(a.updatedAt) >= startOfTodayIST;
      const wasCalledTodayB = !isNewB && b.updatedAt && new Date(b.updatedAt) >= startOfTodayIST;

      // Group 1: Not called today; Group 2: Called today (should go to bottom)
      if (wasCalledTodayA && !wasCalledTodayB) return 1;
      if (!wasCalledTodayA && wasCalledTodayB) return -1;

      // If both are in the same group (both not called today, or both called today)
      if (!wasCalledTodayA) {
        // Pinned NEW leads at the top of Group 1
        if (isNewA && !isNewB) return -1;
        if (!isNewA && isNewB) return 1;

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

    // Serialize database models
    leads = (mergedLeads as unknown as DBLeadType[]).map((lead) => ({
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
    }));
  } catch (err) {
    console.error("Failed to fetch assigned leads for caller:", err);
    error = "Unable to load leads from the database. Please try again later.";
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Assigned Leads Registry</h1>
        <p className="text-sm text-slate-505 mt-1">Review your allocated client accounts and update calling status flags.</p>
      </div>

      {/* Filter Options */}
      <LeadsFilters />

      {/* Error Alert Display */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 rounded-xl">
          {error}
        </div>
      )}

      {/* Leads Registry Table */}
      {!error && <CallerLeadsTable leads={leads} />}
    </div>
  );
}

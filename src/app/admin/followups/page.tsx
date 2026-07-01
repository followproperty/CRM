import React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import dbConnect from "@/lib/db";
import { LeadContainer } from "@/models/lead.model";
import { UserRole } from "@/types/user";
import { LeadStatus } from "@/types/lead";
import FollowupsDashboardView from "@/components/followups/FollowupsDashboardView";

export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
  }>;
}

interface DBLead {
  _id: { toString(): string };
  name: string;
  phone: string;
  status: LeadStatus;
  nextFollowUp?: Date;
  updatedAt?: Date;
  assignedTo?: {
    name: string;
    email: string;
  } | null;
  source: string;
  collectionType?: string;
  projectName?: string;
  city?: string;
  budgetValue?: string;
  budgetUnit?: string;
  configuration?: string;
  possessionTimeline?: string;
  maybeLaterTimeframe?: string;
  maybeLaterDate?: Date;
}

export default async function AdminFollowupsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || (session.role !== UserRole.ADMIN && session.role !== UserRole.SUPER_ADMIN)) {
    redirect("/login");
  }

  const params = await searchParams;
  const search = params.search || "";
  const statusFilter = params.status || "ALL";

  let interestedLeads: DBLead[] = [];
  let callLaterLeads: DBLead[] = [];
  let todaysFollowups: DBLead[] = [];
  let overdueFollowups: DBLead[] = [];

  try {
    await dbConnect();

    // Setup base filters for search and status
    const baseFilter: Record<string, unknown> = {};

    if (search) {
      baseFilter.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    if (statusFilter && statusFilter !== "ALL") {
      baseFilter.status = statusFilter;
    }

    // Define date ranges for today's and overdue follow-ups
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Queries
    // 1. Interested Leads (Only query if no conflicting statusFilter)
    if (statusFilter === "ALL" || statusFilter === LeadStatus.INTERESTED) {
      interestedLeads = await LeadContainer.find({ ...baseFilter, status: LeadStatus.INTERESTED })
        .populate("assignedTo", "name email")
        .sort({ updatedAt: -1 })
        .lean() as unknown as DBLead[];
    }

    // 2. Call Later Leads
    if (statusFilter === "ALL" || statusFilter === LeadStatus.FOLLOW_UP) {
      callLaterLeads = await LeadContainer.find({ ...baseFilter, status: LeadStatus.FOLLOW_UP })
        .populate("assignedTo", "name email")
        .sort({ nextFollowUp: 1 })
        .lean() as unknown as DBLead[];
    }

    // 3. Today's Followups
    if (statusFilter === "ALL" || statusFilter === LeadStatus.FOLLOW_UP) {
      todaysFollowups = await LeadContainer.find({
        ...baseFilter,
        status: LeadStatus.FOLLOW_UP,
        nextFollowUp: { $gte: startOfToday, $lte: endOfToday },
      }).populate("assignedTo", "name email").sort({ nextFollowUp: 1 }).lean() as unknown as DBLead[];
    }

    // 4. Overdue Followups
    if (statusFilter === "ALL" || statusFilter === LeadStatus.FOLLOW_UP) {
      overdueFollowups = await LeadContainer.find({
        ...baseFilter,
        status: LeadStatus.FOLLOW_UP,
        nextFollowUp: { $lt: startOfToday },
      }).populate("assignedTo", "name email").sort({ nextFollowUp: 1 }).lean() as unknown as DBLead[];
    }
  } catch (err) {
    console.error("Failed to fetch follow-ups in admin dashboard:", err);
  }

  // Type-cast safe conversion helper to avoid any-lint warning
  const mapLead = (l: DBLead) => ({
    _id: l._id.toString(),
    name: l.name,
    phone: l.phone,
    status: l.status,
    nextFollowUp: l.nextFollowUp ? new Date(l.nextFollowUp).toISOString() : undefined,
    assignedTo: l.assignedTo
      ? {
          name: l.assignedTo.name,
          email: l.assignedTo.email,
        }
      : null,
    source: l.source,
    collectionType: l.collectionType,
    projectName: l.projectName,
    city: l.city,
    budgetValue: l.budgetValue,
    budgetUnit: l.budgetUnit,
    configuration: l.configuration,
    possessionTimeline: l.possessionTimeline,
    maybeLaterTimeframe: l.maybeLaterTimeframe,
    maybeLaterDate: l.maybeLaterDate ? new Date(l.maybeLaterDate).toISOString() : undefined,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Follow-ups Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          Monitor caller callbacks, review client site visits and follow-up schedules.
        </p>
      </div>

      <FollowupsDashboardView
        interestedLeads={interestedLeads.map(mapLead)}
        callLaterLeads={callLaterLeads.map(mapLead)}
        todaysFollowups={todaysFollowups.map(mapLead)}
        overdueFollowups={overdueFollowups.map(mapLead)}
      />
    </div>
  );
}

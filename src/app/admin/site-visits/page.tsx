import React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import dbConnect from "@/lib/db";
import Lead from "@/models/lead.model";
import { UserRole } from "@/types/user";
import { LeadStatus, SiteVisitStatus } from "@/types/lead";
import SiteVisitsDashboardView from "@/components/site-visits/SiteVisitsDashboardView";

export const revalidate = 0;

interface PageProps {
  searchParams: Promise<{
    search?: string;
    visitStatus?: string;
  }>;
}

interface DBSiteVisitLead {
  _id: { toString(): string };
  name: string;
  phone: string;
  status: LeadStatus;
  siteVisitDate?: Date;
  siteVisitStatus?: SiteVisitStatus;
  siteVisitNotes?: string;
  assignedTo?: {
    name: string;
    email: string;
  } | null;
  source: string;
}

export default async function AdminSiteVisitsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || (session.role !== UserRole.ADMIN && session.role !== UserRole.SUPER_ADMIN)) {
    redirect("/login");
  }

  const params = await searchParams;
  const search = params.search || "";
  const visitStatusFilter = params.visitStatus || "ALL";

  let upcomingVisits: DBSiteVisitLead[] = [];
  let completedVisits: DBSiteVisitLead[] = [];
  let cancelledVisits: DBSiteVisitLead[] = [];

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

    if (visitStatusFilter && visitStatusFilter !== "ALL") {
      baseFilter.siteVisitStatus = visitStatusFilter;
    }

    // Queries
    // 1. Upcoming Visits
    if (visitStatusFilter === "ALL" || visitStatusFilter === SiteVisitStatus.SCHEDULED) {
      const docs = await Lead.find({ ...baseFilter, siteVisitStatus: SiteVisitStatus.SCHEDULED })
        .populate("assignedTo", "name email")
        .sort({ siteVisitDate: 1 })
        .lean();
      upcomingVisits = docs as unknown as DBSiteVisitLead[];
    }

    // 2. Completed Visits
    if (visitStatusFilter === "ALL" || visitStatusFilter === SiteVisitStatus.COMPLETED) {
      const docs = await Lead.find({ ...baseFilter, siteVisitStatus: SiteVisitStatus.COMPLETED })
        .populate("assignedTo", "name email")
        .sort({ siteVisitDate: -1 })
        .lean();
      completedVisits = docs as unknown as DBSiteVisitLead[];
    }

    // 3. Cancelled & No-show Visits
    if (
      visitStatusFilter === "ALL" ||
      visitStatusFilter === SiteVisitStatus.CANCELLED ||
      visitStatusFilter === SiteVisitStatus.NO_SHOW
    ) {
      const cancelledStatusFilter =
        visitStatusFilter === "ALL"
          ? { $in: [SiteVisitStatus.CANCELLED, SiteVisitStatus.NO_SHOW] }
          : visitStatusFilter;
      const docs = await Lead.find({ ...baseFilter, siteVisitStatus: cancelledStatusFilter })
        .populate("assignedTo", "name email")
        .sort({ siteVisitDate: -1 })
        .lean();
      cancelledVisits = docs as unknown as DBSiteVisitLead[];
    }
  } catch (err) {
    console.error("Failed to fetch site visits in admin dashboard:", err);
  }

  // Type-cast safe conversion helper to avoid any-lint warning
  const mapLead = (l: DBSiteVisitLead) => ({
    _id: l._id.toString(),
    name: l.name,
    phone: l.phone,
    status: l.status,
    siteVisitDate: l.siteVisitDate ? new Date(l.siteVisitDate).toISOString() : undefined,
    siteVisitStatus: l.siteVisitStatus,
    siteVisitNotes: l.siteVisitNotes,
    assignedTo: l.assignedTo
      ? {
          name: l.assignedTo.name,
          email: l.assignedTo.email,
        }
      : null,
    source: l.source,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Site Visits Dashboard</h1>
        <p className="text-sm text-slate-505 mt-1">
          Monitor scheduled properties site visits, review status history, and client response logs.
        </p>
      </div>

      <SiteVisitsDashboardView
        upcomingVisits={upcomingVisits.map(mapLead)}
        completedVisits={completedVisits.map(mapLead)}
        cancelledVisits={cancelledVisits.map(mapLead)}
      />
    </div>
  );
}

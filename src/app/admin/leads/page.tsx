import React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import dbConnect from "@/lib/db";
import Lead from "@/models/lead.model";
import User from "@/models/user.model";
import { ILead, LeadStatus } from "@/types/lead";
import { UserRole } from "@/types/user";
import LeadsFilters from "../../super-admin/leads/LeadsFilters";
import SuperAdminLeadsTable from "../../super-admin/leads/SuperAdminLeadsTable";

// Force models registration
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _models = { User, Lead };

interface PageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
    assignment?: string;
    page?: string;
  }>;
}

interface PopulatedLead extends Omit<ILead, "assignedTo"> {
  assignedTo?: {
    _id: string;
    name: string;
  } | null;
}

interface DBPopulatedLead {
  _id: { toString(): string };
  name: string;
  phone: string;
  email?: string;
  source: string;
  sourceType?: string;
  sourceName?: string;
  projectId?: { toString(): string };
  assignedTo?: {
    _id: { toString(): string };
    name: string;
  } | null;
  assignedAt?: Date;
  assignedBy?: { toString(): string };
  status: string;
  dnd?: boolean;
  city?: string;
  state?: string;
  createdAt: Date;
  updatedAt: Date;
}

export const revalidate = 0;

export default async function AdminLeadsPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session || (session.role !== UserRole.ADMIN && session.role !== UserRole.SUPER_ADMIN)) {
    redirect("/login");
  }

  const params = await searchParams;
  const search = params.search || "";
  const statusFilter = params.status || "ALL";
  const assignmentFilter = params.assignment || "ALL";
  const currentPage = Math.max(1, parseInt(params.page || "1") || 1);
  const LIMIT = 50;

  let leads: PopulatedLead[] = [];
  let eligibleUsers: { _id: string; name: string; role: string; activeCount: number }[] = [];
  let totalCount = 0;
  let totalUnassignedCount = 0;
  let oldestUnassignedIds: string[] = [];
  let error: string | null = null;

  try {
    await dbConnect();

    // Construct Mongo query
    const query: Record<string, unknown> = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }
    if (statusFilter && statusFilter !== "ALL") {
      query.status = statusFilter;
    }
    if (assignmentFilter === "UNASSIGNED") {
      query.$or = [
        { assignedTo: null },
        { assignedTo: { $exists: false } }
      ];
    } else if (assignmentFilter === "ASSIGNED") {
      query.assignedTo = { $ne: null, $exists: true };
    }

    // Count matching documents for pagination
    totalCount = await Lead.countDocuments(query);

    // Get total unassigned leads (database-wide)
    totalUnassignedCount = await Lead.countDocuments({
      $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }]
    });

    // Get oldest unassigned lead IDs for Quick Allocation
    const oldestUnassignedDocs = await Lead.find({
      $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }]
    })
      .select("_id")
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    oldestUnassignedIds = oldestUnassignedDocs.map((doc) => doc._id.toString());

    // Fetch paginated leads
    const leadDocs = await Lead.find(query)
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * LIMIT)
      .limit(LIMIT)
      .lean();

    // Serialize database models to plain objects
    leads = (leadDocs as unknown as DBPopulatedLead[]).map((lead) => ({
      _id: lead._id.toString(),
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      source: lead.source,
      sourceType: lead.sourceType,
      sourceName: lead.sourceName,
      projectId: lead.projectId ? lead.projectId.toString() : undefined,
      assignedTo: lead.assignedTo
        ? {
            _id: lead.assignedTo._id.toString(),
            name: lead.assignedTo.name,
          }
        : null,
      assignedAt: lead.assignedAt ? new Date(lead.assignedAt) : undefined,
      assignedBy: lead.assignedBy ? lead.assignedBy.toString() : undefined,
      status: lead.status as LeadStatus,
      dnd: lead.dnd,
      city: lead.city,
      state: lead.state,
      createdAt: lead.createdAt ? new Date(lead.createdAt) : undefined,
      updatedAt: lead.updatedAt ? new Date(lead.updatedAt) : undefined,
    }));

    const terminalStatuses = [
      LeadStatus.CUSTOMER,
      LeadStatus.LOST,
      LeadStatus.NOT_INTERESTED,
      LeadStatus.DND,
      LeadStatus.WRONG_NUMBER
    ];
    const activeStatuses = Object.values(LeadStatus).filter(
      (status) => !terminalStatuses.includes(status)
    );

    const userDocs = await User.find({
      role: { $in: [UserRole.CALLER, UserRole.ADMIN] },
      isActive: true,
    })
      .select("name role")
      .sort({ name: 1 })
      .lean();

    eligibleUsers = await Promise.all(
      userDocs.map(async (u) => {
        const activeCount = await Lead.countDocuments({
          assignedTo: u._id,
          status: { $in: activeStatuses }
        });
        return {
          _id: u._id.toString(),
          name: u.name,
          role: u.role,
          activeCount,
        };
      })
    );
  } catch (err) {
    console.error("Failed to fetch leads for admin:", err);
    error = "Unable to load leads from the database. Please try again later.";
  }

  const totalPages = Math.ceil(totalCount / LIMIT);

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Leads Registry</h1>
        <p className="text-sm text-slate-500 mt-1">Leads allocation console and caller team load monitoring.</p>
      </div>

      {/* Filter Component */}
      <LeadsFilters />

      {/* Error State */}
      {error && (
        <div className="bg-red-550/10 border border-red-500/20 text-red-700 text-sm p-4 rounded-xl flex items-center gap-3">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Leads Table Client Component wrapper */}
      {!error && (
        <SuperAdminLeadsTable
          leads={leads}
          eligibleUsers={eligibleUsers}
          totalCount={totalCount}
          currentPage={currentPage}
          totalPages={totalPages}
          totalUnassignedCount={totalUnassignedCount}
          oldestUnassignedIds={oldestUnassignedIds}
        />
      )}
    </div>
  );
}

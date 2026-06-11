import React from "react";
import dbConnect from "@/lib/db";
import Lead from "@/models/lead.model";
import User from "@/models/user.model";
import { ILead, LeadStatus } from "@/types/lead";
import { UserRole } from "@/types/user";
import LeadsFilters from "./LeadsFilters";
import SuperAdminLeadsTable from "./SuperAdminLeadsTable";

interface PageProps {
  searchParams: Promise<{
    search?: string;
    status?: string;
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

export default async function SuperAdminLeadsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.search || "";
  const statusFilter = params.status || "ALL";

  let leads: PopulatedLead[] = [];
  let eligibleUsers: { _id: string; name: string; role: string }[] = [];
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

    const leadDocs = await Lead.find(query)
      .populate("assignedTo", "name")
      .sort({ createdAt: -1 })
      .lean();

    // Serialize database models to plain objects, ensuring populated fields are parsed correctly
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

    const userDocs = await User.find({
      role: { $in: [UserRole.CALLER, UserRole.ADMIN] },
      isActive: true,
    })
      .select("name role")
      .sort({ name: 1 })
      .lean();

    eligibleUsers = userDocs.map((u) => ({
      _id: u._id.toString(),
      name: u.name,
      role: u.role,
    }));
  } catch (err) {
    console.error("Failed to fetch leads for super admin:", err);
    error = "Unable to load leads from the database. Please try again later.";
  }

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Leads Registry</h1>
        <p className="text-sm text-slate-500 mt-1">Read-only view of all registered leads in the system.</p>
      </div>

      {/* Filter Component */}
      <LeadsFilters />

      {/* Error State */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-xl flex items-center gap-3">
          <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* SuperAdminLeadsTable Client Component wrapper */}
      {!error && <SuperAdminLeadsTable leads={leads} eligibleUsers={eligibleUsers} />}
    </div>
  );
}

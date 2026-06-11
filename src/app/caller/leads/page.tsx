import React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import dbConnect from "@/lib/db";
import Lead from "@/models/lead.model";
import { ILead } from "@/types/lead";
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

    const leadDocs = await Lead.find(query)
      .sort({ updatedAt: -1 })
      .lean();

    leads = leadDocs as unknown as ILead[];
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

import React from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import dbConnect from "@/lib/db";
import Lead from "@/models/lead.model";
import Project from "@/models/project.model"; // Ensure model registers
import User from "@/models/user.model";       // Ensure model registers
import { UserRole } from "@/types/user";
import { LeadStatus } from "@/types/lead";
import WhatsAppFollowupsView, { PopulatedWhatsAppLead } from "@/components/whatsapp/WhatsAppFollowupsView";

// Register Mongoose schemas to avoid lazy loading missing model errors
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _models = { Project, User };

export const revalidate = 0;

interface DBPopulatedWhatsAppLead {
  _id: { toString(): string };
  name: string;
  phone: string;
  status: string;
  handedOffAt?: Date;
  assignedTo?: {
    name: string;
    email: string;
  } | null;
  projectId?: {
    name: string;
  } | null;
  source: string;
  email?: string;
  city?: string;
  state?: string;
}

export default async function AdminWhatsAppFollowupsPage() {
  const session = await getSession();
  if (!session || (session.role !== UserRole.ADMIN && session.role !== UserRole.SUPER_ADMIN)) {
    redirect("/login");
  }

  let leads: PopulatedWhatsAppLead[] = [];
  try {
    await dbConnect();

    // Query leads handed off to admin, sorted by handoff date descending
    const docs = await Lead.find({ handedOffToAdmin: true })
      .populate("assignedTo", "name email")
      .populate("projectId", "name")
      .sort({ handedOffAt: -1 })
      .lean();

    leads = (docs as unknown as DBPopulatedWhatsAppLead[]).map((lead) => ({
      _id: lead._id.toString(),
      name: lead.name,
      phone: lead.phone,
      status: lead.status as LeadStatus,
      handedOffAt: lead.handedOffAt ? new Date(lead.handedOffAt).toISOString() : undefined,
      assignedTo: lead.assignedTo
        ? {
            name: lead.assignedTo.name,
            email: lead.assignedTo.email,
          }
        : null,
      projectId: lead.projectId
        ? {
            name: lead.projectId.name,
          }
        : null,
      source: lead.source,
      email: lead.email,
      city: lead.city,
      state: lead.state,
    }));
  } catch (error) {
    console.error("Failed to fetch WhatsApp handoffs for admin:", error);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">WhatsApp Follow-ups</h1>
        <p className="text-sm text-slate-500 mt-1">
          Review caller handoff requests, send client project documents, and track chat interaction states.
        </p>
      </div>

      <WhatsAppFollowupsView leads={leads} />
    </div>
  );
}

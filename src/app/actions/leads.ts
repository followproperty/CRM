"use server";

import { Types } from "mongoose";
import dbConnect from "@/lib/db";
import Lead from "@/models/lead.model";
import Activity from "@/models/activity.model";
import User from "@/models/user.model";
import Note from "@/models/note.model";
import { getSession } from "@/lib/session";
import { ActivityAction } from "@/types/activity";
import { UserRole } from "@/types/user";
import { revalidatePath } from "next/cache";
import { LeadStatus, FollowUpStatus, SiteVisitStatus, ILead } from "@/types/lead";
import {
  triggerInterestedLeadNotification,
  triggerAdminHandoffNotification,
  triggerWhatsAppDetailsSentNotification,
  triggerSiteVisitScheduledNotification,
  triggerCustomerWonNotification,
} from "./notifications";

export interface AssignLeadResult {
  success: boolean;
  error?: string;
}

export async function assignLeadAction(leadId: string, assigneeId: string | null): Promise<AssignLeadResult> {
  const session = await getSession();
  if (!session || (session.role !== UserRole.SUPER_ADMIN && session.role !== UserRole.ADMIN)) {
    return { success: false, error: "Unauthorized. Admin or Super Admin access required." };
  }

  try {
    await dbConnect();

    // Verify lead exists
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return { success: false, error: "Lead not found." };
    }

    if (assigneeId) {
      // Verify assignee exists and is CALLER or ADMIN
      const assignee = await User.findById(assigneeId);
      if (!assignee) {
        return { success: false, error: "Assignee not found." };
      }

      if (assignee.role !== UserRole.CALLER && assignee.role !== UserRole.ADMIN) {
        return { success: false, error: "Leads can only be assigned to Callers or Admins." };
      }

      // Perform assignment
      lead.assignedTo = assignee._id;
      lead.assignedAt = new Date();
      lead.assignedBy = session.userId;
      await lead.save();

      // Log assignment activity
      await Activity.create({
        leadId: lead._id,
        userId: session.userId,
        action: ActivityAction.LEAD_ASSIGNED,
        note: `Lead assigned to: ${assignee.name}`,
        metadata: {
          assignedTo: assignee._id.toString(),
          assignedBy: session.userId,
          assigneeName: assignee.name,
        },
      });
    } else {
      // Unassign the lead
      const prevAssigneeId = lead.assignedTo;
      lead.assignedTo = undefined;
      lead.assignedAt = undefined;
      lead.assignedBy = undefined;
      await lead.save();

      // Log unassignment activity
      await Activity.create({
        leadId: lead._id,
        userId: session.userId,
        action: ActivityAction.LEAD_ASSIGNED,
        note: `Lead unassigned`,
        metadata: {
          assignedTo: null,
          assignedBy: session.userId,
          prevAssigneeId: prevAssigneeId ? prevAssigneeId.toString() : null,
        },
      });
    }

    revalidatePath("/super-admin/leads");
    return { success: true };
  } catch (error) {
    console.error("Assign lead error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

export interface UpdateLeadStatusResult {
  success: boolean;
  error?: string;
}

export async function updateLeadStatusAction(
  leadId: string,
  status: LeadStatus,
  followUpDateStr?: string | null,
  noteText?: string | null
): Promise<UpdateLeadStatusResult> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Unauthorized." };
  }

  try {
    await dbConnect();

    // Verify lead exists
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return { success: false, error: "Lead not found." };
    }

    // Verify caller is assigned to this lead (or is admin/superadmin)
    if (session.role === UserRole.CALLER && lead.assignedTo?.toString() !== session.userId) {
      return { success: false, error: "You are not authorized to update this lead's status." };
    }

    // Update status and last modifier details
    lead.status = status;
    lead.updatedBy = session.userId;

    let activityAction = ActivityAction.CALL_MADE;
    let activityNote = `Status updated to ${status}`;

    if (status === LeadStatus.INTERESTED) {
      activityAction = ActivityAction.INTERESTED;
    } else if (status === LeadStatus.NOT_INTERESTED) {
      activityAction = ActivityAction.NOT_INTERESTED;
    } else if (status === LeadStatus.DND) {
      activityAction = ActivityAction.DND;
      lead.dnd = true;
    } else if (status === LeadStatus.FOLLOW_UP) {
      activityAction = ActivityAction.CALL_LATER;
      if (!followUpDateStr) {
        return { success: false, error: "Follow-up date and time is required for Call Later." };
      }
      const parsedDate = new Date(followUpDateStr);
      if (isNaN(parsedDate.getTime())) {
        return { success: false, error: "Invalid follow-up date and time format." };
      }
      lead.nextFollowUp = parsedDate;
      lead.followUp = {
        date: parsedDate,
        status: FollowUpStatus.PENDING,
        notes: noteText || `Scheduled callback for ${parsedDate.toLocaleString()}`,
      };
      activityNote = `Scheduled callback for ${parsedDate.toLocaleString()}`;
    } else if (status === LeadStatus.WRONG_NUMBER) {
      activityAction = ActivityAction.WRONG_NUMBER;
    }

    // Save Note historically if noteText is provided
    if (noteText && noteText.trim()) {
      await Note.create({
        leadId,
        userId: session.userId,
        note: noteText.trim(),
      });
      activityNote = `${activityNote} - Note: ${noteText.trim()}`;
    }

    await lead.save();

    // Trigger notification if status is INTERESTED
    if (status === LeadStatus.INTERESTED) {
      await triggerInterestedLeadNotification(lead);
    }

    // Log update activity
    await Activity.create({
      leadId: lead._id,
      userId: session.userId,
      action: activityAction,
      note: activityNote,
      metadata: {
        status,
        updatedBy: session.userId,
        followUpDate: followUpDateStr || null,
        noteText: noteText || null,
      },
    });

    revalidatePath("/caller/leads");
    revalidatePath("/caller");
    revalidatePath("/super-admin/leads");
    revalidatePath("/admin/leads");
    revalidatePath("/admin/followups");
    revalidatePath("/super-admin/followups");

    return { success: true };
  } catch (error) {
    console.error("Update lead status error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

export interface ScheduleSiteVisitResult {
  success: boolean;
  error?: string;
}

export async function scheduleSiteVisitAction(
  leadId: string,
  visitDateStr: string,
  notes?: string
): Promise<ScheduleSiteVisitResult> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Unauthorized." };
  }

  try {
    await dbConnect();

    // Verify lead exists
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return { success: false, error: "Lead not found." };
    }

    // Verify caller is assigned to this lead (or is admin/superadmin)
    if (session.role === UserRole.CALLER && lead.assignedTo?.toString() !== session.userId) {
      return { success: false, error: "You are not authorized to update this lead's status." };
    }

    const parsedDate = new Date(visitDateStr);
    if (isNaN(parsedDate.getTime())) {
      return { success: false, error: "Invalid visit date and time format." };
    }

    // Save Note historically if notes are provided
    if (notes && notes.trim()) {
      await Note.create({
        leadId,
        userId: session.userId,
        note: notes.trim(),
      });
    }

    // Update lead properties
    lead.status = LeadStatus.SITE_VISIT;
    lead.siteVisitDate = parsedDate;
    lead.siteVisitStatus = SiteVisitStatus.SCHEDULED;
    lead.siteVisitNotes = notes || "";
    lead.updatedBy = session.userId;

    await lead.save();

    // Trigger notification
    await triggerSiteVisitScheduledNotification(lead);

    // Log update activity
    await Activity.create({
      leadId: lead._id,
      userId: session.userId,
      action: ActivityAction.SITE_VISIT_SCHEDULED,
      note: `Site visit scheduled for ${parsedDate.toLocaleString()}. Notes: ${notes || "None"}`,
      metadata: {
        siteVisitDate: parsedDate.toISOString(),
        siteVisitStatus: SiteVisitStatus.SCHEDULED,
        siteVisitNotes: notes || "",
        updatedBy: session.userId,
      },
    });

    revalidatePath("/caller/leads");
    revalidatePath("/caller");
    revalidatePath("/super-admin/leads");
    revalidatePath("/admin/leads");
    revalidatePath("/admin/site-visits");
    revalidatePath("/super-admin/site-visits");

    return { success: true };
  } catch (error) {
    console.error("Schedule site visit error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

export async function startNegotiationAction(leadId: string): Promise<UpdateLeadStatusResult> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Unauthorized." };
  }

  try {
    await dbConnect();
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return { success: false, error: "Lead not found." };
    }

    // Update lead status
    lead.status = LeadStatus.NEGOTIATION;
    lead.updatedBy = session.userId;
    await lead.save();

    // Log activity
    await Activity.create({
      leadId,
      userId: session.userId,
      action: ActivityAction.NEGOTIATION_STARTED,
      note: "Negotiation started with client",
    });

    revalidatePath("/admin/site-visits");
    revalidatePath("/super-admin/site-visits");
    revalidatePath("/caller/leads");
    revalidatePath("/super-admin/leads");
    revalidatePath("/caller");

    return { success: true };
  } catch (error) {
    console.error("Start negotiation error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

export async function markCustomerWonAction(leadId: string): Promise<UpdateLeadStatusResult> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Unauthorized." };
  }

  try {
    await dbConnect();
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return { success: false, error: "Lead not found." };
    }

    // Update lead status
    lead.status = LeadStatus.CUSTOMER;
    lead.wonAt = new Date();
    lead.updatedBy = session.userId;
    await lead.save();

    // Trigger notification
    await triggerCustomerWonNotification(lead);

    // Log activity
    await Activity.create({
      leadId,
      userId: session.userId,
      action: ActivityAction.CUSTOMER_WON,
      note: "Deal successfully closed. Customer won!",
    });

    revalidatePath("/admin/site-visits");
    revalidatePath("/super-admin/site-visits");
    revalidatePath("/caller/leads");
    revalidatePath("/super-admin/leads");
    revalidatePath("/caller");

    return { success: true };
  } catch (error) {
    console.error("Mark customer won error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

export async function markCustomerLostAction(
  leadId: string,
  reason: string
): Promise<UpdateLeadStatusResult> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Unauthorized." };
  }

  if (!reason || !reason.trim()) {
    return { success: false, error: "Lost reason is required." };
  }

  try {
    await dbConnect();
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return { success: false, error: "Lead not found." };
    }

    // Update lead status
    lead.status = LeadStatus.LOST;
    lead.lostAt = new Date();
    lead.lostReason = reason.trim();
    lead.updatedBy = session.userId;
    await lead.save();

    // Log activity
    await Activity.create({
      leadId,
      userId: session.userId,
      action: ActivityAction.CUSTOMER_LOST,
      note: `Lead marked as lost. Reason: ${reason.trim()}`,
      metadata: {
        lostReason: reason.trim(),
      },
    });

    revalidatePath("/admin/site-visits");
    revalidatePath("/super-admin/site-visits");
    revalidatePath("/caller/leads");
    revalidatePath("/super-admin/leads");
    revalidatePath("/caller");

    return { success: true };
  } catch (error) {
    console.error("Mark customer lost error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

export async function requestWhatsAppFollowupAction(leadId: string): Promise<UpdateLeadStatusResult> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Unauthorized." };
  }

  try {
    await dbConnect();
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return { success: false, error: "Lead not found." };
    }

    // Set handoff metadata
    lead.status = LeadStatus.ADMIN_FOLLOWUP;
    lead.handedOffToAdmin = true;
    lead.handedOffAt = new Date();
    lead.handedOffBy = session.userId;
    lead.updatedBy = session.userId;
    await lead.save();

    // Trigger notification
    await triggerAdminHandoffNotification(lead);

    // Log Activity
    await Activity.create({
      leadId: lead._id,
      userId: session.userId,
      action: ActivityAction.ADMIN_HANDOFF_REQUESTED,
      note: "WhatsApp follow-up requested with Admin",
    });

    revalidatePath("/admin/whatsapp");
    revalidatePath("/super-admin/whatsapp");
    revalidatePath("/admin/site-visits");
    revalidatePath("/super-admin/site-visits");
    revalidatePath("/caller/leads");
    revalidatePath("/super-admin/leads");
    revalidatePath("/caller");

    return { success: true };
  } catch (error) {
    console.error("Request WhatsApp follow-up error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

export async function markWhatsAppDetailsSentAction(leadId: string): Promise<UpdateLeadStatusResult> {
  const session = await getSession();
  if (!session || (session.role !== UserRole.ADMIN && session.role !== UserRole.SUPER_ADMIN)) {
    return { success: false, error: "Unauthorized. Admin access required." };
  }

  try {
    await dbConnect();
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return { success: false, error: "Lead not found." };
    }

    lead.status = LeadStatus.WHATSAPP_SHARED;
    lead.updatedBy = session.userId;
    await lead.save();

    // Trigger notification
    await triggerWhatsAppDetailsSentNotification(lead);

    // Log Activity
    await Activity.create({
      leadId: lead._id,
      userId: session.userId,
      action: ActivityAction.WHATSAPP_DETAILS_SENT,
      note: "WhatsApp details successfully sent to client",
    });

    revalidatePath("/admin/whatsapp");
    revalidatePath("/super-admin/whatsapp");
    revalidatePath("/admin/site-visits");
    revalidatePath("/super-admin/site-visits");
    revalidatePath("/caller/leads");
    revalidatePath("/super-admin/leads");
    revalidatePath("/caller");

    return { success: true };
  } catch (error) {
    console.error("Mark WhatsApp details sent error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

export async function startAdminFollowupAction(leadId: string): Promise<UpdateLeadStatusResult> {
  const session = await getSession();
  if (!session || (session.role !== UserRole.ADMIN && session.role !== UserRole.SUPER_ADMIN)) {
    return { success: false, error: "Unauthorized. Admin access required." };
  }

  try {
    await dbConnect();
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return { success: false, error: "Lead not found." };
    }

    lead.status = LeadStatus.ADMIN_FOLLOWUP;
    lead.updatedBy = session.userId;
    await lead.save();

    // Log Activity
    await Activity.create({
      leadId: lead._id,
      userId: session.userId,
      action: ActivityAction.ADMIN_FOLLOWUP_STARTED,
      note: "Admin WhatsApp follow-up set to in progress",
    });

    revalidatePath("/admin/whatsapp");
    revalidatePath("/super-admin/whatsapp");
    revalidatePath("/admin/site-visits");
    revalidatePath("/super-admin/site-visits");
    revalidatePath("/caller/leads");
    revalidatePath("/super-admin/leads");
    revalidatePath("/caller");

    return { success: true };
  } catch (error) {
    console.error("Start admin follow-up error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

export async function getLeadByIdAction(leadId: string): Promise<{ success: boolean; lead?: ILead; error?: string }> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }
  try {
    await dbConnect();
    const lead = await Lead.findById(leadId).lean();
    if (!lead) {
      return { success: false, error: "Lead not found" };
    }
    const serialized = {
      ...lead,
      _id: lead._id.toString(),
      assignedTo: lead.assignedTo ? lead.assignedTo.toString() : undefined,
      assignedBy: lead.assignedBy ? lead.assignedBy.toString() : undefined,
      updatedBy: lead.updatedBy ? lead.updatedBy.toString() : undefined,
      nextFollowUp: lead.nextFollowUp ? new Date(lead.nextFollowUp) : undefined,
      siteVisitDate: lead.siteVisitDate ? new Date(lead.siteVisitDate) : undefined,
      wonAt: lead.wonAt ? new Date(lead.wonAt) : undefined,
      lostAt: lead.lostAt ? new Date(lead.lostAt) : undefined,
      createdAt: lead.createdAt ? new Date(lead.createdAt) : undefined,
      updatedAt: lead.updatedAt ? new Date(lead.updatedAt) : undefined,
    };
    return { success: true, lead: serialized };
  } catch (err) {
    console.error("Get lead by ID error:", err);
    return { success: false, error: "Failed to load lead details" };
  }
}

export interface BulkAssignResult {
  success: boolean;
  error?: string;
}

export async function bulkAssignLeadsAction(leadIds: string[], assigneeId: string | null): Promise<BulkAssignResult> {
  const session = await getSession();
  if (!session || (session.role !== UserRole.SUPER_ADMIN && session.role !== UserRole.ADMIN)) {
    return { success: false, error: "Unauthorized. Admin or Super Admin access required." };
  }

  if (!leadIds || leadIds.length === 0) {
    return { success: false, error: "No leads selected." };
  }

  try {
    await dbConnect();

    let assigneeName = "Unassigned";
    if (assigneeId) {
      const assignee = await User.findById(assigneeId);
      if (!assignee) {
        return { success: false, error: "Assignee not found." };
      }
      assigneeName = assignee.name;
    }

    // Perform updates in bulk
    if (assigneeId) {
      await Lead.updateMany(
        { _id: { $in: leadIds } },
        {
          assignedTo: assigneeId,
          assignedAt: new Date(),
          assignedBy: session.userId,
        }
      );
    } else {
      await Lead.updateMany(
        { _id: { $in: leadIds } },
        {
          $unset: { assignedTo: 1, assignedAt: 1, assignedBy: 1 }
        }
      );
    }

    // Log individual lead activity entries for audit trail
    const activityPromises = leadIds.map(leadId => 
      Activity.create({
        leadId,
        userId: session.userId,
        action: ActivityAction.LEAD_ASSIGNED,
        note: assigneeId ? `Bulk assigned to: ${assigneeName}` : "Bulk unassigned",
        metadata: {
          source: "BULK_ASSIGNMENT",
          assignedTo: assigneeId ? assigneeId.toString() : null,
          assignedBy: session.userId,
          assigneeName,
        }
      })
    );
    await Promise.all(activityPromises);

    revalidatePath("/super-admin/leads");
    revalidatePath("/admin/leads");

    return { success: true };
  } catch (error) {
    console.error("Bulk assign leads error:", error);
    return { success: false, error: "An unexpected error occurred." };
  }
}

export interface AutoDistributeResult {
  success: boolean;
  assignedCount: number;
  unassignedCount: number;
  reason?: string;
  error?: string;
}

export async function autoDistributeLeadsAction(leadIds: string[], activeCap: number): Promise<AutoDistributeResult> {
  const session = await getSession();
  if (!session || (session.role !== UserRole.SUPER_ADMIN && session.role !== UserRole.ADMIN)) {
    return { success: false, assignedCount: 0, unassignedCount: leadIds.length, error: "Unauthorized." };
  }

  if (!leadIds || leadIds.length === 0) {
    return { success: false, assignedCount: 0, unassignedCount: 0, error: "No leads selected." };
  }

  try {
    await dbConnect();

    // 1. Fetch unassigned leads in this batch
    const unassignedLeads = await Lead.find({
      _id: { $in: leadIds },
      $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }]
    });

    if (unassignedLeads.length === 0) {
      return { success: true, assignedCount: 0, unassignedCount: 0 };
    }

    // 2. Fetch all active callers
    const callersRaw = await User.find({ role: UserRole.CALLER, isActive: true }).lean();
    
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

    // 3. Compute current active lead counts for each caller
    const callers = await Promise.all(
      callersRaw.map(async (caller) => {
        const activeCount = await Lead.countDocuments({
          assignedTo: caller._id,
          status: { $in: activeStatuses }
        });
        return {
          id: caller._id.toString(),
          name: caller.name,
          activeCount,
        };
      })
    );

    let assignedCount = 0;
    let unassignedCount = 0;
    let capacityReached = false;

    // 4. Distribute leads
    for (const lead of unassignedLeads) {
      // Filter callers who are below the active lead cap
      const eligibleCallers = callers.filter(c => c.activeCount < activeCap);

      if (eligibleCallers.length === 0) {
        capacityReached = true;
        unassignedCount = unassignedLeads.length - assignedCount;
        break;
      }

      // Sort callers by activeCount ascending, secondary sort by ID string comparison for balanced round-robin allocation
      eligibleCallers.sort((a, b) => {
        if (a.activeCount !== b.activeCount) {
          return a.activeCount - b.activeCount;
        }
        return a.id.localeCompare(b.id);
      });

      const chosenCaller = eligibleCallers[0];

      // Perform assignment on database
      lead.assignedTo = chosenCaller.id as unknown as Types.ObjectId;
      lead.assignedAt = new Date();
      lead.assignedBy = session.userId as unknown as Types.ObjectId;
      await lead.save();

      // Increment local activeCount tracking
      const callerObj = callers.find(c => c.id === chosenCaller.id);
      if (callerObj) {
        callerObj.activeCount++;
      }

      // Log individual activity entry for audit trail
      await Activity.create({
        leadId: lead._id,
        userId: session.userId,
        action: ActivityAction.LEAD_ASSIGNED,
        note: `Auto-distributed to: ${chosenCaller.name}`,
        metadata: {
          source: "AUTO_DISTRIBUTION",
          assignedTo: chosenCaller.id,
          assignedBy: session.userId,
          assigneeName: chosenCaller.name,
          activeLeadCap: activeCap,
        }
      });

      assignedCount++;
    }

    revalidatePath("/super-admin/leads");
    revalidatePath("/admin/leads");

    if (capacityReached) {
      return {
        success: true,
        assignedCount,
        unassignedCount,
        reason: "All callers reached maximum capacity."
      };
    }

    return {
      success: true,
      assignedCount,
      unassignedCount: 0
    };
  } catch (error) {
    console.error("Auto distribute leads error:", error);
    return { success: false, assignedCount: 0, unassignedCount: leadIds.length, error: "An unexpected error occurred." };
  }
}



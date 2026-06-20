"use server";

import dbConnect from "@/lib/db";
import { Lead, UploadedLead } from "@/models/lead.model";
import User from "@/models/user.model";
import Activity from "@/models/activity.model";
import { LeadStatus } from "@/types/lead";
import { UserRole } from "@/types/user";
import { ActivityAction } from "@/types/activity";
import { getSession } from "@/lib/session";

/**
 * Helper to calculate start and end of "Today" in Indian Standard Time (IST).
 * Returns Date objects in UTC corresponding to IST boundaries.
 */
function getISTTodayRange(): { start: Date; end: Date } {
  const now = new Date();
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  const nowIST = new Date(now.getTime() + istOffsetMs);
  
  const year = nowIST.getUTCFullYear();
  const month = nowIST.getUTCMonth();
  const date = nowIST.getUTCDate();
  
  const startIST = new Date(Date.UTC(year, month, date, 0, 0, 0, 0));
  const startUTC = new Date(startIST.getTime() - istOffsetMs);
  
  const endIST = new Date(Date.UTC(year, month, date, 23, 59, 59, 999));
  const endUTC = new Date(endIST.getTime() - istOffsetMs);
  
  return { start: startUTC, end: endUTC };
}

export interface CallerPerformanceMetrics {
  callerName: string;
  totalAssigned: number;
  activeLeads: number;
  actionedLeads: number;
  assignedToday: number;
  calledToday: number;
  callsToday: number;
  totalCalls: number;
  statusBreakdown: Record<LeadStatus, number>;
  recentActivities: Array<{
    _id: string;
    leadName: string;
    leadPhone: string;
    action: string;
    note: string;
    createdAt: Date;
  }>;
}

/**
 * Action to fetch performance metrics for a specific caller.
 */
export async function getCallerPerformanceAction(callerId: string): Promise<{
  success: boolean;
  error?: string;
  metrics?: CallerPerformanceMetrics;
}> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Unauthorized." };
  }

  // Prevent callers from looking up other callers' metrics
  if (session.role === UserRole.CALLER && session.userId !== callerId) {
    return { success: false, error: "Access denied." };
  }

  try {
    await dbConnect();

    // Verify caller exists
    const userDoc = await User.findById(callerId).select("name").lean();
    if (!userDoc) {
      return { success: false, error: "Caller not found." };
    }

    const { start: todayStart, end: todayEnd } = getISTTodayRange();

    const terminalStatuses = [
      LeadStatus.CUSTOMER,
      LeadStatus.LOST,
      LeadStatus.NOT_INTERESTED,
      LeadStatus.DND,
      LeadStatus.WRONG_NUMBER
    ];
    const activeStatuses = Object.values(LeadStatus).filter(
      (s) => !terminalStatuses.includes(s)
    );

    const callOutcomes = [
      ActivityAction.CALL_MADE,
      ActivityAction.INTERESTED,
      ActivityAction.NOT_INTERESTED,
      ActivityAction.DND,
      ActivityAction.CALL_LATER,
      ActivityAction.WRONG_NUMBER,
      ActivityAction.NOT_ANSWERED,
      ActivityAction.MAYBE_LATER
    ];

    // Queries
    const [
      totalLeadsCount, totalUploadedCount,
      activeLeadsCount, activeUploadedCount,
      calledLeadsCount, calledUploadedCount,
      assignedTodayLeads, assignedTodayUploaded,
      calledTodayLeads, calledTodayUploaded,
      callsTodayCount, totalCallsCount
    ] = await Promise.all([
      // Total Assigned
      Lead.countDocuments({ assignedTo: callerId }),
      UploadedLead.countDocuments({ assignedTo: callerId }),
      
      // Active Leads
      Lead.countDocuments({ assignedTo: callerId, status: { $in: activeStatuses } }),
      UploadedLead.countDocuments({ assignedTo: callerId, status: { $in: activeStatuses } }),
      
      // Actioned Leads (status != NEW)
      Lead.countDocuments({ assignedTo: callerId, status: { $ne: LeadStatus.NEW } }),
      UploadedLead.countDocuments({ assignedTo: callerId, status: { $ne: LeadStatus.NEW } }),
      
      // Assigned Today
      Lead.countDocuments({ assignedTo: callerId, assignedAt: { $gte: todayStart, $lte: todayEnd } }),
      UploadedLead.countDocuments({ assignedTo: callerId, assignedAt: { $gte: todayStart, $lte: todayEnd } }),
      
      // Assigned Today and called (status != NEW)
      Lead.countDocuments({ assignedTo: callerId, assignedAt: { $gte: todayStart, $lte: todayEnd }, status: { $ne: LeadStatus.NEW } }),
      UploadedLead.countDocuments({ assignedTo: callerId, assignedAt: { $gte: todayStart, $lte: todayEnd }, status: { $ne: LeadStatus.NEW } }),
      
      // Calls today
      Activity.countDocuments({ userId: callerId, action: { $in: callOutcomes }, createdAt: { $gte: todayStart, $lte: todayEnd } }),
      
      // Total calls logged all time
      Activity.countDocuments({ userId: callerId, action: { $in: callOutcomes } })
    ]);

    // Status breakdown queries
    const statusBreakdown: Record<LeadStatus, number> = {} as Record<LeadStatus, number>;
    await Promise.all(
      Object.values(LeadStatus).map(async (status) => {
        const [lCount, ulCount] = await Promise.all([
          Lead.countDocuments({ assignedTo: callerId, status }),
          UploadedLead.countDocuments({ assignedTo: callerId, status })
        ]);
        statusBreakdown[status] = lCount + ulCount;
      })
    );

    // Recent activities today
    const activitiesRaw = await Activity.find({
      userId: callerId,
      createdAt: { $gte: todayStart, $lte: todayEnd }
    })
      .sort({ createdAt: -1 })
      .limit(15)
      .lean();

    // Map lead details onto the activities logs (querying concurrently)
    const recentActivities = await Promise.all(
      activitiesRaw.map(async (act) => {
        let leadName = "Unknown Lead";
        let leadPhone = "";
        
        if (act.leadId) {
          // Attempt leads collection
          let leadDoc = await Lead.findById(act.leadId).select("name phone").lean();
          if (!leadDoc) {
            // Attempt uploaded_leads collection
            leadDoc = await UploadedLead.findById(act.leadId).select("name phone").lean();
          }
          if (leadDoc) {
            leadName = leadDoc.name;
            leadPhone = leadDoc.phone;
          }
        }

        return {
          _id: act._id.toString(),
          leadName,
          leadPhone,
          action: act.action,
          note: act.note || "",
          createdAt: act.createdAt
        };
      })
    );

    return {
      success: true,
      metrics: {
        callerName: userDoc.name,
        totalAssigned: totalLeadsCount + totalUploadedCount,
        activeLeads: activeLeadsCount + activeUploadedCount,
        actionedLeads: calledLeadsCount + calledUploadedCount,
        assignedToday: assignedTodayLeads + assignedTodayUploaded,
        calledToday: calledTodayLeads + calledTodayUploaded,
        callsToday: callsTodayCount,
        totalCalls: totalCallsCount,
        statusBreakdown,
        recentActivities
      }
    };
  } catch (error) {
    console.error("Failed to fetch caller performance metrics:", error);
    return { success: false, error: "Internal server error." };
  }
}

export interface CallerSummaryItem {
  callerId: string;
  name: string;
  email: string;
  totalAssigned: number;
  activeLeads: number;
  assignedToday: number;
  calledToday: number;
  callsToday: number;
}

/**
 * Action to fetch summary metrics of all active callers in the system.
 */
export async function getAllCallersPerformanceSummaryAction(): Promise<{
  success: boolean;
  error?: string;
  callers?: CallerSummaryItem[];
}> {
  const session = await getSession();
  if (!session || (session.role !== UserRole.ADMIN && session.role !== UserRole.SUPER_ADMIN)) {
    return { success: false, error: "Unauthorized." };
  }

  try {
    await dbConnect();

    // Get all active users with role CALLER
    const callersRaw = await User.find({
      role: UserRole.CALLER,
      isActive: true
    })
      .select("name email")
      .sort({ name: 1 })
      .lean();

    const { start: todayStart, end: todayEnd } = getISTTodayRange();

    const terminalStatuses = [
      LeadStatus.CUSTOMER,
      LeadStatus.LOST,
      LeadStatus.NOT_INTERESTED,
      LeadStatus.DND,
      LeadStatus.WRONG_NUMBER
    ];
    const activeStatuses = Object.values(LeadStatus).filter(
      (s) => !terminalStatuses.includes(s)
    );

    const callOutcomes = [
      ActivityAction.CALL_MADE,
      ActivityAction.INTERESTED,
      ActivityAction.NOT_INTERESTED,
      ActivityAction.DND,
      ActivityAction.CALL_LATER,
      ActivityAction.WRONG_NUMBER,
      ActivityAction.NOT_ANSWERED,
      ActivityAction.MAYBE_LATER
    ];

    const callers = await Promise.all(
      callersRaw.map(async (u) => {
        const callerId = u._id.toString();

        const [
          totalLeadsCount, totalUploadedCount,
          activeLeadsCount, activeUploadedCount,
          assignedTodayLeads, assignedTodayUploaded,
          calledTodayLeads, calledTodayUploaded,
          callsTodayCount
        ] = await Promise.all([
          // Total Assigned
          Lead.countDocuments({ assignedTo: callerId }),
          UploadedLead.countDocuments({ assignedTo: callerId }),
          
          // Active Leads
          Lead.countDocuments({ assignedTo: callerId, status: { $in: activeStatuses } }),
          UploadedLead.countDocuments({ assignedTo: callerId, status: { $in: activeStatuses } }),
          
          // Assigned Today
          Lead.countDocuments({ assignedTo: callerId, assignedAt: { $gte: todayStart, $lte: todayEnd } }),
          UploadedLead.countDocuments({ assignedTo: callerId, assignedAt: { $gte: todayStart, $lte: todayEnd } }),
          
          // Assigned Today and called (status != NEW)
          Lead.countDocuments({ assignedTo: callerId, assignedAt: { $gte: todayStart, $lte: todayEnd }, status: { $ne: LeadStatus.NEW } }),
          UploadedLead.countDocuments({ assignedTo: callerId, assignedAt: { $gte: todayStart, $lte: todayEnd }, status: { $ne: LeadStatus.NEW } }),
          
          // Calls today
          Activity.countDocuments({ userId: callerId, action: { $in: callOutcomes }, createdAt: { $gte: todayStart, $lte: todayEnd } }),
        ]);

        return {
          callerId,
          name: u.name,
          email: u.email,
          totalAssigned: totalLeadsCount + totalUploadedCount,
          activeLeads: activeLeadsCount + activeUploadedCount,
          assignedToday: assignedTodayLeads + assignedTodayUploaded,
          calledToday: calledTodayLeads + calledTodayUploaded,
          callsToday: callsTodayCount
        };
      })
    );

    return {
      success: true,
      callers
    };
  } catch (error) {
    console.error("Failed to fetch all callers summary:", error);
    return { success: false, error: "Internal server error." };
  }
}

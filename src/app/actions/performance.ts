"use server";

import dbConnect from "@/lib/db";
import { LeadContainer } from "@/models/lead.model";
import User from "@/models/user.model";
import Activity from "@/models/activity.model";
import { LeadStatus } from "@/types/lead";
import { UserRole } from "@/types/user";
import { ActivityAction } from "@/types/activity";
import { getSession } from "@/lib/session";

export interface PerformanceFilterParams {
  date?: string;
  period?: "today" | "week" | "month" | "year" | "lifetime";
}

/**
 * Helper to calculate IST range boundaries for target date, yesterday, day before yesterday, and period.
 */
function getISTRange(params?: PerformanceFilterParams) {
  const now = new Date();
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  let targetDateIST = new Date(now.getTime() + istOffsetMs);

  if (params?.date) {
    const parts = params.date.split('-');
    if (parts.length === 3) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const d = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        targetDateIST = new Date(Date.UTC(y, m, d, 12, 0, 0));
      }
    } else {
      const parsed = new Date(params.date);
      if (!isNaN(parsed.getTime())) {
        targetDateIST = new Date(parsed.getTime() + istOffsetMs);
      }
    }
  }

  const year = targetDateIST.getUTCFullYear();
  const month = targetDateIST.getUTCMonth();
  const date = targetDateIST.getUTCDate();

  // Target Date boundaries in IST (converted to UTC)
  const targetStartIST = new Date(Date.UTC(year, month, date, 0, 0, 0, 0));
  const targetStartUTC = new Date(targetStartIST.getTime() - istOffsetMs);
  const targetEndIST = new Date(Date.UTC(year, month, date, 23, 59, 59, 999));
  const targetEndUTC = new Date(targetEndIST.getTime() - istOffsetMs);

  // Yesterday relative to target date
  const yesterdayStartIST = new Date(Date.UTC(year, month, date - 1, 0, 0, 0, 0));
  const yesterdayStartUTC = new Date(yesterdayStartIST.getTime() - istOffsetMs);
  const yesterdayEndIST = new Date(Date.UTC(year, month, date - 1, 23, 59, 59, 999));
  const yesterdayEndUTC = new Date(yesterdayEndIST.getTime() - istOffsetMs);

  // Day before yesterday relative to target date
  const dbyStartIST = new Date(Date.UTC(year, month, date - 2, 0, 0, 0, 0));
  const dbyStartUTC = new Date(dbyStartIST.getTime() - istOffsetMs);
  const dbyEndIST = new Date(Date.UTC(year, month, date - 2, 23, 59, 59, 999));
  const dbyEndUTC = new Date(dbyEndIST.getTime() - istOffsetMs);

  // Period range calculation
  let periodStartUTC = targetStartUTC;
  let periodEndUTC = targetEndUTC;
  const period = params?.period || "today";

  if (period === "week") {
    const day = targetDateIST.getUTCDay();
    const diff = targetDateIST.getUTCDate() - day + (day === 0 ? -6 : 1);
    const weekStartIST = new Date(Date.UTC(year, month, diff, 0, 0, 0, 0));
    periodStartUTC = new Date(weekStartIST.getTime() - istOffsetMs);
    const weekEndIST = new Date(Date.UTC(year, month, diff + 6, 23, 59, 59, 999));
    periodEndUTC = new Date(weekEndIST.getTime() - istOffsetMs);
  } else if (period === "month") {
    const monthStartIST = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
    periodStartUTC = new Date(monthStartIST.getTime() - istOffsetMs);
    const monthEndIST = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
    periodEndUTC = new Date(monthEndIST.getTime() - istOffsetMs);
  } else if (period === "year") {
    const yearStartIST = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    periodStartUTC = new Date(yearStartIST.getTime() - istOffsetMs);
    const yearEndIST = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
    periodEndUTC = new Date(yearEndIST.getTime() - istOffsetMs);
  } else if (period === "lifetime") {
    periodStartUTC = new Date(0); // Epoch start
    periodEndUTC = new Date(Date.now() + istOffsetMs + 3153600000000); // Far future (~100 years)
  }

  return {
    targetDate: { start: targetStartUTC, end: targetEndUTC },
    yesterday: { start: yesterdayStartUTC, end: yesterdayEndUTC },
    dayBeforeYesterday: { start: dbyStartUTC, end: dbyEndUTC },
    period: { start: periodStartUTC, end: periodEndUTC }
  };
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
  // New filtered fields
  assignedPeriod: number;
  calledPeriod: number;
  callsPeriod: number;
  callsTargetDate: number;
  callsYesterday: number;
  callsDayBeforeYesterday: number;
}

/**
 * Action to fetch performance metrics for a specific caller.
 */
export async function getCallerPerformanceAction(
  callerId: string,
  params?: PerformanceFilterParams
): Promise<{
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

    const { targetDate, yesterday, dayBeforeYesterday, period } = getISTRange(params);

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
      ActivityAction.CALL_MADE
    ];

    // Queries
    const [
      totalLeadsCount,
      activeLeadsCount,
      calledLeadsCount,
      
      assignedTargetCount,
      calledTargetCount,
      
      assignedPeriodCount,
      calledPeriodCount,
      
      callsTargetCount,
      callsYesterdayCount,
      callsDbyCount,
      callsPeriodCount,
      totalCallsCount
    ] = await Promise.all([
      // Total Assigned
      LeadContainer.countDocuments({ assignedTo: callerId }),
      
      // Active Leads
      LeadContainer.countDocuments({ assignedTo: callerId, status: { $in: activeStatuses } }),
      
      // Actioned Leads (status != NEW)
      LeadContainer.countDocuments({ assignedTo: callerId, status: { $ne: LeadStatus.NEW } }),
      
      // Assigned on Target Date
      LeadContainer.countDocuments({ assignedTo: callerId, assignedAt: { $gte: targetDate.start, $lte: targetDate.end } }),
      
      // Assigned on Target Date and called (status != NEW)
      LeadContainer.countDocuments({ assignedTo: callerId, assignedAt: { $gte: targetDate.start, $lte: targetDate.end }, status: { $ne: LeadStatus.NEW } }),
      
      // Assigned in Period
      LeadContainer.countDocuments({ assignedTo: callerId, assignedAt: { $gte: period.start, $lte: period.end } }),
      
      // Assigned in Period and called
      LeadContainer.countDocuments({ assignedTo: callerId, assignedAt: { $gte: period.start, $lte: period.end }, status: { $ne: LeadStatus.NEW } }),
      
      // Calls on Target Date
      Activity.countDocuments({ userId: callerId, action: { $in: callOutcomes }, createdAt: { $gte: targetDate.start, $lte: targetDate.end } }),
      
      // Calls Yesterday
      Activity.countDocuments({ userId: callerId, action: { $in: callOutcomes }, createdAt: { $gte: yesterday.start, $lte: yesterday.end } }),
      
      // Calls Day Before Yesterday
      Activity.countDocuments({ userId: callerId, action: { $in: callOutcomes }, createdAt: { $gte: dayBeforeYesterday.start, $lte: dayBeforeYesterday.end } }),
      
      // Calls in Period
      Activity.countDocuments({ userId: callerId, action: { $in: callOutcomes }, createdAt: { $gte: period.start, $lte: period.end } }),
      
      // Total calls logged all time
      Activity.countDocuments({ userId: callerId, action: { $in: callOutcomes } })
    ]);

    // Status breakdown queries
    const statusBreakdown: Record<LeadStatus, number> = {} as Record<LeadStatus, number>;
    await Promise.all(
      Object.values(LeadStatus).map(async (status) => {
        if (params?.period && params.period !== "lifetime") {
          if (status === LeadStatus.NEW) {
            statusBreakdown[status] = await LeadContainer.countDocuments({
              assignedTo: callerId,
              status,
              assignedAt: { $gte: period.start, $lte: period.end }
            });
          } else {
            statusBreakdown[status] = await LeadContainer.countDocuments({
              assignedTo: callerId,
              status,
              updatedAt: { $gte: period.start, $lte: period.end }
            });
          }
        } else {
          statusBreakdown[status] = await LeadContainer.countDocuments({ assignedTo: callerId, status });
        }
      })
    );

    // Recent activities during selected period (excluding CALL_MADE to avoid duplicate entries in history)
    const activitiesRaw = await Activity.find({
      userId: callerId,
      action: { $ne: ActivityAction.CALL_MADE },
      createdAt: { $gte: period.start, $lte: period.end }
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    // Map lead details onto the activities logs (querying concurrently)
    const recentActivities = await Promise.all(
      activitiesRaw.map(async (act) => {
        let leadName = "Unknown Lead";
        let leadPhone = "";
        
        if (act.leadId) {
          const leadDoc = await LeadContainer.findById(act.leadId).select("name phone").lean();
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
        totalAssigned: totalLeadsCount,
        activeLeads: activeLeadsCount,
        actionedLeads: calledLeadsCount,
        // Old fields map to target date metrics
        assignedToday: assignedTargetCount,
        calledToday: calledTargetCount,
        callsToday: callsTargetCount,
        totalCalls: totalCallsCount,
        statusBreakdown,
        recentActivities,
        // New period metrics
        assignedPeriod: assignedPeriodCount,
        calledPeriod: calledPeriodCount,
        callsPeriod: callsPeriodCount,
        callsTargetDate: callsTargetCount,
        callsYesterday: callsYesterdayCount,
        callsDayBeforeYesterday: callsDbyCount
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
  // New filtered fields
  assignedPeriod: number;
  calledPeriod: number;
  callsPeriod: number;
  callsTargetDate: number;
  callsYesterday: number;
  callsDayBeforeYesterday: number;
}

/**
 * Action to fetch summary metrics of all active callers in the system.
 */
export async function getAllCallersPerformanceSummaryAction(
  params?: PerformanceFilterParams
): Promise<{
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
      isActive: true,
      isDev: { $ne: true }
    })
      .select("name email")
      .sort({ name: 1 })
      .lean();

    const { targetDate, yesterday, dayBeforeYesterday, period } = getISTRange(params);

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
      ActivityAction.CALL_MADE
    ];

    const callers = await Promise.all(
      callersRaw.map(async (u) => {
        const callerId = u._id.toString();

        const [
          totalLeadsCount,
          activeLeadsCount,
          
          assignedTargetCount,
          calledTargetCount,
          
          assignedPeriodCount,
          calledPeriodCount,
          
          callsTargetCount,
          callsYesterdayCount,
          callsDbyCount,
          callsPeriodCount
        ] = await Promise.all([
          // Total Assigned
          LeadContainer.countDocuments({ assignedTo: callerId }),
          
          // Active Leads
          LeadContainer.countDocuments({ assignedTo: callerId, status: { $in: activeStatuses } }),
          
          // Assigned on Target Date
          LeadContainer.countDocuments({ assignedTo: callerId, assignedAt: { $gte: targetDate.start, $lte: targetDate.end } }),
          
          // Assigned on Target and called
          LeadContainer.countDocuments({ assignedTo: callerId, assignedAt: { $gte: targetDate.start, $lte: targetDate.end }, status: { $ne: LeadStatus.NEW } }),
          
          // Assigned in Period
          LeadContainer.countDocuments({ assignedTo: callerId, assignedAt: { $gte: period.start, $lte: period.end } }),
          
          // Assigned in Period and called
          LeadContainer.countDocuments({ assignedTo: callerId, assignedAt: { $gte: period.start, $lte: period.end }, status: { $ne: LeadStatus.NEW } }),
          
          // Calls on Target Date
          Activity.countDocuments({ userId: callerId, action: { $in: callOutcomes }, createdAt: { $gte: targetDate.start, $lte: targetDate.end } }),
          
          // Calls Yesterday
          Activity.countDocuments({ userId: callerId, action: { $in: callOutcomes }, createdAt: { $gte: yesterday.start, $lte: yesterday.end } }),
          
          // Calls Day Before Yesterday
          Activity.countDocuments({ userId: callerId, action: { $in: callOutcomes }, createdAt: { $gte: dayBeforeYesterday.start, $lte: dayBeforeYesterday.end } }),
          
          // Calls in Period
          Activity.countDocuments({ userId: callerId, action: { $in: callOutcomes }, createdAt: { $gte: period.start, $lte: period.end } })
        ]);

        return {
          callerId,
          name: u.name,
          email: u.email,
          totalAssigned: totalLeadsCount,
          activeLeads: activeLeadsCount,
          // Old fields map to target date metrics
          assignedToday: assignedTargetCount,
          calledToday: calledTargetCount,
          callsToday: callsTargetCount,
          // New period metrics
          assignedPeriod: assignedPeriodCount,
          calledPeriod: calledPeriodCount,
          callsPeriod: callsPeriodCount,
          callsTargetDate: callsTargetCount,
          callsYesterday: callsYesterdayCount,
          callsDayBeforeYesterday: callsDbyCount
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

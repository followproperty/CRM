"use server";

import dbConnect from "@/lib/db";
import Notification from "@/models/notification.model";
import User from "@/models/user.model";
import Lead from "@/models/lead.model";
import { getSession } from "@/lib/session";
import { UserRole } from "@/types/user";
import { LeadStatus, ILead } from "@/types/lead";
import { Types } from "mongoose";

// Utility helper to safely get User ID from string or populated object
const getUserId = (
  userField: string | Types.ObjectId | { _id: string | Types.ObjectId } | null | undefined
): string | null => {
  if (!userField) return null;
  if (typeof userField === "object" && "_id" in userField && userField._id) {
    return userField._id.toString();
  }
  return userField.toString();
};

/**
 * Creates an in-app notification in the database
 */
export async function createNotification(
  userId: string | Types.ObjectId,
  leadId: string | Types.ObjectId | null | undefined,
  title: string,
  message: string
) {
  try {
    await Notification.create({
      userId,
      leadId: leadId || undefined,
      title,
      message,
      isRead: false,
    });
  } catch (err) {
    console.error("Failed to create notification document:", err);
  }
}

/**
 * Trigger: Interested Lead Created/Updated
 * Rule: Notify Caller's managing Admin (or the Admin directly assigned)
 */
export async function triggerInterestedLeadNotification(lead: ILead) {
  const assigneeId = getUserId(lead.assignedTo);
  if (!assigneeId) return;

  try {
    const assignee = await User.findById(assigneeId);
    if (!assignee) return;

    // Determine target admin user ID
    let targetAdminId: string | null = null;
    if (assignee.role === UserRole.ADMIN) {
      targetAdminId = assignee._id.toString();
    } else if (assignee.role === UserRole.CALLER && assignee.adminId) {
      targetAdminId = assignee.adminId.toString();
    }

    if (targetAdminId) {
      await createNotification(
        targetAdminId,
        lead._id,
        "Interested Lead Created",
        `Lead "${lead.name}" has been marked as Interested.`
      );
    }
  } catch (err) {
    console.error("Interested Lead notification error:", err);
  }
}

/**
 * Trigger: Admin Handoff Requested
 * Rule: Notify Caller's managing Admin
 */
export async function triggerAdminHandoffNotification(lead: ILead) {
  const handoffById = getUserId(lead.handedOffBy) || getUserId(lead.assignedTo);
  if (!handoffById) return;

  try {
    const caller = await User.findById(handoffById);
    if (!caller || !caller.adminId) return;

    await createNotification(
      caller.adminId.toString(),
      lead._id,
      "Admin Handoff Requested",
      `WhatsApp follow-up requested for lead "${lead.name}" by Caller "${caller.name}".`
    );
  } catch (err) {
    console.error("Admin Handoff notification error:", err);
  }
}

/**
 * Trigger: WhatsApp Details Sent
 * Rule: Notify lead owner (usually the Caller)
 */
export async function triggerWhatsAppDetailsSentNotification(lead: ILead) {
  const assigneeId = getUserId(lead.assignedTo);
  if (!assigneeId) return;

  try {
    await createNotification(
      assigneeId,
      lead._id,
      "WhatsApp Details Sent",
      `WhatsApp project details have been successfully sent to lead "${lead.name}".`
    );
  } catch (err) {
    console.error("WhatsApp Details Sent notification error:", err);
  }
}

/**
 * Trigger: Site Visit Scheduled
 * Rule: Notify managing Admin and all active Super Admins
 */
export async function triggerSiteVisitScheduledNotification(lead: ILead) {
  const assigneeId = getUserId(lead.assignedTo);
  try {
    // 1. Notify managing Admin
    if (assigneeId) {
      const assignee = await User.findById(assigneeId);
      if (assignee) {
        let adminId: string | null = null;
        if (assignee.role === UserRole.ADMIN) {
          adminId = assignee._id.toString();
        } else if (assignee.role === UserRole.CALLER && assignee.adminId) {
          adminId = assignee.adminId.toString();
        }

        if (adminId) {
          await createNotification(
            adminId,
            lead._id,
            "Site Visit Scheduled",
            `Site visit scheduled for lead "${lead.name}" on ${lead.siteVisitDate ? new Date(lead.siteVisitDate).toLocaleDateString() : "Unknown Date"}.`
          );
        }
      }
    }

    // 2. Notify all Super Admin users
    const superAdmins = await User.find({ role: UserRole.SUPER_ADMIN, isActive: true });
    for (const superAdmin of superAdmins) {
      await createNotification(
        superAdmin._id.toString(),
        lead._id,
        "Site Visit Scheduled",
        `Site visit scheduled for lead "${lead.name}" on ${lead.siteVisitDate ? new Date(lead.siteVisitDate).toLocaleDateString() : "Unknown Date"}.`
      );
    }
  } catch (err) {
    console.error("Site Visit Scheduled notification error:", err);
  }
}

/**
 * Trigger: Customer Won
 * Rule: Notify managing Admin and all active Super Admins
 */
export async function triggerCustomerWonNotification(lead: ILead) {
  const assigneeId = getUserId(lead.assignedTo);
  try {
    // 1. Notify managing Admin
    if (assigneeId) {
      const assignee = await User.findById(assigneeId);
      if (assignee) {
        let adminId: string | null = null;
        if (assignee.role === UserRole.ADMIN) {
          adminId = assignee._id.toString();
        } else if (assignee.role === UserRole.CALLER && assignee.adminId) {
          adminId = assignee.adminId.toString();
        }

        if (adminId) {
          await createNotification(
            adminId,
            lead._id,
            "Customer Won",
            `Deal successfully closed! Lead "${lead.name}" is now a Customer.`
          );
        }
      }
    }

    // 2. Notify all Super Admin users
    const superAdmins = await User.find({ role: UserRole.SUPER_ADMIN, isActive: true });
    for (const superAdmin of superAdmins) {
      await createNotification(
        superAdmin._id.toString(),
        lead._id,
        "Customer Won",
        `Deal successfully closed! Lead "${lead.name}" is now a Customer.`
      );
    }
  } catch (err) {
    console.error("Customer Won notification error:", err);
  }
}

/**
 * Dynamic check: Follow-up Due Today
 * Rule: Auto-create notifications for follow-up callbacks due today for this specific user
 */
async function checkAndCreateFollowUpNotifications(userId: string) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  try {
    // Find active leads assigned to the user that require follow-up today
    const leadsDueToday = await Lead.find({
      assignedTo: userId,
      status: LeadStatus.FOLLOW_UP,
      nextFollowUp: { $gte: startOfToday, $lte: endOfToday },
    });

    for (const lead of leadsDueToday) {
      // Check if a "Follow-up Due Today" notification already exists for today
      const alreadyNotified = await Notification.findOne({
        userId,
        leadId: lead._id,
        title: "Follow-up Due Today",
        createdAt: { $gte: startOfToday, $lte: endOfToday },
      });

      if (!alreadyNotified) {
        let timeStr = "";
        if (lead.nextFollowUp) {
          timeStr = ` at ${new Date(lead.nextFollowUp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
        }

        await createNotification(
          userId,
          lead._id,
          "Follow-up Due Today",
          `Follow-up callback is due today for lead "${lead.name}"${timeStr}.`
        );
      }
    }
  } catch (err) {
    console.error("Failed to process follow-up due notifications:", err);
  }
}

/**
 * Server Action: Fetch all notifications for current user
 */
export async function getMyNotificationsAction() {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await dbConnect();

    // 1. Run dynamic check for followups due today
    await checkAndCreateFollowUpNotifications(session.userId);

    // 2. Fetch notifications list
    const notifications = await Notification.find({ userId: session.userId })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();

    // 3. Count unread
    const unreadCount = await Notification.countDocuments({
      userId: session.userId,
      isRead: false,
    });

    // Serialize object IDs and dates
    const serialized = notifications.map((n) => ({
      _id: n._id.toString(),
      title: n.title,
      message: n.message,
      userId: n.userId.toString(),
      leadId: n.leadId ? n.leadId.toString() : undefined,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    }));

    return { success: true, notifications: serialized, unreadCount };
  } catch (err) {
    console.error("Get notifications action error:", err);
    return { success: false, error: "Failed to load notifications" };
  }
}

/**
 * Server Action: Mark single notification as read
 */
export async function markNotificationReadAction(notificationId: string) {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await dbConnect();
    await Notification.findOneAndUpdate(
      { _id: notificationId, userId: session.userId },
      { isRead: true }
    );

    return { success: true };
  } catch (err) {
    console.error("Mark notification read error:", err);
    return { success: false, error: "Failed to update notification" };
  }
}

/**
 * Server Action: Mark all notifications as read
 */
export async function markAllNotificationsReadAction() {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    await dbConnect();
    await Notification.updateMany(
      { userId: session.userId, isRead: false },
      { isRead: true }
    );

    return { success: true };
  } catch (err) {
    console.error("Mark all notifications read error:", err);
    return { success: false, error: "Failed to update notifications" };
  }
}

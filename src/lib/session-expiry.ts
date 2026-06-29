import dbConnect from "./db";
import LoginSession from "@/models/login-session.model";
import { SessionStatus } from "@/types/login-session";

/**
 * Marks a specific session as EXPIRED in the database.
 */
export async function markSessionExpired(sessionId: string): Promise<void> {
  try {
    await dbConnect();
    await LoginSession.findOneAndUpdate(
      { sessionId, status: SessionStatus.ACTIVE },
      [
        {
          $set: {
            status: SessionStatus.EXPIRED,
            logoutAt: { $add: ["$loginAt", 4 * 60 * 60 * 1000] },
          },
        },
      ]
    );
  } catch (error) {
    console.error("Error updating expired session status:", error);
  }
}

/**
 * Scans and marks any ACTIVE session for the user that was created
 * more than 4 hours ago as EXPIRED.
 */
export async function cleanOldUserSessions(userId: string): Promise<void> {
  try {
    await dbConnect();
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    await LoginSession.updateMany(
      {
        userId,
        status: SessionStatus.ACTIVE,
        loginAt: { $lt: fourHoursAgo },
      },
      [
        {
          $set: {
            status: SessionStatus.EXPIRED,
            logoutAt: { $add: ["$loginAt", 4 * 60 * 60 * 1000] },
          },
        },
      ]
    );
  } catch (error) {
    console.error("Error cleaning up old user sessions:", error);
  }
}

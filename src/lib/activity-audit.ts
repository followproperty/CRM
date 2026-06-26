import dbConnect from "@/lib/db";
import Activity, { IActivityDocument } from "@/models/activity.model";
import { ActivityAction } from "@/types/activity";
import { getSession } from "@/lib/session";
import { getClientRequestMetadata } from "@/lib/request";
import mongoose from "mongoose";

export interface AuditActivityParams {
  leadId?: string | mongoose.Types.ObjectId;
  userId?: string | mongoose.Types.ObjectId; // Optional: falls back to session.userId if not provided
  action: ActivityAction;
  note?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Reusable helper to create Activity logs automatically populated with
 * request metadata (IP, user agent, browser, OS, device) and active sessionId.
 */
export async function createAuditedActivity(params: AuditActivityParams): Promise<IActivityDocument> {
  await dbConnect();

  // 1. Fetch the active user session and client request metadata concurrently
  const [session, requestMeta] = await Promise.all([
    getSession().catch(() => null),
    getClientRequestMetadata().catch((err) => {
      console.warn("Auditing warning: failed to retrieve request headers context:", err);
      return null;
    }),
  ]);

  // 2. Resolve the user performing this action
  const resolvedUserId = params.userId || session?.userId;
  if (!resolvedUserId) {
    throw new Error(`Auditing error: No userId could be resolved for activity action "${params.action}".`);
  }

  // 3. Construct audited metadata (nest audit parameters under a dedicated sub-object to prevent collisions)
  const auditedMetadata = {
    ...params.metadata,
    audit: {
      ipAddress: requestMeta?.ip || "unknown",
      userAgent: requestMeta?.userAgent || "unknown",
      browser: requestMeta?.browser || "unknown",
      os: requestMeta?.os || "unknown",
      device: requestMeta?.device || "unknown",
      sessionId: session?.sessionId || null,
      auditedAt: new Date(),
    },
  };

  // 4. Create and save the new Activity record
  const activityDoc = await Activity.create({
    leadId: params.leadId,
    userId: resolvedUserId,
    action: params.action,
    note: params.note,
    metadata: auditedMetadata,
  });

  return activityDoc;
}

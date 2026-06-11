import { Types } from "mongoose";

/**
 * Activity Action types tracking operations on a Lead
 */
export enum ActivityAction {
  LEAD_CREATED = "LEAD_CREATED",
  CALL_MADE = "CALL_MADE",
  INTERESTED = "INTERESTED",
  NOT_INTERESTED = "NOT_INTERESTED",
  DND = "DND",
  CALL_LATER = "CALL_LATER",
  BROCHURE_REQUESTED = "BROCHURE_REQUESTED",
  BROCHURE_SENT = "BROCHURE_SENT",
  FOLLOW_UP_SCHEDULED = "FOLLOW_UP_SCHEDULED",
  SITE_VISIT_SCHEDULED = "SITE_VISIT_SCHEDULED",
  NEGOTIATION_STARTED = "NEGOTIATION_STARTED",
  CUSTOMER_WON = "CUSTOMER_WON",
  USER_CREATED = "USER_CREATED",
  USER_STATUS_CHANGED = "USER_STATUS_CHANGED",
  LEAD_ASSIGNED = "LEAD_ASSIGNED",
  WRONG_NUMBER = "WRONG_NUMBER",
  NOTE_ADDED = "NOTE_ADDED",
  CUSTOMER_LOST = "CUSTOMER_LOST",
  ADMIN_HANDOFF_REQUESTED = "ADMIN_HANDOFF_REQUESTED",
  WHATSAPP_DETAILS_SENT = "WHATSAPP_DETAILS_SENT",
  ADMIN_FOLLOWUP_STARTED = "ADMIN_FOLLOWUP_STARTED",
}

/**
 * TypeScript Interface representing a Lead Activity Log
 */
export interface IActivity {
  _id?: string | Types.ObjectId;
  leadId?: string | Types.ObjectId;
  userId: string | Types.ObjectId;
  action: ActivityAction;
  note?: string;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

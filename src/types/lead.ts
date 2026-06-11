import { Types } from "mongoose";

/**
 * Lead Workflow status enums
 */
export enum LeadStatus {
  NEW = "NEW",
  CALLED = "CALLED",
  INTERESTED = "INTERESTED",
  WHATSAPP_SHARED = "WHATSAPP_SHARED",
  FOLLOW_UP = "FOLLOW_UP",
  SITE_VISIT = "SITE_VISIT",
  NEGOTIATION = "NEGOTIATION",
  CUSTOMER = "CUSTOMER",
  LOST = "LOST",
  NOT_INTERESTED = "NOT_INTERESTED",
  DND = "DND",
  WRONG_NUMBER = "WRONG_NUMBER",
  ADMIN_FOLLOWUP = "ADMIN_FOLLOWUP",
}

/**
 * Lead Follow-up status enums
 */
export enum FollowUpStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  MISSED = "MISSED",
}

/**
 * Lead Site Visit status enums
 */
export enum SiteVisitStatus {
  SCHEDULED = "SCHEDULED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  NO_SHOW = "NO_SHOW",
}

/**
 * Embedded interface for follow-up details
 */
export interface IFollowUpDetail {
  date?: Date;
  status: FollowUpStatus;
  notes?: string;
}

/**
 * Embedded interface for site visit details
 */
export interface ISiteVisitDetail {
  date?: Date;
  status: SiteVisitStatus;
  notes?: string;
}

/**
 * TypeScript Interface representing a Lead
 */
export interface ILead {
  _id?: string | Types.ObjectId;
  name: string;
  phone: string;
  email?: string;
  source: string;
  sourceType?: string;
  sourceName?: string;
  projectId?: string | Types.ObjectId;
  assignedTo?: string | Types.ObjectId;
  assignedAt?: Date;
  assignedBy?: string | Types.ObjectId;
  status: LeadStatus;
  followUp?: IFollowUpDetail;
  siteVisit?: ISiteVisitDetail;
  dnd?: boolean;
  nextFollowUp?: Date;
  city?: string;
  state?: string;
  siteVisitDate?: Date;
  siteVisitStatus?: SiteVisitStatus;
  siteVisitNotes?: string;
  wonAt?: Date;
  lostAt?: Date;
  lostReason?: string;
  handedOffToAdmin?: boolean;
  handedOffAt?: Date;
  handedOffBy?: string | Types.ObjectId;
  updatedBy?: string | Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}

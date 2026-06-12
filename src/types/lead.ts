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

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  [LeadStatus.NEW]: "New",
  [LeadStatus.CALLED]: "Calling",
  [LeadStatus.INTERESTED]: "Interested",
  [LeadStatus.FOLLOW_UP]: "Call Later",
  [LeadStatus.WHATSAPP_SHARED]: "Brochure Sent",
  [LeadStatus.ADMIN_FOLLOWUP]: "WhatsApp Follow Up",
  [LeadStatus.SITE_VISIT]: "Site Visit",
  [LeadStatus.NEGOTIATION]: "Payment Plan Sent",
  [LeadStatus.CUSTOMER]: "Sale Done",
  [LeadStatus.LOST]: "Sale Not Done",
  [LeadStatus.NOT_INTERESTED]: "Not Interested",
  [LeadStatus.WRONG_NUMBER]: "Wrong Number",
  [LeadStatus.DND]: "DND (Do Not Disturb)",
};


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
  primaryPhone?: string;
  secondaryPhone?: string;
  customerCode?: string;
  projectName?: string;
  address?: string;
  country?: string;
  sourceDetails?: Record<string, unknown>;
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

/**
 * Defensive utility helper to construct a manual wa.me link.
 */
export function getWhatsAppUrl(phone: string, country?: string): string {
  if (!phone) return "";
  
  // Trim and check
  let trimmed = phone.trim();
  if (!trimmed) return "";

  // If it starts with +, remove + and use the rest as digits.
  // This assumes the user explicitly entered a fully qualified international number.
  if (trimmed.startsWith("+")) {
    const clean = trimmed.replace(/[^\d]/g, "");
    return clean ? `https://wa.me/${clean}` : "";
  }

  // Otherwise, clean all non-digits
  let clean = trimmed.replace(/[^\d]/g, "");
  if (!clean) return "";

  // Remove leading local Indian zero if present (e.g. 09876543210 -> 9876543210)
  if (clean.startsWith("0")) {
    clean = clean.substring(1);
  }

  const isSingaporeCountry = country?.toLowerCase() === "singapore";

  // Case 1: 8-digit number (Typically Singapore)
  if (clean.length === 8) {
    return `https://wa.me/65${clean}`;
  }

  // Case 2: 10-digit number
  if (clean.length === 10) {
    // If it starts with 65, keep it as is (SG format)
    if (clean.startsWith("65")) {
      return `https://wa.me/${clean}`;
    }
    // Otherwise, it is a 10-digit Indian number. Prepend 91.
    return `https://wa.me/91${clean}`;
  }

  // Case 3: 12-digit number
  if (clean.length === 12) {
    // If it starts with 91, it's already a fully qualified Indian number
    if (clean.startsWith("91")) {
      return `https://wa.me/${clean}`;
    }
  }

  // Fallback / other lengths
  if (isSingaporeCountry) {
    if (!clean.startsWith("65")) {
      return `https://wa.me/65${clean}`;
    }
  } else {
    if (!clean.startsWith("91")) {
      return `https://wa.me/91${clean}`;
    }
  }

  return `https://wa.me/${clean}`;
}


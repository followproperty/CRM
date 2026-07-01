import mongoose, { Schema, Document, Model } from "mongoose";
import { ILead, LeadStatus, FollowUpStatus, SiteVisitStatus } from "@/types/lead";

/**
 * Mongoose Document Interface representing a Lead document in MongoDB
 */
export interface ILeadDocument extends Omit<ILead, "_id">, Document {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Follow-up details schema definition (embedded)
 */
const FollowUpSchema = new Schema(
  {
    date: {
      type: Date,
      required: false,
    },
    status: {
      type: String,
      enum: Object.values(FollowUpStatus),
      default: FollowUpStatus.PENDING,
      required: true,
    },
    notes: {
      type: String,
      trim: true,
      required: false,
    },
  },
  { _id: false } // Embedded schema, no separate ObjectId
);

/**
 * Site visit details schema definition (embedded)
 */
const SiteVisitSchema = new Schema(
  {
    date: {
      type: Date,
      required: false,
    },
    status: {
      type: String,
      enum: Object.values(SiteVisitStatus),
      default: SiteVisitStatus.SCHEDULED,
      required: true,
    },
    notes: {
      type: String,
      trim: true,
      required: false,
    },
  },
  { _id: false } // Embedded schema, no separate ObjectId
);

/**
 * Lead Schema definition
 */
const LeadSchema = new Schema<ILeadDocument>(
  {
    name: {
      type: String,
      required: [true, "Lead name is required"],
      trim: true,
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
    },
    primaryPhone: {
      type: String,
      trim: true,
      required: false,
    },
    secondaryPhone: {
      type: String,
      trim: true,
      required: false,
    },
    customerCode: {
      type: String,
      trim: true,
      required: false,
    },
    projectName: {
      type: String,
      trim: true,
      required: false,
    },
    address: {
      type: String,
      trim: true,
      required: false,
    },
    country: {
      type: String,
      trim: true,
      required: false,
    },
    sourceDetails: {
      type: Schema.Types.Mixed,
      required: false,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      required: false,
    },
    source: {
      type: String,
      default: "DIRECT",
      trim: true,
      required: true,
    },
    sourceType: {
      type: String,
      trim: true,
      required: false,
    },
    sourceName: {
      type: String,
      trim: true,
      required: false,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: false,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    assignedAt: {
      type: Date,
      required: false,
    },
    assignedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    status: {
      type: String,
      enum: Object.values(LeadStatus),
      default: LeadStatus.NEW,
      required: true,
    },
    followUp: {
      type: FollowUpSchema,
      required: false,
    },
    siteVisit: {
      type: SiteVisitSchema,
      required: false,
    },
    dnd: {
      type: Boolean,
      default: false,
    },
    nextFollowUp: {
      type: Date,
      required: false,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    city: {
      type: String,
      trim: true,
      required: false,
    },
    state: {
      type: String,
      trim: true,
      required: false,
    },
    siteVisitDate: {
      type: Date,
      required: false,
    },
    siteVisitStatus: {
      type: String,
      enum: Object.values(SiteVisitStatus),
      required: false,
    },
    siteVisitNotes: {
      type: String,
      trim: true,
      required: false,
    },
    wonAt: {
      type: Date,
      required: false,
    },
    lostAt: {
      type: Date,
      required: false,
    },
    lostReason: {
      type: String,
      trim: true,
      required: false,
    },
    handedOffToAdmin: {
      type: Boolean,
      default: false,
    },
    handedOffAt: {
      type: Date,
      required: false,
    },
    handedOffBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    budgetValue: {
      type: String,
      trim: true,
      required: false,
    },
    budgetUnit: {
      type: String,
      trim: true,
      required: false,
    },
    configuration: {
      type: String,
      trim: true,
      required: false,
    },
    possessionTimeline: {
      type: String,
      trim: true,
      required: false,
    },
    maybeLaterTimeframe: {
      type: String,
      trim: true,
      required: false,
    },
    maybeLaterDate: {
      type: Date,
      required: false,
    },
    collectionType: {
      type: String,
      trim: true,
      required: false,
    },
    sourceCollection: {
      type: String,
      trim: true,
      required: false,
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

// Backward compatibility hook: sync phone and primaryPhone bidirectionally
/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
LeadSchema.pre("validate", function (this: any) {
  if (this.phone && !this.primaryPhone) {
    this.primaryPhone = this.phone;
  } else if (this.primaryPhone && !this.phone) {
    this.phone = this.primaryPhone;
  }
});

// Indexes for common queries:
// 1. Quick lookups/duplicate checking by phone
LeadSchema.index({ phone: 1 });
LeadSchema.index({ primaryPhone: 1 }, { sparse: true });

// 2. Fetching list of leads assigned to a caller by status
LeadSchema.index({ assignedTo: 1, status: 1 });

// 3. Finding upcoming follow-ups
LeadSchema.index({ "followUp.date": 1 });

// 4. Source-based tracking
LeadSchema.index({ source: 1 });

/**
 * Lead Models
 * Includes Next.js HMR check to reuse the models if already defined in the mongoose model registry.
 */
const Lead: Model<ILeadDocument> =
  mongoose.models.Lead || mongoose.model<ILeadDocument>("Lead", LeadSchema, "leads");

const UploadedLead: Model<ILeadDocument> =
  mongoose.models.UploadedLead || mongoose.model<ILeadDocument>("UploadedLead", LeadSchema, "uploaded_leads");

const VrindavanLead: Model<ILeadDocument> =
  mongoose.models.VrindavanLead || mongoose.model<ILeadDocument>("VrindavanLead", LeadSchema, "vrindavan_leads");

const LeadContainer: Model<ILeadDocument> =
  mongoose.models.LeadContainer || mongoose.model<ILeadDocument>("LeadContainer", LeadSchema, "lead_containers");

/**
 * Resolves the appropriate Lead model based on collectionType.
 */
function getLeadModel(collectionType?: string): Model<ILeadDocument> {
  if (collectionType === "uploaded_leads") {
    return UploadedLead;
  }
  if (collectionType === "vrindavan_leads") {
    return VrindavanLead;
  }
  if (collectionType === "leads") {
    return Lead;
  }
  if (collectionType === "lead_container") {
    return LeadContainer;
  }
  return LeadContainer;
}

export default Lead;
export { Lead, UploadedLead, VrindavanLead, LeadContainer, getLeadModel };


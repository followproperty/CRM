import mongoose, { Schema, Document, Model } from "mongoose";
import { IActivity, ActivityAction } from "@/types/activity";

/**
 * Mongoose Document Interface representing an Activity document in MongoDB
 */
export interface IActivityDocument extends Omit<IActivity, "_id">, Document {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Activity Schema definition
 * Represents an immutable log of actions performed on leads.
 * Note: Activity records should never be deleted.
 */
const ActivitySchema = new Schema<IActivityDocument>(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      required: false,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    action: {
      type: String,
      enum: Object.values(ActivityAction),
      required: [true, "Action is required"],
    },
    note: {
      type: String,
      trim: true,
      required: false,
    },
    metadata: {
      type: Schema.Types.Mixed,
      required: false,
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

// Indexes for fast querying of activities by lead and user
ActivitySchema.index({ leadId: 1, createdAt: -1 });
ActivitySchema.index({ userId: 1, createdAt: -1 });

/**
 * Activity Model
 * Includes Next.js HMR check to reuse the model if already defined in the mongoose model registry.
 */
const Activity: Model<IActivityDocument> =
  mongoose.models.Activity || mongoose.model<IActivityDocument>("Activity", ActivitySchema);

export default Activity;
export { Activity };

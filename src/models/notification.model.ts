import mongoose, { Schema, Document, Model } from "mongoose";
import { INotification } from "@/types/notification";

/**
 * Mongoose Document Interface representing a Notification document in MongoDB
 */
export interface INotificationDocument extends Omit<INotification, "_id">, Document {
  createdAt: Date;
}

/**
 * Notification Schema definition
 */
const NotificationSchema = new Schema<INotificationDocument>(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      required: false,
    },
    isRead: {
      type: Boolean,
      default: false,
      required: true,
    },
  },
  {
    // Use timestamps option to only generate createdAt
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Compound index for fast lookup of a user's unread/read notifications sorted by date
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

/**
 * Notification Model
 * Includes Next.js HMR check to reuse the model if already defined in the mongoose model registry.
 */
const Notification: Model<INotificationDocument> =
  mongoose.models.Notification || mongoose.model<INotificationDocument>("Notification", NotificationSchema);

export default Notification;
export { Notification };

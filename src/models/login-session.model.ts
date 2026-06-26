import mongoose, { Schema, Document, Model } from "mongoose";
import { ILoginSession, SessionStatus } from "@/types/login-session";

/**
 * Mongoose Document Interface representing a LoginSession document in MongoDB
 */
export interface ILoginSessionDocument extends Omit<ILoginSession, "_id">, Document {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * LoginSession Schema definition
 * Tracks user work sessions, activity timestamps, and client environment.
 */
const LoginSessionSchema = new Schema<ILoginSessionDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    sessionId: {
      type: String,
      required: [true, "Session ID is required"],
      unique: true,
      trim: true,
    },
    loginAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    logoutAt: {
      type: Date,
      required: false,
      default: null,
    },
    lastActiveAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    ipAddress: {
      type: String,
      required: true,
      trim: true,
      default: "127.0.0.1",
    },
    userAgent: {
      type: String,
      required: true,
      trim: true,
    },
    browser: {
      type: String,
      required: true,
      trim: true,
      default: "Unknown Browser",
    },
    os: {
      type: String,
      required: true,
      trim: true,
      default: "Unknown OS",
    },
    device: {
      type: String,
      required: true,
      trim: true,
      default: "Desktop",
    },
    status: {
      type: String,
      enum: Object.values(SessionStatus),
      default: SessionStatus.ACTIVE,
      required: true,
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

// Indexes for fast querying of sessions
LoginSessionSchema.index({ sessionId: 1 }, { unique: true });
LoginSessionSchema.index({ userId: 1, loginAt: -1 });
LoginSessionSchema.index({ status: 1, lastActiveAt: -1 });

/**
 * LoginSession Model
 * Includes Next.js HMR check to reuse the model if already defined in the mongoose model registry.
 */
const LoginSession: Model<ILoginSessionDocument> =
  mongoose.models.LoginSession ||
  mongoose.model<ILoginSessionDocument>("LoginSession", LoginSessionSchema, "login_sessions");

export default LoginSession;
export { LoginSession };

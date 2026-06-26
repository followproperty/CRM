import type { Types } from "mongoose";

/**
 * Status types representing user login session states
 */
export enum SessionStatus {
  ACTIVE = "ACTIVE",
  LOGGED_OUT = "LOGGED_OUT",
  EXPIRED = "EXPIRED",
}

/**
 * TypeScript Interface representing an Employee Login Session
 */
export interface ILoginSession {
  _id?: string | Types.ObjectId;
  userId: string | Types.ObjectId;
  sessionId: string;
  loginAt: Date;
  logoutAt?: Date | null;
  lastActiveAt: Date;
  ipAddress: string;
  userAgent: string;
  browser: string;
  os: string;
  device: string;
  status: SessionStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

import { Types } from "mongoose";

/**
 * User Role Types for the Real Estate CRM
 */
export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  CALLER = "CALLER",
  DATA_ENTRY = "DATA_ENTRY",
}

/**
 * TypeScript Interface representing a User
 */
export interface IUser {
  _id?: string | Types.ObjectId;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  adminId?: string | Types.ObjectId | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

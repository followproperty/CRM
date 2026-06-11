import { Types } from "mongoose";

/**
 * TypeScript Interface representing a Project
 */
export interface IProject {
  _id?: string | Types.ObjectId;
  name: string;
  slug: string;
  brochureUrl?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

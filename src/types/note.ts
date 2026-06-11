import { Types } from "mongoose";

/**
 * TypeScript Interface representing a Lead Note / Remark
 */
export interface INote {
  _id?: string | Types.ObjectId;
  leadId: string | Types.ObjectId;
  userId: string | Types.ObjectId;
  note: string;
  createdAt?: Date;
  updatedAt?: Date;
}

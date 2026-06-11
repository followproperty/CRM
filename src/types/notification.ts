import { Types } from "mongoose";

/**
 * TypeScript Interface representing an in-app Notification
 */
export interface INotification {
  _id?: string | Types.ObjectId;
  title: string;
  message: string;
  userId: string | Types.ObjectId;
  leadId?: string | Types.ObjectId;
  isRead: boolean;
  createdAt?: Date;
}

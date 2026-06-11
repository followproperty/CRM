import mongoose, { Schema, Document, Model } from "mongoose";
import { IUser, UserRole } from "@/types/user";

/**
 * Mongoose Document Interface representing a User document in MongoDB
 */
export interface IUserDocument extends Omit<IUser, "_id">, Document {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User Schema definition
 */
const UserSchema = new Schema<IUserDocument>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      lowercase: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email address",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.CALLER,
      required: true,
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      required: true,
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

// Ensure index validation for email uniqueness in mongoose
UserSchema.index({ email: 1 }, { unique: true });

/**
 * User Model
 * Includes Next.js HMR check to reuse the model if already defined in the mongoose model registry.
 */
const User: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>("User", UserSchema);

export default User;
export { User };

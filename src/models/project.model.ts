import mongoose, { Schema, Document, Model } from "mongoose";
import { IProject } from "@/types/project";

/**
 * Mongoose Document Interface representing a Project document in MongoDB
 */
export interface IProjectDocument extends Omit<IProject, "_id">, Document {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Project Schema definition
 */
const ProjectSchema = new Schema<IProjectDocument>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      trim: true,
      lowercase: true,
    },
    brochureUrl: {
      type: String,
      trim: true,
      required: false,
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

// Ensure index validation for slug uniqueness in mongoose
ProjectSchema.index({ slug: 1 }, { unique: true });

/**
 * Project Model
 * Includes Next.js HMR check to reuse the model if already defined in the mongoose model registry.
 */
const Project: Model<IProjectDocument> =
  mongoose.models.Project || mongoose.model<IProjectDocument>("Project", ProjectSchema);

export default Project;
export { Project };

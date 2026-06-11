import mongoose, { Schema, Document, Model } from "mongoose";
import { INote } from "@/types/note";

/**
 * Mongoose Document Interface representing a Note document in MongoDB
 */
export interface INoteDocument extends Omit<INote, "_id">, Document {
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Note Schema definition
 * Stores historical, immutable notes/remarks added to leads.
 */
const NoteSchema = new Schema<INoteDocument>(
  {
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      required: [true, "Lead ID is required"],
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    note: {
      type: String,
      trim: true,
      required: [true, "Note content is required"],
    },
  },
  {
    timestamps: true, // Automatically manages createdAt and updatedAt
  }
);

// Index for fast chronological query of notes by lead
NoteSchema.index({ leadId: 1, createdAt: -1 });

/**
 * Note Model
 * Includes Next.js HMR check to reuse the model if already defined in the mongoose model registry.
 */
const Note: Model<INoteDocument> =
  mongoose.models.Note || mongoose.model<INoteDocument>("Note", NoteSchema);

export default Note;
export { Note };

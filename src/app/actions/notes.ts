"use server";

import dbConnect from "@/lib/db";
import Note from "@/models/note.model";
import Activity from "@/models/activity.model";
import { getSession } from "@/lib/session";
import { ActivityAction } from "@/types/activity";
import { revalidatePath } from "next/cache";

export interface AddNoteResult {
  success: boolean;
  error?: string;
}

export interface PopulatedNote {
  _id: string;
  leadId: string;
  note: string;
  createdAt: string;
  user?: {
    name: string;
    role: string;
  } | null;
}

interface PopulatedNoteDoc {
  _id: { toString(): string };
  leadId: { toString(): string };
  note: string;
  createdAt: Date;
  userId?: {
    name: string;
    role: string;
  } | null;
}

/**
 * Server Action to add a manual note/remark to a lead
 */
export async function addLeadNoteAction(leadId: string, noteText: string): Promise<AddNoteResult> {
  const session = await getSession();
  if (!session) {
    return { success: false, error: "Unauthorized." };
  }

  if (!noteText || !noteText.trim()) {
    return { success: false, error: "Note content cannot be empty." };
  }

  try {
    await dbConnect();

    // Create Note entry
    const note = await Note.create({
      leadId,
      userId: session.userId,
      note: noteText.trim(),
    });

    // Create Activity entry for the added note
    await Activity.create({
      leadId,
      userId: session.userId,
      action: ActivityAction.NOTE_ADDED,
      note: noteText.trim(),
      metadata: {
        noteId: note._id.toString(),
        addedBy: session.userId,
      },
    });

    revalidatePath("/caller/leads");
    revalidatePath("/caller");
    revalidatePath("/super-admin/leads");
    revalidatePath("/admin/leads");
    revalidatePath("/admin/followups");
    revalidatePath("/super-admin/followups");
    revalidatePath("/admin/site-visits");
    revalidatePath("/super-admin/site-visits");

    return { success: true };
  } catch (error) {
    console.error("Add lead note error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

/**
 * Server Action to fetch historical notes/remarks for a lead
 */
export async function getLeadNotesAction(leadId: string): Promise<PopulatedNote[]> {
  try {
    await dbConnect();

    const docs = await Note.find({ leadId })
      .populate("userId", "name role")
      .sort({ createdAt: -1 })
      .lean();

    const mappedNotes: PopulatedNote[] = (docs as unknown as PopulatedNoteDoc[]).map((doc) => ({
      _id: doc._id.toString(),
      leadId: doc.leadId.toString(),
      note: doc.note,
      createdAt: doc.createdAt.toISOString(),
      user: doc.userId
        ? {
            name: doc.userId.name,
            role: doc.userId.role,
          }
        : null,
    }));

    return mappedNotes;
  } catch (error) {
    console.error("Get lead notes error:", error);
    return [];
  }
}

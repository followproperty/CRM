"use server";

import dbConnect from "@/lib/db";
import User from "@/models/user.model";
import Activity from "@/models/activity.model";
import { getSession } from "@/lib/session";
import { ActivityAction } from "@/types/activity";
import { UserRole } from "@/types/user";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

export interface UserActionResult {
  success: boolean;
  error?: string;
}

export async function createUserAction(formData: FormData): Promise<UserActionResult> {
  const session = await getSession();
  if (!session || session.role !== UserRole.SUPER_ADMIN) {
    return { success: false, error: "Unauthorized. Super Admin access required." };
  }

  const name = formData.get("name")?.toString().trim();
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const password = formData.get("password")?.toString();
  const role = formData.get("role")?.toString() as UserRole;
  const isActiveString = formData.get("isActive")?.toString();
  const isActive = isActiveString === "true";

  if (!name || !email || !password || !role) {
    return { success: false, error: "All fields are required." };
  }

  const allowedRoles = [UserRole.ADMIN, UserRole.CALLER, UserRole.DATA_ENTRY];
  if (!allowedRoles.includes(role)) {
    return { success: false, error: "Invalid user role selected." };
  }

  try {
    await dbConnect();

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return { success: false, error: "A user with this email already exists." };
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      isActive,
    });

    // Log user creation activity
    await Activity.create({
      userId: session.userId,
      action: ActivityAction.USER_CREATED,
      note: `Created user account: ${name} (${role})`,
      metadata: {
        targetUserId: newUser._id.toString(),
        role: role,
        name: name,
        email: email,
      },
    });

    revalidatePath("/super-admin/users");
    return { success: true };
  } catch (error) {
    console.error("Create user error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

export async function toggleUserStatusAction(userId: string, currentIsActive: boolean): Promise<UserActionResult> {
  const session = await getSession();
  if (!session || session.role !== UserRole.SUPER_ADMIN) {
    return { success: false, error: "Unauthorized. Super Admin access required." };
  }

  if (userId === session.userId) {
    return { success: false, error: "You cannot deactivate your own super admin account." };
  }

  try {
    await dbConnect();

    const newIsActive = !currentIsActive;

    // Update user
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { isActive: newIsActive },
      { new: true }
    );

    if (!updatedUser) {
      return { success: false, error: "User not found." };
    }

    // Log status change activity
    await Activity.create({
      userId: session.userId,
      action: ActivityAction.USER_STATUS_CHANGED,
      note: `${newIsActive ? "Activated" : "Deactivated"} user account: ${updatedUser.name}`,
      metadata: {
        targetUserId: userId,
        isActive: newIsActive,
        name: updatedUser.name,
      },
    });

    revalidatePath("/super-admin/users");
    return { success: true };
  } catch (error) {
    console.error("Toggle user status error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

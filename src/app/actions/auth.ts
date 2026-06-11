"use server";

import dbConnect from "@/lib/db";
import User from "@/models/user.model";
import { createSession } from "@/lib/session";
import bcrypt from "bcryptjs";

export interface LoginResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
}

export async function login(formData: FormData): Promise<LoginResult> {
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();

  if (!email || !password) {
    return { success: false, error: "Please enter both email and password." };
  }

  try {
    await dbConnect();

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return { success: false, error: "Invalid email or password." };
    }

    if (!user.isActive) {
      return { success: false, error: "Account is inactive. Please contact support." };
    }

    // Passwords in DB are hashed. Compare using bcryptjs.
    const isMatch = await bcrypt.compare(password, user.password || "");
    if (!isMatch) {
      return { success: false, error: "Invalid email or password." };
    }

    // Set up the session payload
    const payload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    };

    await createSession(payload);

    // Determine redirect url based on role
    let redirectTo = "/";
    switch (user.role) {
      case "SUPER_ADMIN":
        redirectTo = "/super-admin";
        break;
      case "ADMIN":
        redirectTo = "/admin";
        break;
      case "CALLER":
        redirectTo = "/caller";
        break;
      case "DATA_ENTRY":
        redirectTo = "/data-entry";
        break;
    }

    return { success: true, redirectTo };
  } catch (error) {
    console.error("Login server error:", error);
    return { success: false, error: "An unexpected error occurred. Please try again." };
  }
}

export async function logout(): Promise<void> {
  const { destroySession } = await import("@/lib/session");
  await destroySession();
}

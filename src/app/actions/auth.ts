"use server";

import dbConnect from "@/lib/db";
import User from "@/models/user.model";
import { createSession, getSession } from "@/lib/session";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import LoginSession from "@/models/login-session.model";
import { SessionStatus } from "@/types/login-session";
import { getClientRequestMetadata } from "@/lib/request";

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

    // Generate unique sessionId
    const sessionId = new mongoose.Types.ObjectId().toString();

    // Create LoginSession record (fail-safe to not block login on audit failures)
    try {
      const { cleanOldUserSessions } = await import("@/lib/session-expiry");
      await cleanOldUserSessions(user._id.toString());

      const metadata = await getClientRequestMetadata();
      await LoginSession.create({
        userId: user._id.toString(),
        sessionId,
        loginAt: new Date(),
        ipAddress: metadata.ip,
        userAgent: metadata.userAgent,
        browser: metadata.browser,
        os: metadata.os,
        device: metadata.device,
        status: SessionStatus.ACTIVE,
      });
    } catch (sessionError) {
      console.error("Failed to create login session record:", sessionError);
    }

    // Set up the session payload including sessionId
    const payload = {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
      sessionId,
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
  try {
    const session = await getSession();
    if (session?.sessionId) {
      await dbConnect();
      await LoginSession.findOneAndUpdate(
        { sessionId: session.sessionId },
        {
          logoutAt: new Date(),
          status: SessionStatus.LOGGED_OUT,
        }
      );
    }
  } catch (error) {
    console.error("Logout session tracking error:", error);
  }

  const { destroySession } = await import("@/lib/session");
  await destroySession();
}

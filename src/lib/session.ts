import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { encrypt, decrypt, SessionPayload } from "./session-crypto";

const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY) {
  throw new Error("JWT_SECRET environment variable is missing");
}
const key = new TextEncoder().encode(SECRET_KEY);

export type { SessionPayload };
export { encrypt, decrypt };

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await encrypt(payload);
  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 4, // 4 hours
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) return null;
  
  try {
    const { payload } = await jwtVerify(sessionCookie, key, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch (error: unknown) {
    const jwtError = error as { code?: string };
    if (jwtError?.code === "ERR_JWT_EXPIRED") {
      try {
        const { decodeJwt } = await import("jose");
        const payload = decodeJwt(sessionCookie) as unknown as SessionPayload;
        if (payload?.sessionId) {
          const { markSessionExpired } = await import("./session-expiry");
          // Mark session expired asynchronously in the database
          await markSessionExpired(payload.sessionId);
        }
      } catch (err) {
        console.error("Failed to mark session as expired during getSession:", err);
      }
    }
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}

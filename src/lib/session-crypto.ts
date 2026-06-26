import { SignJWT, jwtVerify } from "jose";
import { UserRole } from "@/types/user";

const SECRET_KEY = process.env.JWT_SECRET;
if (!SECRET_KEY) {
  throw new Error("JWT_SECRET environment variable is missing");
}
const key = new TextEncoder().encode(SECRET_KEY);

export interface SessionPayload {
  userId: string;
  email: string;
  role: UserRole;
  name: string;
  sessionId?: string;
}

export async function encrypt(payload: SessionPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("4h")
    .sign(key);
}

export async function decrypt(input: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(input, key, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

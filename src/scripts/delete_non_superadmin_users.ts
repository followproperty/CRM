import fs from "fs";
import path from "path";
import dbConnect from "../lib/db";
import User from "../models/user.model";
import { UserRole } from "../types/user";

// Manually parse .env.local if variables are not already loaded in the environment
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  const envFileContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envFileContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...values] = trimmed.split("=");
      const envKey = key.trim();
      const envValue = values.join("=").trim();
      if (!process.env[envKey]) {
        process.env[envKey] = envValue;
      }
    }
  }
}

async function main() {
  console.log("Connecting to MongoDB...");
  await dbConnect();
  console.log("Connected successfully.");

  console.log("Registered users before deletion:");
  const usersBefore = await User.find({}).select("name email role isActive");
  console.log(usersBefore.map(u => ({ name: u.name, email: u.email, role: u.role })));

  console.log("Deleting all users that are not super-admin...");
  const result = await User.deleteMany({ role: { $ne: UserRole.SUPER_ADMIN } });
  console.log(`Deleted ${result.deletedCount} users.`);

  console.log("Registered users after deletion:");
  const usersAfter = await User.find({}).select("name email role isActive");
  console.log(usersAfter.map(u => ({ name: u.name, email: u.email, role: u.role })));

  process.exit(0);
}

main().catch((err) => {
  console.error("Error executing delete users script:", err);
  process.exit(1);
});

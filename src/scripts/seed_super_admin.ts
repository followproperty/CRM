import fs from "fs";
import path from "path";
import dbConnect from "../lib/db";
import User from "../models/user.model";
import { UserRole } from "../types/user";
import bcrypt from "bcryptjs";

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

  const email = "superadmin@crm.com";
  const password = "superadmin123";
  const name = "Super Admin";

  console.log(`Checking if user with email ${email} already exists...`);
  let user = await User.findOne({ email: email.toLowerCase() });

  if (user) {
    console.log("Super Admin already exists. Updating role and active status just in case...");
    user.role = UserRole.SUPER_ADMIN;
    user.isActive = true;
    
    // Also rehash the password just in case they need to log in with the default password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    
    await user.save();
    console.log("Super Admin updated successfully.");
  } else {
    console.log("Creating new Super Admin...");
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = await User.create({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: UserRole.SUPER_ADMIN,
      isActive: true,
    });
    console.log("Super Admin created successfully.");
  }

  console.log("\nCredentials to log in:");
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Error seeding super admin:", err);
  process.exit(1);
});

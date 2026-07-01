import fs from "fs";
import path from "path";
import dbConnect from "../lib/db";
import User from "../models/user.model";
import Activity from "../models/activity.model";

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

  // Find user "sumit"
  const sumit = await User.findOne({ name: /sumit/i });
  if (!sumit) {
    console.error("User Sumit not found!");
    process.exit(1);
  }
  console.log(`Found user Sumit: Name="${sumit.name}", ID="${sumit._id}"`);

  // Start of today in local system time
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  console.log(`Deleting system activity logs for Sumit created today (since ${startOfToday.toISOString()})...`);
  
  const result = await Activity.deleteMany({
    userId: sumit._id,
    createdAt: { $gte: startOfToday }
  });

  console.log(`Deleted ${result.deletedCount} system activity records successfully.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error executing delete activities script:", err);
  process.exit(1);
});

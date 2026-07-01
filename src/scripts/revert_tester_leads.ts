import fs from "fs";
import path from "path";
import dbConnect from "../lib/db";
import User from "../models/user.model";
import Note from "../models/note.model";
import Activity from "../models/activity.model";
import { Lead, UploadedLead, VrindavanLead, LeadContainer } from "../models/lead.model";
import { LeadStatus } from "../types/lead";

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

  // Find user "tester"
  const tester = await User.findOne({ name: /tester/i });
  if (!tester) {
    console.error("User Tester not found!");
    process.exit(1);
  }
  console.log(`Found user Tester: Name="${tester.name}", ID="${tester._id}"`);

  const models = [
    { name: "leads", model: Lead },
    { name: "uploaded_leads", model: UploadedLead },
    { name: "vrindavan_leads", model: VrindavanLead }
  ];

  let totalReverted = 0;

  for (const m of models) {
    console.log(`\nScanning collection: ${m.name}...`);
    const leads = await m.model.find({ assignedTo: tester._id });
    console.log(`Found ${leads.length} leads assigned to Tester in ${m.name}.`);

    for (const lead of leads) {
      if (lead.status !== LeadStatus.NEW) {
        console.log(`Reverting lead: "${lead.name}" (${lead.primaryPhone || lead.phone}) | Current Status: ${lead.status}`);
        
        // Revert properties
        lead.status = LeadStatus.NEW;
        lead.followUp = undefined;
        lead.siteVisit = undefined;
        lead.maybeLaterTimeframe = undefined;
        lead.maybeLaterDate = undefined;
        lead.updatedAt = new Date();

        await lead.save();

        // Sync with LeadContainer
        await LeadContainer.updateOne(
          { _id: lead._id },
          {
            $set: {
              status: LeadStatus.NEW,
              followUp: undefined,
              siteVisit: undefined,
              maybeLaterTimeframe: undefined,
              maybeLaterDate: undefined,
              updatedAt: new Date(),
              sourceCollection: m.name
            }
          },
          { upsert: true }
        );

        // Delete notes for this lead created today
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const deleteNotesRes = await Note.deleteMany({
          leadId: lead._id.toString(),
          createdAt: { $gte: startOfToday }
        });
        console.log(`Deleted ${deleteNotesRes.deletedCount} notes created today for ${lead.name}`);

        totalReverted++;
      }
    }
  }

  // Delete today's Activity logs for Tester
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const deleteActivitiesRes = await Activity.deleteMany({
    userId: tester._id,
    createdAt: { $gte: startOfToday }
  });
  console.log(`\nDeleted ${deleteActivitiesRes.deletedCount} system activity logs for Tester.`);

  console.log(`\nSuccess! Reverted ${totalReverted} leads back to NEW status.`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error executing revert script:", err);
  process.exit(1);
});

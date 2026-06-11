/**
 * TEMPORARY TESTING UTILITY - LEAD SEEDER
 * This script is a temporary utility to seed realistic test leads into the database.
 * It is safe to run multiple times (prevents duplicate phone numbers).
 * Can be safely deleted once testing is completed.
 *
 * Command to run: npm run seed:leads
 */

import fs from "fs";
import path from "path";
import dbConnect from "../lib/db";
import Lead from "../models/lead.model";
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

const testLeads = [
  { name: "Ramesh Patel", phone: "9876543210", city: "Mumbai", state: "Maharashtra", source: "Website", status: LeadStatus.NEW },
  { name: "Priya Sharma", phone: "9123456789", city: "Delhi", state: "Delhi", source: "Meta Ads", status: LeadStatus.INTERESTED },
  { name: "Amit Kumar", phone: "9812345678", city: "Bangalore", state: "Karnataka", source: "Google Ads", status: LeadStatus.NOT_INTERESTED },
  { name: "Ananya Iyer", phone: "9945612307", city: "Chennai", state: "Tamil Nadu", source: "Referral", status: LeadStatus.FOLLOW_UP, nextFollowUp: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  { name: "Vikram Singh", phone: "9789012345", city: "Jaipur", state: "Rajasthan", source: "Event", status: LeadStatus.DND, dnd: true },
  { name: "Sneha Reddy", phone: "9654321098", city: "Hyderabad", state: "Telangana", source: "Website", status: LeadStatus.NEW },
  { name: "Rajesh Gupta", phone: "9543210987", city: "Lucknow", state: "Uttar Pradesh", source: "Meta Ads", status: LeadStatus.INTERESTED },
  { name: "Pooja Mehta", phone: "9432109876", city: "Ahmedabad", state: "Gujarat", source: "Google Ads", status: LeadStatus.FOLLOW_UP, nextFollowUp: new Date(Date.now() + 48 * 60 * 60 * 1000) },
  { name: "Sanjay Verma", phone: "9321098765", city: "Pune", state: "Maharashtra", source: "Referral", status: LeadStatus.NOT_INTERESTED },
  { name: "Divya Rao", phone: "9210987654", city: "Kolkata", state: "West Bengal", source: "Event", status: LeadStatus.DND, dnd: true },
  { name: "Manish Joshi", phone: "9109876543", city: "Indore", state: "Madhya Pradesh", source: "Website", status: LeadStatus.NEW },
  { name: "Neha Gupta", phone: "9098765432", city: "Noida", state: "Uttar Pradesh", source: "Meta Ads", status: LeadStatus.INTERESTED },
  { name: "Sunil Nair", phone: "8987654321", city: "Kochi", state: "Kerala", source: "Google Ads", status: LeadStatus.FOLLOW_UP, nextFollowUp: new Date(Date.now() + 72 * 60 * 60 * 1000) },
  { name: "Swati Deshmukh", phone: "8876543210", city: "Nagpur", state: "Maharashtra", source: "Referral", status: LeadStatus.NOT_INTERESTED },
  { name: "Alok Mishra", phone: "8765432109", city: "Patna", state: "Bihar", source: "Event", status: LeadStatus.DND, dnd: true },
  { name: "Ritu Chaudhary", phone: "8654321098", city: "Chandigarh", state: "Punjab", source: "Website", status: LeadStatus.NEW },
  { name: "Suresh Pillai", phone: "8543210987", city: "Coimbatore", state: "Tamil Nadu", source: "Meta Ads", status: LeadStatus.INTERESTED },
  { name: "Kavita Sen", phone: "8432109876", city: "Guwahati", state: "Assam", source: "Google Ads", status: LeadStatus.FOLLOW_UP, nextFollowUp: new Date(Date.now() + 12 * 60 * 60 * 1000) },
  { name: "Pankaj Sharma", phone: "8321098765", city: "Dehradun", state: "Uttarakhand", source: "Referral", status: LeadStatus.NOT_INTERESTED },
  { name: "Preeti Bhat", phone: "8210987654", city: "Jammu", state: "Jammu and Kashmir", source: "Event", status: LeadStatus.DND, dnd: true },
  { name: "Manoj Kulkarni", phone: "8109876543", city: "Nashik", state: "Maharashtra", source: "Website", status: LeadStatus.NEW },
  { name: "Geeta Malhotra", phone: "8098765432", city: "Gurgaon", state: "Haryana", source: "Meta Ads", status: LeadStatus.INTERESTED },
  { name: "Gaurav Saxena", phone: "7987654321", city: "Bhopal", state: "Madhya Pradesh", source: "Google Ads", status: LeadStatus.NEW },
  { name: "Deepa Nair", phone: "7876543210", city: "Trivandrum", state: "Kerala", source: "Referral", status: LeadStatus.FOLLOW_UP, nextFollowUp: new Date(Date.now() + 6 * 60 * 60 * 1000) },
  { name: "Harish Patel", phone: "7765432109", city: "Surat", state: "Gujarat", source: "Event", status: LeadStatus.NOT_INTERESTED }
];

async function main() {
  console.log("Connecting to MongoDB...");
  await dbConnect();
  console.log("Connected successfully.");

  let insertedCount = 0;
  let skippedCount = 0;

  for (const leadData of testLeads) {
    const existingLead = await Lead.findOne({ phone: leadData.phone });

    if (existingLead) {
      skippedCount++;
      continue;
    }

    await Lead.create(leadData);
    insertedCount++;
  }

  console.log(`\nSeeding completed:`);
  console.log(`- Inserted: ${insertedCount} leads`);
  console.log(`- Skipped (Duplicates): ${skippedCount} leads`);
  
  process.exit(0);
}

main().catch((err) => {
  console.error("Error seeding leads database:", err);
  process.exit(1);
});

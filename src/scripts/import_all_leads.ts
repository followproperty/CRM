import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import dbConnect from "../lib/db";
import Lead from "../models/lead.model";
import { LeadStatus } from "../types/lead";

// Load environment variables from .env.local
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

// Utility to normalize phone values
function normalizePhone(val: unknown): string {
  if (val === undefined || val === null) return "";
  let str = String(val).trim();
  str = str.replace(/[\s\-\(\)]/g, "");
  str = str.replace(/[^\d+]/g, "");
  return str;
}

function isMobile(phone: string): boolean {
  const clean = phone.replace(/[^\d]/g, "");
  if (clean.startsWith("65") && clean.length === 10) {
    return /^65[89]/.test(clean);
  }
  if (clean.length === 8) {
    return /^[89]/.test(clean);
  }
  if (clean.length === 10) {
    return /^[6-9]/.test(clean) && !clean.startsWith("65");
  }
  if (clean.length === 11 && /^0[6-9]/.test(clean)) {
    return true;
  }
  if (clean.length === 12 && /^91[6-9]/.test(clean)) {
    return true;
  }
  return false;
}

function extractCountry(address: string): string {
  if (!address) return "";
  const lower = address.toLowerCase();
  if (lower.includes("singapore")) return "Singapore";
  if (lower.includes("india")) return "India";
  if (lower.includes("delhi")) return "India";
  if (lower.includes("haryana")) return "India";
  if (lower.includes("mumbai")) return "India";
  return "";
}

async function main() {
  console.log("Connecting to MongoDB...");
  await dbConnect();
  console.log("Connected successfully.");

  // Delete all old leads from the database
  console.log("Deleting all old leads from database...");
  const deleteResult = await Lead.deleteMany({});
  console.log(`Database cleared. Deleted ${deleteResult.deletedCount} old leads.`);

  const filePath = path.resolve(process.cwd(), "src/data/Untitled spreadsheet-1.xlsx");
  if (!fs.existsSync(filePath)) {
    console.error(`Excel file not found at ${filePath}`);
    process.exit(1);
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`Loaded sheet. Total raw rows (including headers): ${rawRows.length}`);

  let totalRowsProcessed = 0;
  let uselessCount = 0;
  let duplicateCount = 0;
  let swapCount = 0;
  let uploadedCount = 0;

  const seenPhones = new Set<string>();

  // Assuming row 0 is header. We loop from index 1.
  for (let idx = 1; idx < rawRows.length; idx++) {
    const row = rawRows[idx];
    if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) {
      continue;
    }

    totalRowsProcessed++;

    const sNo = row[0];
    const customerCode = row[1] ? String(row[1]).trim() : undefined;
    const projectName = row[2] ? String(row[2]).trim() : undefined;
    const name = row[3] ? String(row[3]).trim() : "Unnamed Lead";
    const rawAddress = row[4] ? String(row[4]).trim() : undefined;
    
    const rawPhone = row[5];
    const rawSecPhone = row[6];
    let primaryPhone = normalizePhone(rawPhone);
    let secondaryPhone = normalizePhone(rawSecPhone);

    // Swap if primary is landline but secondary is mobile
    let wasSwapped = false;
    if (primaryPhone && secondaryPhone) {
      const isPrimaryMobile = isMobile(primaryPhone);
      const isSecondaryMobile = isMobile(secondaryPhone);
      if (!isPrimaryMobile && isSecondaryMobile) {
        const temp = primaryPhone;
        primaryPhone = secondaryPhone;
        secondaryPhone = temp;
        wasSwapped = true;
        swapCount++;
      }
    }

    if (!primaryPhone) {
      uselessCount++;
      continue; // Useless row: missing primary phone number
    }

    if (seenPhones.has(primaryPhone)) {
      duplicateCount++;
      continue; // Duplicate lead: skip it
    }
    seenPhones.add(primaryPhone);

    const email = row[7] ? String(row[7]).trim().toLowerCase() : undefined;
    const country = rawAddress ? extractCountry(rawAddress) : "";

    const leadPayload = {
      name,
      primaryPhone,
      secondaryPhone: secondaryPhone || undefined,
      email: email || undefined,
      customerCode: customerCode || undefined,
      projectName: projectName || undefined,
      address: rawAddress || undefined,
      country: country || undefined,
      source: "CUSTOMER_DATABASE",
      status: LeadStatus.NEW,
      sourceDetails: {
        rawRowData: {
          excelRowIndex: idx,
          sNo: sNo !== undefined ? String(sNo).trim() : undefined,
          phoneSwapped: wasSwapped
        }
      }
    };

    try {
      await Lead.create(leadPayload);
      uploadedCount++;
    } catch (err) {
      console.error(`Failed to create lead at row index ${idx}:`, err instanceof Error ? err.message : String(err));
      uselessCount++;
    }
  }

  console.log("\n=== IMPORT COMPLETE ===");
  console.log(`- Total Excel Rows Processed: ${totalRowsProcessed}`);
  console.log(`- Useless Rows (missing phone or invalid): ${uselessCount}`);
  console.log(`- Duplicate Leads Skipped: ${duplicateCount}`);
  console.log(`- Phone Columns Swapped (Landline/Mobile): ${swapCount}`);
  console.log(`- Total Leads Uploaded to DB: ${uploadedCount}`);

  process.exit(0);
}

main().catch((err) => {
  console.error("Import sequence failed:", err);
  process.exit(1);
});

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
function normalizePhone(val: any): string {
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

  // ==========================================
  // PHASE 1: Clear DB and Import 200 Leads
  // ==========================================
  console.log("\n--- PHASE 1: Cleard leads collection and import 200 leads ---");
  await Lead.deleteMany({});
  console.log("Cleared leads collection.");

  const filePath = path.resolve(process.cwd(), "src/data/Untitled spreadsheet-1.xlsx");
  if (!fs.existsSync(filePath)) {
    console.error(`Excel file not found at ${filePath}`);
    process.exit(1);
  }

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`Loaded sheet. Total raw rows: ${rawRows.length}`);

  let rowsImported = 0;
  const seenPhones = new Set<string>();

  for (let idx = 0; idx < rawRows.length; idx++) {
    const row = rawRows[idx];
    if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) {
      continue;
    }

    if (rowsImported >= 200) {
      break;
    }

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
      }
    }

    if (!primaryPhone) {
      continue; // Skip if missing phone
    }

    if (seenPhones.has(primaryPhone)) {
      continue; // Skip duplicate phone in the same spreadsheet import
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
      rowsImported++;
    } catch (err: any) {
      console.error(`Failed to create lead at row index ${idx}:`, err.message);
    }
  }

  console.log(`Phase 1 complete. Imported ${rowsImported} leads as LeadStatus.NEW.`);
  const dbCount1 = await Lead.countDocuments({});
  console.log(`Database leads count: ${dbCount1}`);

  // ==========================================
  // PHASE 2: Delete 15 Leads
  // ==========================================
  console.log("\n--- PHASE 2: Deleting 15 leads from database ---");
  const leadsToDelete = await Lead.find({}).limit(15);
  const deleteIds = leadsToDelete.map(l => l._id);
  
  const deleteResult = await Lead.deleteMany({ _id: { $in: deleteIds } });
  console.log(`Successfully deleted ${deleteResult.deletedCount} leads.`);

  const dbCount2 = await Lead.countDocuments({});
  console.log(`Database leads count: ${dbCount2} (should be ${dbCount1 - 15})`);

  // ==========================================
  // PHASE 3: Re-import 200 Leads from row 0 without duplicates
  // ==========================================
  console.log("\n--- PHASE 3: Re-uploading 200 leads from 0th row (skipping duplicates) ---");
  
  let reImportedCount = 0;
  // Clear the in-memory set, but we will check database for existing primaryPhone
  const seenPhonesPhase3 = new Set<string>();

  for (let idx = 0; idx < rawRows.length; idx++) {
    const row = rawRows[idx];
    if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) {
      continue;
    }

    // Still bound checking by total database leads limit or row processing
    const currentCount = await Lead.countDocuments({});
    if (currentCount >= 200) {
      console.log(`Target database limit of 200 leads reached. Stopping re-import.`);
      break;
    }

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
      }
    }

    if (!primaryPhone) {
      continue;
    }

    if (seenPhonesPhase3.has(primaryPhone)) {
      continue;
    }
    seenPhonesPhase3.add(primaryPhone);

    // Check database to see if phone exists
    const existingLead = await Lead.findOne({ primaryPhone });
    if (existingLead) {
      continue; // Skip duplicate database records
    }

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
      reImportedCount++;
    } catch (err: any) {
      console.error(`Failed to re-import lead at row index ${idx}:`, err.message);
    }
  }

  console.log(`Phase 3 complete. Re-imported ${reImportedCount} missing leads.`);
  const finalDbCount = await Lead.countDocuments({});
  console.log(`Final Database leads count: ${finalDbCount}`);

  process.exit(0);
}

main().catch(err => {
  console.error("Workflow failed:", err);
  process.exit(1);
});

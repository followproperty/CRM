import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import dbConnect from "../lib/db";
import { getLeadModel } from "../models/lead.model";
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

// Validation for wrong/invalid numbers
function getPhoneIssue(phone: string): string | null {
  if (!phone) {
    return "Missing/Empty Phone";
  }
  const clean = phone.replace(/[^\d]/g, "");
  if (clean.length === 0) {
    return "No Digits in Phone";
  }
  if (clean.length < 8) {
    return "Too Short (Less than 8 digits)";
  }
  if (clean.length > 15) {
    return "Too Long (More than 15 digits)";
  }
  return null;
}

async function main() {
  // Parse command line arguments: npx ts-node src/scripts/import_leads.ts <file_path> [collectionType]
  const args = process.argv.slice(2);
  const cliFilePath = args[0];
  const collectionType = args[1] || "leads"; // Default to leads collection

  console.log(`Connecting to MongoDB...`);
  await dbConnect();
  console.log("Connected successfully.");

  const Model = getLeadModel(collectionType);

  // Clear existing records from chosen collection
  console.log(`Clearing all old records from collection [${Model.collection.name}]...`);
  const deleteResult = await Model.deleteMany({});
  console.log(`Cleared collection. Deleted ${deleteResult.deletedCount} old records.`);

  // Setup files to process
  let filesToImport: Array<{ name: string; path: string }> = [];
  if (cliFilePath) {
    const filePath = path.resolve(process.cwd(), cliFilePath);
    if (!fs.existsSync(filePath)) {
      console.error(`Specified Excel file not found at ${filePath}`);
      process.exit(1);
    }
    filesToImport = [{ name: path.basename(filePath), path: filePath }];
  } else {
    // If no argument is provided, check if standard workspace files exist or fall back
    console.log("No spreadsheet path provided as CLI argument. Looking for fallback files...");
    const fallbacks = [
      { name: "Untitled spreadsheet-1.xlsx", path: "src/data/Untitled spreadsheet-1.xlsx" },
      { name: "DOC-20260406-WA0016.xlsx", path: "src/data/DOC-20260406-WA0016.xlsx" }
    ];
    for (const f of fallbacks) {
      if (fs.existsSync(path.resolve(process.cwd(), f.path))) {
        filesToImport.push(f);
      }
    }
    if (filesToImport.length === 0) {
      console.error("No import spreadsheets found. Usage: npx ts-node src/scripts/import_leads.ts <file_path> [collectionType]");
      process.exit(1);
    }
  }

  let totalProcessed = 0;
  let duplicateCount = 0;
  let wrongNumberCount = 0;
  let swapCount = 0;

  const seenPhones = new Set<string>();
  const wrongNumberExamples: Array<{ file: string; sheet: string; rowIdx: number; name: string; rawPhone: unknown; cleanPhone: string; reason: string }> = [];
  const duplicateExamples: Array<{ file: string; sheet: string; rowIdx: number; name: string; phone: string }> = [];
  
  const leadPayloads = [];

  for (const fileInfo of filesToImport) {
    const filePath = path.resolve(process.cwd(), fileInfo.path);
    console.log(`Reading file: ${fileInfo.name}...`);
    const workbook = XLSX.readFile(filePath);

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      console.log(`- Loaded sheet [${sheetName}]. Total rows: ${rawRows.length}`);

      if (rawRows.length === 0) continue;

      // Detect headers and build column mapping indices dynamically
      // We look at row 0 or row 1 (fallback) to find header descriptions
      const headers = rawRows[0] ? rawRows[0].map(h => String(h || "").trim().toLowerCase()) : [];

      const nameIdx = headers.findIndex(h => h.includes("name") || h.includes("customer"));
      const phoneIdx = headers.findIndex(h => h.includes("phone") || h.includes("mobile") || h.includes("contact") || h.includes("no.") || h.includes("number"));
      const secPhoneIdx = headers.findIndex((h, idx) => idx !== phoneIdx && (h.includes("phone") || h.includes("mobile") || h.includes("contact") || h.includes("secondary") || h.includes("alt")));
      const addressIdx = headers.findIndex(h => h.includes("address") || h.includes("location"));
      const cityIdx = headers.findIndex(h => h.includes("city"));
      const stateIdx = headers.findIndex(h => h.includes("state") || h.includes("region"));
      const emailIdx = headers.findIndex(h => h.includes("email") || h.includes("mail"));
      const projectIdx = headers.findIndex(h => h.includes("project"));
      const codeIdx = headers.findIndex(h => h.includes("code") || h.includes("sno"));

      console.log(`Dynamic Column Index mapping:`, {
        nameIdx, phoneIdx, secPhoneIdx, addressIdx, cityIdx, stateIdx, emailIdx, projectIdx, codeIdx
      });

      // Loop rows (row 0 is the headers row, so we start at row index 1)
      for (let idx = 1; idx < rawRows.length; idx++) {
        const row = rawRows[idx];
        if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) {
          continue;
        }

        totalProcessed++;

        // Base fields
        let customerCode: string | undefined = undefined;
        let projectName: string | undefined = undefined;
        let name = "Unnamed Lead";
        let rawAddress: string | undefined = undefined;
        let rawPhone: unknown = undefined;
        let rawSecPhone: unknown = undefined;
        let email: string | undefined = undefined;
        let city: string | undefined = undefined;
        let state: string | undefined = undefined;

        // If headers weren't detected properly (e.g. no match for phone), fallback to standard Sheet1 layout
        if (phoneIdx === -1 && row.length >= 6) {
          // Standard Fallback Layout:
          // Col 1: Customer Code, Col 2: Project, Col 3: Name, Col 4: Address, Col 5: Phone, Col 6: Sec Phone, Col 7: Email
          customerCode = row[1] ? String(row[1]).trim() : undefined;
          projectName = row[2] ? String(row[2]).trim() : undefined;
          name = row[3] ? String(row[3]).trim() : "Unnamed Lead";
          rawAddress = row[4] ? String(row[4]).trim() : undefined;
          rawPhone = row[5];
          rawSecPhone = row[6];
          email = row[7] ? String(row[7]).trim().toLowerCase() : undefined;
        } else {
          // Use dynamically resolved columns
          if (nameIdx !== -1 && row[nameIdx] !== undefined) name = String(row[nameIdx]).trim();
          if (phoneIdx !== -1) rawPhone = row[phoneIdx];
          if (secPhoneIdx !== -1) rawSecPhone = row[secPhoneIdx];
          if (addressIdx !== -1 && row[addressIdx] !== undefined) rawAddress = String(row[addressIdx]).trim();
          if (cityIdx !== -1 && row[cityIdx] !== undefined) city = String(row[cityIdx]).trim();
          if (stateIdx !== -1 && row[stateIdx] !== undefined) state = String(row[stateIdx]).trim();
          if (emailIdx !== -1 && row[emailIdx] !== undefined) email = String(row[emailIdx]).trim().toLowerCase();
          if (projectIdx !== -1 && row[projectIdx] !== undefined) projectName = String(row[projectIdx]).trim();
          if (codeIdx !== -1 && row[codeIdx] !== undefined) customerCode = String(row[codeIdx]).trim();
        }

        let primaryPhone = normalizePhone(rawPhone);
        let secondaryPhone = normalizePhone(rawSecPhone);

        // Validate phone number
        const phoneIssue = getPhoneIssue(primaryPhone);
        if (phoneIssue) {
          wrongNumberCount++;
          if (wrongNumberExamples.length < 15) {
            wrongNumberExamples.push({
              file: fileInfo.name,
              sheet: sheetName,
              rowIdx: idx,
              name,
              rawPhone,
              cleanPhone: primaryPhone,
              reason: phoneIssue
            });
          }
          continue;
        }

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

        // Duplicate check
        if (seenPhones.has(primaryPhone)) {
          duplicateCount++;
          if (duplicateExamples.length < 15) {
            duplicateExamples.push({
              file: fileInfo.name,
              sheet: sheetName,
              rowIdx: idx,
              name,
              phone: primaryPhone
            });
          }
          continue;
        }
        seenPhones.add(primaryPhone);

        const country = rawAddress ? extractCountry(rawAddress) : "";

        // Collect other extra attributes in sourceDetails
        const sourceDetails: Record<string, unknown> = {
          rawRowData: {
            excelRowIndex: idx,
            fileName: fileInfo.name,
            sheetName: sheetName,
            phoneSwapped: wasSwapped
          }
        };

        // Populate dynamic extra fields (e.g. profession, specialty)
        headers.forEach((header, colIdx) => {
          const skipCols = [nameIdx, phoneIdx, secPhoneIdx, addressIdx, cityIdx, stateIdx, emailIdx, projectIdx, codeIdx];
          if (!skipCols.includes(colIdx) && header && row[colIdx] !== undefined && row[colIdx] !== null) {
            sourceDetails[header] = row[colIdx];
          }
        });

        leadPayloads.push({
          name,
          phone: primaryPhone,
          primaryPhone,
          secondaryPhone: secondaryPhone || undefined,
          email: email || undefined,
          customerCode: customerCode || undefined,
          projectName: projectName || undefined,
          address: rawAddress || undefined,
          city: city || undefined,
          state: state || undefined,
          country: country || undefined,
          source: collectionType === "uploaded_leads" ? "UPLOADED_LEADS" : "CUSTOMER_DATABASE",
          status: LeadStatus.NEW,
          sourceDetails
        });
      }
    }
  }

  console.log(`Inserting ${leadPayloads.length} records in bulk into [${Model.collection.name}]...`);
  let successCount = 0;
  if (leadPayloads.length > 0) {
    const insertResult = await Model.insertMany(leadPayloads);
    successCount = insertResult.length;
  }

  console.log("\n================ COMBINED IMPORT METRICS ================");
  console.log(`- Target Collection: ${collectionType}`);
  console.log(`- Total Excel Rows Processed: ${totalProcessed}`);
  console.log(`- Successfully Uploaded to DB (Unique & Valid): ${successCount}`);
  console.log(`- Duplicate Leads Skipped: ${duplicateCount}`);
  console.log(`- Wrong/Invalid Numbers Skipped: ${wrongNumberCount}`);
  console.log(`- Phone Columns Swapped (Landline/Mobile): ${swapCount}`);
  console.log("=========================================================\n");

  if (wrongNumberExamples.length > 0) {
    console.log("--- WRONG NUMBER EXAMPLES ---");
    wrongNumberExamples.forEach(ex => {
      console.log(`File: ${ex.file} | Sheet: ${ex.sheet} | Row ${ex.rowIdx} | Name: ${ex.name} | Raw Phone: ${ex.rawPhone} | Clean Phone: ${ex.cleanPhone} | Reason: ${ex.reason}`);
    });
    console.log("-----------------------------\n");
  }

  if (duplicateExamples.length > 0) {
    console.log("--- DUPLICATE EXAMPLES ---");
    duplicateExamples.forEach(ex => {
      console.log(`File: ${ex.file} | Sheet: ${ex.sheet} | Row ${ex.rowIdx} | Name: ${ex.name} | Phone: ${ex.phone}`);
    });
    console.log("--------------------------\n");
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Import script failed:", err);
  process.exit(1);
});

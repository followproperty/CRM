import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { PDFParse } from "pdf-parse";
import dbConnect from "../lib/db";
import { getLeadModel } from "../models/lead.model";
import { ImportLog } from "../models/import-log.model";
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

// -----------------------------------------------------------------------------
// Configurations
// -----------------------------------------------------------------------------
const SUPPORTED_COLLECTIONS = ["leads", "uploaded_leads"];

const FIELD_ALIASES = {
  name: [
    "name", "full name", "contact name", "person name", 
    "customer name", "lead name", "client name", "investor name"
  ],
  phone: [
    "phone", "mobile", "mobile number", "contact number", 
    "whatsapp number", "msisdn", "phone number", "tel", "telephone", 
    "primary phone", "primary mobile"
  ],
  secondaryPhone: [
    "sec phone", "secondary phone", "secondary mobile", "alt phone", 
    "alternative phone", "alternate phone", "alt contact", "other phone"
  ],
  address: [
    "address", "location", "office address", "address1", "address 2", 
    "residential address", "home address", "postal address"
  ],
  city: [
    "city", "town", "district"
  ],
  state: [
    "state", "region", "province"
  ],
  email: [
    "email", "mail", "email address", "e-mail"
  ],
  about: [
    "profession", "specialty", "speciality", "category", "designation", 
    "role", "about", "occupation", "job title", "title"
  ]
};

// Helper to check key matches against aliases
function getMatchedField(key: string): string | null {
  const cleanKey = key.toLowerCase().trim().replace(/[\s\-_.]/g, "");
  
  // 1. Exact match pass
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      const cleanAlias = alias.toLowerCase().trim().replace(/[\s\-_.]/g, "");
      if (cleanKey === cleanAlias) {
        return field;
      }
    }
  }

  // 2. Substring/prefix match pass
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      const cleanAlias = alias.toLowerCase().trim().replace(/[\s\-_.]/g, "");
      if (cleanKey.includes(cleanAlias) || cleanAlias.includes(cleanKey)) {
        return field;
      }
    }
  }

  return null;
}

// -----------------------------------------------------------------------------
// Phone Normalization & Validation
// -----------------------------------------------------------------------------
function cleanPhone(val: unknown): string {
  if (val === undefined || val === null) return "";
  let str = String(val).trim();
  str = str.replace(/[\s\-\(\)\.\+]/g, "");
  str = str.replace(/[^\d]/g, "");
  
  // Strip country code 91 if it's 12 digits and starts with 91 followed by 6-9
  if (str.length === 12 && str.startsWith("91")) {
    const secondPart = str.slice(2);
    if (/^[6-9]/.test(secondPart)) {
      str = secondPart;
    }
  }
  return str;
}

function getPhoneIssue(phone: string): string | null {
  if (!phone) {
    return "Missing/Empty Phone";
  }
  if (phone.length !== 10) {
    return `Invalid Length (${phone.length} digits, must be exactly 10)`;
  }
  if (!/^[6-9]/.test(phone)) {
    return "Invalid Mobile Prefix (must start with 6, 7, 8, or 9)";
  }
  if (/^(.)\1{9}$/.test(phone)) {
    return "All Same Digits (e.g. 9999999999)";
  }
  return null;
}

// -----------------------------------------------------------------------------
// Address-based Location Extractor
// -----------------------------------------------------------------------------
function extractLocationFromAddress(address: string): { city: string; state: string } {
  if (!address) return { city: "", state: "" };
  const lower = address.toLowerCase();
  
  const mappings = [
    { city: "Gurgaon", state: "Haryana", keywords: ["gurgaon", "gurugram"] },
    { city: "Noida", state: "Uttar Pradesh", keywords: ["noida"] },
    { city: "Delhi", state: "Delhi", keywords: ["delhi", "new delhi"] },
    { city: "Faridabad", state: "Haryana", keywords: ["faridabad"] },
    { city: "Ghaziabad", state: "Uttar Pradesh", keywords: ["ghaziabad"] },
    { city: "Karnal", state: "Haryana", keywords: ["karnal"] },
    { city: "Bangalore", state: "Karnataka", keywords: ["bangalore", "bengaluru"] },
    { city: "Mumbai", state: "Maharashtra", keywords: ["mumbai", "bombay"] },
    { city: "Pune", state: "Maharashtra", keywords: ["pune"] },
    { city: "Kolkata", state: "West Bengal", keywords: ["kolkata", "calcutta"] },
    { city: "Chennai", state: "Tamil Nadu", keywords: ["chennai", "madras"] },
    { city: "Hyderabad", state: "Telangana", keywords: ["hyderabad"] },
    { city: "Panchkula", state: "Haryana", keywords: ["panchkula"] },
    { city: "Ambala", state: "Haryana", keywords: ["ambala"] },
    { city: "Sonipat", state: "Haryana", keywords: ["sonipat"] },
    { city: "Panipat", state: "Haryana", keywords: ["panipat"] },
    { city: "Rohtak", state: "Haryana", keywords: ["rohtak"] },
    { city: "Hisar", state: "Haryana", keywords: ["hisar"] }
  ];

  for (const m of mappings) {
    for (const kw of m.keywords) {
      if (lower.includes(kw)) {
        return { city: m.city, state: m.state };
      }
    }
  }

  let state = "";
  if (lower.includes("haryana")) {
    state = "Haryana";
  } else if (lower.includes("uttar pradesh") || lower.includes(" u.p.") || lower.includes(", up") || lower.includes(" up ")) {
    state = "Uttar Pradesh";
  } else if (lower.includes("maharashtra")) {
    state = "Maharashtra";
  } else if (lower.includes("karnataka")) {
    state = "Karnataka";
  } else if (lower.includes("west bengal")) {
    state = "West Bengal";
  } else if (lower.includes("tamil nadu")) {
    state = "Tamil Nadu";
  } else if (lower.includes("telangana")) {
    state = "Telangana";
  }

  return { city: "", state };
}

// Extract potential designation from name prefix (dataset-agnostic fallback)
function extractProfessionFromName(name: string): string {
  const cleanName = name.trim();
  if (/^dr\b/i.test(cleanName)) return "Doctor";
  if (/^prof\b/i.test(cleanName)) return "Professor";
  if (/^adv\b/i.test(cleanName)) return "Lawyer";
  return "";
}

// -----------------------------------------------------------------------------
// Parsers
// -----------------------------------------------------------------------------
function parseSpreadsheet(filePath: string): Record<string, unknown>[] {
  const workbook = XLSX.readFile(filePath);
  const allRecords: Record<string, unknown>[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rawRows.length === 0) continue;

    // Detect header row by scanning first 5 rows for non-empty matching labels
    let headerRowIdx = -1;
    let headers: string[] = [];
    
    for (let rIdx = 0; rIdx < Math.min(rawRows.length, 5); rIdx++) {
      const row = rawRows[rIdx];
      if (row && row.length > 0 && row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== "")) {
        const nonValCells = row.filter(cell => cell !== null && cell !== undefined && String(cell).trim() !== "");
        if (nonValCells.length >= 2) {
          headerRowIdx = rIdx;
          headers = row.map(h => String(h || "").trim());
          break;
        }
      }
    }

    if (headerRowIdx === -1) {
      // Fallback: name headers after columns
      const maxCols = Math.max(...rawRows.map(r => r ? r.length : 0));
      headers = Array.from({ length: maxCols }, (_, i) => `column_${i}`);
      headerRowIdx = -1;
    }

    for (let rIdx = headerRowIdx + 1; rIdx < rawRows.length; rIdx++) {
      const row = rawRows[rIdx];
      if (!row || row.length === 0 || row.every(cell => cell === null || cell === undefined || String(cell).trim() === "")) {
        continue;
      }

      const rec: Record<string, unknown> = {};
      headers.forEach((header, colIdx) => {
        if (header && row[colIdx] !== undefined && row[colIdx] !== null) {
          rec[header] = row[colIdx];
        }
      });
      allRecords.push(rec);
    }
  }

  return allRecords;
}

async function parsePdf(filePath: string): Promise<Record<string, unknown>[]> {
  const dataBuffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: dataBuffer });
  const textResult = await parser.getText();
  await parser.destroy();

  const pages = textResult.pages;
  const namePhonePages: typeof pages = [];
  const emailAddrPages: typeof pages = [];

  pages.forEach(page => {
    const text = page.text.toLowerCase();
    if (text.includes("msisdn") || (text.includes("name") && !text.includes("email"))) {
      namePhonePages.push(page);
    } else if (text.includes("email") || text.includes("address")) {
      emailAddrPages.push(page);
    } else {
      // Line regex counts fallback
      const lines = page.text.split("\n").map(l => l.trim()).filter(Boolean);
      let phoneCount = 0;
      let emailCount = 0;
      lines.forEach(l => {
        if (/[6-9]\d{9}$/.test(l)) phoneCount++;
        if (/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(l)) emailCount++;
      });
      if (phoneCount > emailCount) {
        namePhonePages.push(page);
      } else {
        emailAddrPages.push(page);
      }
    }
  });

  // Handle Case 1: Split-column page layouts
  if (namePhonePages.length > 0 && emailAddrPages.length > 0) {
    namePhonePages.sort((a, b) => a.num - b.num);
    emailAddrPages.sort((a, b) => a.num - b.num);

    const col12: string[] = [];
    const col34: string[] = [];

    namePhonePages.forEach(p => {
      const lines = p.text.split("\n").map(l => l.trim()).filter(Boolean);
      const dataLines = lines.filter(line => !line.toLowerCase().includes("name msisdn") && !line.includes('-- page_number'));
      col12.push(...dataLines);
    });

    emailAddrPages.forEach(p => {
      const lines = p.text.split("\n").map(l => l.trim()).filter(Boolean);
      const dataLines = lines.filter(line => !line.toLowerCase().includes("email address") && !line.includes('-- page_number'));
      col34.push(...dataLines);
    });

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const records: Record<string, unknown>[] = [];
    const limit = Math.max(col12.length, col34.length);

    for (let i = 0; i < limit; i++) {
      const rawCol12 = col12[i] || "";
      const rawCol34 = col34[i] || "";

      const parts = rawCol12.split(/\s+/);
      const phone = parts.length > 1 ? parts[parts.length - 1] : "";
      const name = parts.length > 1 ? parts.slice(0, parts.length - 1).join(" ") : rawCol12;

      let email = "";
      let address = rawCol34;
      const emailMatch = rawCol34.match(emailRegex);
      if (emailMatch) {
        email = emailMatch[0];
        address = rawCol34.substring(email.length).trim();
      }

      records.push({
        name,
        phone,
        email,
        address
      });
    }
    return records;
  } else {
    // Handle Case 2: Single-stream page layouts
    const records: Record<string, unknown>[] = [];
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const phoneRegex = /[6-9]\d{9}/;

    pages.sort((a, b) => a.num - b.num).forEach(page => {
      const lines = page.text.split("\n").map(l => l.trim()).filter(Boolean);
      lines.forEach(line => {
        if (line.toLowerCase().includes("name") && line.toLowerCase().includes("phone")) return;
        if (line.includes('-- page_number')) return;

        let email = "";
        const emailMatch = line.match(emailRegex);
        if (emailMatch) {
          email = emailMatch[0];
        }

        let phone = "";
        const phoneMatch = line.match(phoneRegex);
        if (phoneMatch) {
          phone = phoneMatch[0];
        }

        let name = line;
        if (phone) name = name.replace(phone, "");
        if (email) name = name.replace(email, "");
        
        name = name.replace(/[|,\-\:]/g, " ").trim();
        const words = name.split(/\s+/);
        const extractedName = words.slice(0, 3).join(" ");
        const address = words.slice(3).join(" ").trim();

        records.push({
          name: extractedName,
          phone,
          email,
          address
        });
      });
    });
    return records;
  }
}

// -----------------------------------------------------------------------------
// Pipeline Execution
// -----------------------------------------------------------------------------
async function main() {
  const args = process.argv.slice(2);
  const commitFlagIdx = args.indexOf("--commit");
  const isCommit = commitFlagIdx !== -1;
  if (isCommit) {
    args.splice(commitFlagIdx, 1);
  }

  const fileArg = args[0];
  const collectionType = args[1] || "uploaded_leads";

  if (!fileArg) {
    console.error("Usage: npx tsx src/scripts/import_leads.ts <file_path> [collectionType] [--commit]");
    process.exit(1);
  }

  // 1. Validate Target Collection name
  if (!SUPPORTED_COLLECTIONS.includes(collectionType)) {
    console.error(`Unknown collection: ${collectionType}.`);
    console.error(`Supported collections:\n\n* ${SUPPORTED_COLLECTIONS.join("\n* ")}`);
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found at: ${filePath}`);
    process.exit(1);
  }

  const fileExt = path.extname(filePath).toLowerCase();
  let importSource: "PDF" | "XLSX" | "CSV" = "XLSX";
  if (fileExt === ".pdf") {
    importSource = "PDF";
  } else if (fileExt === ".csv") {
    importSource = "CSV";
  } else if (fileExt === ".xlsx" || fileExt === ".xls") {
    importSource = "XLSX";
  } else {
    console.error(`Unsupported file extension: ${fileExt}. Supported formats: .pdf, .xlsx, .xls, .csv`);
    process.exit(1);
  }

  console.log(`Detect file type: ${importSource}`);
  console.log(`Parsing file: ${path.basename(filePath)}...`);

  // 2. Parse file
  let rawRecords: Record<string, unknown>[] = [];
  if (importSource === "PDF") {
    rawRecords = await parsePdf(filePath);
  } else {
    rawRecords = parseSpreadsheet(filePath);
  }
  const totalRecords = rawRecords.length;
  console.log(`Parsed ${totalRecords} raw records.`);

  interface NormalizedLeadPayload {
    name: string;
    phone: string;
    primaryPhone: string;
    secondaryPhone?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    source: string;
    status: string;
    dnd: boolean;
    handedOffToAdmin: boolean;
    sourceDetails: {
      about: string;
      importedAt: Date;
      importedFileName: string;
      importSource: string;
      rawData: Record<string, unknown>;
      [key: string]: unknown;
    };
  }

  // 3. Normalization, Validation and Cleaning
  const validLeads: NormalizedLeadPayload[] = [];
  const invalidRecords: { record: Record<string, unknown>; reason: string }[] = [];
  const duplicateRecords: { record: Record<string, unknown> }[] = [];
  
  const seenPhones = new Set<string>();

  for (const raw of rawRecords) {
    // Determine mapped fields via FIELD_ALIASES
    const mapped: Record<string, unknown> = {};
    const extraDetails: Record<string, unknown> = {};

    Object.entries(raw).forEach(([key, val]) => {
      const field = getMatchedField(key);
      if (field) {
        mapped[field] = val;
      } else {
        extraDetails[key] = val;
      }
    });

    const rawName = String(mapped.name || "").trim();
    const cleanName = rawName.replace(/\.+$/, "").trim(); // strip trailing dots/garbage

    // Check name missing
    if (!cleanName) {
      invalidRecords.push({ record: raw, reason: "Missing/Empty Name" });
      continue;
    }

    let phoneVal = cleanPhone(mapped.phone);
    let secPhoneVal = cleanPhone(mapped.secondaryPhone);

    // Swap if primary is invalid but secondary is valid
    let primaryIssue = getPhoneIssue(phoneVal);
    if (primaryIssue && secPhoneVal && !getPhoneIssue(secPhoneVal)) {
      const temp = phoneVal;
      phoneVal = secPhoneVal;
      secPhoneVal = temp;
      primaryIssue = null;
    }

    // Check phone invalid
    if (primaryIssue) {
      invalidRecords.push({ record: raw, reason: `Phone issue: ${primaryIssue}` });
      continue;
    }

    // Deduplication check
    if (seenPhones.has(phoneVal)) {
      duplicateRecords.push({ record: raw });
      continue;
    }
    seenPhones.add(phoneVal);

    // Address & Location mapping
    const rawAddress = String(mapped.address || "").trim().replace(/^[\s,;\-]+/, "").trim();
    let cityVal = String(mapped.city || "").trim();
    let stateVal = String(mapped.state || "").trim();

    if (!cityVal || !stateVal) {
      const parsedLoc = extractLocationFromAddress(rawAddress);
      if (!cityVal) cityVal = parsedLoc.city;
      if (!stateVal) stateVal = parsedLoc.state;
    }

    // About extraction
    let aboutVal = String(mapped.about || "").trim();
    if (!aboutVal) {
      aboutVal = extractProfessionFromName(cleanName);
    }

    // Metadata & Raw preservation
    const sourceDetails = {
      about: aboutVal,
      importedAt: new Date(),
      importedFileName: path.basename(filePath),
      importSource,
      rawData: raw,
      ...extraDetails
    };

    validLeads.push({
      name: cleanName,
      phone: phoneVal,
      primaryPhone: phoneVal,
      secondaryPhone: secPhoneVal || undefined,
      email: mapped.email ? String(mapped.email).trim().toLowerCase() : undefined,
      address: rawAddress || undefined,
      city: cityVal || undefined,
      state: stateVal || undefined,
      source: collectionType === "uploaded_leads" ? "UPLOADED_LEADS" : "CUSTOMER_DATABASE",
      status: LeadStatus.NEW,
      dnd: false,
      handedOffToAdmin: false,
      sourceDetails
    });
  }

  // -----------------------------------------------------------------------------
  // Preview Summary
  // -----------------------------------------------------------------------------
  console.log("\n=================== IMPORT PREVIEW SUMMARY ===================");
  console.log(`Total Records Found:      ${totalRecords}`);
  console.log(`Valid Records:            ${validLeads.length}`);
  console.log(`Invalid Records:          ${invalidRecords.length}`);
  console.log(`Duplicate Records Removed: ${duplicateRecords.length}`);
  console.log(`Final Records To Import:  ${validLeads.length}`);
  console.log("==============================================================\n");

  if (validLeads.length > 0) {
    console.log("--- SAMPLE VALID RECORDS (FIRST 5) ---");
    validLeads.slice(0, 5).forEach((lead, idx) => {
      console.log(`[${idx + 1}] Name: "${lead.name}" | Phone: "${lead.phone}" | City: "${lead.city || ''}" | State: "${lead.state || ''}"`);
      console.log(`    About: "${lead.sourceDetails.about}" | Address: "${lead.address || ''}"`);
    });
    console.log("--------------------------------------\n");

    if (validLeads.length > 5) {
      console.log("--- SAMPLE VALID RECORDS (LAST 5) ---");
      validLeads.slice(-5).forEach((lead, idx) => {
        console.log(`[${validLeads.length - 5 + idx + 1}] Name: "${lead.name}" | Phone: "${lead.phone}" | City: "${lead.city || ''}" | State: "${lead.state || ''}"`);
        console.log(`    About: "${lead.sourceDetails.about}" | Address: "${lead.address || ''}"`);
      });
      console.log("-------------------------------------\n");
    }
  }

  if (invalidRecords.length > 0) {
    console.log("--- SAMPLE INVALID RECORDS (UP TO 5) ---");
    invalidRecords.slice(0, 5).forEach((inv, idx) => {
      console.log(`[${idx + 1}] Reason: "${inv.reason}" | Raw Data: ${JSON.stringify(inv.record)}`);
    });
    console.log("----------------------------------------\n");
  }

  if (duplicateRecords.length > 0) {
    console.log("--- SAMPLE DUPLICATE RECORDS (UP TO 5) ---");
    duplicateRecords.slice(0, 5).forEach((dup, idx) => {
      console.log(`[${idx + 1}] Raw Data: ${JSON.stringify(dup.record)}`);
    });
    console.log("------------------------------------------\n");
  }

  // 4. DB Import (Commit Mode)
  if (isCommit) {
    console.log("Connecting to Database...");
    await dbConnect();
    console.log("Connected successfully.");

    const LeadModel = getLeadModel(collectionType);
    console.log(`Inserting ${validLeads.length} leads into target collection [${collectionType}]...`);

    let insertedCount = 0;
    if (validLeads.length > 0) {
      const insertResult = await LeadModel.insertMany(validLeads);
      insertedCount = insertResult.length;
      console.log(`Successfully imported ${insertedCount} leads.`);
    } else {
      console.log("No valid leads to import.");
    }

    console.log(`Recording import audit log...`);
    await ImportLog.create({
      fileName: path.basename(filePath),
      fileType: importSource,
      importedAt: new Date(),
      totalRecords,
      validRecords: validLeads.length,
      invalidRecords: invalidRecords.length,
      duplicateRecords: duplicateRecords.length,
      insertedRecords: insertedCount,
      targetCollection: collectionType
    });
    console.log("Import audit log saved successfully.");
  } else {
    console.log("RUNNING IN DRY-RUN MODE.");
    console.log("To commit records to the database, run the command with the --commit flag.");
    console.log(`Example: npx tsx src/scripts/import_leads.ts ${fileArg} ${collectionType} --commit`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Universal importer error:", err);
  process.exit(1);
});

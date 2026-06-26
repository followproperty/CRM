import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { PDFParse } from "pdf-parse";
import mongoose from "mongoose";
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
    "primary phone", "primary mobile", "mobile no"
  ],
  secondaryPhone: [
    "sec phone", "secondary phone", "secondary mobile", "alt phone", 
    "alternative phone", "alternate phone", "alt contact", "other phone", "phone no"
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
    "profession", "category", "designation", 
    "role", "about", "occupation", "job title", "title",
    "specialisation", "specialization", "specialty", "speciality", "specilazation", "specilistaion"
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

// -----------------------------------------------------------------------------
// Noida Extension Doctors PDF Parsing Helpers
// -----------------------------------------------------------------------------
function isMetadataOrHeaderLine(line: string): boolean {
  const lower = line.toLowerCase().trim();
  if (!lower) return true;
  if (/^page \d+ of \d+/i.test(lower)) return true;
  if (/^doctors at greater/i.test(lower)) return true;
  if (/^prepared by/i.test(lower)) return true;
  if (/^date of release/i.test(lower)) return true;
  if (/^email:.*twitter:/i.test(lower)) return true;
  if (/^s\.no\.\s+sevices/i.test(lower)) return true;
  return false;
}

function extractPhones(text: string): { phones: string[]; cleanedText: string } {
  const regexes = [
    /0\d{1,4}-\d{3,4}\s*\d{3,4}/g,
    /\b[6-9]\d{4}-\d{5}\b/g,
    /\b[6-9]\d{9}\b/g,
    /\b0\d{10}\b/g
  ];

  let cleaned = text;
  const found: string[] = [];

  for (const r of regexes) {
    let match;
    while ((match = r.exec(cleaned)) !== null) {
      found.push(match[0]);
      cleaned = cleaned.replace(match[0], " ");
    }
  }
  return { phones: found, cleanedText: cleaned.replace(/\s+/g, " ").trim() };
}

function splitNameAndAddress(remainingText: string): { name: string; address: string } {
  const words = remainingText.split(/\s+/);
  if (words.length <= 1) {
    return { name: remainingText, address: "" };
  }

  let splitIdx = -1;
  const addressKeywords = new Set([
    "cherry", "supertech", "crossing", "crossings", "mahagun", "la", "gaur", 
    "sector", "sec", "mool", "apollo", "apolo", "city", "residentia", 
    "moderne", "mascot", "republik", "galleria", "plaza", "haryana", "delhi", 
    "noida", "ghaziabad", "ward", "hospital", "diagnostics", "tower", "towers", 
    "flat", "apartment", "apartments", "dream", "exotica", "plaza"
  ]);

  const facilityKeywords = new Set(["labs", "lab", "clinic", "pathology", "path", "care"]);

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const clean = word.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!clean) continue;

    if (clean === "dr") continue;
    if (facilityKeywords.has(clean)) continue;

    if (/\d/.test(clean)) {
      splitIdx = i;
      break;
    }

    if (addressKeywords.has(clean)) {
      splitIdx = i;
      break;
    }
  }

  if (splitIdx === -1) {
    if (words[0].toLowerCase().startsWith("dr") && words.length > 3) {
      return {
        name: words.slice(0, 3).join(" "),
        address: words.slice(3).join(" ")
      };
    }
    return { name: remainingText, address: "" };
  }

  if (splitIdx === 0) {
    splitIdx = 1;
  }

  return {
    name: words.slice(0, splitIdx).join(" "),
    address: words.slice(splitIdx).join(" ")
  };
}

function processNoidaRecord(lines: string[]): Record<string, unknown> {
  const fullText = lines.join(" ").replace(/\s+/g, " ").trim();
  const { phones, cleanedText } = extractPhones(fullText);
  
  const categoryRegex = /^\s*(\d+)\s+(Doctor\s*-\s*(?:Acupuncture|Ayurveda|Cardiac\s+Anaesthestist|Cardio|Dental|Diabetologist|ENT|Eyes|Gastro\s+&\s+Liver|Gynae|Homoeo|Intensivist|Microbiologist|Multi\s+Purpose|Nephrologist\s+\(Kidney\)|Nuero\s+Surgeon|Nuero|Ortho|Pedia|Physician|Physio|Psychiatrist|Skin\s+\(Dermatologist\)|Surgeon|Urologist|Vascular\s+Surgeon|Xray)|Doctor\b|Pathology\b)/i;
  const match = cleanedText.match(categoryRegex);
  
  if (!match) {
    const { name, address } = splitNameAndAddress(cleanedText);
    return {
      name,
      phone: phones[0] || "",
      secondaryPhone: phones[1] || "",
      address,
      about: ""
    };
  }

  const category = match[2].trim();
  const restText = cleanedText.substring(match[0].length).trim();
  const { name, address } = splitNameAndAddress(restText);
  
  return {
    name,
    phone: phones[0] || "",
    secondaryPhone: phones[1] || "",
    address,
    about: category
  };
}

function processPanelRecord(lines: string[]): Record<string, unknown> {
  const fullText = lines.join(" ").replace(/\s+/g, " ").trim();
  const { phones, cleanedText } = extractPhones(fullText);

  const serialMatch = cleanedText.match(/^\s*(\d+)\s+(Dr\b.*)/i);
  if (!serialMatch) {
    return {
      name: cleanedText,
      phone: phones[0] || "",
      secondaryPhone: phones[1] || "",
      address: "",
      about: ""
    };
  }

  const restText = serialMatch[2].trim();
  const specRegex = /\s+(Cardiology|Dental|Dermatology|ENT|Gynaecology|General\s+Medicine|General\s+Surgery|Ophthalmology|Opthalmology|Orthopaedics|Paediatrics|Psychiatry|Radiology|Urology|Physiotherapy|Endocrinology|Genreal\s+Medicine|Nephrology|Obsterics\s+&\s+Gynaecology|Obstetrics\s+&\s+Gynaecology|Obstetrics|Obsterics|General|Plastic\s+Surgery|Oncology|Pathology|Radiodiagnosis|Diagnostics)\b/i;
  
  const specMatch = restText.match(specRegex);
  if (specMatch) {
    const specialty = specMatch[1];
    const index = restText.indexOf(specMatch[0]);
    const name = restText.substring(0, index).trim();
    const address = restText.substring(index + specMatch[0].length).trim();
    return {
      name,
      phone: phones[0] || "",
      secondaryPhone: phones[1] || "",
      address,
      about: `Doctor - ${specialty}`
    };
  } else {
    const words = restText.split(/\s+/);
    const name = words.slice(0, 3).join(" ");
    const address = words.slice(3).join(" ");
    return {
      name,
      phone: phones[0] || "",
      secondaryPhone: phones[1] || "",
      address,
      about: "Doctor"
    };
  }
}

function cleanNtpcNameAndDesignation(rawName: string, rawDesignation: string): { name: string; designation: string } {
  const name = rawName.trim();
  const designationKeywords = [
    "CHIEF MEDICAL OFFICER",
    "SPECIALIST",
    "SR.SPECIALIST",
    "SR. SPECIALIST",
    "SR.MEDICAL OFFICER",
    "GDMO",
    "ACMO",
    "MEDICAL OFFICER",
    "PHYSICIAN"
  ];

  for (const kw of designationKeywords) {
    const idx = name.toUpperCase().indexOf(kw);
    if (idx !== -1) {
      const cleanedName = name.substring(0, idx).trim();
      const extractedDesignation = name.substring(idx).trim();
      const finalDesignation = rawDesignation 
        ? `${extractedDesignation} - ${rawDesignation}`
        : extractedDesignation;
      return { name: cleanedName, designation: finalDesignation };
    }
  }

  return { name, designation: rawDesignation };
}

async function parsePdf(filePath: string): Promise<Record<string, unknown>[]> {
  if (path.basename(filePath).toLowerCase() === "doc.pdf") {
    const jsonPath = path.resolve(path.dirname(filePath), "doc.json");
    if (fs.existsSync(jsonPath)) {
      console.log(`Scanned/Image PDF detected. Loading pre-transcribed data from: ${jsonPath}`);
      const jsonContent = fs.readFileSync(jsonPath, "utf-8");
      return JSON.parse(jsonContent);
    }
  }

  const dataBuffer = fs.readFileSync(filePath);
  const parser = new PDFParse({ data: dataBuffer });
  const textResult = await parser.getText();
  await parser.destroy();

  const pages = textResult.pages;

  // Check if it's the NTPC Doctors PDF by looking for headers
  const isNtpcDoctors = pages.some(p => p.text.includes("Project") && p.text.includes("Doctor Name") && p.text.includes("Mobile No."));

  if (isNtpcDoctors) {
    const records: Record<string, unknown>[] = [];
    for (const page of pages.sort((a, b) => a.num - b.num)) {
      const lines = page.text.split("\n").map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (line.toLowerCase().includes("project") && line.toLowerCase().includes("doctor name")) continue;
        if (line.toLowerCase().includes("list of ntpc") || line.toLowerCase().includes("doctors")) continue;

        const parts = line.split("\t").map(p => p.trim());
        if (parts.length >= 4) {
          // 1. Find name column
          let nameIdx = -1;
          for (let i = 0; i < parts.length; i++) {
            if (/\bDr\b/i.test(parts[i])) {
              nameIdx = i;
              break;
            }
          }
          if (nameIdx === -1) {
            nameIdx = parts.length >= 6 ? 2 : 1;
          }

          const rawName = parts[nameIdx];
          const beforeName = parts.slice(0, nameIdx).join(" ");
          const project = beforeName.replace(/^\s*\d+\s+/, "").trim();

          // 2. Extract phone, email and designation from parts after name
          const afterName = parts.slice(nameIdx + 1);
          let phone = "";
          let email = "";
          let rawDesignation = "";

          if (afterName.length >= 2) {
            const last = afterName[afterName.length - 1];
            const secondLast = afterName[afterName.length - 2];
            if (last.includes("@")) {
              email = last;
              phone = secondLast;
              rawDesignation = afterName.slice(0, afterName.length - 2).join(" - ");
            } else {
              phone = last;
              rawDesignation = afterName.slice(0, afterName.length - 1).join(" - ");
            }
          } else if (afterName.length === 1) {
            phone = afterName[0];
          }

          // If phone is not a valid phone but email contains a 10-digit phone
          if (email && (!phone || !/^\d+$/.test(phone.replace(/[-\s]/g, "")))) {
            const phoneMatch = email.match(/\b([6-9]\d{9})\b/);
            if (phoneMatch) {
              phone = phoneMatch[1];
              email = email.replace(phoneMatch[0], "").replace(/[\s/]+/g, "").trim();
            }
          }

          // 3. Clean Name and Designation
          const { name, designation } = cleanNtpcNameAndDesignation(rawName, rawDesignation);

          records.push({
            name,
            phone,
            email,
            address: project ? `NTPC Project: ${project}` : undefined,
            about: designation
          });
        }
      }
    }
    return records;
  }

  // Check if it's the Panel Doctors PDF
  const isPanelDoctors = pages.some(p => p.text.includes("Sl No. Doctor Name") && p.text.includes("Specilazation") && p.text.includes("Clinic Address"));

  if (isPanelDoctors) {
    const records: Record<string, unknown>[] = [];
    let currentRecordLines: string[] = [];

    for (const page of pages.sort((a, b) => a.num - b.num)) {
      const lines = page.text.split("\n").map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (line.toLowerCase().includes("sl no. doctor name") && line.toLowerCase().includes("specilazation")) continue;

        const match = line.match(/^\s*(\d+)\s+Dr\b/i);
        if (match) {
          if (currentRecordLines.length > 0) {
            records.push(processPanelRecord(currentRecordLines));
          }
          currentRecordLines = [line];
        } else {
          if (currentRecordLines.length > 0) {
            currentRecordLines.push(line);
          }
        }
      }
    }
    if (currentRecordLines.length > 0) {
      records.push(processPanelRecord(currentRecordLines));
    }
    return records;
  }

  // Check if it's the Noida Extension Doctors PDF by looking for the column header
  const isNoidaDoctors = pages.some(p => p.text.includes("S.No. Sevices Name Address/Tower/Flat Contact No."));

  if (isNoidaDoctors) {
    const records: Record<string, unknown>[] = [];
    let currentRecordLines: string[] = [];

    for (const page of pages.sort((a, b) => a.num - b.num)) {
      const lines = page.text.split("\n").map(l => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (isMetadataOrHeaderLine(line)) {
          continue;
        }

        const match = line.match(/^\s*(\d+)\s+(Doctor|Pathology)\b/i);
        if (match) {
          if (currentRecordLines.length > 0) {
            records.push(processNoidaRecord(currentRecordLines));
          }
          currentRecordLines = [line];
        } else {
          if (currentRecordLines.length > 0) {
            currentRecordLines.push(line);
          }
        }
      }
    }
    if (currentRecordLines.length > 0) {
      records.push(processNoidaRecord(currentRecordLines));
    }
    return records;
  }

  // Fallback to previous layouts
  const isSplitColumnLayout = pages.some(p => p.text.toLowerCase().includes("name msisdn")) && 
                              pages.some(p => p.text.toLowerCase().includes("email address1") || p.text.toLowerCase().includes("email address"));

  if (isSplitColumnLayout) {
    const namePhonePages: typeof pages = [];
    const emailAddrPages: typeof pages = [];

    pages.forEach(page => {
      const text = page.text.toLowerCase();
      if (text.includes("msisdn") || (text.includes("name") && !text.includes("email"))) {
        namePhonePages.push(page);
      } else {
        emailAddrPages.push(page);
      }
    });

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

  // Connect to DB and fetch existing numbers to check for duplicates
  console.log("Connecting to Database...");
  await dbConnect();
  console.log("Connected successfully.");

  const LeadModel = getLeadModel(collectionType);
  console.log(`Fetching existing leads from collection [${collectionType}] to build duplicate filter...`);
  const existingLeads = await LeadModel.find({}, { phone: 1 }).lean();
  const dbPhones = new Set<string>();
  for (const lead of existingLeads) {
    if (lead.phone) {
      dbPhones.add(lead.phone);
    }
  }
  console.log(`Loaded ${dbPhones.size} existing phone numbers from database.`);

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
  const dbDuplicateRecords: { record: Record<string, unknown> }[] = [];
  
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

    // Deduplication check (within batch)
    if (seenPhones.has(phoneVal)) {
      duplicateRecords.push({ record: raw });
      continue;
    }
    seenPhones.add(phoneVal);

    // Deduplication check (against database)
    if (dbPhones.has(phoneVal)) {
      dbDuplicateRecords.push({ record: raw });
      continue;
    }

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
  console.log(`Total Records Found:        ${totalRecords}`);
  console.log(`Valid Records:              ${validLeads.length}`);
  console.log(`Invalid Records:            ${invalidRecords.length}`);
  console.log(`Batch Duplicates Removed:   ${duplicateRecords.length}`);
  console.log(`DB Duplicates Skipped:      ${dbDuplicateRecords.length}`);
  console.log(`Final Records To Import:    ${validLeads.length}`);
  console.log("==============================================================\n");

  if (validLeads.length > 0) {
    console.log("--- SAMPLE VALID RECORDS (FIRST 5) ---");
    validLeads.slice(0, 5).forEach((lead, idx) => {
      console.log(`[${idx + 1}] Name: "${lead.name}" | Phone: "${lead.phone}" | City: "${lead.city || ''}" | State: "${lead.state || ''}"`);
      console.log(`    About (Specialisation): "${lead.sourceDetails.about || ''}" | Address: "${lead.address || ''}"`);
    });
    console.log("--------------------------------------\n");

    if (validLeads.length > 5) {
      console.log("--- SAMPLE VALID RECORDS (LAST 5) ---");
      validLeads.slice(-5).forEach((lead, idx) => {
        console.log(`[${validLeads.length - 5 + idx + 1}] Name: "${lead.name}" | Phone: "${lead.phone}" | City: "${lead.city || ''}" | State: "${lead.state || ''}"`);
        console.log(`    About (Specialisation): "${lead.sourceDetails.about || ''}" | Address: "${lead.address || ''}"`);
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
    console.log("--- SAMPLE BATCH DUPLICATE RECORDS (UP TO 5) ---");
    duplicateRecords.slice(0, 5).forEach((dup, idx) => {
      console.log(`[${idx + 1}] Raw Data: ${JSON.stringify(dup.record)}`);
    });
    console.log("------------------------------------------------\n");
  }

  if (dbDuplicateRecords.length > 0) {
    console.log("--- SAMPLE DB DUPLICATE RECORDS (UP TO 5) ---");
    dbDuplicateRecords.slice(0, 5).forEach((dup, idx) => {
      console.log(`[${idx + 1}] Raw Data: ${JSON.stringify(dup.record)}`);
    });
    console.log("---------------------------------------------\n");
  }

  // 4. DB Import (Commit Mode)
  if (isCommit) {
    // Perform database cleanup of useless/wrong numbers
    console.log("Cleaning up existing invalid phone numbers in target collection...");
    const allDBLeads = await LeadModel.find({}, { _id: 1, phone: 1 }).lean();
    const idsToDelete: mongoose.Types.ObjectId[] = [];
    
    for (const lead of allDBLeads) {
      const cleaned = cleanPhone(lead.phone);
      const issue = getPhoneIssue(cleaned);
      if (issue) {
        idsToDelete.push(lead._id);
      }
    }
    
    let deletedCount = 0;
    if (idsToDelete.length > 0) {
      const deleteResult = await LeadModel.deleteMany({ _id: { $in: idsToDelete } });
      deletedCount = deleteResult.deletedCount || idsToDelete.length;
      console.log(`Deleted ${deletedCount} existing leads with invalid/useless numbers from database.`);
    } else {
      console.log("No existing invalid leads found in database.");
    }

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
      duplicateRecords: duplicateRecords.length + dbDuplicateRecords.length,
      insertedRecords: insertedCount,
      targetCollection: collectionType
    });
    console.log("Import audit log saved successfully.");

    const finalDBCount = await LeadModel.countDocuments({});
    console.log(`\n=================== POST-IMPORT SUMMARY ===================`);
    console.log(`Leads deleted (useless/wrong numbers):  ${deletedCount}`);
    console.log(`Leads imported:                         ${insertedCount}`);
    console.log(`Total cleaned leads in database:        ${finalDBCount}`);
    console.log(`============================================================\n`);
  } else {
    console.log("RUNNING IN DRY-RUN MODE.");
    console.log("To commit records to the database, run the command with the --commit flag.");
    console.log(`Example: npx tsx src/scripts/import_leads.ts ${fileArg} ${collectionType} --commit`);

    // Run dry-run cleanup calculation
    let projectedDeletedCount = 0;
    const allDBLeads = await LeadModel.find({}, { phone: 1 }).lean();
    for (const lead of allDBLeads) {
      const cleaned = cleanPhone(lead.phone);
      const issue = getPhoneIssue(cleaned);
      if (issue) {
        projectedDeletedCount++;
      }
    }
    const currentDBCount = allDBLeads.length;
    console.log(`\n=================== DRY-RUN SUMMARY ===================`);
    console.log(`Current leads in database:              ${currentDBCount}`);
    console.log(`Projected leads to import:              ${validLeads.length}`);
    console.log(`Projected database duplicates skipped:  ${dbDuplicateRecords.length}`);
    console.log(`Projected batch duplicates skipped:     ${duplicateRecords.length}`);
    console.log(`Projected invalid records skipped:      ${invalidRecords.length}`);
    console.log(`Projected leads to delete (useless/wrong): ${projectedDeletedCount}`);
    console.log(`Projected final cleaned leads in database: ${currentDBCount - projectedDeletedCount + validLeads.length}`);
    console.log(`========================================================\n`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Universal importer error:", err);
  process.exit(1);
});

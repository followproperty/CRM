import fs from "fs";
import { PDFParse } from "pdf-parse";
import dbConnect from "../lib/db";
import { VrindavanLead } from "../models/lead.model";
import { LeadStatus } from "../types/lead";

// Predefined list of UP districts in the PDF
const UP_DISTRICTS = [
  "Ambedkar Nagar", "Gautam Buddh Nagar", "Sant Kabir Nagar", "Kanpur Nagar",
  "Kanpur Dehat", "Lakhimpur Kheri", "Siddharth Nagar", "Agra", "Aligarh",
  "Allahabad", "Amethi", "Auraiya", "Azamgarh", "Badaun", "Baghpat", "Bahraich",
  "Ballia", "Balrampur", "Banda", "Barabanki", "Bareilly", "Basti", "Bhadohi",
  "Bijnor", "Bulandshahr", "Chandauli", "Chitrakoot", "Deoria", "Etah", "Etawah",
  "Faizabad", "Farrukabad", "Fatehpur", "Firozabad", "Ghaziabad", "Ghazipur",
  "Gonda", "Gorakhpur", "Hamirpur", "Hardoi", "Hathras", "Jalaun", "Jaunpur",
  "Jhansi", "JP Nagar", "Kannauj", "Kushinagar", "Lalitpur", "Lucknow",
  "Maharajganj", "Mahoba", "Mainpuri", "Mathura", "Mau", "Meerut", "Mirzapur",
  "Moradabad", "Muzaffarnagar", "Pilibhit", "Pratapgarh", "Raibareli", "Rampur",
  "Saharanpur", "Sambhal", "Shrawasti", "Sitapur", "Sonbhadra", "Sultanpur",
  "Unnao", "Varanasi", "Kaushambi", "Shahjahanpur", "Shamli"
];

// Target districts for Vrindavan plots (proximity + high wealth)
const TARGET_DISTRICTS = new Set([
  "Mathura", "Agra", "Aligarh", "Hathras", "Firozabad", "Etah", "Etawah",
  "Ghaziabad", "Gautam Buddh Nagar", "Meerut", "Bulandshahr", "Lucknow", "Kanpur Nagar"
]);

// Premium HNI Medical Qualifications
const PREMIUM_QUALIFICATIONS = new Set([
  "MS- Gen. Surgery", "MS - Gen. Surgery", "MS-Gen. Surgery", "MS", 
  "MS-Gynae", "MS- Gynae", "MD-Gynae", "MD - Gynae", "DGO", "DCH", "MS-Gynaecologist"
]);

function cleanPhone(val: unknown): string {
  if (val === undefined || val === null) return "";
  let str = String(val).trim();
  str = str.replace(/[\s\-\(\)\.\+]/g, "");
  str = str.replace(/[^\d]/g, "");
  
  if (str.length === 12 && str.startsWith("91")) {
    const secondPart = str.slice(2);
    if (/^[6-9]/.test(secondPart)) {
      str = secondPart;
    }
  }
  return str;
}

function getPhoneIssue(phone: string): string | null {
  if (!phone) return "Missing/Empty Phone";
  if (phone.length !== 10) return `Invalid Length (${phone.length} digits)`;
  if (!/^[6-9]/.test(phone)) return "Invalid Mobile Prefix (must start with 6-9)";
  if (/^(.)\1{9}$/.test(phone)) return "All same digits";
  return null;
}

async function main() {
  const pdfPath = "C:/Users/badal/.gemini/antigravity-ide/brain/6f7f57f7-12b5-4241-8ec9-659873417472/media__1782877540054.pdf";
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`PDF not found at: ${pdfPath}`);
    process.exit(1);
  }

  console.log("Connecting to MongoDB database...");
  await dbConnect();
  console.log("Connected successfully.");

  // Build duplicate check set from existing vrindavan_leads
  console.log("Building duplicate filter from existing vrindavan_leads...");
  const existingLeads = await VrindavanLead.find({}, { phone: 1 }).lean();
  const dbPhones = new Set<string>();
  for (const lead of existingLeads) {
    if (lead.phone) dbPhones.add(lead.phone);
  }
  console.log(`Loaded ${dbPhones.size} existing leads from database.`);

  console.log("Parsing PDF file...");
  const dataBuffer = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: dataBuffer });
  const textResult = await parser.getText();
  await parser.destroy();
  console.log(`Parsed ${textResult.pages.length} pages.`);

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const validLeads: any[] = [];
  const invalidCount = { missingPhone: 0, badPhone: 0, dupeBatch: 0, dupeDb: 0 };
  const seenPhones = new Set<string>();

  // Regex to extract serial, name text block, phone, and remainder
  const rowRegex = /^\s*(\d+)\s+([A-Za-z\s\.\/\&\'\(\)\,\-]+?)\s*([6-9]\d{9}(?:\/\s*[6-9]\d{9})?)\s*(.*)/i;

  textResult.pages.forEach((page) => {
    const lines = page.text.split("\n").filter(Boolean);
    
    lines.forEach(line => {
      // Data rows start with a number followed by space
      if (/^\d+\s+/.test(line)) {
        const match = line.match(rowRegex);
        
        if (!match) {
          invalidCount.missingPhone++;
          return;
        }

        const textBeforePhone = match[2].trim();
        const phoneVal = cleanPhone(match[3]);
        const rest = match[4].trim();

        // 1. Detect District and clean Doctor Name
        let detectedDistrict = "Unknown";
        let doctorName = textBeforePhone;

        for (const dist of UP_DISTRICTS) {
          if (textBeforePhone.startsWith(dist)) {
            detectedDistrict = dist;
            doctorName = textBeforePhone.substring(dist.length).trim();
            break;
          }
        }

        // Clean trailing dots/whitespace from name
        doctorName = doctorName.replace(/\.+$/, "").trim();

        // 2. Validate phone number
        const phoneIssue = getPhoneIssue(phoneVal);
        if (phoneIssue) {
          invalidCount.badPhone++;
          return;
        }

        // Deduplication (Batch)
        if (seenPhones.has(phoneVal)) {
          invalidCount.dupeBatch++;
          return;
        }
        seenPhones.add(phoneVal);

        // Deduplication (Database)
        if (dbPhones.has(phoneVal)) {
          invalidCount.dupeDb++;
          return;
        }

        // 3. Parse fields from 'rest' segment
        // Rest format: "[optional eHRMS] [Qualification] [Facility Posted] [Type] [Block] [Date] [LS] [LAP] ... [Remarks]"
        const tokens = rest.split(/\s+/);
        
        // Find qualification (e.g. MBBS, DGO, MS, etc.)
        let qualification = "";
        let qIdx = -1;
        
        // Check for common qualifications in the tokens
        const qualPatterns = ["MBBS", "DGO", "MS-", "MS", "MD-", "MD", "DCH", "MS-Others", "MD-Others"];
        for (let i = 0; i < tokens.length; i++) {
          const tok = tokens[i].toUpperCase();
          if (qualPatterns.some(p => tok.startsWith(p))) {
            qualification = tokens[i];
            qIdx = i;
            break;
          }
        }

        let hrmsCode = "";
        if (qIdx > 0 && /^\d{5,6}$/.test(tokens[0])) {
          hrmsCode = tokens[0];
        }

        // Mapped facility & type
        let facility = "";
        let typeOfFacility = "";
        if (qIdx !== -1 && qIdx + 1 < tokens.length) {
          // Facility is typically 1-3 tokens after qualification
          const facilityTokens = tokens.slice(qIdx + 1, qIdx + 4);
          facility = facilityTokens.join(" ");
          
          if (facility.includes("DWH")) typeOfFacility = "DWH";
          else if (facility.includes("CHC")) typeOfFacility = "CHC";
          else if (facility.includes("PHC")) typeOfFacility = "PHC";
        }

        // Extract Remarks (the end tokens containing performance stats or text description)
        // Usually, the last 1-4 tokens contain strings like "Performing", "not interest", "Complete", "Incomplete", etc.
        let remarks = "";
        const completeIdx = tokens.indexOf("Complete");
        const incompleteIdx = tokens.indexOf("Incomplete");
        const pendingIdx = tokens.indexOf("Pending");
        
        const remarksStartIdx = Math.max(completeIdx, incompleteIdx, pendingIdx);
        if (remarksStartIdx !== -1 && remarksStartIdx + 1 < tokens.length) {
          remarks = tokens.slice(remarksStartIdx + 1).join(" ");
        } else {
          // fallback to last 2 words
          remarks = tokens.slice(-2).join(" ");
        }

        // 4. Calculate Lead Relevance (Priority)
        let priority = "medium";
        const isTargetDistrict = TARGET_DISTRICTS.has(detectedDistrict);
        const isPremiumQual = PREMIUM_QUALIFICATIONS.has(qualification);
        
        // High priority: target districts, premium specialists, active workload, not on leave/uninterested
        const isUninterested = remarks.toLowerCase().includes("not interest") || 
                              remarks.toLowerCase().includes("unwilling") || 
                              remarks.toLowerCase().includes("maternity");
                              
        if (isTargetDistrict && isPremiumQual && !isUninterested) {
          priority = "high";
        } else if (isUninterested) {
          priority = "low";
        }

        // 5. Construct lead payload
        const address = `${facility || "District Hospital"}, ${detectedDistrict}, Uttar Pradesh`;
        
        validLeads.push({
          name: doctorName,
          phone: phoneVal,
          primaryPhone: phoneVal,
          address,
          city: detectedDistrict,
          state: "Uttar Pradesh",
          projectName: "Plots in Vrindavan",
          source: "VRINDAVAN_LEADS",
          status: LeadStatus.NEW,
          dnd: false,
          handedOffToAdmin: false,
          sourceDetails: {
            qualification,
            hrmsCode,
            facility,
            typeOfFacility,
            remarks,
            originalDistrict: detectedDistrict,
            originalRow: line,
            priority,
            importedAt: new Date(),
            importedFileName: "media__1782877540054.pdf"
          }
        });
      }
    });
  });

  console.log("\n=================== IMPORT SUMMARY ===================");
  console.log(`Total rows processed:         ${validLeads.length + invalidCount.missingPhone + invalidCount.badPhone + invalidCount.dupeBatch + invalidCount.dupeDb}`);
  console.log(`Valid leads to import:        ${validLeads.length}`);
  console.log(`Missing phone skipped:        ${invalidCount.missingPhone}`);
  console.log(`Invalid phone numbers skipped: ${invalidCount.badPhone}`);
  console.log(`Batch duplicates skipped:     ${invalidCount.dupeBatch}`);
  console.log(`DB duplicates skipped:        ${invalidCount.dupeDb}`);
  console.log("======================================================\n");

  if (validLeads.length > 0) {
    console.log(`Inserting ${validLeads.length} leads into [vrindavan_leads] collection...`);
    const insertResult = await VrindavanLead.insertMany(validLeads);
    console.log(`Successfully imported ${insertResult.length} Vrindavan leads!`);
    
    // Sort valid leads by priority to showcase top leads for today
    const highPriorityLeads = validLeads.filter(l => l.sourceDetails.priority === "high");
    console.log(`\n=================== TOP LEADS FOR TODAY (${highPriorityLeads.length}) ===================`);
    console.log("Callers should target these Western UP / NCR premium specialists first:");
    highPriorityLeads.slice(0, 15).forEach((lead, idx) => {
      console.log(`[${idx + 1}] Name: "${lead.name}" | Phone: "${lead.phone}" | District: "${lead.city}"`);
      console.log(`    Spec: "${lead.sourceDetails.qualification || 'N/A'}" | Facility: "${lead.sourceDetails.facility || 'N/A'}" | Remarks: "${lead.sourceDetails.remarks || 'N/A'}"`);
    });
    console.log("=========================================================================\n");
  } else {
    console.log("No new leads to import (all duplicate or invalid).");
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Vrindavan Seeder Error:", err);
  process.exit(1);
});

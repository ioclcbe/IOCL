import crypto from "node:crypto";
import { CrewType } from "@prisma/client";
import { ApiError } from "../../lib/api-error.js";

const MAX_QR_LENGTH = 2_000;
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

type FieldKey = "crewId" | "driverName" | "crewType" | "passValidUntil" | "ttNumberOnPass" | "drivingLicenseNumber" | "drivingLicenseExpiryDate";
const fields: Array<{ key: FieldKey; label: string; patterns: RegExp[] }> = [
  { key: "crewId", label: "Crew Id", patterns: [/^crew\s*id\s*:\s*(.*)$/i] },
  { key: "driverName", label: "Name", patterns: [/^name\s*:\s*(.*)$/i] },
  { key: "crewType", label: "Crew Type", patterns: [/^crew\s*type\s*:\s*(.*)$/i] },
  { key: "passValidUntil", label: "Pass Valid Upto", patterns: [/^pass\s*valid\s*(?:upto|up\s*to|until)\s*:\s*(.*)$/i] },
  { key: "ttNumberOnPass", label: "TT No", patterns: [/^tt\s*(?:no|number)\s*:\s*(.*)$/i] },
  { key: "drivingLicenseNumber", label: "DL No", patterns: [/^dl\s*(?:no|number)\s*:\s*(.*)$/i, /^driving\s*licen[cs]e\s*(?:no|number)\s*:\s*(.*)$/i] },
  { key: "drivingLicenseExpiryDate", label: "DL Expiry Date", patterns: [/^dl\s*expiry\s*(?:date)?\s*:\s*(.*)$/i, /^driving\s*licen[cs]e\s*expiry\s*(?:date)?\s*:\s*(.*)$/i] },
];

export function looksLikeCrewPassQr(rawPayload: string) {
  return /(?:^|\r?\n)\s*crew\s*id\s*:/i.test(rawPayload) || /(?:^|\r?\n)\s*crew\s*type\s*:/i.test(rawPayload);
}

function parseStrictDate(value: string, fieldLabel: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) throw new ApiError(400, "QR_INVALID_DATE", `${fieldLabel} must use DD/MM/YYYY`);
  const day = Number(match[1]); const month = Number(match[2]); const year = Number(match[3]);
  if (year < 2000 || year > 2100) throw new ApiError(400, "QR_INVALID_DATE", `${fieldLabel} contains an unsupported year`);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new ApiError(400, "QR_INVALID_DATE", `${fieldLabel} is not a valid calendar date`);
  }
  return date;
}

function mapCrewType(raw: string) {
  const normalized = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (normalized === "driver") return CrewType.DRIVER;
  if (normalized === "driver with helper") return CrewType.DRIVER_WITH_HELPER;
  if (normalized === "contract crew") return CrewType.CONTRACT_CREW;
  throw new ApiError(400, "QR_INVALID_CREW_TYPE", "The QR contains an unsupported crew type");
}

export function parseCrewPassQr(rawPayload: string) {
  if (typeof rawPayload !== "string" || !rawPayload.trim()) throw new ApiError(400, "QR_EMPTY", "Scan or enter a crew-pass QR");
  if (Buffer.byteLength(rawPayload, "utf8") > MAX_QR_LENGTH) throw new ApiError(400, "QR_TOO_LONG", "The crew-pass QR is larger than the supported limit");
  if (CONTROL_CHARACTERS.test(rawPayload)) throw new ApiError(400, "QR_CONTROL_CHARACTERS", "The crew-pass QR contains unsupported control characters");

  const text = rawPayload.replaceAll("\r\n", " ").replaceAll("\r", " ").replaceAll("\n", " ").trim();
  // Each alternative MUST be the full field-label pattern (so the lookahead matches `label :` correctly).
  // Using the complete label avoids false stops on partial words inside field values.
  const nextFields = "(?:name|driver\\s*name)|crew\\s*type|pass\\s*valid\\s*(?:upto|up\\s*to|until)|tt\\s*(?:no|number)|(?:dl\\s*(?:no|number)|driving\\s*licen[cs]e\\s*(?:no|number))|(?:dl\\s*expiry(?:\\s*date)?|driving\\s*licen[cs]e\\s*expiry(?:\\s*date)?)";
  const getField = (labelRegex: string) => {
    const regex = new RegExp(`${labelRegex}\\s*:\\s*(.*?)(?=\\s+(?:${nextFields})\\s*:|$)`, "i");
    return regex.exec(text)?.[1]?.trim() ?? "";
  };

  const extracted = new Map<FieldKey, string>();
  extracted.set("crewId", getField("crew\\s*id"));
  // (?:...) is required around alternatives so the pipe | is scoped, not top-level in the regex.
  // Without it, `name|driver\s*name\s*:...` means `name` OR `driver\s*name\s*:...`
  // — the first alternative matches 4 chars with no capture group, returning undefined.
  extracted.set("driverName", getField("(?:name|driver\\s*name)"));
  extracted.set("crewType", getField("crew\\s*type"));
  extracted.set("passValidUntil", getField("pass\\s*valid\\s*(?:upto|up\\s*to|until)"));
  extracted.set("ttNumberOnPass", getField("tt\\s*(?:no|number)"));
  extracted.set("drivingLicenseNumber", getField("(?:dl\\s*(?:no|number)|driving\\s*licen[cs]e\\s*(?:no|number))"));
  extracted.set("drivingLicenseExpiryDate", getField("(?:dl\\s*expiry\\s*(?:date)?|driving\\s*licen[cs]e\\s*expiry\\s*(?:date)?)"));

  // Track which fields were missing or unparseable from the QR
  const missingFields: Array<{ key: FieldKey; label: string }> = [];

  let crewId = extracted.get("crewId")!.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z0-9]{6,50}$/.test(crewId)) {
    missingFields.push({ key: "crewId", label: "Crew ID" });
    crewId = "UNK" + crypto.randomBytes(4).toString("hex").toUpperCase();
  }

  let driverName = extracted.get("driverName")!.replace(/\s+/g, " ").trim();
  if (!/^[\p{L} .'-]{2,120}$/u.test(driverName)) {
    missingFields.push({ key: "driverName", label: "Driver Name" });
    driverName = "UNKNOWN DRIVER";
  }

  let ttNumberOnPass = extracted.get("ttNumberOnPass")!.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!/^[A-Z0-9]{6,15}$/.test(ttNumberOnPass) || !/[A-Z]/.test(ttNumberOnPass) || !/\d/.test(ttNumberOnPass)) {
    missingFields.push({ key: "ttNumberOnPass", label: "TT Number on Pass" });
    ttNumberOnPass = "UNKNOWN1";
  }

  let drivingLicenseNumber = extracted.get("drivingLicenseNumber")!.replace(/\s+/g, "").trim();
  if (!/^[A-Za-z0-9./_-]{4,40}$/.test(drivingLicenseNumber)) {
    missingFields.push({ key: "drivingLicenseNumber", label: "DL Number" });
    drivingLicenseNumber = "UNKNOWN_DL";
  }

  let crewType: CrewType = CrewType.DRIVER;
  const crewTypeRaw = extracted.get("crewType") ?? "";
  try { if (crewTypeRaw) crewType = mapCrewType(crewTypeRaw); } catch { /* ignore */ }

  let passValidUntil = "";
  const passValidRaw = extracted.get("passValidUntil") ?? "";
  let passDateMissing = !passValidRaw;
  if (passValidRaw) passValidUntil = passValidRaw;
  if (passDateMissing) missingFields.push({ key: "passValidUntil", label: "Pass Valid Upto" });

  let drivingLicenseExpiryDate = "";
  const dlExpiryRaw = extracted.get("drivingLicenseExpiryDate") ?? "";
  let dlDateMissing = !dlExpiryRaw;
  if (dlExpiryRaw) drivingLicenseExpiryDate = dlExpiryRaw;
  if (dlDateMissing) missingFields.push({ key: "drivingLicenseExpiryDate", label: "DL Expiry Date" });

  const normalizedRawPayload = [
    `Crew Id:${crewId}`,
    `Name:${driverName}`,
    `Crew Type:${crewType}`,
    `Pass Valid Upto:${passValidUntil}`,
    `TT No:${ttNumberOnPass}`,
    `DL No:${drivingLicenseNumber.toUpperCase()}`,
    `DL Expiry Date:${drivingLicenseExpiryDate}`,
  ].join("\n");
  return {
    crewId,
    driverName,
    crewType,
    passValidUntil,
    ttNumberOnPass,
    drivingLicenseNumber,
    drivingLicenseExpiryDate,
    normalizedRawPayload,
    payloadHash: crypto.createHash("sha256").update(normalizedRawPayload, "utf8").digest("hex"),
    missingFields, // [] means all fields were present; non-empty means user should fill gaps
  };
}

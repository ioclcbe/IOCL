import { ApiError } from "../../lib/api-error.js";

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const KNOWN_LABELS = ["Inv", "Dt", "Val", "Veh", "Prd/Qty", "Con"] as const;

type Label = (typeof KNOWN_LABELS)[number];

export interface ParsedInvoiceQr {
  invoiceNumber: string;
  invoiceDate: Date;
  invoiceDateIso: string;
  invoiceValue: string | null;
  vehicleNumber: string;
  productQuantityRaw: string;
  consignee: string;
  normalizedRawPayload: string;
}

function normalizeTruck(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function parseDate(value: string) {
  const match = /^(\d{2})[.\/-](\d{2})[.\/-](\d{2}|\d{4})$/.exec(value.trim());
  if (!match) throw new ApiError(422, "INVOICE_QR_INVALID_DATE", "Invoice date must use DD.MM.YY or DD.MM.YYYY");
  const day = Number(match[1]);
  const month = Number(match[2]);
  const rawYear = Number(match[3]);
  const year = match[3]!.length === 2 ? 2000 + rawYear : rawYear;
  if (year < 2000 || year > 2100) {
    throw new ApiError(422, "INVOICE_QR_INVALID_DATE", "Invoice date contains an unsupported year");
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new ApiError(422, "INVOICE_QR_INVALID_DATE", "Invoice QR contains an impossible calendar date");
  }
  return { date, iso: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extract(payload: string, label: Label): string {
  const alternatives = KNOWN_LABELS.filter((candidate) => candidate !== label).map(escapeRegex).join("|");
  const regex = new RegExp(`${escapeRegex(label)}\\s*:\\s*(.*?)(?=\\s+(?:${alternatives})\\s*:|$)`, "i");
  const matches = [...payload.matchAll(new RegExp(regex.source, "gi"))];
  if (matches.length === 0) throw new ApiError(422, "INVOICE_QR_MISSING_FIELD", `Invoice QR is missing ${label}`);
  if (matches.length > 1) throw new ApiError(422, "INVOICE_QR_DUPLICATE_FIELD", `Invoice QR contains duplicate ${label} labels`);
  const value = matches[0]?.[1]?.trim() ?? "";
  if (!value) throw new ApiError(422, "INVOICE_QR_EMPTY_FIELD", `Invoice QR ${label} value is empty`);
  return value;
}

export function parseInvoiceQr(rawPayload: string): ParsedInvoiceQr {
  if (typeof rawPayload !== "string") throw new ApiError(422, "INVOICE_QR_INVALID", "Invoice QR must be text");
  const normalized = rawPayload.replace(/\r\n?/g, "\n").replace(/\s*\n\s*/g, " ").trim().replace(/\s+/g, " ");
  if (normalized.length < 10 || normalized.length > 2_000) {
    throw new ApiError(422, "INVOICE_QR_INVALID_LENGTH", "Invoice QR length is invalid");
  }
  if (CONTROL_CHARACTERS.test(normalized)) {
    throw new ApiError(422, "INVOICE_QR_CONTROL_CHARACTERS", "Invoice QR contains unsupported control characters");
  }

  const invoiceNumber = extract(normalized, "Inv").replace(/\s+/g, "").toUpperCase();
  const invoiceDate = parseDate(extract(normalized, "Dt"));
  const valueRaw = extract(normalized, "Val").replace(/,/g, "");
  const vehicleNumber = normalizeTruck(extract(normalized, "Veh"));
  const productQuantityRaw = extract(normalized, "Prd/Qty");
  const consignee = extract(normalized, "Con");

  if (!/^[A-Z0-9._\/-]{3,60}$/.test(invoiceNumber)) {
    throw new ApiError(422, "INVOICE_QR_INVALID_NUMBER", "Invoice number contains unsupported characters");
  }
  if (!/^[A-Z0-9]{6,15}$/.test(vehicleNumber)) {
    throw new ApiError(422, "INVOICE_QR_INVALID_VEHICLE", "Invoice QR contains an invalid vehicle number");
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(valueRaw)) {
    throw new ApiError(422, "INVOICE_QR_INVALID_VALUE", "Invoice value is invalid");
  }
  const [wholeValue] = valueRaw.split(".");
  if ((wholeValue ?? "").length > 14) {
    throw new ApiError(422, "INVOICE_QR_INVALID_VALUE", "Invoice value exceeds the supported database precision");
  }
  if (productQuantityRaw.length > 1_000 || consignee.length > 200) {
    throw new ApiError(422, "INVOICE_QR_FIELD_TOO_LONG", "Invoice QR contains an overlong field");
  }

  return {
    invoiceNumber,
    invoiceDate: invoiceDate.date,
    invoiceDateIso: invoiceDate.iso,
    invoiceValue: valueRaw,
    vehicleNumber,
    productQuantityRaw,
    consignee,
    normalizedRawPayload: normalized,
  };
}

// Maps IOCL invoice product codes (e.g. "BULK-MS/8000") → DB field names
const PRODUCT_CODE_MAP: Record<string, string> = {
  "BULK-MS": "qtyMs",
  "MS": "qtyMs",
  "BULK-HSD": "qtyHsd",
  "HSD": "qtyHsd",
  "BULK-XPMS": "qtyXpms",
  "XPMS": "qtyXpms",
  "XP-95": "qtyXpms",
  "XP95": "qtyXpms",
  "BULK-XP95": "qtyXpms",
  "BULK-SKO": "qtySko",
  "SKO": "qtySko",
  "BULK-XG": "qtyXg",
  "XG": "qtyXg",
  "BULK-BIOHSD": "qtyBioHsd",
  "BIO-HSD": "qtyBioHsd",
  "BIOHSD": "qtyBioHsd",
  "BULK-FO": "qtyFo",
  "FO": "qtyFo",
  "BULK-LDO": "qtyLdo",
  "LDO": "qtyLdo",
  "BULK-EBMS": "qtyEbms",
  "EBMS": "qtyEbms",
};

export function parseProductQuantities(raw: string): Record<string, number> {
  const result: Record<string, number> = {};
  // Matches patterns like BULK-MS/8000 or BULK-HSD/2000.500
  const pattern = /([A-Z0-9][A-Z0-9-]*)\/(\d+(?:\.\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw.toUpperCase())) !== null) {
    const code = match[1]!;
    const qty = parseFloat(match[2]!);
    const field = PRODUCT_CODE_MAP[code];
    if (field && Number.isFinite(qty) && qty > 0) {
      result[field] = qty;
    }
  }
  return result;
}

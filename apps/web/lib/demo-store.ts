import type {
  AuditLogRecord,
  CreateGateEntryInput,
  CrewPass,
  DashboardSummary,
  ExitResolveResult,
  GateEntryRecord,
  SubmitExitInput,
  UpdateExitQuantitiesInput,
  UpdateGateEntryInput,
  UserRecord,
  UserRole,
} from "@iocl/shared";
import { normalizeTruck } from "./utils";

const ENTRY_KEY = "iocl_demo_entries_v3";
const AUDIT_KEY = "iocl_demo_audit_v3";

const demoUsers: Record<string, { id: string; employeeCode: string; name: string; role: UserRole }> = {
  SEC1001: { id: "7fe3c08c-70dd-489c-9c2e-e956fc7c3f51", employeeCode: "SEC1001", name: "Rajesh Kumar", role: "ENTRY_GATE_SECURITY" },
  EXT1001: { id: "2a4ef876-17b4-47bc-af42-489d64a047e1", employeeCode: "EXT1001", name: "Meena Devi", role: "EXIT_GATE_SECURITY" },
  SUP1001: { id: "277e72de-a133-49d8-a239-b27fc16c7769", employeeCode: "SUP1001", name: "Gate Supervisor", role: "SUPERVISOR" },
  ADM1001: { id: "26a7bb7a-1765-4bb4-a479-6222fbe7223a", employeeCode: "ADM1001", name: "System Administrator", role: "ADMIN" },
};
export const demoUser = demoUsers.SEC1001!;

export const DEMO_QR = `Crew Id : IOC11965186D0010
Name : RAGUPRABAHAR C
Crew Type : Driver
pass valid Upto : 03/08/2025
TT No : TN74AZ8730
DL No : Tn7420210005690
DL Expiry Date : 02/07/2026`;
export const FUTURE_DEMO_QR = "IOCL:CREW:CRW-30215";
export const DEMO_INVOICE_QR = "Inv:0793356259 Dt:06.06.26 Val:1143122.00 Veh:TN74AZ8730 Prd/Qty:BULK-MS/8;BULK-HSD/4 Con:203031(VASUGI AGENCIES)";

const demoPasses: Record<string, CrewPass> = {
  [DEMO_QR]: {
    id: "dd6c6212-5664-4ff9-ad36-305cf85b927a",
    qrToken: DEMO_QR,
    crewId: "IOC11965186D0010",
    driverName: "RAGUPRABAHAR C",
    crewType: "DRIVER",
    passValidUntil: "2025-08-03T00:00:00.000Z",
    ttNumberOnPass: "TN74AZ8730",
    drivingLicenseNumber: "Tn7420210005690",
    drivingLicenseExpiryDate: "2026-07-02T00:00:00.000Z",
    isActive: true,
    sourceSystem: "RAW_TEXT_QR",
    warnings: ["Crew pass has expired", "Driving licence has expired", "Demo mode permits presentation only"],
  },
  [FUTURE_DEMO_QR]: {
    id: "cccf3e93-cd6b-4fba-a613-cd61b17b5f20",
    qrToken: FUTURE_DEMO_QR,
    crewId: "CRW-30215",
    driverName: "Sunil Sharma",
    crewType: "DRIVER",
    passValidUntil: "2028-12-31T00:00:00.000Z",
    ttNumberOnPass: "HR38AB7724",
    drivingLicenseNumber: "HR3820160049382",
    drivingLicenseExpiryDate: "2029-08-06T00:00:00.000Z",
    isActive: true,
    sourceSystem: "DEMO_MASTER",
    warnings: [],
  },
};

const safetyBase = {
  checklistVersion: 2,
  drivingLicenseValidCmvRule9: true,
  verifyRegisterColumn1: true,
  ppeAvailable: true,
  rubberHoseCumLockCouplingGttMarked: true,
  sparkArrestorCcoeApproved: true,
  tremCardAndTrainingCardAvailable: true,
  selfStarterWorking: true,
  batteryTerminalRubberCovers: true,
  noContainerCanExplosivesInCabin: true,
  vmuWorking: true,
  batteryCutOffSwitchCondition: true,
  handBrakeWorking: true,
  earthCleatProvided: true,
  tlfNo: "TLF-4001",
  accessMethod: "GANTRY",
  inspectionArea: "Main gate inspection bay",
  sealNumber: "SEAL-1001",
  verifiedBy: "Rajesh Kumar",
  verificationNotes: "Physical safety inspection completed",
  exceptionRemarks: "",
};

function todayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; } catch { return fallback; }
}
function write<T>(key: string, value: T) { if (typeof window !== "undefined") localStorage.setItem(key, JSON.stringify(value)); }
function uid() { return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2); }
function serial(index: number) { return `IN-${todayKey().replaceAll("-", "")}-${String(index).padStart(4, "0")}`; }

function blankExit() {
  return {
    qtyMs: null, qtyXpms: null, qtyEbms: null, qtyHsd: null, qtySko: null, qtyXg: null, qtyBioHsd: null, qtyFo: null, qtyLdo: null, lockNumber: null,
    invoiceNumber: null, invoiceDate: null, invoiceValue: null, invoiceVehicle: null, invoiceConsignee: null, invoiceProductsRaw: null,
    exitCreatedBy: null, isDeleted: false, deletedAt: null, deleteReason: null,
  };
}

export function seedDemoEntries() {
  if (typeof window === "undefined" || localStorage.getItem(ENTRY_KEY)) return;
  const now = new Date();
  const pass = demoPasses[DEMO_QR]!;
  const sample: GateEntryRecord[] = [{
    id: "a227b85b-0bf6-4296-968e-4c178caed9a1",
    recordVersion: 1,
    facilityCode: "IOCL-MADURAI",
    gateCode: "IN-GATE-01",
    serialNumber: 1,
    displaySerial: serial(1),
    businessDate: todayKey(),
    entryDate: new Date(now.getTime() - 40 * 60_000).toISOString(),
    timeIn: new Date(now.getTime() - 40 * 60_000).toISOString(),
    timeOut: null,
    status: "IN",
    qrScanMethod: "CAMERA",
    crewId: pass.crewId,
    driverName: pass.driverName,
    crewType: pass.crewType,
    passValidUntil: pass.passValidUntil,
    ttNumberOnPass: pass.ttNumberOnPass,
    drivingLicenseNumber: pass.drivingLicenseNumber,
    drivingLicenseExpiryDate: pass.drivingLicenseExpiryDate,
    customerDestination: "VASUGI AGENCIES",
    actualTankTruckNumber: "TN74AZ8730",
    abs: true,
    challanNumber: "CH-482901",
    driverPassNumber: "DP-7412",
    driverAbt: true,
    helperName: null,
    helperPassNumber: null,
    helperAbt: false,
    mobileTokenNumber: "MT-1001",
    driverSignatureConfirmed: true,
    remarks: "Client demonstration movement",
    ttNumberMatch: true,
    safetyChecklist: { ...safetyBase },
    createdBy: demoUser,
    createdAt: new Date(now.getTime() - 40 * 60_000).toISOString(),
    updatedAt: new Date(now.getTime() - 40 * 60_000).toISOString(),
    ...blankExit(),
  }];
  write(ENTRY_KEY, sample);
  write(AUDIT_KEY, []);
}

export function demoLogin(employeeCode: string, password: string) {
  const user = demoUsers[employeeCode.trim().toUpperCase()];
  if (!user || password !== "Gate@123") throw new Error("Employee code or password is incorrect");
  return { accessToken: "demo-access-token", user };
}

export function resolveDemoPass(qrToken: string): CrewPass {
  const exact = demoPasses[qrToken.trim()];
  if (exact) return exact;
  const text = qrToken.trim();
  const field = (label: RegExp) => text.split(/\r?\n/).map((line) => line.match(label)?.[1]?.trim()).find(Boolean);
  const crewId = field(/^crew\s*id\s*:\s*(.+)$/i);
  const driverName = field(/^(?:name|driver\s*name)\s*:\s*(.+)$/i);
  const type = field(/^crew\s*type\s*:\s*(.+)$/i) ?? "Driver";
  const pass = field(/^pass\s*valid\s*(?:upto|until)\s*:\s*(.+)$/i);
  const truck = field(/^tt\s*(?:no|number)\s*:\s*(.+)$/i);
  const dl = field(/^dl\s*(?:no|number)\s*:\s*(.+)$/i);
  const dlExpiry = field(/^dl\s*expiry\s*(?:date)?\s*:\s*(.+)$/i);
  if (!crewId || !driverName || !pass || !truck || !dl || !dlExpiry) throw new Error("QR payload is missing required crew-pass fields");
  const parse = (value: string) => {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
    if (!match) throw new Error("QR date must use DD/MM/YYYY");
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new Error("QR contains an impossible date");
    }
    return date.toISOString();
  };
  return {
    id: uid(), qrToken: text, crewId: crewId.replace(/\s+/g, "").toUpperCase(), driverName,
    crewType: /helper/i.test(type) ? "DRIVER_WITH_HELPER" : /contract/i.test(type) ? "CONTRACT_CREW" : "DRIVER",
    passValidUntil: parse(pass), ttNumberOnPass: normalizeTruck(truck), drivingLicenseNumber: dl,
    drivingLicenseExpiryDate: parse(dlExpiry), isActive: true, sourceSystem: "RAW_TEXT_QR",
  };
}

export function getDemoEntries() { seedDemoEntries(); return read<GateEntryRecord[]>(ENTRY_KEY, []).filter((item) => !item.isDeleted); }
export function getDemoEntry(id: string) { const item = getDemoEntries().find((entry) => entry.id === id); if (!item) throw new Error("Entry not found"); return item; }

export function createDemoEntry(input: CreateGateEntryInput) {
  const pass = Object.values(demoPasses).find((item) => item.id === input.crewPassId);
  if (!pass) throw new Error("Scan a supported demo crew pass");
  const entries = getDemoEntries();
  const truck = normalizeTruck(input.actualTankTruckNumber);
  const token = (input.mobileTokenNumber ?? "-").replace(/\s+/g, "").toUpperCase();
  const today = `${todayKey()}T00:00:00.000Z`;
  if (pass.passValidUntil < today) throw new Error("Crew pass has expired");
  if (pass.drivingLicenseExpiryDate < today) throw new Error("Driving licence has expired");
  if (entries.some((item) => item.status === "IN" && normalizeTruck(item.actualTankTruckNumber) === truck)) throw new Error("Vehicle already entered");
  if (entries.some((item) => item.status === "IN" && item.crewId === pass.crewId)) throw new Error("This crew pass already has an open IN entry");
  if (entries.some((item) => item.businessDate === todayKey() && item.mobileTokenNumber === token)) throw new Error("Mobile token already used today");
  if (normalizeTruck(pass.ttNumberOnPass) !== truck && (input.remarks ?? "").trim().length < 5) throw new Error("Add remarks explaining the TT mismatch");
  const now = new Date().toISOString();
  const index = entries.length + 1;
  const entry: GateEntryRecord = {
    id: uid(), recordVersion: 1, facilityCode: "IOCL-MADURAI", gateCode: "IN-GATE-01", serialNumber: index,
    displaySerial: serial(index), businessDate: todayKey(), entryDate: now, timeIn: now, timeOut: null, status: "IN",
    qrScanMethod: input.qrScanMethod ?? "MANUAL", crewId: pass.crewId, driverName: pass.driverName, crewType: pass.crewType,
    passValidUntil: pass.passValidUntil, ttNumberOnPass: pass.ttNumberOnPass, drivingLicenseNumber: pass.drivingLicenseNumber,
    drivingLicenseExpiryDate: pass.drivingLicenseExpiryDate, customerDestination: input.customerDestination ?? "-",
    actualTankTruckNumber: truck, abs: input.abs, challanNumber: input.challanNumber ?? "-", driverPassNumber: input.driverPassNumber ?? "-",
    driverAbt: input.driverAbt ?? false, helperName: input.helperName || null, helperPassNumber: input.helperPassNumber || null,
    helperAbt: input.helperAbt ?? false, mobileTokenNumber: token, driverSignatureConfirmed: input.driverSignatureConfirmed === true,
    remarks: input.remarks || null, ttNumberMatch: normalizeTruck(pass.ttNumberOnPass) === truck,
    safetyChecklist: { checklistVersion: 2, ...input.safetyChecklist, inspectionArea: input.safetyChecklist.inspectionArea ?? "-", sealNumber: input.safetyChecklist.sealNumber ?? "-", verifiedBy: demoUser.name, verificationNotes: input.safetyChecklist.verificationNotes ?? "-", exceptionRemarks: input.safetyChecklist.exceptionRemarks ?? "" },
    createdBy: demoUser, createdAt: now, updatedAt: now, ...blankExit(),
  };
  write(ENTRY_KEY, [entry, ...entries]);
  return entry;
}

export function updateDemoEntry(id: string, input: UpdateGateEntryInput) {
  const entries = getDemoEntries();
  const current = entries.find((item) => item.id === id);
  if (!current || current.status !== "IN") throw new Error("Entry is locked or missing");
  const next: GateEntryRecord = {
    ...current,
    ...Object.fromEntries(Object.entries(input).filter(([key, value]) => key !== "expectedVersion" && key !== "safetyChecklist" && value !== undefined)),
    recordVersion: current.recordVersion + 1,
    actualTankTruckNumber: input.actualTankTruckNumber ? normalizeTruck(input.actualTankTruckNumber) : current.actualTankTruckNumber,
    ttNumberMatch: input.actualTankTruckNumber ? normalizeTruck(input.actualTankTruckNumber) === normalizeTruck(current.ttNumberOnPass) : current.ttNumberMatch,
    safetyChecklist: input.safetyChecklist ? { ...current.safetyChecklist, ...input.safetyChecklist } : current.safetyChecklist,
    updatedAt: new Date().toISOString(),
  } as GateEntryRecord;
  write(ENTRY_KEY, entries.map((item) => item.id === id ? next : item));
  return next;
}

function parseInvoice(raw: string) {
  const get = (label: string, next: string) => new RegExp(`${label}\\s*:\\s*(.*?)(?=\\s+(?:${next})\\s*:|$)`, "i").exec(raw)?.[1]?.trim() ?? "";
  return {
    invoiceNumber: get("Inv", "Dt|Val|Veh|Prd/Qty|Con"),
    invoiceDate: get("Dt", "Inv|Val|Veh|Prd/Qty|Con"),
    invoiceValue: get("Val", "Inv|Dt|Veh|Prd/Qty|Con"),
    vehicleNumber: normalizeTruck(get("Veh", "Inv|Dt|Val|Prd/Qty|Con")),
    productQuantityRaw: get("Prd/Qty", "Inv|Dt|Val|Veh|Con"),
    consignee: get("Con", "Inv|Dt|Val|Veh|Prd/Qty"),
  };
}

export function resolveDemoInvoice(rawInvoiceQr: string): ExitResolveResult {
  const invoice = parseInvoice(rawInvoiceQr);
  const entry = getDemoEntries().find((item) => item.status === "IN" && item.actualTankTruckNumber === invoice.vehicleNumber);
  if (!entry) throw new Error("No open IN record was found today for the invoice vehicle");
  return {
    invoice: { ...invoice, invoiceDate: "2026-06-06", rawInvoiceQr, invoiceValue: invoice.invoiceValue || null, parsedQuantities: {} },
    entry,
    warnings: [
      ...(entry.passValidUntil < `${todayKey()}T00:00:00.000Z` ? ["Crew pass is expired"] : []),
      ...(entry.drivingLicenseExpiryDate < `${todayKey()}T00:00:00.000Z` ? ["Driving licence is expired"] : []),
      ...(!entry.ttNumberMatch ? ["TT number mismatch was recorded at entry"] : []),
    ],
  };
}

export function submitDemoExit(id: string, input: SubmitExitInput) {
  const entries = getDemoEntries();
  const current = entries.find((item) => item.id === id);
  if (!current || current.status !== "IN") throw new Error("Open IN entry was not found");
  if (current.recordVersion !== input.expectedVersion) throw new Error("This entry changed. Reload and try again");
  const invoice = parseInvoice(input.rawInvoiceQr);
  if (!invoice.invoiceNumber || !invoice.vehicleNumber || !invoice.productQuantityRaw) throw new Error("Invoice QR is missing required fields");
  if (normalizeTruck(current.actualTankTruckNumber) !== invoice.vehicleNumber) throw new Error("Invoice vehicle does not match the open IN record");
  if (entries.some((item) => item.invoiceNumber === invoice.invoiceNumber)) throw new Error("This invoice number has already been submitted");
  if ([input.qtyMs, input.qtyXpms, input.qtyEbms, input.qtyHsd, input.qtySko, input.qtyXg, input.qtyBioHsd, input.qtyFo, input.qtyLdo].some((value) => !Number.isFinite(value) || value < 0) ||
      input.qtyMs + input.qtyXpms + input.qtyEbms + input.qtyHsd + input.qtySko + input.qtyXg + input.qtyBioHsd + input.qtyFo + input.qtyLdo <= 0) {
    throw new Error("Enter at least one valid product quantity");
  }
  const hasExpiryWarning = current.passValidUntil < `${todayKey()}T00:00:00.000Z` || current.drivingLicenseExpiryDate < `${todayKey()}T00:00:00.000Z`;
  if (hasExpiryWarning && !input.warningsAcknowledged) throw new Error("Acknowledge expired document warnings before OUT");
  const outUser = demoUsers.EXT1001!;
  const next: GateEntryRecord = {
    ...current, recordVersion: current.recordVersion + 1, status: "OUT", timeOut: new Date().toISOString(),
    qtyMs: String(input.qtyMs), qtyXpms: String(input.qtyXpms), qtyEbms: String(input.qtyEbms), qtyHsd: String(input.qtyHsd),
    qtySko: String(input.qtySko), qtyXg: String(input.qtyXg), qtyBioHsd: String(input.qtyBioHsd), qtyFo: String(input.qtyFo), qtyLdo: String(input.qtyLdo),
    invoiceNumber: invoice.invoiceNumber, invoiceDate: "2026-06-06", invoiceValue: invoice.invoiceValue || null,
    invoiceVehicle: invoice.vehicleNumber, invoiceConsignee: invoice.consignee, invoiceProductsRaw: invoice.productQuantityRaw,
    exitCreatedBy: outUser, updatedAt: new Date().toISOString(),
  };
  write(ENTRY_KEY, entries.map((item) => item.id === id ? next : item));
  return next;
}

export function updateDemoExitQuantities(id: string, input: UpdateExitQuantitiesInput) {
  const entries = getDemoEntries();
  const current = entries.find((item) => item.id === id);
  if (!current || current.status !== "OUT") throw new Error("OUT entry was not found");
  if (current.recordVersion !== input.expectedVersion) throw new Error("This entry changed. Reload and try again");
  const next = { ...current, ...Object.fromEntries(Object.entries(input).filter(([key, value]) => key !== "expectedVersion" && value !== undefined).map(([key, value]) => [key, String(value)])), recordVersion: current.recordVersion + 1, updatedAt: new Date().toISOString() } as GateEntryRecord;
  write(ENTRY_KEY, entries.map((item) => item.id === id ? next : item));
  return next;
}

export function getDemoDashboard(): DashboardSummary {
  const entries = getDemoEntries();
  const out = entries.filter((item) => item.status === "OUT");
  const sum = (key: "qtyMs" | "qtyXpms" | "qtyEbms" | "qtyHsd") => out.reduce((total, item) => total + Number(item[key] ?? 0), 0);
  const ms = sum("qtyMs"), xpms = sum("qtyXpms"), ebms = sum("qtyEbms"), hsd = sum("qtyHsd");
  return {
    facilityCode: "IOCL-MADURAI", gateCode: "IN-GATE-01", businessDate: todayKey(), total: entries.length,
    open: entries.filter((item) => item.status === "IN").length, exited: out.length,
    mismatches: entries.filter((item) => !item.ttNumberMatch).length,
    safetyExceptions: entries.filter((item) => Object.entries(item.safetyChecklist).some(([key, value]) => key !== "checklistVersion" && value === false)).length,
    quantities: { ms: String(ms), xpms: String(xpms), ebms: String(ebms), hsd: String(hsd), sko: "0", xg: "0", bioHsd: "0", fo: "0", ldo: "0", petrol: String(ms + xpms + ebms), diesel: String(hsd), other: "0" },
    recent: entries.slice(0, 8).map(({ id, serialNumber, displaySerial, businessDate, actualTankTruckNumber, driverName, customerDestination, ttNumberMatch, status, timeIn }) => ({ id, serialNumber, displaySerial, businessDate, actualTankTruckNumber, driverName, customerDestination, ttNumberMatch, status, timeIn })),
  };
}

export function getDemoAudits(): AuditLogRecord[] { return read<AuditLogRecord[]>(AUDIT_KEY, []); }
export function getDemoDestinations() { return [
  { id: "1", code: "VASUGI", name: "VASUGI AGENCIES" }, { id: "2", code: "MDU", name: "Madurai Retail Depot" }, { id: "3", code: "TRI", name: "Trichy Terminal" },
]; }
export function getDemoUsers(): UserRecord[] { const now = new Date().toISOString(); return Object.values(demoUsers).map((user) => ({ ...user, isActive: true, failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: now, createdAt: now, updatedAt: now })); }

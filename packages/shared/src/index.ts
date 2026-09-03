import { z } from "zod";

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function cleanText(min: number, max: number, requiredMessage: string) {
  return z
    .string()
    .trim()
    .min(min, requiredMessage)
    .max(max, `Must be ${max} characters or fewer`)
    .refine((value) => !CONTROL_CHARACTERS.test(value), "Contains unsupported control characters");
}

function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .refine((value) => !CONTROL_CHARACTERS.test(value), "Contains unsupported control characters")
    .default("");
}

const queryBooleanSchema = z.preprocess((value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no", ""].includes(normalized)) return false;
  }
  return value;
}, z.boolean());

export const isoDateSchema = z
  .string()
  .regex(ISO_DATE, "Use date format YYYY-MM-DD")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year!, month! - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day;
  }, "Invalid calendar date");

export const userRoleSchema = z.enum([
  "ENTRY_GATE_SECURITY",
  "EXIT_GATE_SECURITY",
  "SUPERVISOR",
  "ADMIN",
]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const crewTypeSchema = z.enum(["DRIVER", "DRIVER_WITH_HELPER", "CONTRACT_CREW"]);
export type CrewType = z.infer<typeof crewTypeSchema>;

export const entryStatusSchema = z.enum(["IN", "OUT", "CANCELLED"]);
export type EntryStatus = z.infer<typeof entryStatusSchema>;

export const qrScanMethodSchema = z.enum(["CAMERA", "HARDWARE_SCANNER", "MANUAL", "DEMO"]);
export type QrScanMethod = z.infer<typeof qrScanMethodSchema>;


/** Register products and reporting groups are configuration, not scattered business logic. */
export const REGISTER_PRODUCTS = [
  { code: "MS", field: "qtyMs", group: "PETROL" },
  { code: "XPMS", field: "qtyXpms", group: "PETROL" },
  { code: "EBMS", field: "qtyEbms", group: "PETROL" },
  { code: "HSD", field: "qtyHsd", group: "DIESEL" },
  { code: "SKO", field: "qtySko", group: "OTHER" },
  { code: "XG", field: "qtyXg", group: "OTHER" },
  { code: "BIO_HSD", field: "qtyBioHsd", group: "DIESEL" },
  { code: "FO", field: "qtyFo", group: "OTHER" },
  { code: "LDO", field: "qtyLdo", group: "OTHER" },
] as const;
export type RegisterProductCode = (typeof REGISTER_PRODUCTS)[number]["code"];
export type RegisterProductField = (typeof REGISTER_PRODUCTS)[number]["field"];
export type RegisterProductGroup = (typeof REGISTER_PRODUCTS)[number]["group"];

export const loginSchema = z.object({
  employeeCode: z
    .string()
    .trim()
    .min(4, "Enter a valid employee code")
    .max(32)
    .regex(/^[A-Za-z0-9._-]+$/, "Employee code contains unsupported characters")
    .transform((value) => value.toUpperCase()),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
}).strict();
export type LoginInput = z.infer<typeof loginSchema>;

export const crewPassSchema = z.object({
  id: z.string(),
  qrToken: z.string(),
  crewId: z.string(),
  driverName: z.string(),
  crewType: crewTypeSchema,
  passValidUntil: z.string(),
  ttNumberOnPass: z.string(),
  drivingLicenseNumber: z.string(),
  drivingLicenseExpiryDate: z.string(),
  isActive: z.boolean(),
  sourceSystem: z.string().optional(),
  warnings: z.array(z.string()).optional(),
  missingFields: z.array(z.object({ key: z.string(), label: z.string() })).optional(),
});
export type CrewPass = z.infer<typeof crewPassSchema>;

export const tankTruckSchema = z.object({
  id: z.string().uuid().optional(),
  ttNumber: z.string().trim().min(3).max(20).toUpperCase(),
  isActive: z.boolean().default(true),
});
export type TankTruck = z.infer<typeof tankTruckSchema>;

export const driverSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(3).max(120),
  drivingLicenseNumber: z.string().trim().min(5).max(40),
  drivingLicenseExpiryDate: isoDateSchema,
  passValidUntil: isoDateSchema,
  isActive: z.boolean().default(true),
});
export type Driver = z.infer<typeof driverSchema>;

export const helperSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(3).max(120),
  helperPassNumber: z.string().trim().min(5).max(50),
  isActive: z.boolean().default(true),
});
export type Helper = z.infer<typeof helperSchema>;

const yesNo = z.boolean({ error: "Select Yes or No" });

export const IN_GATE_SAFETY_ITEMS = [
  { key: "verifyRegisterColumn1", label: "ISI Marked DCP FE Available (1x10 kg DCP & 1x2kg CO2 or 1x2 kg Stored pressure Type DCP or 2x10 kg DCPs)" },
  { key: "drivingLicenseValidCmvRule9", label: "Driving License is endorsed as per CMV Rule 9 (Driving Hazardous Goods Carrying Vehicle)" },
  { key: "ppeAvailable", label: "Wearing of PPEs by TT Crew (Safety Shoe, Helmet)" },
  { key: "rubberHoseCumLockCouplingGttMarked", label: "Rubber Hose with Cam-Lock Coupling on both ends & TT No marked on Hose" },
  { key: "sparkArrestorCcoeApproved", label: "CCOE approved Spark Arrester welded in the exhaust pipe" },
  { key: "tremCardAndTrainingCardAvailable", label: "TERM Card and Crew Training Card available" },
  { key: "selfStarterWorking", label: "Self Starter Working" },
  { key: "batteryTerminalRubberCovers", label: "Rubber Cover Provided for Battery Terminal" },
  { key: "noContainerCanExplosivesInCabin", label: "No Container / Can in TT's Cabin" },
  { key: "batteryCutOffSwitchCondition", label: "Condition of Battery Cut off Switch" },
  { key: "handBrakeWorking", label: "Hand Break working" },
  { key: "earthCleatProvided", label: "Earth Cleat Provided" },
  { key: "vmuWorking", label: "VMU Status Switch OFF" },
] as const;
export type SafetyCheckKey = (typeof IN_GATE_SAFETY_ITEMS)[number]["key"];

export const safetyChecklistBase = z.object({
  tlfNo: z.string().trim().max(50).optional(),
  accessMethod: z.string().trim().max(50).optional(),
  drivingLicenseValidCmvRule9: yesNo,
  verifyRegisterColumn1: yesNo.optional(),
  verifyRegisterColumn2: yesNo.optional(),
  ppeAvailable: yesNo,
  rubberHoseCumLockCouplingGttMarked: yesNo,
  sparkArrestorCcoeApproved: yesNo,
  tremCardAndTrainingCardAvailable: yesNo,
  selfStarterWorking: yesNo,
  batteryTerminalRubberCovers: yesNo,
  noContainerCanExplosivesInCabin: yesNo,
  vmuWorking: yesNo,
  truckTyreConditionAcceptable: yesNo.optional(),
  batteryCutOffSwitchCondition: yesNo,
  handBrakeWorking: yesNo,
  earthCleatProvided: yesNo,
  inspectionArea: z.string().trim().max(100).default("-"),
  sealNumber: z.string().trim().max(80).default("-"),
  verifiedBy: z.string().trim().max(100).default("-"),
  verificationNotes: z.string().trim().max(500).default("-"),
  exceptionRemarks: optionalText(500),
}).strict();

export const safetyChecklistSchema = safetyChecklistBase;
export type SafetyChecklistInput = z.input<typeof safetyChecklistSchema>;
export type SafetyChecklistValue = z.output<typeof safetyChecklistSchema>;

const truckNumber = z
  .string()
  .trim()
  .transform((value) => value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())
  .pipe(z.string().min(6, "Enter a valid tank truck number").max(15).regex(/^[A-Z0-9]+$/));

const operationalIdentifier = (min: number, max: number, requiredMessage: string) =>
  z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, "").toUpperCase())
    .pipe(
      z
        .string()
        .min(min, requiredMessage)
        .max(max, `Must be ${max} characters or fewer`)
        .regex(/^[A-Z0-9._\/-]+$/, "Use only letters, numbers, dot, slash, underscore or hyphen"),
    );

export const createGateEntrySchema = z.object({
  crewPassId: z.string().uuid("Scan and verify a valid crew pass"),
  qrScanMethod: qrScanMethodSchema.default("CAMERA"),
  customerDestination: z.string().trim().max(160).default("-"),
  actualTankTruckNumber: truckNumber,
  abs: yesNo,
  challanNumber: z.string().default("-"),
  driverPassNumber: z.string().trim().max(50).default("-"),
  driverAbt: z.boolean().default(false),
  helperName: optionalText(100),
  helperPassNumber: z
    .string()
    .trim()
    .max(50)
    .default("")
    .transform((value) => value.replace(/\s+/g, "").toUpperCase())
    .refine((value) => value === "" || /^[A-Z0-9._\/-]+$/.test(value), "Helper pass number contains unsupported characters"),
  helperAbt: z.boolean().default(false),
  mobileTokenNumber: z.string().trim().max(40).default("-"),
  driverSignatureConfirmed: z.literal(true, { error: "Driver confirmation is required" }),
  remarks: optionalText(500),
  safetyChecklist: safetyChecklistSchema,
}).strict();
export type CreateGateEntryInput = z.input<typeof createGateEntrySchema>;
export type CreateGateEntryValue = z.output<typeof createGateEntrySchema>;

export const editableGateEntrySchema = z.object({
  customerDestination: cleanText(2, 160, "Customer / destination is required").optional(),
  actualTankTruckNumber: truckNumber.optional(),
  abs: yesNo.optional(),
  challanNumber: z.string().optional(),
  driverPassNumber: operationalIdentifier(2, 50, "Driver pass number is required").optional(),
  driverAbt: yesNo.optional(),
  helperName: z.string().trim().max(100).optional(),
  helperPassNumber: z
    .string()
    .trim()
    .max(50)
    .transform((value) => value.replace(/\s+/g, "").toUpperCase())
    .refine((value) => value === "" || /^[A-Z0-9._\/-]+$/.test(value), "Helper pass number contains unsupported characters")
    .optional(),
  helperAbt: yesNo.optional(),
  mobileTokenNumber: operationalIdentifier(3, 40, "Mobile token is required").optional(),
  driverSignatureConfirmed: z.literal(true, { error: "Driver confirmation must remain confirmed" }).optional(),
  remarks: z.string().trim().max(500).optional(),
  safetyChecklist: safetyChecklistBase.partial().strict().optional(),
}).strict();

export const updateGateEntrySchema = editableGateEntrySchema
  .extend({ expectedVersion: z.number().int().positive() })
  .refine((value) => Object.keys(value).some((key) => key !== "expectedVersion"), "Provide at least one field to update");
export type UpdateGateEntryInput = z.infer<typeof updateGateEntrySchema>;

const quantity = z.coerce.number().finite().min(0, "Quantity cannot be negative").max(100_000_000).default(0);

export const invoiceQrResolveSchema = z.object({
  rawInvoiceQr: z.string().trim().min(10, "Scan or enter an invoice QR").max(2_000),
}).strict();
export type InvoiceQrResolveInput = z.infer<typeof invoiceQrResolveSchema>;

export const submitExitSchema = z.object({
  rawInvoiceQr: z.string().trim().min(10).max(2_000),
  expectedVersion: z.number().int().positive(),
  lockNumber: z.string().trim().max(50).optional(),
  qtyMs: quantity,
  qtyXpms: quantity,
  qtyEbms: quantity,
  qtyHsd: quantity,
  qtySko: quantity,
  qtyXg: quantity,
  qtyBioHsd: quantity,
  qtyFo: quantity,
  qtyLdo: quantity,
  warningsAcknowledged: z.boolean().default(false),
}).strict().superRefine((value, ctx) => {
  if (value.qtyMs + value.qtyXpms + value.qtyEbms + value.qtyHsd + value.qtySko + value.qtyXg + value.qtyBioHsd + value.qtyFo + value.qtyLdo <= 0) {
    ctx.addIssue({ code: "custom", path: ["qtyMs"], message: "Enter at least one product quantity" });
  }
});
export type SubmitExitInput = z.infer<typeof submitExitSchema>;

// Separate quantity type without .default(0) for partial updates — prevents silently overwriting existing values with 0
const optionalQuantity = z.coerce.number().finite().min(0, "Quantity cannot be negative").max(100_000_000).optional();

export const updateExitQuantitiesSchema = z.object({
  expectedVersion: z.number().int().positive(),
  lockNumber: z.string().trim().max(50).optional(),
  qtyMs: optionalQuantity,
  qtyXpms: optionalQuantity,
  qtyEbms: optionalQuantity,
  qtyHsd: optionalQuantity,
  qtySko: optionalQuantity,
  qtyXg: optionalQuantity,
  qtyBioHsd: optionalQuantity,
  qtyFo: optionalQuantity,
  qtyLdo: optionalQuantity,
}).strict().refine(
  (value) => [value.qtyMs, value.qtyXpms, value.qtyEbms, value.qtyHsd, value.qtySko, value.qtyXg, value.qtyBioHsd, value.qtyFo, value.qtyLdo, value.lockNumber].some((item) => item !== undefined),
  "Provide at least one quantity or lock number to update",
);
export type UpdateExitQuantitiesInput = z.infer<typeof updateExitQuantitiesSchema>;

export const entryIdSchema = z.string().uuid("Invalid entry identifier");

export const entryFilterSchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: entryStatusSchema.optional(),
  match: z.enum(["all", "matched", "mismatched"]).default("all"),
  date: isoDateSchema.optional(),
  dateFrom: isoDateSchema.optional(),
  dateTo: isoDateSchema.optional(),
  createdBy: z.string().trim().max(32).optional(),
  includeDeleted: queryBooleanSchema.default(false),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict().superRefine((value, ctx) => {
  if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
    ctx.addIssue({ code: "custom", path: ["dateTo"], message: "End date cannot be before start date" });
  }
});
export type EntryFilter = z.infer<typeof entryFilterSchema>;

export const deleteEntrySchema = z.object({
  reason: cleanText(5, 300, "Deletion reason is required"),
}).strict();
export type DeleteEntryInput = z.infer<typeof deleteEntrySchema>;

export const bulkDeleteSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use month format YYYY-MM"),
  reason: cleanText(5, 300, "Deletion reason is required"),
  confirmation: z.literal("DELETE", { error: "Type DELETE to confirm" }),
}).strict();
export type BulkDeleteInput = z.infer<typeof bulkDeleteSchema>;

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/\d/, "Include a number")
  .regex(/[^A-Za-z0-9]/, "Include a special character");

export const createUserSchema = z.object({
  employeeCode: loginSchema.shape.employeeCode,
  name: cleanText(2, 100, "Name is required"),
  role: userRoleSchema,
  password: passwordSchema,
}).strict();
export type CreateUserInput = z.input<typeof createUserSchema>;

export const updateUserSchema = z.object({
  employeeCode: loginSchema.shape.employeeCode.optional(),
  name: cleanText(2, 100, "Name is required").optional(),
  role: userRoleSchema.optional(),
  isActive: z.boolean().optional(),
  unlock: z.boolean().optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Provide at least one user change");
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({ password: passwordSchema }).strict();
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const userListFilterSchema = z.object({
  search: z.string().trim().max(100).optional(),
  role: userRoleSchema.optional(),
  active: z.enum(["all", "active", "disabled"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
}).strict();
export type UserListFilter = z.infer<typeof userListFilterSchema>;

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
  meta?: { requestId?: string };
}

export interface ApiFailure {
  success: false;
  error: { code: string; message: string; fieldErrors?: Record<string, string[]>; requestId?: string };
}
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface SafetyChecklistRecord {
  id?: string;
  gateEntryId?: string;
  checklistVersion: number;
  drivingLicenseValidCmvRule9: boolean | null;
  verifyRegisterColumn1?: boolean | null | undefined;
  verifyRegisterColumn2?: boolean | null | undefined;
  ppeAvailable: boolean | null;
  rubberHoseCumLockCouplingGttMarked: boolean | null;
  sparkArrestorCcoeApproved: boolean | null;
  tremCardAndTrainingCardAvailable: boolean | null;
  selfStarterWorking: boolean | null;
  batteryTerminalRubberCovers: boolean | null;
  noContainerCanExplosivesInCabin: boolean | null;
  vmuWorking: boolean | null;
  truckTyreConditionAcceptable?: boolean | null | undefined;
  batteryCutOffSwitchCondition: boolean | null;
  handBrakeWorking: boolean | null;
  earthCleatProvided: boolean | null;
  tlfNo?: string | null | undefined;
  accessMethod?: string | null | undefined;
  inspectionArea?: string | null | undefined;
  sealNumber?: string | null | undefined;
  verifiedBy?: string | null | undefined;
  verificationNotes?: string | null | undefined;
  exceptionRemarks: string;
}

export interface GateEntryRecord {
  id: string;
  recordVersion: number;
  facilityCode: string;
  gateCode: string;
  serialNumber: number;
  displaySerial: string;
  businessDate: string;
  entryDate: string;
  timeIn: string;
  timeOut: string | null;
  status: EntryStatus;
  qrScanMethod: QrScanMethod;
  crewId: string;
  driverName: string;
  crewType: CrewType;
  passValidUntil: string;
  ttNumberOnPass: string;
  drivingLicenseNumber: string;
  drivingLicenseExpiryDate: string;
  customerDestination: string;
  actualTankTruckNumber: string;
  abs: boolean;
  challanNumber: string;
  driverPassNumber: string;
  driverAbt: boolean;
  helperName: string | null;
  helperPassNumber: string | null;
  helperAbt: boolean;
  mobileTokenNumber: string;
  driverSignatureConfirmed: boolean;
  remarks: string | null;
  ttNumberMatch: boolean;
  qtyMs: string | null;
  qtyXpms: string | null;
  qtyEbms: string | null;
  qtyHsd: string | null;
  qtySko: string | null;
  qtyXg: string | null;
  qtyBioHsd: string | null;
  qtyFo: string | null;
  qtyLdo: string | null;
  lockNumber: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  invoiceValue: string | null;
  invoiceVehicle: string | null;
  invoiceConsignee: string | null;
  invoiceProductsRaw: string | null;
  isDeleted: boolean;
  deletedAt: string | null;
  deleteReason: string | null;
  safetyChecklist: SafetyChecklistRecord;
  createdBy: { id: string; employeeCode: string; name: string };
  exitCreatedBy: { id: string; employeeCode: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ExitInvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  invoiceValue: string | null;
  vehicleNumber: string;
  productQuantityRaw: string;
  parsedQuantities: Record<string, number>;
  consignee: string;
  rawInvoiceQr: string;
}

export interface ExitResolveResult {
  invoice: ExitInvoiceData;
  entry: GateEntryRecord;
  warnings: string[];
}

export interface QuantitySummary {
  ms: string;
  xpms: string;
  ebms: string;
  hsd: string;
  sko: string;
  xg: string;
  bioHsd: string;
  fo: string;
  ldo: string;
  petrol: string;
  diesel: string;
  other: string;
}

export interface DashboardSummary {
  facilityCode: string;
  gateCode: string;
  businessDate: string;
  total: number;
  open: number;
  exited: number;
  mismatches: number;
  safetyExceptions: number;
  quantities: QuantitySummary;
  recent: Array<Pick<GateEntryRecord, "id" | "serialNumber" | "displaySerial" | "businessDate" | "actualTankTruckNumber" | "driverName" | "customerDestination" | "ttNumberMatch" | "status" | "timeIn">>;
}

export interface UserRecord {
  id: string;
  employeeCode: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogRecord {
  id: string;
  entityType: string;
  entityId: string | null;
  action: string;
  actorRole: UserRole;
  changedFields: string[] | null;
  beforeData: unknown;
  afterData: unknown;
  createdAt: string;
  actor: { employeeCode: string; name: string; role: UserRole };
}

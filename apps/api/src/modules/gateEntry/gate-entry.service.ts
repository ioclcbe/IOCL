import crypto from "node:crypto";
import {
  AuditAction,
  CrewType,
  EntryStatus,
  Prisma,
  QrScanMethod,
  UserRole,
  type UserRole as PrismaUserRole,
} from "@prisma/client";
import {
  IN_GATE_SAFETY_ITEMS,
  safetyChecklistSchema,
  type BulkDeleteInput,
  type CreateGateEntryValue,
  type DeleteEntryInput,
  type EntryFilter,
  type SubmitExitInput,
  type UpdateExitQuantitiesInput,
  type UpdateGateEntryInput,
} from "@iocl/shared";
import { env } from "../../config/env.js";
import { ApiError } from "../../lib/api-error.js";
import { formatDisplaySerial, getBusinessDate, monthDateRange, parseIsoBusinessDate } from "../../lib/date.js";
import { prisma } from "../../lib/prisma.js";
import { parseInvoiceQr, parseProductQuantities } from "../exitGate/invoice-qr-parser.js";

const includeEntry = {
  safetyChecklist: true,
  createdBy: { select: { id: true, employeeCode: true, name: true } },
  exitCreatedBy: { select: { id: true, employeeCode: true, name: true } },
} satisfies Prisma.GateEntryInclude;

type Actor = { userId: string; role: PrismaUserRole; employeeCode?: string };
type RequestMeta = { ip?: string; userAgent?: string; requestId: string };

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function normalizeTruck(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function isPastDate(val: string | null | undefined): boolean {
  if (!val) return false;
  const d = new Date(val);
  if (isNaN(d.getTime())) return false; // Non-parseable, so skip expiry warning
  return d < getBusinessDate();
}

function decimalString(value: Prisma.Decimal | number | string | null | undefined) {
  return value == null ? null : String(value);
}

function serializeEntry<T extends Record<string, any>>(entry: T) {
  const safetyChecklist = entry.safetyChecklist
    ? { ...entry.safetyChecklist, exceptionRemarks: entry.safetyChecklist.exceptionRemarks ?? "" }
    : {
        checklistVersion: 0,
        ...Object.fromEntries(IN_GATE_SAFETY_ITEMS.map(({ key }) => [key, null])),
        inspectionArea: "Not captured",
        sealNumber: "Not captured",
        verifiedBy: "Not captured",
        verificationNotes: "Legacy record without a captured safety checklist",
        exceptionRemarks: "",
      };
  return {
    ...entry,
    qtyMs: decimalString(entry.qtyMs),
    qtyXpms: decimalString(entry.qtyXpms),
    qtyEbms: decimalString(entry.qtyEbms),
    qtyHsd: decimalString(entry.qtyHsd),
    qtySko: decimalString(entry.qtySko),
    qtyXg: decimalString(entry.qtyXg),
    qtyBioHsd: decimalString(entry.qtyBioHsd),
    qtyFo: decimalString(entry.qtyFo),
    qtyLdo: decimalString(entry.qtyLdo),
    invoiceValue: decimalString(entry.invoiceValue),
    safetyChecklist,
    displaySerial: formatDisplaySerial(entry.businessDate, entry.serialNumber),
  };
}

function dateWhere(filter: EntryFilter, actor: Actor): Prisma.GateEntryWhereInput {
  if (actor.role === UserRole.ENTRY_GATE_SECURITY || actor.role === UserRole.EXIT_GATE_SECURITY) {
    return { businessDate: getBusinessDate() };
  }
  if (filter.date) return { businessDate: parseIsoBusinessDate(filter.date) };
  if (filter.dateFrom || filter.dateTo) {
    return {
      businessDate: {
        ...(filter.dateFrom ? { gte: parseIsoBusinessDate(filter.dateFrom) } : {}),
        ...(filter.dateTo ? { lte: parseIsoBusinessDate(filter.dateTo) } : {}),
      },
    };
  }
  return {};
}

function roleVisibility(actor: Actor, filter: EntryFilter): Prisma.GateEntryWhereInput | undefined {
  if (actor.role === UserRole.ENTRY_GATE_SECURITY) {
    return { createdById: actor.userId };
  }
  if (actor.role === UserRole.EXIT_GATE_SECURITY) {
    if (filter.status === EntryStatus.OUT) return { exitCreatedById: actor.userId };
    if (filter.status === EntryStatus.IN) return undefined;
    return { OR: [{ status: EntryStatus.IN }, { status: EntryStatus.OUT, exitCreatedById: actor.userId }] };
  }
  return undefined;
}

function buildWhere(filter: EntryFilter, actor: Actor): Prisma.GateEntryWhereInput {
  const and: Prisma.GateEntryWhereInput[] = [dateWhere(filter, actor)];
  if (!(filter.includeDeleted && actor.role === UserRole.ADMIN)) and.push({ isDeleted: false });
  if (filter.status) and.push({ status: filter.status });
  if (filter.match === "matched") and.push({ ttNumberMatch: true });
  if (filter.match === "mismatched") and.push({ ttNumberMatch: false });
  if (filter.createdBy && (actor.role === UserRole.ADMIN || actor.role === UserRole.SUPERVISOR)) {
    and.push({ createdBy: { employeeCode: { equals: filter.createdBy, mode: "insensitive" } } });
  }
  const visibility = roleVisibility(actor, filter);
  if (visibility) and.push(visibility);
  if (filter.search?.trim()) {
    const search = filter.search.trim();
    and.push({
      OR: [
        { actualTankTruckNumber: { contains: search, mode: "insensitive" } },
        { ttNumberOnPass: { contains: search, mode: "insensitive" } },
        { driverName: { contains: search, mode: "insensitive" } },
        { crewId: { contains: search, mode: "insensitive" } },
        { mobileTokenNumber: { contains: search, mode: "insensitive" } },
        { customerDestination: { contains: search, mode: "insensitive" } },
        { challanNumber: { contains: search, mode: "insensitive" } },
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { invoiceConsignee: { contains: search, mode: "insensitive" } },
      ],
    });
  }
  return { AND: and };
}

function assertHelperData(crewType: CrewType, helperName?: string | null, helperPassNumber?: string | null) {
  if (crewType === CrewType.DRIVER_WITH_HELPER && (!helperName?.trim() || !helperPassNumber?.trim())) {
    throw new ApiError(422, "HELPER_DETAILS_REQUIRED", "Helper name and helper pass number are required for this crew pass");
  }
}

function auditSnapshot(entry: Record<string, unknown>) {
  const allowed = [
    "id", "recordVersion", "serialNumber", "businessDate", "timeIn", "timeOut", "status", "crewId",
    "driverName", "ttNumberOnPass", "customerDestination", "actualTankTruckNumber", "abs", "challanNumber",
    "driverPassNumber", "driverAbt", "helperName", "helperPassNumber", "helperAbt", "mobileTokenNumber",
    "driverSignatureConfirmed", "remarks", "ttNumberMatch", "qtyMs", "qtyXpms", "qtyEbms", "qtyHsd",
    "qtySko", "qtyXg", "qtyBioHsd", "qtyFo", "qtyLdo", "lockNumber",
    "invoiceNumber", "invoiceDate", "invoiceValue", "invoiceVehicle", "invoiceConsignee", "invoiceProductsRaw",
    "isDeleted", "deletedAt", "deleteReason", "safetyChecklist",
  ];
  return Object.fromEntries(allowed.filter((key) => key in entry).map((key) => [key, entry[key]]));
}

function changedFields(before: Record<string, unknown>, after: Record<string, unknown>) {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

async function serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5_000,
        timeout: 15_000,
      });
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034";
      if (!retryable || attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 50));
    }
  }
  throw new Error("Unreachable transaction retry state");
}

function assertCanRead(entry: { businessDate: Date; createdById: string; exitCreatedById: string | null; status: EntryStatus; isDeleted: boolean }, actor: Actor) {
  if (actor.role === UserRole.ADMIN || actor.role === UserRole.SUPERVISOR) return;
  if (entry.isDeleted) throw new ApiError(404, "ENTRY_NOT_FOUND", "Gate entry was not found");
  if (entry.businessDate.getTime() !== getBusinessDate().getTime()) {
    throw new ApiError(403, "HISTORY_NOT_ALLOWED", "Security users can access only today's records");
  }
  if (actor.role === UserRole.ENTRY_GATE_SECURITY && entry.status === EntryStatus.IN && entry.createdById !== actor.userId) {
    throw new ApiError(403, "FORBIDDEN", "You can edit only your own open IN entries");
  }
  if (actor.role === UserRole.EXIT_GATE_SECURITY && entry.status === EntryStatus.OUT && entry.exitCreatedById !== actor.userId) {
    throw new ApiError(403, "FORBIDDEN", "You can access only your own completed OUT entries");
  }
}

export async function createEntry(input: CreateGateEntryValue, actor: Actor, meta: RequestMeta) {
  const businessDate = getBusinessDate();
  const actualTruck = normalizeTruck(input.actualTankTruckNumber);
  // If no real token was provided (field removed from UI), generate a unique placeholder
  // so the DB unique index never conflicts between entries on the same day
  const rawToken = input.mobileTokenNumber?.replace(/\s+/g, "").toUpperCase() ?? "-";
  const mobileTokenNumber = rawToken === "-" || rawToken === "" ? `NTKN-${crypto.randomBytes(6).toString("hex").toUpperCase()}` : rawToken;

  if (env.NODE_ENV === "production" && input.qrScanMethod === QrScanMethod.DEMO) {
    throw new ApiError(422, "DEMO_SCAN_DISABLED", "Demo QR scans are disabled in production");
  }

  return serializable(async (tx) => {
    const [pass, actorUser] = await Promise.all([
      tx.crewPass.findUnique({ where: { id: input.crewPassId } }),
      tx.user.findUnique({ where: { id: actor.userId }, select: { name: true } }),
    ]);
    if (!pass || !pass.isActive) throw new ApiError(404, "PASS_NOT_FOUND", "Crew pass is invalid or inactive");
    if (!actorUser) throw new ApiError(401, "AUTH_REQUIRED", "Authenticated user was not found");
    // For manual entries the operator has already accepted the warning — don't hard-block on expiry
    if (pass.sourceSystem !== "MANUAL_ENTRY") {
      if (isPastDate(pass.passValidUntil)) throw new ApiError(422, "PASS_EXPIRED", "Crew pass has expired");
      if (isPastDate(pass.drivingLicenseExpiryDate)) throw new ApiError(422, "LICENCE_EXPIRED", "Driving licence has expired");
    }

    assertHelperData(pass.crewType, input.helperName, input.helperPassNumber);

    const [openEntry, openCrewEntry, tokenUsed] = await Promise.all([
      tx.gateEntry.findFirst({
        where: { actualTankTruckNumber: actualTruck, status: EntryStatus.IN, isDeleted: false, businessDate },
        select: { serialNumber: true, businessDate: true },
      }),
      tx.gateEntry.findFirst({
        // Block re-entry ONLY if currently IN and from today. If they entered yesterday and didn't exit, allow a new entry today.
        where: { crewPassId: pass.id, isDeleted: false, status: EntryStatus.IN, businessDate },
        select: { serialNumber: true, businessDate: true, status: true },
      }),
      Promise.resolve(null),
    ]);
    if (openEntry) {
      throw new ApiError(409, "TRUCK_ALREADY_IN", `Truck already entered under ${formatDisplaySerial(openEntry.businessDate, openEntry.serialNumber)}`);
    }
    if (openCrewEntry) {
      throw new ApiError(409, "CREW_ALREADY_IN", `This crew is already inside under ${formatDisplaySerial(openCrewEntry.businessDate, openCrewEntry.serialNumber)}`);
    }
    // tokenUsed check removed — real tokens are enforced by DB unique index; placeholder tokens are unique per entry.

    const counter = await tx.dailyCounter.upsert({
      where: { businessDate },
      create: { businessDate, lastSerial: 1 },
      update: { lastSerial: { increment: 1 } },
    });

    const calculatedMatch = normalizeTruck(pass.ttNumberOnPass) === actualTruck;

    const entry = await tx.gateEntry.create({
      data: {
        recordVersion: 1,
        facilityCode: env.FACILITY_CODE,
        gateCode: env.GATE_CODE,
        serialNumber: counter.lastSerial,
        businessDate,
        qrScanMethod: input.qrScanMethod,
        crewPassId: pass.id,
        crewId: pass.crewId,
        driverName: pass.driverName,
        crewType: pass.crewType,
        passValidUntil: pass.passValidUntil,
        ttNumberOnPass: normalizeTruck(pass.ttNumberOnPass),
        drivingLicenseNumber: pass.drivingLicenseNumber,
        drivingLicenseExpiryDate: pass.drivingLicenseExpiryDate,
        customerDestination: input.customerDestination.trim(),
        actualTankTruckNumber: actualTruck,
        abs: input.abs,
        challanNumber: input.challanNumber,
        driverPassNumber: input.driverPassNumber,
        driverAbt: input.driverAbt,
        helperName: input.helperName.trim() || null,
        helperPassNumber: input.helperPassNumber.trim() || null,
        helperAbt: input.helperAbt,
        mobileTokenNumber,
        driverSignatureConfirmed: input.driverSignatureConfirmed,
        remarks: input.remarks.trim() || null,
        ttNumberMatch: calculatedMatch,
        createdById: actor.userId,
        safetyChecklist: {
          create: {
            checklistVersion: 2,
            ...input.safetyChecklist,
            verifiedBy: actorUser.name,
            exceptionRemarks: input.safetyChecklist.exceptionRemarks.trim() || null,
          },
        },
      },
      include: includeEntry,
    });

    const snapshot = auditSnapshot(entry as unknown as Record<string, unknown>);
    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        actorRole: actor.role,
        entityType: "GATE_ENTRY",
        entityId: entry.id,
        action: AuditAction.CREATE,
        changedFields: Object.keys(snapshot),
        afterData: jsonValue(snapshot),
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      },
    });
    return serializeEntry(entry);
  });
}

export async function listEntries(filter: EntryFilter, actor: Actor) {
  const where = buildWhere(filter, actor);
  const [items, total] = await prisma.$transaction([
    prisma.gateEntry.findMany({
      where,
      include: includeEntry,
      orderBy: [{ timeIn: "desc" }],
      skip: (filter.page - 1) * filter.pageSize,
      take: filter.pageSize,
    }),
    prisma.gateEntry.count({ where }),
  ]);
  return { items: items.map(serializeEntry), page: filter.page, pageSize: filter.pageSize, total, totalPages: Math.max(1, Math.ceil(total / filter.pageSize)) };
}

export async function listForExport(filter: EntryFilter, actor: Actor) {
  const where = buildWhere({ ...filter, page: 1, pageSize: 100 }, actor);
  const total = await prisma.gateEntry.count({ where });
  if (total > 10_000) throw new ApiError(422, "EXPORT_LIMIT_EXCEEDED", "Refine the date range before exporting more than 10,000 records");
  const items = await prisma.gateEntry.findMany({ where, include: includeEntry, orderBy: [{ businessDate: "asc" }, { serialNumber: "asc" }], take: 10_000 });
  return items.map(serializeEntry);
}

export async function getEntry(id: string, actor: Actor) {
  const entry = await prisma.gateEntry.findUnique({ where: { id }, include: includeEntry });
  if (!entry) throw new ApiError(404, "ENTRY_NOT_FOUND", "Gate entry was not found");
  assertCanRead(entry, actor);
  return serializeEntry(entry);
}

export async function updateEntry(id: string, input: UpdateGateEntryInput, actor: Actor, meta: RequestMeta) {
  return serializable(async (tx) => {
    const before = await tx.gateEntry.findUnique({ where: { id }, include: includeEntry });
    if (!before || before.isDeleted) throw new ApiError(404, "ENTRY_NOT_FOUND", "Gate entry was not found");
    const adminCorrection = actor.role === UserRole.ADMIN;
    if (before.status !== EntryStatus.IN && !adminCorrection && actor.role !== UserRole.EXIT_GATE_SECURITY) {
      throw new ApiError(409, "ENTRY_LOCKED", "Operational IN data is locked after exit; only an administrator can make an audited correction");
    }
    if (actor.role === UserRole.ENTRY_GATE_SECURITY && (before.createdById !== actor.userId || before.businessDate.getTime() !== getBusinessDate().getTime())) {
      throw new ApiError(403, "FORBIDDEN", "You can edit only your own open IN entries from today");
    }
    if (actor.role === UserRole.EXIT_GATE_SECURITY) {
      // EXIT_GATE_SECURITY must NEVER be able to edit IN records
      if (before.status === EntryStatus.IN) {
        throw new ApiError(403, "FORBIDDEN", "Exit Gate Security cannot edit IN records. Only Entry Gate Security or Supervisors may do this.");
      }
      if (before.exitCreatedById !== actor.userId || before.businessDate.getTime() !== getBusinessDate().getTime()) {
        throw new ApiError(403, "FORBIDDEN", "You can edit only your own OUT entries from today");
      }
    }
    if (before.recordVersion !== input.expectedVersion) throw new ApiError(409, "VERSION_CONFLICT", "This record changed on another device. Reload and try again.");
    if (!before.safetyChecklist) throw new ApiError(500, "CHECKLIST_MISSING", "The safety checklist is missing from this record");

    const { safetyChecklist, expectedVersion, ...manual } = input;
    const nextHelperName = manual.helperName !== undefined ? manual.helperName : before.helperName;
    const nextHelperPass = manual.helperPassNumber !== undefined ? manual.helperPassNumber : before.helperPassNumber;
    assertHelperData(before.crewType, nextHelperName, nextHelperPass);

    const nextTruck = manual.actualTankTruckNumber !== undefined ? normalizeTruck(manual.actualTankTruckNumber) : before.actualTankTruckNumber;
    const nextRemarks = manual.remarks !== undefined ? manual.remarks.trim() : before.remarks ?? "";

    let mergedSafety: ReturnType<typeof safetyChecklistSchema.parse> | undefined;
    if (safetyChecklist) {
      const existing = before.safetyChecklist;
      const values = Object.fromEntries(IN_GATE_SAFETY_ITEMS.map(({ key }) => [key, existing[key]]));
      mergedSafety = safetyChecklistSchema.parse({
        ...values,
        inspectionArea: existing.inspectionArea,
        sealNumber: existing.sealNumber,
        verifiedBy: existing.verifiedBy,
        verificationNotes: existing.verificationNotes,
        exceptionRemarks: existing.exceptionRemarks ?? "",
        ...safetyChecklist,
      });
    }

    const data: Prisma.GateEntryUpdateInput = { recordVersion: { increment: 1 }, updatedBy: { connect: { id: actor.userId } } };
    if (manual.customerDestination !== undefined) data.customerDestination = manual.customerDestination.trim();
    if (manual.actualTankTruckNumber !== undefined) {
      data.actualTankTruckNumber = nextTruck;
      data.ttNumberMatch = normalizeTruck(before.ttNumberOnPass) === nextTruck;
    }
    if (manual.abs !== undefined) data.abs = manual.abs;
    if (manual.challanNumber !== undefined) data.challanNumber = manual.challanNumber;
    if (manual.driverPassNumber !== undefined) data.driverPassNumber = manual.driverPassNumber;
    if (manual.driverAbt !== undefined) data.driverAbt = manual.driverAbt;
    if (manual.helperName !== undefined) data.helperName = manual.helperName.trim() || null;
    if (manual.helperPassNumber !== undefined) data.helperPassNumber = manual.helperPassNumber.trim() || null;
    if (manual.helperAbt !== undefined) data.helperAbt = manual.helperAbt;
    if (manual.mobileTokenNumber !== undefined) data.mobileTokenNumber = manual.mobileTokenNumber.replace(/\s+/g, "").toUpperCase();
    if (manual.driverSignatureConfirmed !== undefined) data.driverSignatureConfirmed = manual.driverSignatureConfirmed;
    if (manual.remarks !== undefined) data.remarks = manual.remarks.trim() || null;
    if (mergedSafety) {
      data.safetyChecklist = {
        update: {
          checklistVersion: 2,
          ...mergedSafety,
          exceptionRemarks: mergedSafety.exceptionRemarks.trim() || null,
        },
      };
    }

    const entry = await tx.gateEntry.update({ where: { id_recordVersion: { id, recordVersion: expectedVersion } }, data, include: includeEntry });
    const beforeAudit = auditSnapshot(before as unknown as Record<string, unknown>);
    const afterAudit = auditSnapshot(entry as unknown as Record<string, unknown>);
    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        actorRole: actor.role,
        entityType: "GATE_ENTRY",
        entityId: id,
        action: AuditAction.UPDATE,
        changedFields: changedFields(beforeAudit, afterAudit),
        beforeData: jsonValue(beforeAudit),
        afterData: jsonValue(afterAudit),
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      },
    });
    return serializeEntry(entry);
  });
}

export async function resolveInvoice(rawInvoiceQr: string) {
  const invoice = parseInvoiceQr(rawInvoiceQr);

  // Find today's open entry for this truck first
  const entry = await prisma.gateEntry.findFirst({
    where: { businessDate: getBusinessDate(), actualTankTruckNumber: invoice.vehicleNumber, status: EntryStatus.IN, isDeleted: false },
    include: includeEntry,
    orderBy: { timeIn: "desc" },
  });
  if (!entry) throw new ApiError(404, "NO_DATA_FOUND", "No open IN record was found today for the invoice vehicle");

  // Block only if invoice is already used TODAY on a DIFFERENT entry (not this truck's open entry)
  // Scoped to today's businessDate — same invoice on a previous day is a different dispatch and must be allowed
  const duplicate = await prisma.gateEntry.findFirst({
    where: { invoiceNumber: invoice.invoiceNumber, businessDate: getBusinessDate(), id: { not: entry.id }, isDeleted: false },
    select: { id: true },
  });
  if (duplicate) throw new ApiError(409, "DUPLICATE_INVOICE", "This invoice number has already been submitted today on a different entry");

  const warnings: string[] = [];
  const today = getBusinessDate();
  if (isPastDate(entry.passValidUntil)) warnings.push("Crew pass is expired");
  if (isPastDate(entry.drivingLicenseExpiryDate)) warnings.push("Driving licence is expired");
  if (!entry.ttNumberMatch) warnings.push("TT number on pass did not match the physical lorry at entry");
  const failed = entry.safetyChecklist ? IN_GATE_SAFETY_ITEMS.filter(({ key }) => entry.safetyChecklist?.[key] === false) : [];
  if (failed.length > 0) warnings.push(`${failed.length} safety checklist item(s) were marked No`);

  return {
    invoice: {
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDateIso,
      invoiceValue: invoice.invoiceValue,
      vehicleNumber: invoice.vehicleNumber,
      productQuantityRaw: invoice.productQuantityRaw,
      parsedQuantities: parseProductQuantities(invoice.productQuantityRaw),
      consignee: invoice.consignee,
      rawInvoiceQr: invoice.normalizedRawPayload,
    },
    entry: serializeEntry(entry),
    warnings,
  };
}

export async function submitExit(id: string, input: SubmitExitInput, actor: Actor, meta: RequestMeta) {
  const invoice = parseInvoiceQr(input.rawInvoiceQr);
  return serializable(async (tx) => {
    const before = await tx.gateEntry.findUnique({ where: { id }, include: includeEntry });
    if (!before || before.isDeleted) throw new ApiError(404, "ENTRY_NOT_FOUND", "Gate entry was not found");
    if (actor.role === UserRole.EXIT_GATE_SECURITY && before.businessDate.getTime() !== getBusinessDate().getTime()) {
      throw new ApiError(403, "HISTORY_NOT_ALLOWED", "Exit security can complete only today's open IN records");
    }
    if (before.status !== EntryStatus.IN) throw new ApiError(409, "ENTRY_NOT_OPEN", "Only an open IN entry can be marked OUT");
    if (before.recordVersion !== input.expectedVersion) throw new ApiError(409, "VERSION_CONFLICT", "This record changed on another device. Reload and scan again.");
    if (normalizeTruck(before.actualTankTruckNumber) !== invoice.vehicleNumber) {
      throw new ApiError(422, "INVOICE_VEHICLE_MISMATCH", "Invoice vehicle does not match the open physical tank truck number");
    }
    // Only block if this invoice number is used TODAY on a DIFFERENT entry (not the one we are currently exiting)
    // Scoped to today's businessDate — same invoice on a previous day is a different dispatch and must be allowed
    const duplicate = await tx.gateEntry.findFirst({ where: { invoiceNumber: invoice.invoiceNumber, businessDate: getBusinessDate(), id: { not: id }, isDeleted: false }, select: { id: true } });
    if (duplicate) throw new ApiError(409, "DUPLICATE_INVOICE", "This invoice number has already been submitted today on a different entry");

    const today = getBusinessDate();
    const hasExpiryWarning = isPastDate(before.passValidUntil) || isPastDate(before.drivingLicenseExpiryDate);
    if (hasExpiryWarning && !input.warningsAcknowledged) {
      throw new ApiError(422, "WARNINGS_ACK_REQUIRED", "Acknowledge the expired pass/licence warning before confirming exit");
    }

    const entry = await tx.gateEntry.update({
      where: { id_recordVersion: { id, recordVersion: input.expectedVersion } },
      data: {
        status: EntryStatus.OUT,
        timeOut: new Date(),
        recordVersion: { increment: 1 },
        qtyMs: new Prisma.Decimal(input.qtyMs),
        qtyXpms: new Prisma.Decimal(input.qtyXpms),
        qtyEbms: new Prisma.Decimal(input.qtyEbms),
        qtyHsd: new Prisma.Decimal(input.qtyHsd),
        qtySko: new Prisma.Decimal(input.qtySko),
        qtyXg: new Prisma.Decimal(input.qtyXg),
        qtyBioHsd: new Prisma.Decimal(input.qtyBioHsd),
        qtyFo: new Prisma.Decimal(input.qtyFo),
        qtyLdo: new Prisma.Decimal(input.qtyLdo),
        lockNumber: input.lockNumber?.trim() || null,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        invoiceValue: invoice.invoiceValue ? new Prisma.Decimal(invoice.invoiceValue) : null,
        invoiceVehicle: invoice.vehicleNumber,
        invoiceConsignee: invoice.consignee,
        invoiceProductsRaw: invoice.productQuantityRaw,
        exitCreatedById: actor.userId,
        updatedById: actor.userId,
      },
      include: includeEntry,
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        actorRole: actor.role,
        entityType: "GATE_ENTRY",
        entityId: id,
        action: AuditAction.EXIT,
        changedFields: ["status", "timeOut", "invoiceNumber", "invoiceDate", "invoiceVehicle", "invoiceConsignee", "invoiceProductsRaw", "qtyMs", "qtyXpms", "qtyEbms", "qtyHsd", "qtySko", "qtyXg", "qtyBioHsd", "qtyFo", "qtyLdo", "lockNumber"],
        beforeData: jsonValue(auditSnapshot(before as unknown as Record<string, unknown>)),
        afterData: jsonValue(auditSnapshot(entry as unknown as Record<string, unknown>)),
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      },
    });
    return serializeEntry(entry);
  });
}

export async function updateExitQuantities(id: string, input: UpdateExitQuantitiesInput, actor: Actor, meta: RequestMeta) {
  return serializable(async (tx) => {
    const before = await tx.gateEntry.findUnique({ where: { id }, include: includeEntry });
    if (!before || before.isDeleted) throw new ApiError(404, "ENTRY_NOT_FOUND", "Gate entry was not found");
    if (actor.role === UserRole.EXIT_GATE_SECURITY) {
      if (before.exitCreatedById !== actor.userId || before.businessDate.getTime() !== getBusinessDate().getTime()) {
        throw new ApiError(403, "FORBIDDEN", "Exit security can only edit OUT quantities for vehicles they processed today. Contact an administrator.");
      }
    }
    if (before.status !== EntryStatus.OUT) throw new ApiError(409, "EXIT_NOT_COMPLETED", "Only completed OUT entries can have exit quantities corrected");
    if (actor.role === UserRole.ENTRY_GATE_SECURITY) throw new ApiError(403, "FORBIDDEN", "Entry security cannot edit OUT quantities");
    if (before.recordVersion !== input.expectedVersion) throw new ApiError(409, "VERSION_CONFLICT", "This record changed on another device. Reload and try again.");

    const data: Prisma.GateEntryUpdateInput = { recordVersion: { increment: 1 }, updatedBy: { connect: { id: actor.userId } } };
    if (input.qtyMs !== undefined) data.qtyMs = new Prisma.Decimal(input.qtyMs);
    if (input.qtyXpms !== undefined) data.qtyXpms = new Prisma.Decimal(input.qtyXpms);
    if (input.qtyEbms !== undefined) data.qtyEbms = new Prisma.Decimal(input.qtyEbms);
    if (input.qtyHsd !== undefined) data.qtyHsd = new Prisma.Decimal(input.qtyHsd);
    if (input.qtySko !== undefined) data.qtySko = new Prisma.Decimal(input.qtySko);
    if (input.qtyXg !== undefined) data.qtyXg = new Prisma.Decimal(input.qtyXg);
    if (input.qtyBioHsd !== undefined) data.qtyBioHsd = new Prisma.Decimal(input.qtyBioHsd);
    if (input.qtyFo !== undefined) data.qtyFo = new Prisma.Decimal(input.qtyFo);
    if (input.qtyLdo !== undefined) data.qtyLdo = new Prisma.Decimal(input.qtyLdo);
    if (input.lockNumber !== undefined) data.lockNumber = input.lockNumber?.trim() || null;
    if (input.invoiceConsignee !== undefined) data.invoiceConsignee = input.invoiceConsignee?.trim() || null;

    const entry = await tx.gateEntry.update({ where: { id_recordVersion: { id, recordVersion: input.expectedVersion } }, data, include: includeEntry });
    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        actorRole: actor.role,
        entityType: "GATE_ENTRY",
        entityId: id,
        action: AuditAction.EXIT_UPDATE,
        changedFields: ["qtyMs", "qtyXpms", "qtyEbms", "qtyHsd", "qtySko", "qtyXg", "qtyBioHsd", "qtyFo", "qtyLdo", "lockNumber", "recordVersion"],
        beforeData: jsonValue(auditSnapshot(before as unknown as Record<string, unknown>)),
        afterData: jsonValue(auditSnapshot(entry as unknown as Record<string, unknown>)),
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      },
    });
    return serializeEntry(entry);
  });
}

export async function softDeleteEntry(id: string, input: DeleteEntryInput, actor: Actor, meta: RequestMeta) {
  if (actor.role !== UserRole.ADMIN) throw new ApiError(403, "FORBIDDEN", "Only an administrator can delete records");
  return serializable(async (tx) => {
    const before = await tx.gateEntry.findUnique({ where: { id }, include: includeEntry });
    if (!before || before.isDeleted) throw new ApiError(404, "ENTRY_NOT_FOUND", "Gate entry was not found");
    const entry = await tx.gateEntry.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
        deletedById: actor.userId,
        deleteReason: input.reason,
        recordVersion: { increment: 1 },
        updatedById: actor.userId,
      },
      include: includeEntry,
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        actorRole: actor.role,
        entityType: "GATE_ENTRY",
        entityId: id,
        action: AuditAction.DELETE,
        changedFields: ["isDeleted", "deletedAt", "deletedById", "deleteReason"],
        beforeData: jsonValue(auditSnapshot(before as unknown as Record<string, unknown>)),
        afterData: jsonValue(auditSnapshot(entry as unknown as Record<string, unknown>)),
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      },
    });
    return serializeEntry(entry);
  });
}

export async function restoreEntry(id: string, actor: Actor, meta: RequestMeta) {
  if (actor.role !== UserRole.ADMIN) throw new ApiError(403, "FORBIDDEN", "Only an administrator can restore records");
  return serializable(async (tx) => {
    const before = await tx.gateEntry.findUnique({ where: { id }, include: includeEntry });
    if (!before) throw new ApiError(404, "ENTRY_NOT_FOUND", "Gate entry was not found");
    if (!before.isDeleted) throw new ApiError(409, "ENTRY_NOT_DELETED", "This gate entry is already active");

    const entry = await tx.gateEntry.update({
      where: { id_recordVersion: { id, recordVersion: before.recordVersion } },
      data: {
        isDeleted: false,
        deletedAt: null,
        deletedById: null,
        deleteReason: null,
        recordVersion: { increment: 1 },
        updatedById: actor.userId,
      },
      include: includeEntry,
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        actorRole: actor.role,
        entityType: "GATE_ENTRY",
        entityId: id,
        action: AuditAction.RESTORE,
        changedFields: ["isDeleted", "deletedAt", "deletedById", "deleteReason", "recordVersion"],
        beforeData: jsonValue(auditSnapshot(before as unknown as Record<string, unknown>)),
        afterData: jsonValue(auditSnapshot(entry as unknown as Record<string, unknown>)),
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      },
    });
    return serializeEntry(entry);
  });
}

export async function bulkSoftDelete(input: BulkDeleteInput, actor: Actor, meta: RequestMeta) {
  if (actor.role !== UserRole.ADMIN) throw new ApiError(403, "FORBIDDEN", "Only an administrator can bulk delete records");
  const { start, end } = monthDateRange(input.month);
  return serializable(async (tx) => {
    const ids = await tx.gateEntry.findMany({
      where: { businessDate: { gte: start, lt: end }, isDeleted: false },
      select: { id: true },
      take: 20_000,
    });
    if (ids.length === 0) return { count: 0 };
    const now = new Date();
    const result = await tx.gateEntry.updateMany({
      where: { id: { in: ids.map((item) => item.id) }, isDeleted: false },
      data: {
        isDeleted: true,
        deletedAt: now,
        deletedById: actor.userId,
        deleteReason: input.reason,
        recordVersion: { increment: 1 },
        updatedById: actor.userId,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.userId,
        actorRole: actor.role,
        entityType: "GATE_ENTRY_BATCH",
        entityId: input.month,
        action: AuditAction.BULK_DELETE,
        changedFields: ["isDeleted", "deletedAt", "deletedById", "deleteReason"],
        afterData: jsonValue({ month: input.month, reason: input.reason, count: result.count, recordIds: ids.map((item) => item.id) }),
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        requestId: meta.requestId,
      },
    });
    return { count: result.count };
  });
}

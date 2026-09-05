import { Router } from "express";
import { Prisma, UserRole } from "@prisma/client";
import { z } from "zod";
import { asyncHandler } from "../../lib/async-handler.js";
import { ApiError } from "../../lib/api-error.js";
import { getBusinessDate } from "../../lib/date.js";
import { prisma } from "../../lib/prisma.js";
import { authenticate, authorize } from "../../middleware/auth.js";
import { validateBody } from "../../middleware/validate.js";
import { looksLikeCrewPassQr, parseCrewPassQr } from "./crew-pass-qr-parser.js";
import { isPastDate } from "../gateEntry/gate-entry.service.js";

const resolveSchema = z.object({ qrToken: z.string().min(5).max(2_000) }).strict();


async function resolveRawQr(raw: string) {
  const parsed = parseCrewPassQr(raw);
  try {
    return await prisma.$transaction(async (tx) => {
      const [byCrew, byHash] = await Promise.all([
        tx.crewPass.findUnique({ where: { crewId: parsed.crewId } }),
        tx.crewPass.findUnique({ where: { qrToken: parsed.payloadHash } }),
      ]);
      if (byHash && byHash.crewId !== parsed.crewId) throw new ApiError(409, "QR_HASH_CONFLICT", "This QR payload is already linked to another crew ID");
      // Always allow update — QR data (name, TT, licence) can change between scans (e.g. renewed pass).
      // If the crewId matches, the upsert below will overwrite the stored record with the latest scanned values.
      const data = {
        qrToken: parsed.payloadHash,
        driverName: parsed.driverName,
        crewType: parsed.crewType,
        passValidUntil: parsed.passValidUntil,
        ttNumberOnPass: parsed.ttNumberOnPass,
        drivingLicenseNumber: parsed.drivingLicenseNumber,
        drivingLicenseExpiryDate: parsed.drivingLicenseExpiryDate,
        sourceSystem: "RAW_TEXT_QR",
        sourcePayload: { format: "IOCL_LEGACY_MULTILINE_V1", payloadHash: parsed.payloadHash },
        isActive: true,
      } satisfies Prisma.CrewPassUpdateInput;
      if (byCrew) return tx.crewPass.update({ where: { id: byCrew.id }, data });
      return tx.crewPass.create({ data: { ...data, crewId: parsed.crewId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new ApiError(409, "CREW_PASS_CONFLICT", "The crew pass conflicts with an existing record");
    throw error;
  }
}

export const crewPassRouter = Router();
crewPassRouter.use(authenticate, authorize(UserRole.ENTRY_GATE_SECURITY, UserRole.SUPERVISOR, UserRole.ADMIN));
crewPassRouter.post("/resolve", validateBody(resolveSchema), asyncHandler(async (req, res) => {
  const qrToken = req.body.qrToken as string;
  const rawFormat = looksLikeCrewPassQr(qrToken);
  let missingFields: Array<{ key: string; label: string }> = [];
  if (rawFormat) {
    // Parse first to get missingFields, then upsert
    const { missingFields: mf } = parseCrewPassQr(qrToken);
    missingFields = mf;
  }
  const pass = rawFormat ? await resolveRawQr(qrToken) : await prisma.crewPass.findUnique({ where: { qrToken: qrToken.trim() } });
  if (!pass || !pass.isActive) throw new ApiError(404, "PASS_NOT_FOUND", "Crew pass was not found or is inactive");
  const warnings: string[] = [];
  if (rawFormat) warnings.push("Locally parsed QR; official IOCL authenticity verification is not configured");
  const businessDate = getBusinessDate();
  if (isPastDate(pass.passValidUntil)) warnings.push("Crew pass has expired");
  if (isPastDate(pass.drivingLicenseExpiryDate)) warnings.push("Driving licence has expired");
  if (missingFields.length > 0) warnings.push(`${missingFields.length} field(s) could not be read from the QR — please fill them in manually`);
  res.json({ success: true, data: {
    id: pass.id, qrToken: pass.qrToken, crewId: pass.crewId, driverName: pass.driverName, crewType: pass.crewType,
    passValidUntil: pass.passValidUntil, ttNumberOnPass: pass.ttNumberOnPass, drivingLicenseNumber: pass.drivingLicenseNumber,
    drivingLicenseExpiryDate: pass.drivingLicenseExpiryDate, isActive: pass.isActive, sourceSystem: pass.sourceSystem,
    warnings,
    missingFields, // list of { key, label } for fields the UI should let the operator fill in
  } });
}));

// Manual driver entry — creates/upserts a crew pass from typed details (no QR scan needed)
const manualPassSchema = z.object({
  driverName: z.string().trim().min(2, "Driver name is required").max(120),
  ttNumberOnPass: z.string().trim().min(4, "Truck number is required").max(20).transform((v) => v.replace(/[^A-Za-z0-9]/g, "").toUpperCase()),
  drivingLicenseNumber: z.string().trim().min(2, "DL number is required").max(40),
  drivingLicenseExpiryDate: z.string().optional().nullable(),
  passValidUntil: z.string().optional().nullable(),
  crewType: z.enum(["DRIVER", "DRIVER_WITH_HELPER", "CONTRACT_CREW"]).default("DRIVER"),
  crewId: z.string().trim().optional(),
}).strict();

crewPassRouter.post("/manual", validateBody(manualPassSchema), asyncHandler(async (req, res) => {
  const body = req.body as z.infer<typeof manualPassSchema>;
  // Use M-{TRUCKNO} as crewId so same truck coming in again same day is properly blocked
  const crewId = body.crewId || `M-${body.ttNumberOnPass}`;
  // Unique token: based on crewId so same manual record upserts cleanly
  const qrToken = `MANUAL:${crewId}`;
  const dlExpiry = body.drivingLicenseExpiryDate || null;
  const passUntil = body.passValidUntil || null;
  const pass = await prisma.crewPass.upsert({
    where: { crewId },
    create: {
      crewId,
      qrToken,
      driverName: body.driverName,
      crewType: body.crewType as "DRIVER" | "DRIVER_WITH_HELPER" | "CONTRACT_CREW",
      passValidUntil: passUntil,
      ttNumberOnPass: body.ttNumberOnPass,
      drivingLicenseNumber: body.drivingLicenseNumber,
      drivingLicenseExpiryDate: dlExpiry,
      isActive: true,
      sourceSystem: "MANUAL_ENTRY",
    },
    update: {
      qrToken,
      driverName: body.driverName,
      crewType: body.crewType as "DRIVER" | "DRIVER_WITH_HELPER" | "CONTRACT_CREW",
      passValidUntil: passUntil,
      ttNumberOnPass: body.ttNumberOnPass,
      drivingLicenseNumber: body.drivingLicenseNumber,
      drivingLicenseExpiryDate: dlExpiry,
      isActive: true,
      sourceSystem: "MANUAL_ENTRY",
    },
  });
  const businessDate = getBusinessDate();
  const warnings: string[] = ["Manual entry — no QR scan; details entered by operator"];
  if (!pass.passValidUntil) warnings.push("Pass validity date is missing from master database");
  else if (isPastDate(pass.passValidUntil)) warnings.push("Pass valid date has expired");
  
  if (!pass.drivingLicenseExpiryDate) warnings.push("Driving licence expiry date is missing from master database");
  else if (isPastDate(pass.drivingLicenseExpiryDate)) warnings.push("Driving licence has expired");
  
  res.json({ success: true, data: {
    id: pass.id, qrToken: pass.qrToken, crewId: pass.crewId, driverName: pass.driverName, crewType: pass.crewType,
    passValidUntil: pass.passValidUntil, ttNumberOnPass: pass.ttNumberOnPass, drivingLicenseNumber: pass.drivingLicenseNumber,
    drivingLicenseExpiryDate: pass.drivingLicenseExpiryDate, isActive: pass.isActive, sourceSystem: pass.sourceSystem,
    warnings, missingFields: [],
  } });
}));

import { Router } from "express";
import { EntryStatus, UserRole } from "@prisma/client";
import { env } from "../../config/env.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { formatDisplaySerial, getBusinessDate } from "../../lib/date.js";
import { prisma } from "../../lib/prisma.js";
import { buildQuantitySummary } from "../../lib/product-totals.js";
import { authenticate, authorize } from "../../middleware/auth.js";

export const dashboardRouter = Router();
dashboardRouter.use(
  authenticate,
  authorize(UserRole.ENTRY_GATE_SECURITY, UserRole.EXIT_GATE_SECURITY, UserRole.SUPERVISOR, UserRole.ADMIN),
);

dashboardRouter.get(
  "/summary",
  asyncHandler(async (_req, res) => {
    const businessDate = getBusinessDate();
    const base = { businessDate, isDeleted: false } as const;
    const [total, open, exited, mismatches, safetyExceptions, recent, quantityTotals] = await prisma.$transaction([
      prisma.gateEntry.count({ where: base }),
      prisma.gateEntry.count({ where: { ...base, status: EntryStatus.IN } }),
      prisma.gateEntry.count({ where: { ...base, status: EntryStatus.OUT } }),
      prisma.gateEntry.count({ where: { ...base, ttNumberMatch: false } }),
      prisma.safetyChecklist.count({
        where: {
          gateEntry: base,
          OR: [
            { drivingLicenseValidCmvRule9: false }, { verifyRegisterColumn1: false }, { verifyRegisterColumn2: false },
            { ppeAvailable: false }, { rubberHoseCumLockCouplingGttMarked: false }, { sparkArrestorCcoeApproved: false },
            { tremCardAndTrainingCardAvailable: false }, { selfStarterWorking: false }, { batteryTerminalRubberCovers: false },
            { noContainerCanExplosivesInCabin: false }, { vmuWorking: false }, { truckTyreConditionAcceptable: false },
          ],
        },
      }),
      prisma.gateEntry.findMany({
        where: { ...base, status: EntryStatus.IN },
        orderBy: { timeIn: "desc" },
        take: 8,
        select: {
          id: true, serialNumber: true, businessDate: true, actualTankTruckNumber: true, driverName: true,
          customerDestination: true, ttNumberMatch: true, status: true, timeIn: true,
        },
      }),
      prisma.gateEntry.aggregate({
        where: { ...base, status: EntryStatus.OUT },
        _sum: { qtyMs: true, qtyXpms: true, qtyEbms: true, qtyHsd: true, qtySko: true, qtyXg: true, qtyBioHsd: true, qtyFo: true, qtyLdo: true },
      }),
    ]);
    res.json({
      success: true,
      data: {
        facilityCode: env.FACILITY_CODE,
        gateCode: env.GATE_CODE,
        businessDate,
        total,
        open,
        exited,
        mismatches,
        safetyExceptions,
        quantities: buildQuantitySummary(quantityTotals._sum),
        recent: recent.map((entry) => ({ ...entry, displaySerial: formatDisplaySerial(entry.businessDate, entry.serialNumber) })),
      },
    });
  }),
);

import { Router } from "express";
import { EntryStatus, UserRole } from "@prisma/client";
import { entryFilterSchema, isoDateSchema } from "@iocl/shared";
import { z } from "zod";
import { asyncHandler } from "../../lib/async-handler.js";
import { buildXlsx, type XlsxCell } from "../../lib/xlsx.js";
import { parseIsoBusinessDate } from "../../lib/date.js";
import { prisma } from "../../lib/prisma.js";
import { buildQuantitySummary } from "../../lib/product-totals.js";
import { authenticate, authorize } from "../../middleware/auth.js";
import { validateQuery } from "../../middleware/validate.js";
import { listForExport } from "../gateEntry/gate-entry.service.js";

const reportQuerySchema = z.object({ dateFrom: isoDateSchema, dateTo: isoDateSchema.optional() }).strict();

function asNumber(value: string | null) {
  return value == null ? null : Number(value);
}

function safetyText(value: boolean | null | undefined) {
  return value == null ? "NOT CAPTURED" : value ? "YES" : "NO";
}

export const reportRouter = Router();
reportRouter.use(authenticate, authorize(UserRole.SUPERVISOR, UserRole.ADMIN));

reportRouter.get(
  "/summary",
  validateQuery(reportQuerySchema),
  asyncHandler(async (_req, res) => {
    const from = parseIsoBusinessDate(res.locals.validatedQuery.dateFrom);
    const toStr = res.locals.validatedQuery.dateTo || res.locals.validatedQuery.dateFrom;
    const to = parseIsoBusinessDate(toStr);
    
    const [counts, totals] = await prisma.$transaction([
      prisma.gateEntry.groupBy({
        by: ["status"],
        where: { businessDate: { gte: from, lte: to }, isDeleted: false },
        _count: true,
        orderBy: undefined,
      }),
      prisma.gateEntry.aggregate({
        where: { businessDate: { gte: from, lte: to }, isDeleted: false, status: EntryStatus.OUT },
        _sum: { qtyMs: true, qtyXpms: true, qtyEbms: true, qtyHsd: true, qtySko: true, qtyXg: true, qtyBioHsd: true, qtyFo: true, qtyLdo: true },
      }),
    ]);
    const byStatus = Object.fromEntries(counts.map((item) => [item.status, item._count]));
    res.json({
      success: true,
      data: {
        date: res.locals.validatedQuery.dateFrom,
        total: Object.values(byStatus).reduce((sum, value) => sum + Number(value), 0),
        in: byStatus.IN ?? 0,
        out: byStatus.OUT ?? 0,
        cancelled: byStatus.CANCELLED ?? 0,
        quantities: buildQuantitySummary(totals._sum),
      },
    });
  }),
);

reportRouter.get(
  "/excel",
  validateQuery(reportQuerySchema),
  asyncHandler(async (req, res) => {
    const dateFrom = res.locals.validatedQuery.dateFrom as string;
    const dateTo = res.locals.validatedQuery.dateTo as string | undefined;
    const filter = entryFilterSchema.parse({ dateFrom, dateTo, page: 1, pageSize: 100, match: "all", includeDeleted: false });
    const items = await listForExport(filter, req.auth!);

    const columns = [
      ["SL.NO", 9], ["Name & Destination of Customer", 28], ["Tank Truck No", 16], ["ABS", 9], ["Challan No", 16],
      ["Time In", 13], ["Time Out", 13], ["MS", 12], ["XPMS", 12], ["EBMS", 12], ["HSD", 12],
      ["DL valid as per CMV Rule 9", 20], ["Verify Register Column (1)", 20], ["Verify Register Column (2)", 20],
      ["PPE", 10], ["Rubber Hose Cum Lock Coupling GTT No. Marked", 28], ["Spark Arrestor Approved by CCOE", 24],
      ["TREM Card & Training Card", 22], ["Self Starter Working", 18], ["Rubber Cover on Battery Terminals", 24],
      ["No Container/Can/Explosives in TT Cabin", 28], ["VMU Working", 14], ["Truck Tyre Condition", 18],
      ["Name of Driver", 20], ["Driver Pass No", 16], ["ABT Driver", 12], ["Name of Helper", 20], ["Helper Pass No", 16],
      ["ABT Helper", 12], ["Mobile Token No", 16], ["Signature Driver", 16], ["Remarks", 28],
      ["Invoice No", 18], ["Invoice Date", 14], ["Invoice Vehicle", 16], ["Consignee", 28], ["Prd/Qty Raw", 24],
      ["TT No on Pass", 16], ["TT Match", 12],
    ] as const;

    const rows: XlsxCell[][] = items.map((entry) => {
      const safety = entry.safetyChecklist;
      return [
        entry.serialNumber,
        entry.customerDestination,
        entry.actualTankTruckNumber,
        entry.abs ? "YES" : "NO",
        entry.challanNumber,
        entry.timeIn.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }),
        entry.timeOut ? entry.timeOut.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" }) : "",
        asNumber(entry.qtyMs), asNumber(entry.qtyXpms), asNumber(entry.qtyEbms), asNumber(entry.qtyHsd),
        safetyText(safety?.drivingLicenseValidCmvRule9), safetyText(safety?.verifyRegisterColumn1), safetyText(safety?.verifyRegisterColumn2),
        safetyText(safety?.ppeAvailable), safetyText(safety?.rubberHoseCumLockCouplingGttMarked), safetyText(safety?.sparkArrestorCcoeApproved),
        safetyText(safety?.tremCardAndTrainingCardAvailable), safetyText(safety?.selfStarterWorking), safetyText(safety?.batteryTerminalRubberCovers),
        safetyText(safety?.noContainerCanExplosivesInCabin), safetyText(safety?.vmuWorking), safetyText(safety?.truckTyreConditionAcceptable),
        entry.driverName, entry.driverPassNumber, entry.driverAbt ? "YES" : "NO", entry.helperName ?? "", entry.helperPassNumber ?? "",
        entry.helperAbt ? "YES" : "NO", entry.mobileTokenNumber, entry.driverSignatureConfirmed ? "CONFIRMED" : "NOT CONFIRMED",
        entry.remarks ?? "", entry.invoiceNumber ?? "", entry.invoiceDate?.toISOString().slice(0, 10) ?? "", entry.invoiceVehicle ?? "",
        entry.invoiceConsignee ?? "", entry.invoiceProductsRaw ?? "", entry.ttNumberOnPass, entry.ttNumberMatch ? "YES" : "NO",
      ];
    });
    const firstDataRow = 4;
    const lastDataRow = rows.length + 3;
    const sumOrZero = (columnStart: string, columnEnd = columnStart): XlsxCell =>
      rows.length > 0 ? { formula: `SUM(${columnStart}${firstDataRow}:${columnEnd}${lastDataRow})` } : 0;
    const totalsRow: XlsxCell[] = [
      "TOTALS", "", "", "", "", "", "",
      sumOrZero("H"), sumOrZero("I"), sumOrZero("J"), sumOrZero("K"),
      "PETROL TOTAL", sumOrZero("H", "J"), "DIESEL TOTAL", sumOrZero("K"),
    ];
    const displayDate = dateFrom !== dateTo && dateTo ? `${dateFrom} to ${dateTo}` : dateFrom;
    const buffer = buildXlsx({
      title: "INDIAN OIL — TANK TRUCK GATE REGISTER",
      subtitle: `Register Date: ${displayDate}`,
      headers: columns.map(([name]) => name),
      widths: columns.map(([, width]) => width),
      rows,
      totalsRow,
    });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const fileSuffix = dateFrom !== dateTo && dateTo ? `${dateFrom}-to-${dateTo}` : dateFrom;
    res.setHeader("Content-Disposition", `attachment; filename="gate-log-${fileSuffix}.xlsx"`);
    res.send(buffer);
  }),
);

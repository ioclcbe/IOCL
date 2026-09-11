import { Router, type Request } from "express";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import {
  bulkDeleteSchema,
  createGateEntrySchema,
  deleteEntrySchema,
  entryFilterSchema,
  invoiceQrResolveSchema,
  submitExitSchema,
  updateExitQuantitiesSchema,
  updateGateEntrySchema,
} from "@iocl/shared";
import { asyncHandler } from "../../lib/async-handler.js";
import { authenticate, authorize } from "../../middleware/auth.js";
import { validateBody, validateParams, validateQuery } from "../../middleware/validate.js";
import * as service from "./gate-entry.service.js";

const idParams = z.object({ id: z.string().uuid() }).strict();
const allOperationalRoles = [UserRole.ENTRY_GATE_SECURITY, UserRole.EXIT_GATE_SECURITY, UserRole.SUPERVISOR, UserRole.ADMIN] as const;

function meta(req: Request) {
  return { ip: req.ip, userAgent: req.header("user-agent")?.slice(0, 500), requestId: req.requestId };
}

function csvCell(value: unknown) {
  const raw = value == null ? "" : String(value);
  const safe = /^[\s\u0000-\u001F]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export const gateEntryRouter = Router();
gateEntryRouter.use(authenticate);

gateEntryRouter.get(
  "/summary",
  authorize(UserRole.SUPERVISOR, UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);
    const items = await service.listForExport({ date, pageSize: 10000 } as Parameters<typeof service.listForExport>[0], req.auth!);
    const sum = (key: "qtyMs" | "qtyXpms" | "qtyEbms" | "qtyHsd" | "qtySko" | "qtyXg" | "qtyBioHsd" | "qtyFo" | "qtyLdo") =>
      items.reduce((acc, item) => acc + parseFloat(String(item[key] ?? "0")), 0);
    const out   = items.filter((item) => item.status === "OUT");
    const inItems = items.filter((item) => item.status === "IN");
    res.json({
      success: true,
      data: {
        date,
        total: items.length,
        in: inItems.length,
        out: out.length,
        cancelled: items.filter((item) => item.status === "CANCELLED").length,
        quantities: {
          ms:     String(sum("qtyMs")),
          xpms:   String(sum("qtyXpms")),
          ebms:   String(sum("qtyEbms")),
          hsd:    String(sum("qtyHsd")),
          petrol: String(sum("qtyMs") + sum("qtyXpms") + sum("qtyEbms")),
          diesel: String(sum("qtyHsd") + sum("qtySko") + sum("qtyXg") + sum("qtyBioHsd")),
        },
      },
    });
  }),
);

gateEntryRouter.get(
  "/",
  authorize(...allOperationalRoles),
  validateQuery(entryFilterSchema),
  asyncHandler(async (req, res) => {
    const data = await service.listEntries(res.locals.validatedQuery, req.auth!);
    res.json({ success: true, data });
  }),
);

gateEntryRouter.get(
  "/export.csv",
  authorize(UserRole.SUPERVISOR, UserRole.ADMIN),
  validateQuery(entryFilterSchema),
  asyncHandler(async (req, res) => {
    const items = await service.listForExport(res.locals.validatedQuery, req.auth!);
    const maskPlaceholder = (v: string | null | undefined) => {
      if (!v || v === "-" || v.startsWith("NTKN-")) return "";
      return v;
    };
    const headers = [
      "SL.NO", "Date", "Status", "Customer / Destination", "Tank Truck No", "ABS", "Time In", "Time Out",
      "MS (L)", "XP 95 (L)", "EBMS (L)", "HSD (L)", "SKO (L)", "XG (L)", "BIO HSD (L)", "FO (L)", "LDO (L)", "Lock No",
      "Driver", "Crew ID", "DL No", "DL Expiry", "Pass Valid Upto", "TT No on Pass", "TT Match",
      "Helper", "Helper Pass", "Driver Confirmation",
      "Invoice No", "Invoice Date", "Consignee", "Remarks", "Created By", "Exit By",
    ];
    const rows = items.map((entry) => [
      entry.serialNumber, entry.businessDate.toISOString().slice(0, 10), entry.status, entry.customerDestination,
      entry.actualTankTruckNumber, entry.abs ? "YES" : "NO", entry.timeIn.toISOString(), entry.timeOut?.toISOString() ?? "",
      entry.qtyMs ?? "", entry.qtyXpms ?? "", entry.qtyEbms ?? "", entry.qtyHsd ?? "",
      entry.qtySko ?? "", entry.qtyXg ?? "", entry.qtyBioHsd ?? "", entry.qtyFo ?? "", entry.qtyLdo ?? "",
      entry.lockNumber ?? "",
      entry.driverName, entry.crewId, entry.drivingLicenseNumber,
      entry.drivingLicenseExpiryDate ?? "", entry.passValidUntil ?? "", entry.ttNumberOnPass,
      entry.ttNumberMatch ? "YES" : "NO",
      entry.helperName ?? "", maskPlaceholder(entry.helperPassNumber), entry.driverSignatureConfirmed ? "CONFIRMED" : "NOT CONFIRMED",
      entry.invoiceNumber ?? "", entry.invoiceDate?.toISOString().slice(0, 10) ?? "",
      entry.invoiceConsignee ?? "", entry.remarks ?? "", entry.createdBy.employeeCode, entry.exitCreatedBy?.employeeCode ?? "",
    ]);

    const totalMs = items.reduce((sum, item) => sum + (parseFloat(item.qtyMs || "0") || 0), 0);
    const totalXpms = items.reduce((sum, item) => sum + (parseFloat(item.qtyXpms || "0") || 0), 0);
    const totalEbms = items.reduce((sum, item) => sum + (parseFloat(item.qtyEbms || "0") || 0), 0);
    const totalHsd = items.reduce((sum, item) => sum + (parseFloat(item.qtyHsd || "0") || 0), 0);
    const totalSko = items.reduce((sum, item) => sum + (parseFloat(item.qtySko || "0") || 0), 0);
    const totalXg = items.reduce((sum, item) => sum + (parseFloat(item.qtyXg || "0") || 0), 0);
    const totalBioHsd = items.reduce((sum, item) => sum + (parseFloat(item.qtyBioHsd || "0") || 0), 0);
    const totalFo = items.reduce((sum, item) => sum + (parseFloat(item.qtyFo || "0") || 0), 0);
    const totalLdo = items.reduce((sum, item) => sum + (parseFloat(item.qtyLdo || "0") || 0), 0);

    const totalsRow = [
      "TOTALS", "", "", "", "", "", "", "",
      totalMs.toFixed(3), totalXpms.toFixed(3), totalEbms.toFixed(3), totalHsd.toFixed(3),
      totalSko.toFixed(3), totalXg.toFixed(3), totalBioHsd.toFixed(3), totalFo.toFixed(3), totalLdo.toFixed(3), "",
      "", "", "", "", "", "", "",
      "", "", "",
      "", "", "", "", "", "",
    ];
    rows.push(totalsRow);

    const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="iocl-gate-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }),
);

gateEntryRouter.get(
  "/export.xlsx",
  authorize(UserRole.SUPERVISOR, UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const dateFrom = (req.query.dateFrom as string) || new Date().toISOString().slice(0, 10);
    const dateTo = (req.query.dateTo as string) || dateFrom;
    const filter = { dateFrom, dateTo, pageSize: 10000 };
    
    const items = await service.listForExport(filter as any, req.auth!);

    const workbook = new ExcelJS.Workbook();
    const sheetName = dateFrom !== dateTo ? `${dateFrom} to ${dateTo}` : dateFrom;
    const safeSheetName = sheetName.substring(0, 31).replace(/[\[\]*?:\/\\]/g, "");
    const sheet = workbook.addWorksheet(safeSheetName);

    sheet.columns = [
      { header: "Sl. No", key: "slNo", width: 8 },
      { header: "TT No.", key: "truckNo", width: 15 },
      { header: "ABS", key: "abs", width: 8 },
      { header: "TLF No / Challan", key: "tlfNo", width: 15 },
      { header: "Thru' / proxi-card / manual", key: "scanMethod", width: 15 },
      { header: "Time IN", key: "timeIn", width: 10 },
      { header: "ISI Marked DCP FE Available", key: "isiDcp", width: 15 },
      { header: "Driving License is endorsed as per CMV Rule 9", key: "dlEndorsed", width: 15 },
      { header: "Availability of Helper with Tank Truck", key: "helperAvail", width: 15 },
      { header: "Wearing of PPEs by TT Crew", key: "ppe", width: 15 },
      { header: "Rubber Hose with Cam-Lock Coupling", key: "rubberHose", width: 15 },
      { header: "CCOE approved Spark Arrester welded", key: "sparkArrester", width: 15 },
      { header: "TERM Card and Crew Training Card available", key: "termCard", width: 15 },
      { header: "Self Starter Working", key: "selfStarter", width: 15 },
      { header: "Rubber Cover Provided for Battery Terminal", key: "batteryCover", width: 15 },
      { header: "No Container / Can in TT's Cabin", key: "noContainers", width: 15 },
      { header: "Condition of Battery Cut off Switch", key: "batteryCutoff", width: 15 },
      { header: "Hand Break working", key: "handBrake", width: 15 },
      { header: "Earth Cleat Provided", key: "earthCleat", width: 15 },
      { header: "VMU Status Switch OFF", key: "vmuSwitch", width: 15 },
      { header: "Driver Name with Pass No.", key: "driverInfo", width: 25 },
      { header: "ABT", key: "driverAbt", width: 8 },
      { header: "Cleaner Name with Pass No.", key: "helperInfo", width: 25 },
      { header: "ABAT", key: "helperAbt", width: 8 },
      { header: "Time OUT", key: "timeOut", width: 10 },
      { header: "MS (L)", key: "ms", width: 10 },
      { header: "XP 95 (L)", key: "xp95", width: 10 },
      { header: "HSD (L)", key: "hsd", width: 10 },
      { header: "SKO (L)", key: "sko", width: 10 },
      { header: "XG (L)", key: "xg", width: 10 },
      { header: "BIO HSD (L)", key: "bioHsd", width: 12 },
      { header: "FO (L)", key: "fo", width: 10 },
      { header: "LDO (L)", key: "ldo", width: 10 },
      { header: "Invoice No", key: "invoiceNo", width: 15 },
      { header: "Invoice Date", key: "invoiceDate", width: 12 },
      { header: "Destination", key: "destination", width: 20 },
      { header: "Status", key: "status", width: 12 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE87722" },
      };
      cell.alignment = { wrapText: true, vertical: "top" };
    });

    sheet.spliceRows(1, 0, [], [], [], []);
    
    sheet.mergeCells("A1:AK1");
    sheet.mergeCells("A2:AK2");
    
    const r1 = sheet.getRow(1);
    r1.height = 35;
    r1.getCell(1).value = "INDIAN OIL CORPORATION LIMITED";
    r1.getCell(1).font = { name: "Arial", size: 18, bold: true };
    r1.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

    const r2 = sheet.getRow(2);
    r2.height = 30;
    r2.getCell(1).value = "COIMBATORE TERMINAL";
    r2.getCell(1).font = { name: "Arial", size: 16, bold: true };
    r2.getCell(1).alignment = { horizontal: "center", vertical: "middle" };

    try {
      const cwd = process.cwd();
      const possiblePaths = [
        path.resolve(cwd, "../web/public/indian-oil-logo.jpeg"),
        path.resolve(cwd, "apps/web/public/indian-oil-logo.jpeg"),
        path.resolve(cwd, "../../apps/web/public/indian-oil-logo.jpeg"),
        path.resolve(cwd, "public/indian-oil-logo.jpeg"),
      ];
      
      const logoPath = possiblePaths.find(p => fs.existsSync(p));
      
      if (logoPath) {
        const logoId = workbook.addImage({
          buffer: fs.readFileSync(logoPath),
          extension: "jpeg",
        });
        sheet.addImage(logoId, {
          tl: { col: 15, row: 0 },
          ext: { width: 70, height: 70 },
        });
        } else {
          console.error("Logo file not found in any possible paths");
        }
      } catch (e) {
        console.error("Failed to add logo to excel", e);
      }

      const formatTime = (d: Date | null | undefined) => d ? `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}` : "";
    const formatDate = (d: Date | null | undefined) => d ? `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}` : "";
    const chk = (val: boolean | undefined | null) => val === true ? "YES" : val === false ? "NO" : "";

    items.forEach((entry) => {
      const s = entry.safetyChecklist || ({} as any);
      sheet.addRow({
        slNo: entry.serialNumber,
        truckNo: entry.actualTankTruckNumber,
        abs: chk(entry.abs),
        tlfNo: entry.challanNumber || "",
        scanMethod: entry.qrScanMethod === "MANUAL" ? "MANUAL" : "PROXI-CARD",
        timeIn: formatTime(entry.timeIn),
        isiDcp: chk(s.verifyRegisterColumn1),
        dlEndorsed: chk(s.drivingLicenseValidCmvRule9),
        helperAvail: chk(!!entry.helperName),
        ppe: chk(s.ppeAvailable),
        rubberHose: chk(s.rubberHoseCumLockCouplingGttMarked),
        sparkArrester: chk(s.sparkArrestorCcoeApproved),
        termCard: chk(s.tremCardAndTrainingCardAvailable),
        selfStarter: chk(s.selfStarterWorking),
        batteryCover: chk(s.batteryTerminalRubberCovers),
        noContainers: chk(s.noContainerCanExplosivesInCabin),
        batteryCutoff: chk(s.batteryCutOffSwitchCondition),
        handBrake: chk(s.handBrakeWorking),
        earthCleat: chk(s.earthCleatProvided),
        vmuSwitch: chk(s.vmuStatusSwitchOff),
        driverInfo: entry.driverName ? `${entry.driverName} (${entry.driverPassNumber || "-"})` : "-",
        driverAbt: chk(entry.driverAbt),
        helperInfo: entry.helperName ? `${entry.helperName} (${entry.helperPassNumber || "-"})` : "-",
        helperAbt: chk(entry.helperAbt),
        timeOut: formatTime(entry.timeOut),
        ms: entry.qtyMs ? Number(entry.qtyMs) : null,
        xp95: entry.qtyXpms ? Number(entry.qtyXpms) : null,
        hsd: entry.qtyHsd ? Number(entry.qtyHsd) : null,
        sko: entry.qtySko ? Number(entry.qtySko) : null,
        xg: entry.qtyXg ? Number(entry.qtyXg) : null,
        bioHsd: entry.qtyBioHsd ? Number(entry.qtyBioHsd) : null,
        fo: entry.qtyFo ? Number(entry.qtyFo) : null,
        ldo: entry.qtyLdo ? Number(entry.qtyLdo) : null,
        invoiceNo: entry.invoiceNumber ?? "",
        invoiceDate: formatDate(entry.invoiceDate),
        destination: entry.customerDestination ?? "",
        status: entry.status,
      });
    });

    const totalRowIndex = sheet.rowCount + 1;
    const totalsRow = sheet.getRow(totalRowIndex);
    totalsRow.getCell("slNo").value = "TOTALS";

    // Columns Z to AG are the product quantities
    const columnsToSum = ["Z", "AA", "AB", "AC", "AD", "AE", "AF", "AG"];
    columnsToSum.forEach((col) => {
      totalsRow.getCell(col).value = { formula: `SUM(${col}6:${col}${totalRowIndex - 1})`, date1904: false };
    });

    totalsRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3CD" } };
    });

    const sigRowIndex = totalRowIndex + 5;

    sheet.mergeCells(`A${sigRowIndex}:D${sigRowIndex}`);
    const approved = sheet.getCell(`A${sigRowIndex}`);
    approved.value = "Approved";
    approved.font = { bold: true, size: 12 };
    approved.alignment = { horizontal: "center" };

    sheet.mergeCells(`AG${sigRowIndex}:AK${sigRowIndex}`);
    const sig = sheet.getCell(`AG${sigRowIndex}`);
    sig.value = "Signature";
    sig.font = { bold: true, size: 12 };
    sig.alignment = { horizontal: "center" };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="gate-log-${dateFrom !== dateTo ? `${dateFrom}-to-${dateTo}` : dateFrom}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  }),
);

gateEntryRouter.post(
  "/exit/resolve",
  authorize(UserRole.EXIT_GATE_SECURITY, UserRole.SUPERVISOR, UserRole.ADMIN),
  validateBody(invoiceQrResolveSchema),
  asyncHandler(async (req, res) => {
    const data = await service.resolveInvoice(req.body.rawInvoiceQr);
    res.json({ success: true, data });
  }),
);

gateEntryRouter.post(
  "/bulk-delete",
  authorize(UserRole.ADMIN),
  validateBody(bulkDeleteSchema),
  asyncHandler(async (req, res) => {
    const data = await service.bulkSoftDelete(req.body, req.auth!, meta(req));
    res.json({ success: true, data, message: `${data.count} record(s) soft deleted` });
  }),
);

gateEntryRouter.get(
  "/:id",
  authorize(...allOperationalRoles),
  validateParams(idParams),
  asyncHandler(async (req, res) => {
    const data = await service.getEntry(res.locals.validatedParams.id, req.auth!);
    res.json({ success: true, data });
  }),
);

gateEntryRouter.post(
  "/",
  authorize(UserRole.ENTRY_GATE_SECURITY, UserRole.SUPERVISOR, UserRole.ADMIN),
  validateBody(createGateEntrySchema),
  asyncHandler(async (req, res) => {
    const data = await service.createEntry(req.body, req.auth!, meta(req));
    res.status(201).json({ success: true, data, message: "Vehicle IN entry created successfully" });
  }),
);

gateEntryRouter.patch(
  "/:id/exit-quantities",
  authorize(UserRole.EXIT_GATE_SECURITY, UserRole.SUPERVISOR, UserRole.ADMIN),
  validateParams(idParams),
  validateBody(updateExitQuantitiesSchema),
  asyncHandler(async (req, res) => {
    const data = await service.updateExitQuantities(res.locals.validatedParams.id, res.locals.validatedBody, req.auth!, meta(req));
    res.json({ success: true, data, message: "OUT quantities updated" });
  }),
);

gateEntryRouter.patch(
  "/:id",
  // ENTRY_GATE_SECURITY can edit their OWN open IN entries (today only)
  // SUPERVISOR/ADMIN can edit any entry — service layer enforces these rules
  authorize(UserRole.ENTRY_GATE_SECURITY, UserRole.EXIT_GATE_SECURITY, UserRole.SUPERVISOR, UserRole.ADMIN),
  validateParams(idParams),
  validateBody(updateGateEntrySchema),
  asyncHandler(async (req, res) => {
    const data = await service.updateEntry(res.locals.validatedParams.id, res.locals.validatedBody, req.auth!, meta(req));
    res.json({ success: true, data, message: "IN entry updated" });
  }),
);

gateEntryRouter.post(
  "/:id/exit",
  authorize(UserRole.EXIT_GATE_SECURITY, UserRole.SUPERVISOR, UserRole.ADMIN),
  validateParams(idParams),
  validateBody(submitExitSchema),
  asyncHandler(async (req, res) => {
    const data = await service.submitExit(res.locals.validatedParams.id, res.locals.validatedBody, req.auth!, meta(req));
    res.json({ success: true, data, message: "Vehicle OUT completed and entry locked" });
  }),
);

gateEntryRouter.post(
  "/:id/restore",
  authorize(UserRole.ADMIN),
  validateParams(idParams),
  asyncHandler(async (req, res) => {
    const data = await service.restoreEntry(res.locals.validatedParams.id, req.auth!, meta(req));
    res.json({ success: true, data, message: "Record restored and audited" });
  }),
);

gateEntryRouter.delete(
  "/:id",
  authorize(UserRole.ADMIN),
  validateParams(idParams),
  validateBody(deleteEntrySchema),
  asyncHandler(async (req, res) => {
    const data = await service.softDeleteEntry(res.locals.validatedParams.id, req.body, req.auth!, meta(req));
    res.json({ success: true, data, message: "Record soft deleted" });
  }),
);

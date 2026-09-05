import { Router, type Request } from "express";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { asyncHandler } from "../../lib/async-handler.js";
import { ApiError } from "../../lib/api-error.js";
import { authenticate, authorize } from "../../middleware/auth.js";
import { prisma as db } from "../../lib/prisma.js";
import { tankTruckSchema, driverSchema, helperSchema } from "@iocl/shared";
import multer from "multer";
import ExcelJS from "exceljs";

const upload = multer({ storage: multer.memoryStorage() });

export const masterRouter = Router();

masterRouter.use(authenticate);

// ==========================================
// TANK TRUCKS
// ==========================================

masterRouter.get(
  "/trucks",
  authorize(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.ENTRY_GATE_SECURITY),
  asyncHandler(async (req, res) => {
    const trucks = await db.tankTruck.findMany({ orderBy: { ttNumber: "asc" } });
    res.json({ success: true, data: trucks });
  })
);

masterRouter.post(
  "/trucks",
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const data = tankTruckSchema.parse(req.body);
    const exists = await db.tankTruck.findUnique({ where: { ttNumber: data.ttNumber } });
    if (exists) throw new ApiError(400, "DUPLICATE_TRUCK", "Truck number already exists");
    
    const truck = await db.tankTruck.create({ data: { ttNumber: data.ttNumber, isActive: data.isActive } });
    res.status(201).json({ success: true, data: truck });
  })
);

masterRouter.put(
  "/trucks/:id",
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = tankTruckSchema.parse(req.body);
    const truck = await db.tankTruck.update({
      where: { id: id as string },
      data: { ttNumber: data.ttNumber, isActive: data.isActive },
    });
    res.json({ success: true, data: truck });
  })
);

masterRouter.post(
  "/trucks/bulk-delete",
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) throw new ApiError(400, "INVALID_INPUT", "Expected a non-empty array of ids");
    const uuidRe = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const validIds = (ids as string[]).filter(id => uuidRe.test(id));
    if (validIds.length === 0) { res.json({ success: true, count: 0 }); return; }
    const result = await db.tankTruck.deleteMany({ where: { id: { in: validIds } } });
    res.json({ success: true, count: result.count });
  })
);

masterRouter.delete(
  "/trucks/:id",
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await db.tankTruck.delete({ where: { id: id as string } });
    res.json({ success: true });
  })
);



masterRouter.post(
  "/trucks/upload",
  authorize(UserRole.ADMIN),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, "NO_FILE", "Please upload an Excel file");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new ApiError(400, "EMPTY_FILE", "The uploaded Excel file is empty");

    const rows = worksheet.getSheetValues() as any[][];
    if (rows.length < 2) throw new ApiError(400, "NO_DATA", "The uploaded Excel file has no data rows");

    const headers = rows[1] || [];
    let ttIdx = -1;
    for (let i = 1; i < headers.length; i++) {
      const h = String(headers[i] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (h.includes("truck") || h.includes("tt") || h.includes("vehicle")) ttIdx = i;
    }

    if (ttIdx === -1) {
      throw new ApiError(400, "INVALID_FORMAT", "Excel must contain a column for Truck Number (e.g. TT Number)");
    }

    const dataToInsert = [];
    for (let r = 2; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const ttNumber = String(row[ttIdx] || "").trim().toUpperCase();
      if (!ttNumber || ttNumber.length < 4) continue;

      dataToInsert.push({
        ttNumber,
        isActive: true
      });
    }

    const result = await db.tankTruck.createMany({
      data: dataToInsert,
      skipDuplicates: true
    });

    res.json({ success: true, inserted: result.count });
  })
);

// ==========================================
// DRIVERS
// ==========================================

masterRouter.get(
  "/drivers",
  authorize(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.ENTRY_GATE_SECURITY),
  asyncHandler(async (req, res) => {
    const drivers = await db.driver.findMany({ orderBy: { name: "asc" } });
    res.json({ success: true, data: drivers });
  })
);

masterRouter.post(
  "/drivers",
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const data = driverSchema.parse(req.body);
    const exists = await db.driver.findUnique({ where: { drivingLicenseNumber: data.drivingLicenseNumber } });
    if (exists) throw new ApiError(400, "DUPLICATE_DRIVER", "Driving license number already exists");
    
    const driver = await db.driver.create({
      data: {
        name: data.name,
        drivingLicenseNumber: data.drivingLicenseNumber,
        drivingLicenseExpiryDate: new Date(data.drivingLicenseExpiryDate),
        passValidUntil: new Date(data.passValidUntil),
        crewId: data.crewId || null,
        isActive: data.isActive,
      }
    });
    res.status(201).json({ success: true, data: driver });
  })
);

masterRouter.put(
  "/drivers/:id",
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = driverSchema.parse(req.body);
    const driver = await db.driver.update({
      where: { id: id as string },
      data: {
        name: data.name,
        drivingLicenseNumber: data.drivingLicenseNumber,
        drivingLicenseExpiryDate: new Date(data.drivingLicenseExpiryDate),
        passValidUntil: new Date(data.passValidUntil),
        crewId: data.crewId || null,
        isActive: data.isActive,
      },
    });
    res.json({ success: true, data: driver });
  })
);

masterRouter.post(
  "/drivers/bulk-delete",
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) throw new ApiError(400, "INVALID_INPUT", "Expected a non-empty array of ids");
    const uuidRe = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const validIds = (ids as string[]).filter(id => uuidRe.test(id));
    if (validIds.length === 0) { res.json({ success: true, count: 0 }); return; }
    const result = await db.driver.deleteMany({ where: { id: { in: validIds } } });
    res.json({ success: true, count: result.count });
  })
);

masterRouter.delete(
  "/drivers/:id",
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await db.driver.delete({ where: { id: id as string } });
    res.json({ success: true });
  })
);


masterRouter.post(
  "/drivers/upload",
  authorize(UserRole.ADMIN),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, "NO_FILE", "Please upload an Excel file");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new ApiError(400, "EMPTY_FILE", "The uploaded Excel file is empty");

    const rows = worksheet.getSheetValues() as any[][];
    if (rows.length < 2) throw new ApiError(400, "NO_DATA", "The uploaded Excel file has no data rows");

    const headers = rows[1] || [];
    let nameIdx = -1, dlIdx = -1, dlExpIdx = -1, passExpIdx = -1, ttIdx = -1, crewIdIdx = -1, crewTypeIdx = -1;
    for (let i = 1; i < headers.length; i++) {
      const h = String(headers[i] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (h.includes("name")) nameIdx = i;
      else if (h.includes("exp")) dlExpIdx = i;
      else if (h.includes("pass") || h.includes("valid") || h.includes("upto")) passExpIdx = i;
      else if (h.includes("dl") || h.includes("lic")) dlIdx = i;
        else if (h.includes("truck") || h.includes("tt") || h.includes("vehicle")) ttIdx = i;
        else if (h.includes("crew") && h.includes("id")) crewIdIdx = i;
        else if (h.includes("crew") && h.includes("type")) crewTypeIdx = i;
    }

    if (nameIdx === -1 || dlIdx === -1 || dlExpIdx === -1 || passExpIdx === -1) {
      throw new ApiError(400, "INVALID_FORMAT", "Excel must contain columns for Name, DL Number, DL Expiry, and Pass Validity");
    }

    const dataToInsert = [];
    for (let r = 2; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const name = String(row[nameIdx] || "").trim();
      const dlNumber = String(row[dlIdx] || "").trim().toUpperCase();
      const rawDlExp = row[dlExpIdx];
      const rawPassExp = row[passExpIdx];
        const defaultTruckNumber = ttIdx !== -1 && row[ttIdx] ? String(row[ttIdx]).trim().toUpperCase() : null;
        const crewId = crewIdIdx !== -1 && row[crewIdIdx] ? String(row[crewIdIdx]).trim() : null;
        const crewType = crewTypeIdx !== -1 && row[crewTypeIdx] ? String(row[crewTypeIdx]).trim() : null;

      if (!name || !dlNumber || !rawDlExp || !rawPassExp) continue;

      const parseDate = (val: any) => {
        if (val instanceof Date) return val;
        const s = String(val).trim();
        const parts = s.split(/[/-]/);
        if (parts.length === 3) {
          if (parts[0]?.length === 4) return new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
          return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
        }
        return new Date(s);
      };

      try {
        dataToInsert.push({
          name,
          drivingLicenseNumber: dlNumber,
          drivingLicenseExpiryDate: parseDate(rawDlExp),
          passValidUntil: parseDate(rawPassExp),
          defaultTruckNumber: defaultTruckNumber || null,
          crewId: crewId || null,
          crewType: crewType || null,
          isActive: true
        });
      } catch {
        // skip invalid
      }
    }

    const result = await db.driver.createMany({
      data: dataToInsert,
      skipDuplicates: true
    });

    res.json({ success: true, inserted: result.count });
  })
);

// ==========================================
// HELPERS
// ==========================================

masterRouter.get(
  "/helpers",
  authorize(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.ENTRY_GATE_SECURITY),
  asyncHandler(async (req, res) => {
    const helpers = await db.helper.findMany({ orderBy: { name: "asc" } });
    res.json({ success: true, data: helpers });
  })
);

masterRouter.post(
  "/helpers",
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const data = helperSchema.parse(req.body);
    const exists = await db.helper.findUnique({ where: { helperPassNumber: data.helperPassNumber } });
    if (exists) throw new ApiError(400, "DUPLICATE_HELPER", "Helper pass number already exists");
    
    const helper = await db.helper.create({
      data: {
        name: data.name,
        helperPassNumber: data.helperPassNumber,
        isActive: data.isActive,
      }
    });
    res.status(201).json({ success: true, data: helper });
  })
);

masterRouter.put(
  "/helpers/:id",
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const data = helperSchema.parse(req.body);
    const helper = await db.helper.update({
      where: { id: id as string },
      data: {
        name: data.name,
        helperPassNumber: data.helperPassNumber,
        isActive: data.isActive,
      },
    });
    res.json({ success: true, data: helper });
  })
);

masterRouter.post(
  "/helpers/bulk-delete",
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) throw new ApiError(400, "INVALID_INPUT", "Expected a non-empty array of ids");
    const uuidRe = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const validIds = (ids as string[]).filter(id => uuidRe.test(id));
    if (validIds.length === 0) { res.json({ success: true, count: 0 }); return; }
    const result = await db.helper.deleteMany({ where: { id: { in: validIds } } });
    res.json({ success: true, count: result.count });
  })
);

masterRouter.delete(
  "/helpers/:id",
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await db.helper.delete({ where: { id: id as string } });
    res.json({ success: true });
  })
);

masterRouter.post(
  "/helpers/upload",
  authorize(UserRole.ADMIN),
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw new ApiError(400, "NO_FILE", "Please upload an Excel file");
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) throw new ApiError(400, "EMPTY_FILE", "The uploaded Excel file is empty");

    const rows = worksheet.getSheetValues() as any[][];
    if (rows.length < 2) throw new ApiError(400, "NO_DATA", "The uploaded Excel file has no data rows");

    const headers = rows[1] || [];
    let nameIdx = -1, passIdx = -1, crewIdIdx = -1, crewTypeIdx = -1, passExpIdx = -1, ttIdx = -1;
    for (let i = 1; i < headers.length; i++) {
      const h = String(headers[i] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (h.includes("name")) nameIdx = i;
      else if (h.includes("crew") && h.includes("type")) crewTypeIdx = i;
      else if (h.includes("crew") && h.includes("id")) crewIdIdx = i;
      else if (h.includes("exp") || h.includes("valid") || h.includes("upto")) passExpIdx = i;
      else if (h.includes("truck") || h.includes("tt") || h.includes("vehicle")) ttIdx = i;
      else if (h.includes("pass") || h.includes("id") || h.includes("num") || h.includes("no")) passIdx = i;
    }

    if (nameIdx === -1 || passIdx === -1) {
      throw new ApiError(400, "INVALID_FORMAT", "Excel must contain at least Name and Helper Pass Number columns");
    }

    const parseDate = (val: any) => {
      if (!val) return null;
      if (val instanceof Date) return val;
      if (val && typeof val === "object" && val.result) val = val.result;
      if (val instanceof Date) return val;
      if (typeof val === "number") return new Date(Math.round((val - 25569) * 86400 * 1000));
      const s = String(val).trim();
      if (!s) return null;
      const parts = s.split(/[\/-]/);
      if (parts.length === 3) {
        if (parts[0]?.length === 4) return new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      }
      return new Date(s);
    };

    const dataToInsert = [];
    for (let r = 2; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const name = String(row[nameIdx] || "").trim();
      const passNumber = String(row[passIdx] || "").trim().toUpperCase();
      if (!name || !passNumber) continue;

      const crewId = crewIdIdx !== -1 && row[crewIdIdx] ? String(row[crewIdIdx]).trim() : null;
      const crewType = crewTypeIdx !== -1 && row[crewTypeIdx] ? String(row[crewTypeIdx]).trim() : null;
      const passValidUntil = passExpIdx !== -1 ? parseDate(row[passExpIdx]) : null;
      const defaultTruckNumber = ttIdx !== -1 && row[ttIdx] ? String(row[ttIdx]).trim().toUpperCase() : null;

      dataToInsert.push({
        name,
        helperPassNumber: passNumber,
        crewId,
        crewType,
        passValidUntil,
        defaultTruckNumber,
        isActive: true
      });
    }

    const result = await db.helper.createMany({
      data: dataToInsert,
      skipDuplicates: true
    });

    res.json({ success: true, inserted: result.count });
  })
);

// ==========================================
// DESTINATIONS
// ==========================================

masterRouter.get(
  "/destinations",
  authorize(UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.ENTRY_GATE_SECURITY),
  asyncHandler(async (req, res) => {
    const destinations = await db.customerDestination.findMany({ where: { isActive: true }, orderBy: { displayOrder: "asc" } });
    res.json({ success: true, data: destinations });
  })
);

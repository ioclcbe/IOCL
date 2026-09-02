import { Router, type Request } from "express";
import { UserRole } from "@prisma/client";
import { z } from "zod";
import { asyncHandler } from "../../lib/async-handler.js";
import { authenticate, authorize } from "../../middleware/auth.js";
import { prisma as db } from "../../lib/prisma.js";
import { tankTruckSchema, driverSchema, helperSchema } from "@iocl/shared";

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
    if (exists) throw new Error("Truck number already exists");
    
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

masterRouter.delete(
  "/trucks/:id",
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await db.tankTruck.delete({ where: { id: id as string } });
    res.json({ success: true });
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
    if (exists) throw new Error("Driving license number already exists");
    
    const driver = await db.driver.create({
      data: {
        name: data.name,
        drivingLicenseNumber: data.drivingLicenseNumber,
        drivingLicenseExpiryDate: new Date(data.drivingLicenseExpiryDate),
        passValidUntil: new Date(data.passValidUntil),
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
        isActive: data.isActive,
      },
    });
    res.json({ success: true, data: driver });
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
    if (exists) throw new Error("Helper pass number already exists");
    
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

masterRouter.delete(
  "/helpers/:id",
  authorize(UserRole.ADMIN),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    await db.helper.delete({ where: { id: id as string } });
    res.json({ success: true });
  })
);

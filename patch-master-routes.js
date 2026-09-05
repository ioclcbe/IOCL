const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'apps', 'api', 'src', 'modules', 'master', 'master.routes.ts');
let content = fs.readFileSync(file, 'utf-8');

// Add truck bulk delete
if (!content.includes('/trucks/bulk-delete')) {
  const truckDeleteSingle = `masterRouter.delete(
    "/trucks/:id",
    authorize(UserRole.ADMIN),
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      await db.tankTruck.delete({ where: { id: id as string } });
      res.json({ success: true });
    })
  );`;
  const truckBulkDelete = `masterRouter.post(
    "/trucks/bulk-delete",
    authorize(UserRole.ADMIN),
    asyncHandler(async (req, res) => {
      const { ids } = req.body;
      if (!Array.isArray(ids)) throw new ApiError(400, "INVALID_INPUT", "Expected an array of ids");
      await db.tankTruck.deleteMany({ where: { id: { in: ids } } });
      res.json({ success: true, count: ids.length });
    })
  );`;
  content = content.replace(truckDeleteSingle, truckDeleteSingle + "\n\n" + truckBulkDelete);
}

// Add driver bulk delete
if (!content.includes('/drivers/bulk-delete')) {
  const driverDeleteSingle = `masterRouter.delete(
    "/drivers/:id",
    authorize(UserRole.ADMIN),
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      await db.driver.delete({ where: { id: id as string } });
      res.json({ success: true });
    })
  );`;
  const driverBulkDelete = `masterRouter.post(
    "/drivers/bulk-delete",
    authorize(UserRole.ADMIN),
    asyncHandler(async (req, res) => {
      const { ids } = req.body;
      if (!Array.isArray(ids)) throw new ApiError(400, "INVALID_INPUT", "Expected an array of ids");
      await db.driver.deleteMany({ where: { id: { in: ids } } });
      res.json({ success: true, count: ids.length });
    })
  );`;
  content = content.replace(driverDeleteSingle, driverDeleteSingle + "\n\n" + driverBulkDelete);
}

// Add helper bulk delete
if (!content.includes('/helpers/bulk-delete')) {
  const helperDeleteSingle = `masterRouter.delete(
    "/helpers/:id",
    authorize(UserRole.ADMIN),
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      await db.helper.delete({ where: { id: id as string } });
      res.json({ success: true });
    })
  );`;
  const helperBulkDelete = `masterRouter.post(
    "/helpers/bulk-delete",
    authorize(UserRole.ADMIN),
    asyncHandler(async (req, res) => {
      const { ids } = req.body;
      if (!Array.isArray(ids)) throw new ApiError(400, "INVALID_INPUT", "Expected an array of ids");
      await db.helper.deleteMany({ where: { id: { in: ids } } });
      res.json({ success: true, count: ids.length });
    })
  );`;
  content = content.replace(helperDeleteSingle, helperDeleteSingle + "\n\n" + helperBulkDelete);
}

fs.writeFileSync(file, content);
console.log('Patched master.routes.ts');

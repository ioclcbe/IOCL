const { PrismaClient } = require("./node_modules/@prisma/client");
const prisma = new PrismaClient();

async function wipeAll() {
  console.log("Wiping transactional data...");
  await prisma.gateEntry.deleteMany({});
  await prisma.crewPass.deleteMany({});
  await prisma.auditLog.deleteMany({});
  
  console.log("Wiping master data...");
  await prisma.driver.deleteMany({});
  await prisma.helper.deleteMany({});
  await prisma.tankTruck.deleteMany({});
  
  console.log("All data successfully wiped! The database is fresh.");
}

wipeAll()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

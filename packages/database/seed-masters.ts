import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function seed() {
  console.log("Seeding drivers...");
  const dummyDrivers = Array.from({ length: 20 }).map((_, i) => ({
    name: `Driver Test ${i + 1}`,
    drivingLicenseNumber: `DL${String(i + 1).padStart(12, '0')}`,
    drivingLicenseExpiryDate: new Date("2030-12-31"),
    passValidUntil: new Date("2026-12-31"),
    defaultTruckNumber: `TN12AB${String(i + 1000).padStart(4, '0')}`,
    isActive: true
  }));
  
  await db.driver.createMany({
    data: [
      { name: "Rajesh Kumar", drivingLicenseNumber: "DL1420110012345", drivingLicenseExpiryDate: new Date("2030-12-31"), passValidUntil: new Date("2026-12-31"), defaultTruckNumber: "TN12AB3456", isActive: true },
      { name: "Amit Singh", drivingLicenseNumber: "UP3220150098765", drivingLicenseExpiryDate: new Date("2028-06-15"), passValidUntil: new Date("2026-12-31"), defaultTruckNumber: "MH04CD7890", isActive: true },
      { name: "Suresh Babu", drivingLicenseNumber: "TN0920190055443", drivingLicenseExpiryDate: new Date("2029-01-20"), passValidUntil: new Date("2027-01-20"), defaultTruckNumber: "UP32EF1234", isActive: true },
      ...dummyDrivers
    ],
    skipDuplicates: true
  });

  console.log("Seeding helpers...");
  const dummyHelpers = Array.from({ length: 20 }).map((_, i) => ({
    name: `Helper Test ${i + 1}`,
    helperPassNumber: `HP-2024-${String(i + 1).padStart(3, '0')}`,
    isActive: true
  }));

  await db.helper.createMany({
    data: [
      { name: "Manoj Das", helperPassNumber: "HP-2024-001", isActive: true },
      { name: "Vikas Yadav", helperPassNumber: "HP-2024-002", isActive: true },
      { name: "Karan Sharma", helperPassNumber: "HP-2024-003", isActive: true },
      ...dummyHelpers
    ],
    skipDuplicates: true
  });

  console.log("Seeding trucks...");
  const dummyTrucks = Array.from({ length: 20 }).map((_, i) => ({
    ttNumber: `TN12AB${String(i + 1000).padStart(4, '0')}`,
    isActive: true
  }));

  await db.tankTruck.createMany({
    data: [
      { ttNumber: "TN12AB3456", isActive: true },
      { ttNumber: "MH04CD7890", isActive: true },
      { ttNumber: "UP32EF1234", isActive: true },
      ...dummyTrucks
    ],
    skipDuplicates: true
  });

  console.log("Seed complete.");
}

seed().catch(console.error).finally(() => db.$disconnect());

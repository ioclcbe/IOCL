import { CrewType, PrismaClient, UserRole } from "@prisma/client";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function upsertUser(employeeCode: string, name: string, role: UserRole, passwordHash: string) {
  await prisma.user.upsert({
    where: { employeeCode },
    update: { name, role, isActive: true, passwordHash, failedLoginAttempts: 0, lockedUntil: null },
    create: { employeeCode, name, passwordHash, role },
  });
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "true") {
    throw new Error("Demo seeding is blocked in production. Use db:provision-user and the approved master-data import process.");
  }
  const passwordHash = await bcrypt.hash("Gate@123", 12);

  await upsertUser("SEC1001", "Rajesh Kumar", UserRole.ENTRY_GATE_SECURITY, passwordHash);
  await upsertUser("SUP2001", "Gate Supervisor", UserRole.SUPERVISOR, passwordHash);
  await upsertUser("EXIT3001", "Exit Gate Security", UserRole.EXIT_GATE_SECURITY, passwordHash);
  await upsertUser("ADM9001", "System Administrator", UserRole.ADMIN, passwordHash);


  const legacyPayload = [
    "Crew Id:IOC11965186D0010",
    "Name:RAGUPRABAHAR C",
    "Crew Type:Driver",
    "Pass Valid Upto:03/08/2025",
    "TT No:TN74AZ8730",
    "DL No:Tn7420210005690",
    "DL Expiry Date:02/07/2026",
  ].join("\n");
  const futurePayload = [
    "Crew Id:IOC11965186D0020",
    "Name:KARTHIKEYAN M",
    "Crew Type:Driver With Helper",
    "Pass Valid Upto:31/12/2028",
    "TT No:TN59CL2839",
    "DL No:TN5920210007788",
    "DL Expiry Date:30/11/2029",
  ].join("\n");

  const passes = [
    {
      qrToken: crypto.createHash("sha256").update(legacyPayload).digest("hex"),
      crewId: "IOC11965186D0010",
      driverName: "RAGUPRABAHAR C",
      crewType: CrewType.DRIVER,
      passValidUntil: new Date("2025-08-03T00:00:00.000Z"),
      ttNumberOnPass: "TN74AZ8730",
      drivingLicenseNumber: "Tn7420210005690",
      drivingLicenseExpiryDate: new Date("2026-07-02T00:00:00.000Z"),
      sourceSystem: "RAW_TEXT_QR",
      sourcePayload: { format: "IOCL_LEGACY_MULTILINE_V1", sample: "CLIENT_EXPIRED" },
    },
    {
      qrToken: crypto.createHash("sha256").update(futurePayload).digest("hex"),
      crewId: "IOC11965186D0020",
      driverName: "KARTHIKEYAN M",
      crewType: CrewType.DRIVER_WITH_HELPER,
      passValidUntil: new Date("2028-12-31T00:00:00.000Z"),
      ttNumberOnPass: "TN59CL2839",
      drivingLicenseNumber: "TN5920210007788",
      drivingLicenseExpiryDate: new Date("2029-11-30T00:00:00.000Z"),
      sourceSystem: "RAW_TEXT_QR",
      sourcePayload: { format: "IOCL_LEGACY_MULTILINE_V1", sample: "FUTURE_VALID" },
    },
    {
      qrToken: "IOCL:CREW:CRW-20841",
      crewId: "CRW-20841",
      driverName: "Mahesh Yadav",
      crewType: CrewType.DRIVER_WITH_HELPER,
      passValidUntil: new Date("2027-03-31T00:00:00.000Z"),
      ttNumberOnPass: "UP53GT4821",
      drivingLicenseNumber: "UP5320140018291",
      drivingLicenseExpiryDate: new Date("2029-11-18T00:00:00.000Z"),
      sourceSystem: "DEMO_MASTER",
      sourcePayload: { source: "DEMO_MASTER", version: 2 },
    },
    {
      qrToken: "IOCL:CREW:CRW-30215",
      crewId: "CRW-30215",
      driverName: "Sunil Sharma",
      crewType: CrewType.DRIVER,
      passValidUntil: new Date("2027-12-31T00:00:00.000Z"),
      ttNumberOnPass: "HR38AB7724",
      drivingLicenseNumber: "HR3820160049382",
      drivingLicenseExpiryDate: new Date("2029-08-06T00:00:00.000Z"),
      sourceSystem: "DEMO_MASTER",
      sourcePayload: { source: "DEMO_MASTER", version: 2 },
    },
    {
      qrToken: "IOCL:CREW:CRW-44109",
      crewId: "CRW-44109",
      driverName: "Vijay Singh",
      crewType: CrewType.CONTRACT_CREW,
      passValidUntil: new Date("2027-06-30T00:00:00.000Z"),
      ttNumberOnPass: "UP32MN9087",
      drivingLicenseNumber: "UP3220180065412",
      drivingLicenseExpiryDate: new Date("2030-01-15T00:00:00.000Z"),
      sourceSystem: "DEMO_MASTER",
      sourcePayload: { source: "DEMO_MASTER", version: 2 },
    },
  ];

  for (const pass of passes) {
    await prisma.crewPass.upsert({ where: { crewId: pass.crewId }, update: pass, create: pass });
  }

  const destinations = [
    ["VASUGI", "VASUGI AGENCIES", 10],
    ["CBE-TML", "Coimbatore Smart Terminal", 20],
    ["TRI-DEP", "Trichy Retail Depot", 30],
    ["DGL-DEP", "Dindigul Depot", 40],
    ["TEN-DEP", "Tirunelveli Depot", 50],
  ] as const;

  for (const [code, name, displayOrder] of destinations) {
    await prisma.customerDestination.upsert({
      where: { code },
      update: { name, displayOrder, isActive: true },
      create: { code, name, displayOrder },
    });
  }
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });

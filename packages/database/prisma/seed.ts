import { CrewType, PrismaClient, UserRole } from "@prisma/client";
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

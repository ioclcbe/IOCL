const { PrismaClient } = require("./node_modules/@prisma/client");
const prisma = new PrismaClient();

async function test() {
  console.log("Connecting...");
  const user = await prisma.user.findFirst();
  console.log("Found:", user);
}
test().catch(e => { console.error("FAILED:", e); }).finally(() => prisma.$disconnect());

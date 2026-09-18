const { PrismaClient } = require('./packages/database/node_modules/@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.gateEntry.count();
  console.log('Total GateEntries:', count);
}
main().catch(console.error).finally(() => prisma.$disconnect());

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('./packages/database/node_modules/@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const passwordHash = await bcrypt.hash('Gate@123', 12);
  await prisma.user.upsert({
    where: { employeeCode: 'ADM9001' },
    update: { passwordHash, isActive: true },
    create: { employeeCode: 'ADM9001', name: 'Admin', role: 'ADMIN', passwordHash }
  });
  console.log('Admin user seeded.');
}
main().catch(console.error).finally(() => prisma.$disconnect());

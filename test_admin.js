const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const admin = await prisma.user.findUnique({ where: { employeeCode: 'ADM9001' } });
  console.log('Found ADM9001:', !!admin);
}
main().catch(console.error).finally(() => prisma.$disconnect());

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testDates() {
  try {
    const driver = await prisma.driver.upsert({
      where: { drivingLicenseNumber: 'DL-TEXT-TEST' },
      update: {
        name: 'Test Text Driver',
        drivingLicenseExpiryDate: 'fade',
        passValidUntil: 'name',
      },
      create: {
        name: 'Test Text Driver',
        drivingLicenseNumber: 'DL-TEXT-TEST',
        drivingLicenseExpiryDate: 'fade',
        passValidUntil: 'name',
        crewId: 'M-TEXT123',
        crewType: 'DRIVER'
      }
    });
    console.log('Successfully inserted driver with text dates:', driver);

    const check = await prisma.driver.findUnique({
      where: { id: driver.id }
    });
    console.log('Successfully retrieved from DB:', check.drivingLicenseExpiryDate, check.passValidUntil);

  } catch (e) {
    console.error('Error during DB test:', e);
  } finally {
    await prisma.$disconnect();
  }
}

testDates();

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  try {
    const driver = await prisma.driver.upsert({
      where: { drivingLicenseNumber: 'DL-CHECK-1122' },
      update: {
        name: 'check1',
        drivingLicenseExpiryDate: null,
        passValidUntil: null,
      },
      create: {
        name: 'check1',
        drivingLicenseNumber: 'DL-CHECK-1122',
        drivingLicenseExpiryDate: null,
        passValidUntil: null,
        crewId: 'M-MH01AB1234',
        crewType: 'DRIVER_WITH_HELPER'
      }
    });
    console.log('Inserted driver:', driver.name);

    const helper = await prisma.helper.upsert({
      where: { helperPassNumber: 'HP-CHECK-3344' },
      update: {
        name: 'check1',
        passValidUntil: null
      },
      create: {
        name: 'check1',
        helperPassNumber: 'HP-CHECK-3344',
        passValidUntil: null
      }
    });
    console.log('Inserted helper:', helper.name);

  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

seed();

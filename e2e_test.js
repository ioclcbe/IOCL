const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

const API_BASE = 'http://localhost:4000/api/v1';

// Helpers
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  try {
    const response = await fetch(url, options);
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else if (contentType && contentType.includes('text/csv')) {
      data = await response.text();
    } else if (contentType && contentType.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')) {
      data = await response.arrayBuffer();
    } else {
      data = await response.text();
    }
    return { status: response.status, data, headers: response.headers };
  } catch (err) {
    console.error(`Request Failed: ${url}`, err);
    return { status: 500, data: err.message };
  }
}

async function createExcel(filename, columns, rows) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');
  worksheet.columns = columns.map(c => ({ header: c, key: c }));
  worksheet.addRows(rows);
  const buffer = await workbook.xlsx.writeBuffer();
  fs.writeFileSync(filename, buffer);
  return buffer;
}

let tokens = {};

async function runTests() {
  console.log("=== PHASE 1: DB State ===");
  try {
    const users = await prisma.user.count();
    const drivers = await prisma.driver.count();
    const helpers = await prisma.helper.count();
    const trucks = await prisma.tankTruck.count();
    const entries = await prisma.gateEntry.count();
    const crewPasses = await prisma.crewPass.count();
    
    console.log(`DB Counts -> Users: ${users}, Drivers: ${drivers}, Helpers: ${helpers}, Trucks: ${trucks}, Gate Entries: ${entries}, Crew Passes: ${crewPasses}`);
    console.log("PHASE 1: PASS");
  } catch (err) {
    console.error("PHASE 1: FAIL", err);
  }

  console.log("\n=== PHASE 2: Auth Tests ===");
  const usersToTest = [
    { code: 'ADM9001', role: 'Admin' },
    { code: 'SUP2001', role: 'Supervisor' },
    { code: 'SEC1001', role: 'Security' }
  ];
  const passwords = ['Gate@123'];

  for (const u of usersToTest) {
    let success = false;
    let lastRes;
    for (const p of passwords) {
      const res = await request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeCode: u.code, password: p })
      });
      lastRes = res;
      if (res.status === 200) {
        tokens[u.code] = res.data.data.accessToken;
        console.log(`Login SUCCESS for ${u.code} (${u.role}) with pass: ${p}`);
        success = true;
        break;
      }
    }
    if (!success) {
      console.log(`Login FAILED for ${u.code} (${u.role}) - res:`, lastRes?.status, lastRes?.data);
    }
  }
  if (tokens['ADM9001'] && tokens['SUP2001'] && tokens['SEC1001']) {
    console.log("PHASE 2: PASS");
  } else {
    console.log("PHASE 2: FAIL");
  }

  console.log("\n=== PHASE 3: Master Data Upload Tests ===");
  try {
    const adminToken = tokens['ADM9001'];
    const authHeaders = { 'Authorization': `Bearer ${adminToken}` };

    // 1. Trucks
    const truckFilename = 'test_trucks.xlsx';
    await createExcel(truckFilename, ['Tank Truck Number'], [
      { 'Tank Truck Number': 'TN-01-AB-1001' },
      { 'Tank Truck Number': 'TN-01-AB-1002' },
      { 'Tank Truck Number': 'TN-01-AB-1003' },
      { 'Tank Truck Number': 'TN-01-AB-1004' },
      { 'Tank Truck Number': 'TN-01-AB-1005' },
    ]);
    let fd = new FormData();
    fd.append('file', new File([fs.readFileSync(truckFilename)], truckFilename, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    let res = await request('/masters/trucks/upload', { method: 'POST', headers: authHeaders, body: fd });
    console.log("Trucks upload res:", res.status, res.data);
    if (fs.existsSync(truckFilename)) fs.unlinkSync(truckFilename);

    // 2. Drivers
    const driverFilename = 'test_drivers.xlsx';
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await createExcel(driverFilename, ['Name', 'Driving License Number', 'DL Expiry Date', 'Pass Valid Until'], [
      { 'Name': 'Driver 1', 'Driving License Number': 'DL1001', 'DL Expiry Date': dateStr, 'Pass Valid Until': dateStr },
      { 'Name': 'Driver 2', 'Driving License Number': 'DL1002', 'DL Expiry Date': dateStr, 'Pass Valid Until': dateStr },
      { 'Name': 'Driver 3', 'Driving License Number': 'DL1003', 'DL Expiry Date': dateStr, 'Pass Valid Until': dateStr },
      { 'Name': 'Driver 4', 'Driving License Number': 'DL1004', 'DL Expiry Date': dateStr, 'Pass Valid Until': dateStr },
      { 'Name': 'Driver 5', 'Driving License Number': 'DL1005', 'DL Expiry Date': dateStr, 'Pass Valid Until': dateStr },
    ]);
    fd = new FormData();
    fd.append('file', new File([fs.readFileSync(driverFilename)], driverFilename, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    res = await request('/masters/drivers/upload', { method: 'POST', headers: authHeaders, body: fd });
    console.log("Drivers upload res:", res.status, res.data);
    if (fs.existsSync(driverFilename)) fs.unlinkSync(driverFilename);

    // 3. Helpers
    const helperFilename = 'test_helpers.xlsx';
    await createExcel(helperFilename, ['Crew Id', 'Name', 'Pass Valid Until', 'TT No', 'Helper Pass Number'], [
      { 'Crew Id': 'H1001', 'Name': 'Helper 1', 'Pass Valid Until': dateStr, 'TT No': 'TN-01-AB-1001', 'Helper Pass Number': 'HP1001' },
      { 'Crew Id': 'H1002', 'Name': 'Helper 2', 'Pass Valid Until': dateStr, 'TT No': 'TN-01-AB-1002', 'Helper Pass Number': 'HP1002' },
      { 'Crew Id': 'H1003', 'Name': 'Helper 3', 'Pass Valid Until': dateStr, 'TT No': 'TN-01-AB-1003', 'Helper Pass Number': 'HP1003' },
      { 'Crew Id': 'H1004', 'Name': 'Helper 4', 'Pass Valid Until': dateStr, 'TT No': 'TN-01-AB-1004', 'Helper Pass Number': 'HP1004' },
      { 'Crew Id': 'H1005', 'Name': 'Helper 5', 'Pass Valid Until': dateStr, 'TT No': 'TN-01-AB-1005', 'Helper Pass Number': 'HP1005' },
    ]);
    fd = new FormData();
    fd.append('file', new File([fs.readFileSync(helperFilename)], helperFilename, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    res = await request('/masters/helpers/upload', { method: 'POST', headers: authHeaders, body: fd });
    console.log("Helpers upload res:", res.status, res.data);
    if (fs.existsSync(helperFilename)) fs.unlinkSync(helperFilename);
    console.log("PHASE 3: Finished, review output.");
  } catch (err) {
    console.error("PHASE 3: FAIL", err);
  }

  console.log("\n=== PHASE 4: Manual Entry Flow ===");
  let entryId = null;
  try {
    const secToken = tokens['SEC1001'];
    const authHeaders = { 'Authorization': `Bearer ${secToken}`, 'Content-Type': 'application/json' };
    
    // Create manual pass
    const passPayload = {
      driverName: 'Driver 1',
      ttNumberOnPass: 'TN-01-AB-1001',
      drivingLicenseNumber: 'DL1001',
      drivingLicenseExpiryDate: '2030-01-01',
      passValidUntil: '2030-01-01',
      crewType: 'DRIVER_WITH_HELPER'
    };
    let res = await request('/crew-passes/manual', { method: 'POST', headers: authHeaders, body: JSON.stringify(passPayload) });
    console.log("Manual Pass res:", res.status, res.data);
    
    const passData = res.data?.data || res.data;
    const passId = passData?.id || passData?.crewPass?.id;
    console.log("Pass ID:", passId);

    if (passId) {
      // Create gate entry
      const entryPayload = {
        crewPassId: passId,
        qrScanMethod: 'MANUAL',
        actualTankTruckNumber: 'TN-01-AB-1001',
        abs: true,
        driverSignatureConfirmed: true,
        helperName: 'Helper 1',
        helperPassNumber: 'HP1001',
        safetyChecklist: {
          drivingLicenseValidCmvRule9: true, verifyRegisterColumn1: true, verifyRegisterColumn2: true, ppeAvailable: true,
          rubberHoseCumLockCouplingGttMarked: true, sparkArrestorCcoeApproved: true, tremCardAndTrainingCardAvailable: true,
          selfStarterWorking: true, batteryTerminalRubberCovers: true, noContainerCanExplosivesInCabin: true, vmuWorking: true,
          truckTyreConditionAcceptable: true, batteryCutOffSwitchCondition: true, handBrakeWorking: true, earthCleatProvided: true,
          inspectionArea: "FRONT", sealNumber: "S-1", verifiedBy: "Admin", verificationNotes: "OK"
        }
      };
      res = await request('/gate-entries', { method: 'POST', headers: authHeaders, body: JSON.stringify(entryPayload) });
      console.log("Gate Entry res:", res.status, res.data);
      
      const entryData = res.data?.data || res.data;
      entryId = entryData?.id || entryData?.entry?.id;
      console.log("Entry ID:", entryId);
    }

    // Verify
    res = await request('/gate-entries', { method: 'GET', headers: { 'Authorization': `Bearer ${secToken}` } });
    console.log("Gate Entries Get res status:", res.status);
    
  } catch (err) {
    console.error("PHASE 4: FAIL", err);
  }

  console.log("\n=== PHASE 5: OUT Gate Exit ===");
  try {
    const adminToken = tokens['ADM9001'];
    const authHeaders = { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
    
    if (!entryId) {
      let res = await request('/gate-entries', { method: 'GET', headers: { 'Authorization': `Bearer ${adminToken}` } });
      const entries = res.data?.data?.entries || res.data?.entries || res.data?.data || res.data;
      if (Array.isArray(entries) && entries.length > 0) {
        entryId = entries[0].id;
      }
    }
    
    if (entryId) {
      const randomInv1 = `Inv:MANUAL-${Math.floor(Math.random() * 1000000)} Dt:30.08.2026 Val:0 Veh:TN-01-AB-1001 Prd/Qty:BULK-MS/1000 Con:MANUAL`;
      let expectedVersion = 1;
      let getRes = await request(`/gate-entries/${entryId}`, { method: 'GET', headers: authHeaders });
      if (getRes.status === 200) {
         expectedVersion = getRes.data?.data?.recordVersion || 1;
      }
      const exitPayload = {
          expectedVersion: expectedVersion, 
          rawInvoiceQr: randomInv1,
          lockNumber: "123", 
          qtyMs: 1000
      };
      
      let res = await request(`/gate-entries/${entryId}/exit`, { method: 'POST', headers: authHeaders, body: JSON.stringify(exitPayload) });
      if (res.status === 404) {
         res = await request(`/gate-entries/${entryId}`, { method: 'PATCH', headers: authHeaders, body: JSON.stringify({ status: 'COMPLETED' }) });
      }
      console.log("Exit res:", res.status, res.data);
    } else {
      console.log("No entry ID found to exit");
    }
  } catch (err) {
    console.error("PHASE 5: FAIL", err);
  }

  console.log("\n=== PHASE 6: Export Test ===");
  try {
    const adminToken = tokens['ADM9001'];
    const authHeaders = { 'Authorization': `Bearer ${adminToken}` };
    
    let res = await request('/gate-entries/export.csv', { method: 'GET', headers: authHeaders });
    console.log("Export CSV status:", res.status);
    
    res = await request('/gate-entries/export.xlsx', { method: 'GET', headers: authHeaders });
    console.log("Export XLSX status:", res.status);
  } catch (err) {
    console.error("PHASE 6: FAIL", err);
  }

  console.log("\n=== PHASE 7: Admin APIs ===");
  try {
    const adminToken = tokens['ADM9001'];
    const authHeaders = { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
    
    let res = await request('/masters/trucks', { method: 'GET', headers: authHeaders });
    console.log("Get Trucks status:", res.status);
    
    res = await request('/masters/drivers', { method: 'GET', headers: authHeaders });
    console.log("Get Drivers status:", res.status);
    
    res = await request('/masters/helpers', { method: 'GET', headers: authHeaders });
    console.log("Get Helpers status:", res.status);
    
    res = await request('/masters/trucks', { method: 'GET', headers: authHeaders });
    const trucks = res.data?.data?.trucks || res.data?.trucks || res.data?.data || res.data;
    if (Array.isArray(trucks) && trucks.length > 0) {
      const ids = trucks.slice(0, 2).map(t => t.id);
      console.log("Deleting trucks:", ids);
      res = await request('/masters/trucks/bulk-delete', { method: 'POST', headers: authHeaders, body: JSON.stringify({ ids }) });
      console.log("Bulk delete res:", res.status, res.data);
    }
  } catch (err) {
    console.error("PHASE 7: FAIL", err);
  }
}

runTests().then(() => prisma.$disconnect()).catch(() => prisma.$disconnect());

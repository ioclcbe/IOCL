const test = async () => {
  const login = async (role) => {
    const creds = role === "IN" ? { employeeCode: "SEC1001", password: "Gate@123" } 
                : role === "OUT" ? { employeeCode: "EXIT3001", password: "Gate@123" }
                : { employeeCode: "ADM9001", password: "Gate@123" };
    const res = await fetch("http://localhost:4000/api/v1/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(creds)
    });
    if (!res.ok) throw new Error("Login failed");
    return (await res.json()).data.accessToken;
  };

  try {
    const truckId = `T-${Date.now().toString().slice(-6)}`;
    console.log("1. Login as ADMIN");
    const adminToken = await login("ADMIN");
    
    console.log("2. Create Master records");
    const ttRes = await fetch("http://localhost:4000/api/v1/masters/trucks", {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminToken}` },
      body: JSON.stringify({ ttNumber: truckId, isActive: true })
    });
    // ignore if exists
    
    console.log("3. Login as IN GATE");
    const inToken = await login("IN");

    console.log("4. Fetch Master Trucks");
    const trucksRes = await fetch("http://localhost:4000/api/v1/masters/trucks", {
      headers: { "Authorization": `Bearer ${inToken}` }
    });
    if (!trucksRes.ok) throw new Error(`Failed to fetch trucks: ${await trucksRes.text()}`);
    const trucks = await trucksRes.json();
    console.log(`Fetched ${trucks.data.length} trucks`);

    console.log("5. Create Manual Pass");
    const passRes = await fetch("http://localhost:4000/api/v1/crew-passes/manual", {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${inToken}` },
      body: JSON.stringify({
        driverName: "TEST DRIVER",
        ttNumberOnPass: truckId,
        drivingLicenseNumber: "DL12345",
        drivingLicenseExpiryDate: "2030-01-01",
        passValidUntil: "2030-01-01",
        crewType: "DRIVER"
      })
    });
    if (!passRes.ok) throw new Error(`Pass failed: ${await passRes.text()}`);
    const pass = await passRes.json();
    console.log("Pass created:", pass.data.id);

    console.log("6. Create IN Entry");
    const entryRes = await fetch("http://localhost:4000/api/v1/gate-entries", {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${inToken}` },
      body: JSON.stringify({
        crewPassId: pass.data.id,
        qrScanMethod: "MANUAL",
        actualTankTruckNumber: truckId,
        abs: true,
        driverSignatureConfirmed: true,
        safetyChecklist: {
          drivingLicenseValidCmvRule9: true, verifyRegisterColumn1: true, verifyRegisterColumn2: true, ppeAvailable: true,
          rubberHoseCumLockCouplingGttMarked: true, sparkArrestorCcoeApproved: true, tremCardAndTrainingCardAvailable: true,
          selfStarterWorking: true, batteryTerminalRubberCovers: true, noContainerCanExplosivesInCabin: true, vmuWorking: true,
          truckTyreConditionAcceptable: true, batteryCutOffSwitchCondition: true, handBrakeWorking: true, earthCleatProvided: true,
          inspectionArea: "FRONT", sealNumber: "S-1", verifiedBy: "Admin", verificationNotes: "OK"
        }
      })
    });
    if (!entryRes.ok) throw new Error(`Entry failed: ${await entryRes.text()}`);
    const entry = await entryRes.json();
    console.log("Entry created:", entry.data.id);

    console.log("7. Login as OUT GATE");
    const outToken = await login("OUT");

    console.log("8. Execute Manual EXIT");
    const outRes = await fetch(`http://localhost:4000/api/v1/gate-entries/${entry.data.id}/exit`, {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${outToken}` },
      body: JSON.stringify({
        expectedVersion: 1, 
        rawInvoiceQr: `Inv:MANUAL-123 Dt:30.08.2026 Val:0 Veh:${truckId} Prd/Qty:BULK-MS/1000 Con:MANUAL`,
        lockNumber: "123", 
        qtyMs: 1000
      })
    });
    if (!outRes.ok) throw new Error(`Exit failed: ${await outRes.text()}`);
    console.log("Exit successful!");

    console.log("✅ ALL TESTS PASSED");
  } catch (e) {
    console.error("❌ TEST FAILED:", e.message);
  }
};
test();

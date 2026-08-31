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

  const executeFlow = async (caseName, includeHelperInitially, addHelperLater) => {
    console.log(`\n=== Starting ${caseName} ===`);
    try {
      const truckId = `T-${Date.now().toString().slice(-6)}`;
      const inToken = await login("IN");
      const adminToken = await login("ADMIN");
      const outToken = await login("OUT");

      // 1. Create Pass
      console.log("-> Create Manual Pass");
      const passRes = await fetch("http://localhost:4000/api/v1/crew-passes/manual", {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${inToken}` },
        body: JSON.stringify({
          driverName: "TEST DRIVER " + caseName,
          ttNumberOnPass: truckId,
          drivingLicenseNumber: "DL12345",
          drivingLicenseExpiryDate: "2030-01-01",
          passValidUntil: "2030-01-01",
          crewType: includeHelperInitially ? "DRIVER_WITH_HELPER" : "DRIVER"
        })
      });
      if (!passRes.ok) throw new Error(`Pass failed: ${await passRes.text()}`);
      const pass = await passRes.json();

      // 2. Create IN Entry
      console.log("-> Create IN Entry");
      const payload = {
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
      };
      
      if (includeHelperInitially) {
        payload.helperName = "Helper Initial";
        payload.helperPassNumber = "HP-INITIAL-123";
      }

      const entryRes = await fetch("http://localhost:4000/api/v1/gate-entries", {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${inToken}` },
        body: JSON.stringify(payload)
      });
      if (!entryRes.ok) throw new Error(`Entry failed: ${await entryRes.text()}`);
      let entry = (await entryRes.json()).data;
      console.log("   Entry created:", entry.id);

      // 3. Add Helper Later (Edit mode via Admin)
      if (addHelperLater) {
        console.log("-> Add Helper Later via Edit");
        const updateRes = await fetch(`http://localhost:4000/api/v1/gate-entries/${entry.id}`, {
          method: "PATCH", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${adminToken}` },
          body: JSON.stringify({
            expectedVersion: entry.recordVersion,
            helperName: "Helper Added Later",
            helperPassNumber: "HP-LATER-999"
          })
        });
        if (!updateRes.ok) throw new Error(`Update failed: ${await updateRes.text()}`);
        entry = (await updateRes.json()).data;
        console.log("   Entry updated with helper");
      }

      // 4. Exit
      console.log("-> Execute Manual EXIT");
      const outRes = await fetch(`http://localhost:4000/api/v1/gate-entries/${entry.id}/exit`, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${outToken}` },
        body: JSON.stringify({
          expectedVersion: entry.recordVersion, 
          rawInvoiceQr: `Inv:MANUAL-123 Dt:30.08.2026 Val:0 Veh:${truckId} Prd/Qty:BULK-MS/1000 Con:MANUAL`,
          lockNumber: "123", 
          qtyMs: 1000
        })
      });
      if (!outRes.ok) throw new Error(`Exit failed: ${await outRes.text()}`);
      console.log(`o. ${caseName} PASSED`);
    } catch (e) {
      console.error(`?O ${caseName} FAILED:`, e.message);
    }
  };

  await executeFlow("CASE 1 (No Helper -> Edit Helper -> Exit)", false, true);
  await executeFlow("CASE 2 (Initial Helper -> Exit)", true, false);
};
test();

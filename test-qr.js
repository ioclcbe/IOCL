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
    const truckId = `T${Date.now().toString().slice(-6)}`;
    
    console.log("1. Login as IN GATE");
    const inToken = await login("IN");

    console.log("2. Resolve Physical Crew Pass");
    const passPayload = `Crew Id: P-${Date.now()}
Name: Test Scanned Driver
Crew Type: DRIVER
Pass Valid Upto: 30/12/2030
TT No: ${truckId}
DL No: DL99999
DL Expiry Date: 30/12/2030`;

    const passRes = await fetch("http://localhost:4000/api/v1/crew-passes/resolve", {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${inToken}` },
      body: JSON.stringify({ qrToken: passPayload })
    });
    if (!passRes.ok) throw new Error(`Pass resolve failed: ${await passRes.text()}`);
    const pass = await passRes.json();
    console.log("Scanned Pass created/resolved:", pass.data.id);

    console.log("3. Create IN Entry (Scanner Mode)");
    const entryRes = await fetch("http://localhost:4000/api/v1/gate-entries", {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${inToken}` },
      body: JSON.stringify({
        crewPassId: pass.data.id,
        qrScanMethod: "CAMERA",
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

    console.log("4. Login as OUT GATE");
    const outToken = await login("OUT");

    console.log("5. Execute QR Scanned EXIT");
    const exitInvoice = `Inv:INV${Date.now().toString().slice(-6)} Dt:30.12.2030 Val:100.5 Veh:${truckId} Prd/Qty:BULK-MS/5000 Con:Test Consignee`;
    const outRes = await fetch(`http://localhost:4000/api/v1/gate-entries/${entry.data.id}/exit`, {
      method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${outToken}` },
      body: JSON.stringify({
        expectedVersion: 1, 
        rawInvoiceQr: exitInvoice,
        lockNumber: "789", 
        qtyMs: 5000
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

const ExcelJS = require("./node_modules/exceljs");
const path = require("path");

async function generate() {
  // Generate Lean Drivers
  const driverWorkbook = new ExcelJS.Workbook();
  const driverSheet = driverWorkbook.addWorksheet("Drivers");
  
  driverSheet.addRow([
    "Name", 
    "Driving License Number", 
    "DL Expiry Date", 
    "Pass Valid Until"
  ]);
  
  for (let i = 1; i <= 40; i++) {
    const yearDl = 2028 + (i % 3);
    const yearPass = 2026 + (i % 2);
    
    const dlExp = "15/0" + (1 + (i % 9)) + "/" + yearDl;
    const passExp = "15/0" + (1 + (i % 9)) + "/" + yearPass;
    
    driverSheet.addRow([
      "Driver Raj " + i,
      "DL-2026-" + String(i).padStart(3, "0"),
      dlExp,
      passExp
    ]);
  }
  driverSheet.columns.forEach(column => { column.width = 25; });
  await driverWorkbook.xlsx.writeFile(path.join(__dirname, "dummy_drivers_lean.xlsx"));

  // Generate Lean Trucks (just to give them exactly what they asked)
  const truckWorkbook = new ExcelJS.Workbook();
  const truckSheet = truckWorkbook.addWorksheet("Trucks");
  truckSheet.addRow(["Tank Truck Number"]);
  for (let i = 1; i <= 40; i++) {
    truckSheet.addRow(["TN12AB" + (1000 + i)]);
  }
  truckSheet.columns.forEach(column => { column.width = 25; });
  await truckWorkbook.xlsx.writeFile(path.join(__dirname, "dummy_trucks_lean.xlsx"));

  console.log("Dummy Excel files generated!");
}

generate().catch(console.error);

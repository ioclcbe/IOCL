const ExcelJS = require("exceljs");
const path = require("path");

async function generate() {
  const driverWorkbook = new ExcelJS.Workbook();
  const driverSheet = driverWorkbook.addWorksheet("Drivers");
  
  driverSheet.addRow([
    "Name", 
    "Driving License Number", 
    "DL Expiry Date", 
    "Pass Valid Until",
    "Default Truck Number",
    "Crew ID",
    "Crew Type"
  ]);
  
  driverSheet.addRow([
    "check1",         
    "DL-CHECK-1122",  
    "",               
    "",               
    "MH01AB1234",     
    "M-MH01AB1234",   
    "DRIVER"          
  ]);
  
  driverSheet.columns.forEach(column => { column.width = 25; });
  await driverWorkbook.xlsx.writeFile(path.join(__dirname, "dummy_check1_driver.xlsx"));

  const helperWorkbook = new ExcelJS.Workbook();
  const helperSheet = helperWorkbook.addWorksheet("Helpers");
  
  helperSheet.addRow([
    "Name", 
    "Helper Pass Number", 
    "Pass Valid Until"
  ]);
  
  helperSheet.addRow([
    "check1",         
    "HP-CHECK-3344",  
    ""                
  ]);
  
  helperSheet.columns.forEach(column => { column.width = 25; });
  await helperWorkbook.xlsx.writeFile(path.join(__dirname, "dummy_check1_helper.xlsx"));

  console.log("Dummy check1 Excel files generated!");
}

generate().catch(console.error);

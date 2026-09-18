const ExcelJS = require('exceljs');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

async function testUpload() {
  console.log('Generating dummy truck excel...');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Trucks');
  sheet.addRow(['SL.NO', 'TT Number', 'Capacity']);
  sheet.addRow(['1', 'TN74AZ8730', '10000']);
  
  await workbook.xlsx.writeFile('dummy_trucks.xlsx');
  
  console.log('Uploading to API...');
  const formData = new FormData();
  formData.append('file', fs.createReadStream('dummy_trucks.xlsx'));

  try {
    const res = await axios.post('http://localhost:4000/api/v1/master/trucks/upload', formData, {
      headers: {
        ...formData.getHeaders(),
        // We might need auth for this. The route has uthorize(UserRole.ADMIN).
      }
    });
    console.log('Upload success:', res.data);
  } catch (err) {
    console.error('Upload failed with auth (expected if no token provided):', err.response?.status, err.response?.data);
  }
}
testUpload();

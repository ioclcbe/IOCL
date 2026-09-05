const fs = require('fs');
let file = fs.readFileSync('apps/api/src/modules/crewPass/crew-pass.routes.ts', 'utf8');

const isPastDateCode = 
function isPastDate(val) {
  if (!val) return false;
  const d = new Date(val);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(today.getHours() - 6);
  today.setHours(0,0,0,0);
  return d < today;
}
;

file = file.replace(/const router = Router\(\);/g, isPastDateCode + '\nconst router = Router();');

file = file.replace(/passValidUntil: parseDate\(payload\.crewPassValidUntil\)/g, 'passValidUntil: payload.crewPassValidUntil');
file = file.replace(/drivingLicenseExpiryDate: parseDate\(payload\.drivingLicenseValidity\)/g, 'drivingLicenseExpiryDate: payload.drivingLicenseValidity');

file = file.replace(/pass\.passValidUntil \&\& pass\.passValidUntil < businessDate/g, 'isPastDate(pass.passValidUntil)');
file = file.replace(/pass\.drivingLicenseExpiryDate \&\& pass\.drivingLicenseExpiryDate < businessDate/g, 'isPastDate(pass.drivingLicenseExpiryDate)');
file = file.replace(/pass\.passValidUntil < businessDate/g, 'isPastDate(pass.passValidUntil)');
file = file.replace(/pass\.drivingLicenseExpiryDate < businessDate/g, 'isPastDate(pass.drivingLicenseExpiryDate)');

fs.writeFileSync('apps/api/src/modules/crewPass/crew-pass.routes.ts', file);

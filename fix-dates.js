const fs = require('fs');
let file = fs.readFileSync('apps/api/src/modules/gateEntry/gate-entry.service.ts', 'utf8');

const isPastDateCode = 
const isPastDate = (val) => {
  if (!val) return false;
  const d = new Date(val);
  if (isNaN(d.getTime())) return false; // Not a parseable date, so don't warn
  // Need to import getBusinessDate if not imported, but it's local in this file
  const today = new Date();
  today.setHours(today.getHours() - 6);
  today.setHours(0,0,0,0);
  return d < today;
};
;

file = file.replace(/const getBusinessDate = \(\) =>/, isPastDateCode + '\nconst getBusinessDate = () =>');

file = file.replace(/if \(pass\.passValidUntil \&\& pass\.passValidUntil < businessDate\)/g, 'if (isPastDate(pass.passValidUntil))');
file = file.replace(/if \(pass\.drivingLicenseExpiryDate \&\& pass\.drivingLicenseExpiryDate < businessDate\)/g, 'if (isPastDate(pass.drivingLicenseExpiryDate))');
file = file.replace(/if \(entry\.passValidUntil \&\& entry\.passValidUntil < today\)/g, 'if (isPastDate(entry.passValidUntil))');
file = file.replace(/if \(entry\.drivingLicenseExpiryDate \&\& entry\.drivingLicenseExpiryDate < today\)/g, 'if (isPastDate(entry.drivingLicenseExpiryDate))');
file = file.replace(/const hasExpiryWarning = \(before\.passValidUntil \&\& before\.passValidUntil < today\) \|\| \(before\.drivingLicenseExpiryDate \&\& before\.drivingLicenseExpiryDate < today\);/g, 'const hasExpiryWarning = isPastDate(before.passValidUntil) || isPastDate(before.drivingLicenseExpiryDate);');

fs.writeFileSync('apps/api/src/modules/gateEntry/gate-entry.service.ts', file);

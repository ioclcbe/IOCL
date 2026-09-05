const fs = require('fs');
let file = fs.readFileSync('apps/web/app/(portal)/entries/page.tsx', 'utf8');

file = file.replace(
  /const inPanel = useEntriesPanel\("IN"\);/,
  'const inPanel = useEntriesPanel();'
);

file = file.replace(
  /Vehicles currently inside the facility/,
  'All vehicles that entered the facility today'
);

file = file.replace(
  /<Panel\s+title="IN-Gate Records"/,
  '<Panel\n              panelType="in"\n              title="IN-Gate Records"'
);

file = file.replace(
  /<Panel\s+title="OUT-Gate Records"/,
  '<Panel\n              panelType="out"\n              title="OUT-Gate Records"'
);

fs.writeFileSync('apps/web/app/(portal)/entries/page.tsx', file);

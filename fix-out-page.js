const fs = require('fs');
let file = fs.readFileSync('apps/web/app/(portal)/out/page.tsx', 'utf8');

file = file.replace(
  /import \{ resolveExitInvoice, submitExit \} from "\.\.\/\.\.\/\.\.\/lib\/api";/,
  'import { resolveExitInvoice, submitExit, listEntries } from "../../../lib/api";'
);

file = file.replace(
  /export default function OutGatePage\(\) \{/,
  'export default function OutGatePage() {\n  const [inRecords, setInRecords] = useState<GateEntryRecord[]>([]);\n  const [showSearchDrop, setShowSearchDrop] = useState(false);\n  useEffect(() => { listEntries({ status: "IN", pageSize: 500 }).then(res => setInRecords(res.data)).catch(console.error); }, []);'
);

file = file.replace(
  /<label className="field-label">Tank Truck Number <span className="text-red-500">\*<\/span><\/label>\s*<div className="flex gap-3">\s*<input\s*className="field-input flex-1 text-lg font-black uppercase"\s*placeholder="e\.g\. TN74AZ8730"\s*value=\{manualTruck\}\s*onChange=\{\(e\) => setManualTruck\(e\.target\.value\.replace\(\/\[\^A-Za-z0-9\]\/g, ""\)\.toUpperCase\(\)\)\}\s*onKeyDown=\{\(e\) => \{ if \(e\.key === "Enter"\) void lookupByTruck\(\); \}\}\s*\/>\s*<Button type="button" loading=\{loading\} onClick=\{\(\) => void lookupByTruck\(\)\} icon=\{<Truck className="h-5 w-5" \/>\}>\s*Find IN Record\s*<\/Button>\s*<\/div>/,
  \<label className="field-label">Search IN Record <span className="text-red-500">*\</span></label>
                  <div className="flex gap-3 relative">
                    <input
                      className="field-input flex-1 text-lg font-black uppercase"
                      placeholder="e.g. TN74AZ8730 or DRIVER or DL"
                      value={manualTruck}
                      onFocus={() => setShowSearchDrop(true)}
                      onBlur={() => setTimeout(() => setShowSearchDrop(false), 200)}
                      onChange={(e) => setManualTruck(e.target.value.toUpperCase())}
                      onKeyDown={(e) => { if (e.key === "Enter") void lookupByTruck(); }}
                    />
                    <Button type="button" loading={loading} onClick={() => void lookupByTruck()} icon={<Truck className="h-5 w-5" />}>
                      Find IN Record
                    </Button>
                    {showSearchDrop && manualTruck.length > 0 && (
                      <ul className="absolute top-[105%] left-0 z-20 max-h-64 w-[calc(100%-180px)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
                        {inRecords.filter(r => r.actualTankTruckNumber.includes(manualTruck) || r.driverName.toUpperCase().includes(manualTruck) || r.drivingLicenseNumber.toUpperCase().includes(manualTruck)).map(r => (
                          <li key={r.id} className="cursor-pointer px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0" onClick={() => {
                            setManualTruck(r.actualTankTruckNumber);
                            setShowSearchDrop(false);
                          }}>
                            <div className="font-bold text-sm text-iocl-navy">{r.actualTankTruckNumber}</div>
                            <div className="text-[11px] font-mono text-slate-500">Driver: {r.driverName} | DL: {r.drivingLicenseNumber}</div>
                          </li>
                        ))}
                        {inRecords.filter(r => r.actualTankTruckNumber.includes(manualTruck) || r.driverName.toUpperCase().includes(manualTruck) || r.drivingLicenseNumber.toUpperCase().includes(manualTruck)).length === 0 && (
                          <li className="px-4 py-3 text-sm text-slate-500 text-center">No open IN records found matching search</li>
                        )}
                      </ul>
                    )}
                  </div>\
);

fs.writeFileSync('apps/web/app/(portal)/out/page.tsx', file);

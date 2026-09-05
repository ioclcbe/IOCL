const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'apps', 'web', 'components', 'entry', 'entry-wizard.tsx');
let content = fs.readFileSync(file, 'utf-8');

content = content.replace(/ttNumberOnPass: d\.defaultTruckNumber \|\| p\.ttNumberOnPass,\s*/g, '');

const stateOld = 'const [showDriverDlDrop, setShowDriverDlDrop] = useState(false);';
const stateNew = 'const [showDriverDlDrop, setShowDriverDlDrop] = useState(false);\n  const [showTtDrop, setShowTtDrop] = useState(false);';
content = content.replace(stateOld, stateNew);

const fieldOld = `<ManualField label="TT Number on Pass *" error={manualDriverErrors.ttNumberOnPass}>
                      <input
                        readOnly
                        className="field-input bg-slate-100 cursor-not-allowed text-slate-600 font-mono uppercase"
                        value={manualDriver.ttNumberOnPass}
                      />
                    </ManualField>`;

const fieldNew = `<ManualField label="TT Number on Pass *" error={manualDriverErrors.ttNumberOnPass}>
                      <div className="relative">
                        <input
                          className="field-input font-mono uppercase"
                          placeholder="Type to search Truck..."
                          value={manualDriver.ttNumberOnPass}
                          onFocus={() => setShowTtDrop(true)}
                          onBlur={() => setTimeout(() => setShowTtDrop(false), 200)}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase();
                            setManualDriver(p => ({ ...p, ttNumberOnPass: val }));
                          }}
                        />
                        {showTtDrop && manualDriver.ttNumberOnPass.length > 0 && (
                          <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">
                            {masterTrucks.filter(t => t.ttNumber.includes(manualDriver.ttNumberOnPass)).map(t => (
                              <li key={t.id} className="cursor-pointer px-4 py-2 hover:bg-slate-50 border-b border-slate-50 last:border-0" onMouseDown={() => {
                                setManualDriver(p => ({ ...p, ttNumberOnPass: t.ttNumber }));
                                setShowTtDrop(false);
                              }}>
                                <div className="font-bold text-sm text-iocl-navy">{t.ttNumber}</div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </ManualField>`;
content = content.replace(fieldOld, fieldNew);

content = content.replace(/ \{d\.defaultTruckNumber \? `\(TT: \$\{d\.defaultTruckNumber\}\)` : ''\}/g, '');

fs.writeFileSync(file, content);
console.log('Patched');

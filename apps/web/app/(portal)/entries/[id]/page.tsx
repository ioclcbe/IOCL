"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { IN_GATE_SAFETY_ITEMS, type GateEntryRecord, type SafetyCheckKey, type UpdateGateEntryInput } from "@iocl/shared";
import { AlertTriangle, ArrowLeft, CalendarDays, CheckCircle2, Clock3, Edit3, FileLock2, Printer, RefreshCw, Save, ShieldCheck, Truck, UserRound, X, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { getEntry, updateEntry, updateExitQuantities, resolvePass } from "../../../../lib/api";
import { useAuth } from "../../../../lib/auth-context";
import { formatIndiaDate, formatIndiaTime, normalizeTruck } from "../../../../lib/utils";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { YesNoToggle } from "../../../../components/ui/toggle";
import { QRScanner } from "../../../../components/entry/qr-scanner";

export default function EntryDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const [entry, setEntry] = useState<GateEntryRecord | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showHelperScanner, setShowHelperScanner] = useState(false);
  const [helperScanResolving, setHelperScanResolving] = useState(false);
  const [draft, setDraft] = useState<UpdateGateEntryInput>({ expectedVersion: 1, remarks: "" });
  const [quantities, setQuantities] = useState({ qtyMs: "0", qtyXpms: "0", qtyEbms: "0", qtyHsd: "0", qtySko: "0", qtyXg: "0", qtyBioHsd: "0", qtyFo: "0", qtyLdo: "0", lockNumber: "" });

  useEffect(() => {
    let active = true; setLoadError(""); setEntry(null);
    void getEntry(params.id).then((value) => { if (!active) return; setEntry(value); setDraft(toDraft(value)); setQuantities(toQuantities(value)); })
      .catch((error) => active && setLoadError(error instanceof Error ? error.message : "Unable to load the gate entry"));
    return () => { active = false; };
  }, [params.id, loadVersion]);

  const canEditOperational = Boolean(
    entry &&
    !entry.isDeleted &&
    (
      user?.role === "ADMIN" ||
      user?.role === "SUPERVISOR" ||
      (user?.role === "ENTRY_GATE_SECURITY" && entry.status === "IN") ||
      user?.role === "EXIT_GATE_SECURITY"
    )
  );
  const canEditOut = entry?.status === "OUT" && user?.role !== "ENTRY_GATE_SECURITY";
  const draftTruck = String(draft.actualTankTruckNumber ?? entry?.actualTankTruckNumber ?? "");
  const calculatedMatch = useMemo(() => entry ? normalizeTruck(entry.ttNumberOnPass) === normalizeTruck(draftTruck) : false, [entry, draftTruck]);

  async function saveChanges() {
    if (!entry) return; setSaving(true);
    try {
      let updated = await updateEntry(entry.id, draft);
      if (entry.status === "OUT" && canEditOut) {
        const parsed = Object.fromEntries(Object.entries(quantities).map(([key, value]) => [key, key === "lockNumber" ? value : Number(value)])) as any;
        const numericValues = Object.entries(parsed).filter(([key]) => key !== "lockNumber").map(([, value]) => value as number);
        if (numericValues.some((value) => !Number.isFinite(value) || value < 0)) throw new Error("Enter valid non-negative quantities");
        updated = await updateExitQuantities(entry.id, { expectedVersion: updated.recordVersion, ...parsed });
      }
      setEntry(updated);
      setDraft(toDraft(updated));
      setQuantities(toQuantities(updated));
      setEditing(false);
      toast.success("Record updated successfully");
    }
    catch (error) { toast.error(error instanceof Error ? error.message : "Update failed"); }
    finally { setSaving(false); }
  }

  if (loadError) return <div className="panel mx-auto max-w-2xl p-8 text-center"><AlertTriangle className="mx-auto h-10 w-10 text-red-500" /><h1 className="mt-4 text-xl font-black text-iocl-navy">Entry could not be loaded</h1><p className="mt-2 text-sm text-slate-500">{loadError}</p><div className="mt-5 flex justify-center gap-3"><Button variant="secondary" onClick={() => setLoadVersion((value) => value + 1)} icon={<RefreshCw className="h-4 w-4" />}>Retry</Button><Link href="/entries" className="inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold text-iocl-navy">Back</Link></div></div>;
  if (!entry) return <div className="panel h-80 animate-pulse bg-white" />;

  return <div>
    <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><Link href="/entries" className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-iocl-orange"><ArrowLeft className="h-4 w-4" />Back to records</Link><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-black text-iocl-navy sm:text-3xl">{entry.displaySerial}</h1><Badge tone={entry.status === "IN" ? "blue" : entry.status === "OUT" ? "green" : "slate"}>{entry.status}</Badge><Badge tone={entry.ttNumberMatch ? "green" : "red"}>{entry.ttNumberMatch ? "TT Matched" : "TT Mismatch"}</Badge></div><p className="mt-2 text-sm text-slate-500">Created by {entry.createdBy.name} ({entry.createdBy.employeeCode})</p></div><div className="flex flex-wrap gap-2">{editing ? <><Button variant="secondary" onClick={() => { setDraft(toDraft(entry)); setQuantities(toQuantities(entry)); setEditing(false); }} icon={<X className="h-4 w-4" />}>Cancel</Button><Button loading={saving} onClick={() => void saveChanges()} icon={<Save className="h-4 w-4" />}>Save All</Button></> : <><Button variant="secondary" onClick={() => window.print()} icon={<Printer className="h-4 w-4" />}>Print</Button>{canEditOperational ? <Button onClick={() => setEditing(true)} icon={<Edit3 className="h-4 w-4" />}>{entry.status === "IN" ? "Edit Open IN" : user?.role === "ADMIN" ? "Admin Correct Record" : "Correct Record"}</Button> : null}</>}</div></div>

    {entry.status !== "IN" && !canEditOperational ? <div className="mb-5 flex gap-3 rounded-2xl border border-slate-200 bg-slate-100 p-4 text-sm text-slate-700"><FileLock2 className="h-5 w-5 shrink-0" /><div><p className="font-black">Security editing is locked after exit</p><p className="mt-1 text-xs">OUT quantity corrections remain role-controlled. Administrators may make audited operational corrections without changing the immutable QR snapshot.</p></div></div> : null}

    <div className="grid gap-6 xl:grid-cols-[1fr_.82fr]"><div className="space-y-6">
      <Section title="Vehicle movement" icon={<Truck className="h-5 w-5" />}><div className="grid gap-4 sm:grid-cols-2">
        {editing ? <>
          <EditField label="Actual Tank Truck Number" value={draftTruck} onChange={(value) => setDraft((current) => ({ ...current, actualTankTruckNumber: value.toUpperCase() }))} />
          <Data label="TT Number on Pass (locked)" value={entry.ttNumberOnPass} />
          <div><label className="field-label">TT Match (automatic)</label><div className={`flex min-h-13 items-center justify-between rounded-2xl border px-4 ${calculatedMatch ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}><span className="font-black">{calculatedMatch ? "YES — Matched" : "NO — Mismatch"}</span><Badge tone={calculatedMatch ? "green" : "red"}>{calculatedMatch ? "Verified" : "Alert"}</Badge></div></div>
            <Toggle label="ABS" value={draft.abs} onChange={(value) => setDraft((current) => ({ ...current, abs: value }))} />
          <Toggle label="ABT — Driver" value={draft.driverAbt} onChange={(value) => setDraft((current) => ({ ...current, driverAbt: value }))} />
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="field-label mb-0">Helper Name</label>
              <button type="button" onClick={() => setShowHelperScanner(true)} className="flex items-center gap-1 text-[11px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-wider"><ScanLine className="h-3 w-3" /> Scan Pass</button>
            </div>
            <input className="field-input" value={String(draft.helperName ?? "")} onChange={(e) => setDraft((curr) => ({ ...curr, helperName: e.target.value }))} />
            {showHelperScanner && (
               <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
                 <div className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl relative">
                   <button type="button" onClick={() => setShowHelperScanner(false)} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-900 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"><X className="h-5 w-5" /></button>
                   <h3 className="text-lg font-black text-iocl-navy mb-4">Scan Helper Pass</h3>
                   <QRScanner onDetected={async (text) => {
                      setHelperScanResolving(true);
                      try {
                        const res = await resolvePass(text);
                        if (res.crewId) {
                           setDraft(curr => ({ ...curr, helperName: res.driverName, helperPassNumber: res.crewId }));
                           setShowHelperScanner(false);
                           toast.success("Helper details imported");
                        }
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Invalid QR");
                      } finally {
                        setHelperScanResolving(false);
                      }
                   }} loading={helperScanResolving} />
                 </div>
               </div>
            )}
          </div>
          <EditField label="Helper Pass Number" value={String(draft.helperPassNumber ?? "")} onChange={(value) => setDraft((current) => ({ ...current, helperPassNumber: value }))} />
          <Toggle label="ABT — Helper" value={draft.helperAbt} onChange={(value) => setDraft((current) => ({ ...current, helperAbt: value }))} />
          <div className="sm:col-span-2"><label className="field-label">Remarks</label><textarea className="field-textarea" value={String(draft.remarks ?? "")} onChange={(event) => setDraft((current) => ({ ...current, remarks: event.target.value }))} /></div>
        </> : <>
          <Data label="Actual TT Number" value={entry.actualTankTruckNumber} /><Data label="TT Number on Pass" value={entry.ttNumberOnPass} /><Data label="Driver ABT" value={yesNo(entry.driverAbt)} /><Data label="ABS" value={yesNo(entry.abs)} /><Data label="Helper" value={entry.helperName || "Not provided"} /><Data label="Helper Pass No." value={entry.helperPassNumber || "—"} /><Data label="Helper ABT" value={yesNo(entry.helperAbt)} /><Data label="Remarks" value={entry.remarks || "—"} wide />
        </>}
      </div></Section>

      <Section title="Safety checklist" icon={<ShieldCheck className="h-5 w-5" />}><div className="space-y-3">{IN_GATE_SAFETY_ITEMS.map(({ key, label }) => {
        const source = editing && draft.safetyChecklist?.[key] !== undefined ? draft.safetyChecklist[key] : entry.safetyChecklist[key];
        return <div key={key} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-bold text-iocl-navy">{label}</p>{editing ? <YesNoToggle compact value={typeof source === "boolean" ? source : undefined} onChange={(value) => setSafety(setDraft, key, value)} /> : source == null ? <Badge tone="slate">Not captured</Badge> : <Badge tone={source ? "green" : "red"}>{source ? "YES" : "NO"}</Badge>}</div>;
      })}</div></Section>

      {entry.status === "OUT" ? (
        <Section title="OUT invoice and product quantities" icon={<CheckCircle2 className="h-5 w-5" />}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Data label="Invoice Number" value={entry.invoiceNumber ?? "—"} />
            <Data label="Invoice Date" value={entry.invoiceDate ? formatIndiaDate(entry.invoiceDate) : "—"} />
            <Data label="Invoice Vehicle" value={entry.invoiceVehicle ?? "—"} />
            <Data label="Consignee" value={entry.invoiceConsignee ?? "—"} />
            <Data label="Product / Quantity Raw" value={entry.invoiceProductsRaw ?? "—"} wide />
            {editing ? (
              <>
                {([[
                  "qtyMs", "MS",
                ], ["qtyXpms", "XPMS"], ["qtyEbms", "EBMS"], ["qtyHsd", "HSD"], ["qtySko", "SKO"], ["qtyXg", "XG"], ["qtyBioHsd", "BIO HSD"], ["qtyFo", "FO"], ["qtyLdo", "LDO"]] as const).map(([key, label]) => (
                  <EditField key={key} label={`${label} Quantity`} value={quantities[key]} onChange={(value) => setQuantities((current) => ({ ...current, [key]: value }))} />
                ))}
                <EditField label="Lock Number" value={quantities.lockNumber} onChange={(value) => setQuantities((current) => ({ ...current, lockNumber: value }))} />
              </>
            ) : (
              <>
                <Data label="MS" value={entry.qtyMs ?? "0"} />
                <Data label="XPMS" value={entry.qtyXpms ?? "0"} />
                <Data label="EBMS" value={entry.qtyEbms ?? "0"} />
                <Data label="HSD" value={entry.qtyHsd ?? "0"} />
                <Data label="SKO" value={entry.qtySko ?? "0"} />
                <Data label="XG" value={entry.qtyXg ?? "0"} />
                <Data label="BIO HSD" value={entry.qtyBioHsd ?? "0"} />
                <Data label="FO" value={entry.qtyFo ?? "0"} />
                <Data label="LDO" value={entry.qtyLdo ?? "0"} />
                <Data label="Lock Number" value={entry.lockNumber ?? "—"} />
              </>
            )}
          </div>
        </Section>
      ) : null}
      
      {editing ? <div className="mt-6 flex justify-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><Button variant="secondary" onClick={() => { setDraft(toDraft(entry)); setQuantities(toQuantities(entry)); setEditing(false); }} icon={<X className="h-4 w-4" />}>Cancel</Button><Button loading={saving} onClick={() => void saveChanges()} icon={<Save className="h-4 w-4" />}>Save All Changes</Button></div> : null}
    </div>

    <div className="space-y-6"><Section title="Crew pass snapshot (immutable)" icon={<UserRound className="h-5 w-5" />}><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"><Data label="Crew ID" value={entry.crewId} /><Data label="Driver Name" value={entry.driverName} /><Data label="Crew Type" value={entry.crewType.replaceAll("_", " ")} /><Data label="Pass Valid Until" value={formatIndiaDate(entry.passValidUntil)} /><Data label="Driving Licence" value={entry.drivingLicenseNumber} /><Data label="Licence Expiry" value={formatIndiaDate(entry.drivingLicenseExpiryDate)} /></div></Section><Section title="System timeline" icon={<CalendarDays className="h-5 w-5" />}><div className="space-y-3"><Timeline icon={<CheckCircle2 className="h-4 w-4" />} label="Serial" value={entry.displaySerial} /><Timeline icon={<CalendarDays className="h-4 w-4" />} label="Entry date" value={formatIndiaDate(entry.entryDate)} /><Timeline icon={<Clock3 className="h-4 w-4" />} label="Time IN" value={formatIndiaTime(entry.timeIn)} />{entry.timeOut ? <Timeline icon={<Clock3 className="h-4 w-4" />} label="Time OUT" value={formatIndiaTime(entry.timeOut)} /> : null}<Timeline icon={<ShieldCheck className="h-4 w-4" />} label="Status" value={entry.status} /><Timeline icon={<Truck className="h-4 w-4" />} label="Facility / Gate" value={`${entry.facilityCode} · ${entry.gateCode}`} /><Timeline icon={<Edit3 className="h-4 w-4" />} label="Record version" value={String(entry.recordVersion)} /></div></Section></div></div>
  </div>;
}

function toDraft(entry: GateEntryRecord): UpdateGateEntryInput {
  const safetyChecklist: NonNullable<UpdateGateEntryInput["safetyChecklist"]> = {
    tlfNo: entry.safetyChecklist.tlfNo ?? undefined, accessMethod: entry.safetyChecklist.accessMethod ?? undefined,
    inspectionArea: entry.safetyChecklist.inspectionArea ?? undefined, sealNumber: entry.safetyChecklist.sealNumber ?? undefined,
    verificationNotes: entry.safetyChecklist.verificationNotes ?? undefined, exceptionRemarks: entry.safetyChecklist.exceptionRemarks,
  };
  for (const { key } of IN_GATE_SAFETY_ITEMS) if (entry.safetyChecklist[key] != null) safetyChecklist[key] = entry.safetyChecklist[key] as boolean;
  return { expectedVersion: entry.recordVersion, customerDestination: entry.customerDestination, actualTankTruckNumber: entry.actualTankTruckNumber, abs: entry.abs, driverAbt: entry.driverAbt, helperName: entry.helperName ?? "", helperPassNumber: entry.helperPassNumber ?? "", helperAbt: entry.helperAbt, driverSignatureConfirmed: entry.driverSignatureConfirmed ? true : undefined, remarks: entry.remarks ?? "", safetyChecklist };
}
function toQuantities(entry: GateEntryRecord) { return { qtyMs: entry.qtyMs ?? "0", qtyXpms: entry.qtyXpms ?? "0", qtyEbms: entry.qtyEbms ?? "0", qtyHsd: entry.qtyHsd ?? "0", qtySko: entry.qtySko ?? "0", qtyXg: entry.qtyXg ?? "0", qtyBioHsd: entry.qtyBioHsd ?? "0", qtyFo: entry.qtyFo ?? "0", qtyLdo: entry.qtyLdo ?? "0", lockNumber: entry.lockNumber ?? "" }; }
function setSafety(setDraft: React.Dispatch<React.SetStateAction<UpdateGateEntryInput>>, key: SafetyCheckKey, value: boolean) { setDraft((current) => ({ ...current, safetyChecklist: { ...current.safetyChecklist, [key]: value } })); }
function yesNo(value: boolean) { return value ? "YES" : "NO"; }
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="panel overflow-hidden"><div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 text-base font-black text-iocl-navy">{icon}{title}</div><div className="p-5">{children}</div></section>; }
function Data({ label, value, wide }: { label: string; value: string; wide?: boolean }) { return <div className={wide ? "sm:col-span-2" : ""}><p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1.5 break-words text-sm font-black text-iocl-navy">{value}</p></div>; }
function EditField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <div><label className="field-label">{label}</label><input className="field-input" value={value} onChange={(event) => onChange(event.target.value)} /></div>; }
function Toggle({ label, value, onChange }: { label: string; value: boolean | undefined; onChange: (value: boolean) => void }) { return <div><label className="field-label">{label}</label><YesNoToggle value={value} onChange={onChange} /></div>; }
function Timeline({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-iocl-orange shadow-sm">{icon}</span><div><p className="text-xs font-semibold text-slate-400">{label}</p><p className="mt-0.5 text-sm font-black text-iocl-navy">{value}</p></div></div>; }

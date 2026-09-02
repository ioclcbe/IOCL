"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { CrewPass, GateEntryRecord, CreateGateEntryInput, QrScanMethod } from "@iocl/shared";
import { createGateEntrySchema, IN_GATE_SAFETY_ITEMS } from "@iocl/shared";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ClipboardCheck, FileText, Info, Keyboard, Printer, RotateCcw, ScanLine, ShieldCheck, Truck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { createEntry, createManualCrewPass, resolvePass } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import { formatIndiaDate, formatIndiaTime, isExpired, normalizeTruck } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { YesNoToggle } from "../ui/toggle";
import { PassDetails } from "./pass-details";
import { QRScanner } from "./qr-scanner";

const steps = [
  { title: "Driver details", icon: UserRound },
  { title: "Vehicle & helper", icon: Truck },
  { title: "Safety check", icon: ShieldCheck },
  { title: "Review & submit", icon: ClipboardCheck },
];

const unsetBoolean = undefined as unknown as boolean;
const defaultValues: CreateGateEntryInput = {
  crewPassId: "",
  qrScanMethod: "CAMERA",
  customerDestination: "-",
  actualTankTruckNumber: "",
  abs: unsetBoolean,
  driverPassNumber: "",
  driverAbt: false,
  helperName: "",
  helperPassNumber: "",
  helperAbt: false,
  mobileTokenNumber: "",
  driverSignatureConfirmed: false as unknown as true,
  remarks: "",
  safetyChecklist: {
    drivingLicenseValidCmvRule9: unsetBoolean,
    verifyRegisterColumn1: unsetBoolean,
    ppeAvailable: unsetBoolean,
    rubberHoseCumLockCouplingGttMarked: unsetBoolean,
    sparkArrestorCcoeApproved: unsetBoolean,
    tremCardAndTrainingCardAvailable: unsetBoolean,
    selfStarterWorking: unsetBoolean,
    batteryTerminalRubberCovers: unsetBoolean,
    noContainerCanExplosivesInCabin: unsetBoolean,
    vmuWorking: unsetBoolean,
    batteryCutOffSwitchCondition: unsetBoolean,
    handBrakeWorking: unsetBoolean,
    earthCleatProvided: unsetBoolean,
    exceptionRemarks: "",
  },
};

// Manual driver form defaults
const defaultManualDriver = {
  driverName: "",
  ttNumberOnPass: "",
  drivingLicenseNumber: "",
  drivingLicenseExpiryDate: "",
  passValidUntil: "",
  crewType: "DRIVER" as "DRIVER" | "DRIVER_WITH_HELPER" | "CONTRACT_CREW",
};

export function EntryWizard() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [pass, setPass] = useState<CrewPass | null>(null);
  const [manualOverrides, setManualOverrides] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState(false);
  const [submitted, setSubmitted] = useState<GateEntryRecord | null>(null);
  const safetyTop = useRef<HTMLDivElement>(null);

  // Driver mode: "scan" = QR scanner, "manual" = type details
  const [driverMode, setDriverMode] = useState<"scan" | "manual">("scan");
  const [manualDriver, setManualDriver] = useState(defaultManualDriver);
  const [manualDriverErrors, setManualDriverErrors] = useState<Record<string, string>>({});

  // Helper mode: "scan" = QR scanner, "manual" = type name+pass
  const [helperMode, setHelperMode] = useState<"scan" | "manual">("manual");
  const [helperScanResolving, setHelperScanResolving] = useState(false);
  const [helperPass, setHelperPass] = useState<CrewPass | null>(null);

  // Master databases for manual mode
  const [masterTrucks, setMasterTrucks] = useState<any[]>([]);
  const [masterDrivers, setMasterDrivers] = useState<any[]>([]);
  const [masterHelpers, setMasterHelpers] = useState<any[]>([]);

  useEffect(() => {
    import("../../lib/api").then(api => {
      api.getMasterTrucks().then(setMasterTrucks).catch(console.error);
      api.getMasterDrivers().then(setMasterDrivers).catch(console.error);
      api.getMasterHelpers().then(setMasterHelpers).catch(console.error);
    });
  }, []);

  const {
    register, setValue, watch, trigger, handleSubmit, reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateGateEntryInput>({ resolver: zodResolver(createGateEntrySchema), defaultValues, mode: "onBlur" });

  const values = watch();
  const actualTruck = watch("actualTankTruckNumber");
  const ttMatch = useMemo(() => Boolean(pass && normalizeTruck(pass.ttNumberOnPass) === normalizeTruck(actualTruck)), [pass, actualTruck]);
  const completedSafety = IN_GATE_SAFETY_ITEMS.filter(({ key }) => typeof values.safetyChecklist[key] === "boolean").length;
  const failedSafety = IN_GATE_SAFETY_ITEMS.filter(({ key }) => values.safetyChecklist[key] === false);
  const totalSafetyItems = IN_GATE_SAFETY_ITEMS.length;
  const documentWarnings = pass ? Array.from(new Set([
    ...(pass.warnings ?? []),
    ...(isExpired(pass.passValidUntil) ? ["Crew pass is expired"] : []),
    ...(isExpired(pass.drivingLicenseExpiryDate) ? ["Driving licence is expired"] : []),
  ])) : [];
  const documentsExpired = Boolean(
    pass &&
    pass.sourceSystem !== "MANUAL_ENTRY" &&   // manual entries: warn but never block
    (isExpired(pass.passValidUntil) || isExpired(pass.drivingLicenseExpiryDate))
  );

  // Called after a pass (from QR scan OR manual create) is resolved
  function applyPass(resolved: CrewPass, method: QrScanMethod) {
    setPass(resolved);
    setValue("crewPassId", resolved.id, { shouldValidate: true });
    setValue("qrScanMethod", method, { shouldValidate: true });
    setValue("actualTankTruckNumber", resolved.ttNumberOnPass, { shouldValidate: true });
  }

  // QR scan handler (step 0 scan mode)
  async function scan(value: string, method: QrScanMethod = "MANUAL") {
    setResolving(true);
    setPass(null);
    setManualOverrides({});
    setValue("crewPassId", "", { shouldValidate: false });
    try {
      const resolved = await resolvePass(value);
      applyPass(resolved, method);
      const hasWarnings = (resolved.warnings?.length ?? 0) > 0 || isExpired(resolved.passValidUntil) || isExpired(resolved.drivingLicenseExpiryDate);
      const hasMissing = (resolved.missingFields?.length ?? 0) > 0;
      if (hasMissing) toast.warning(`${resolved.missingFields!.length} field(s) missing from QR — please fill them in`);
      else toast.success(hasWarnings ? "Crew pass scanned with warnings" : "Crew pass scanned successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pass verification failed");
    } finally {
      setResolving(false);
    }
  }

  // Manual driver submit handler (step 0 manual mode)
  async function submitManualDriver() {
    const errs: Record<string, string> = {};
    const dName = manualDriver.driverName.trim();
    const dDL = manualDriver.drivingLicenseNumber.trim();
    if (!dName) errs.driverName = "Driver name is required";
    else if (!masterDrivers.find(d => d.name === dName)) errs.driverName = "Only registered drivers can be selected.";
    
    if (!manualDriver.ttNumberOnPass.trim()) errs.ttNumberOnPass = "Truck number is required";
    
    if (!dDL) errs.drivingLicenseNumber = "DL number is required";
    else if (!masterDrivers.find(d => d.drivingLicenseNumber === dDL)) errs.drivingLicenseNumber = "Invalid registered DL number.";

    if (!manualDriver.drivingLicenseExpiryDate) errs.drivingLicenseExpiryDate = "DL expiry date is required";
    if (!manualDriver.passValidUntil) errs.passValidUntil = "Pass valid until date is required";
    if (Object.keys(errs).length > 0) { setManualDriverErrors(errs); return; }
    setManualDriverErrors({});
    setResolving(true);
    setPass(null);
    setValue("crewPassId", "", { shouldValidate: false });
    try {
      const resolved = await createManualCrewPass(manualDriver);
      applyPass(resolved, "MANUAL");
      toast.success("Driver details saved — review and continue");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save driver details");
    } finally {
      setResolving(false);
    }
  }

  // Helper QR scan handler (step 1 helper scan mode)
  async function scanHelper(value: string) {
    setHelperScanResolving(true);
    try {
      const resolved = await resolvePass(value);
      setHelperPass(resolved);
      setValue("helperName", resolved.driverName, { shouldValidate: true });
      setValue("helperPassNumber", resolved.crewId, { shouldValidate: true });
      toast.success("Helper pass scanned successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Helper pass verification failed");
    } finally {
      setHelperScanResolving(false);
    }
  }

  async function next() {
    if (step === 0) {
      if (!pass) {
        if (driverMode === "scan") return toast.error("Scan and verify a crew pass first");
        return toast.error("Enter driver details and click Verify");
      }
      const unfilled = (pass.missingFields ?? []).filter(({ key }) => !(manualOverrides[key] ?? "").trim());
      if (unfilled.length > 0) {
        return toast.error(`Please fill in: ${unfilled.map((f) => f.label).join(", ")}`);
      }
      setStep(1);
      return;
    }
    const fieldsByStep: Record<number, FieldPath<CreateGateEntryInput>[]> = {
      1: ["actualTankTruckNumber", "abs", "driverSignatureConfirmed"],
      2: IN_GATE_SAFETY_ITEMS.map(({ key }) => `safetyChecklist.${key}` as FieldPath<CreateGateEntryInput>),
    };
    const valid = await trigger(fieldsByStep[step] ?? []);
    if (!valid) {
      if (step === 2) safetyTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return toast.error("Please correct the highlighted fields");
    }
    if (step === 1) {
      const hName = (values.helperName ?? "").trim();
      if (hName) {
        if (!masterHelpers.find(h => h.name === hName)) return toast.error("Only registered helpers can be selected from the database.");
      } else if (pass?.crewType === "DRIVER_WITH_HELPER") {
        return toast.error("Helper name is required for this crew type");
      }
    }
    setStep((value) => Math.min(3, value + 1));
  }

  async function submit(input: CreateGateEntryInput) {
    try {
      const entry = await createEntry(input);
      setSubmitted(entry);
      toast.success("Vehicle IN entry created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Entry could not be created");
    }
  }

  function restart() {
    reset(defaultValues);
    setPass(null); setManualOverrides({}); setStep(0); setSubmitted(null);
    setDriverMode("scan"); setManualDriver(defaultManualDriver); setManualDriverErrors({});
    setHelperMode("manual"); setHelperPass(null);
  }

  const StepIcon = steps[step]!.icon;
  if (submitted) return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <div className="panel overflow-hidden text-center">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 px-6 py-10 text-white">
          <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/15 ring-8 ring-white/10"><CheckCircle2 className="h-11 w-11" /></span>
          <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-100">Entry successfully recorded</p>
          <h2 className="mt-2 text-3xl font-black sm:text-4xl">{submitted.displaySerial}</h2>
          <p className="mt-2 text-sm text-emerald-100">Status: IN · Time: {formatIndiaTime(submitted.timeIn)}</p>
        </div>
        <div className="grid gap-px bg-slate-100 sm:grid-cols-3">
          <Summary label="Tank Truck" value={submitted.actualTankTruckNumber} />
          <Summary label="Driver" value={submitted.driverName} />
          <div className="bg-white p-5"><p className="text-xs font-bold uppercase text-slate-400">TT Verification</p><div className="mt-2"><Badge tone={submitted.ttNumberMatch ? "green" : "red"}>{submitted.ttNumberMatch ? "Matched" : "Mismatch"}</Badge></div></div>
        </div>
        <div className="flex flex-col gap-3 p-6 sm:flex-row sm:justify-center">
          <Button type="button" onClick={restart} icon={<RotateCcw className="h-5 w-5" />}>Create Next Entry</Button>
          <Button type="button" variant="secondary" onClick={() => window.print()} icon={<Printer className="h-5 w-5" />}>Print Acknowledgement</Button>
          <Link href={`/entries/${submitted.id}`}><Button type="button" variant="secondary" className="w-full">View Record</Button></Link>
        </div>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit(submit, (errs) => {
      const first = Object.values(errs)[0];
      const msg = first && "message" in first ? (first as { message?: string }).message : undefined;
      toast.error(msg ? `Validation error: ${msg}` : "Please check all required fields before submitting");
    })}>
      <div className="mb-6 overflow-x-auto pb-2"><div className="grid min-w-[680px] grid-cols-4 gap-3">
        {steps.map((item, index) => {
          const active = index === step; const complete = index < step;
          return <div key={item.title} className={`flex items-center gap-3 rounded-2xl border p-3 transition ${active ? "border-orange-200 bg-orange-50" : complete ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? "bg-iocl-orange text-white" : complete ? "bg-iocl-green text-white" : "bg-slate-100 text-slate-400"}`}>{complete ? <Check className="h-5 w-5" /> : <item.icon className="h-5 w-5" />}</span>
            <div><p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Step {index + 1}</p><p className={`text-sm font-black ${active || complete ? "text-iocl-navy" : "text-slate-400"}`}>{item.title}</p></div>
          </div>;
        })}
      </div></div>

      <section className="panel overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-5 sm:px-7"><div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-iocl-orange"><StepIcon className="h-6 w-6" /></span>
          <div><h2 className="text-xl font-black text-iocl-navy">{steps[step]!.title}</h2><p className="mt-0.5 text-xs text-slate-500">{step === 0 ? "Scan crew pass QR or enter driver details manually" : step === 1 ? "Verify the physical vehicle and helper details" : step === 2 ? "Complete all mandatory safety checks" : "Confirm every detail before submission"}</p></div>
        </div></div>

        <div className="p-5 sm:p-7">
          {/* ─── STEP 0: DRIVER DETAILS ──────────────────────────────── */}
          {step === 0 ? <div className="space-y-5">
            {/* Mode toggle */}
            <div className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
              <ModeTab active={driverMode === "scan"} icon={<ScanLine className="h-4 w-4" />} label="Scan Pass" onClick={() => { setDriverMode("scan"); setPass(null); setValue("crewPassId", ""); }} />
              <ModeTab active={driverMode === "manual"} icon={<Keyboard className="h-4 w-4" />} label="Manual Entry" onClick={() => { setDriverMode("manual"); setPass(null); setValue("crewPassId", ""); }} />
            </div>

            {driverMode === "scan" ? <>
              <QRScanner onDetected={scan} loading={resolving} />
              {pass ? <PassDetails pass={pass} /> : null}
              {/* Missing fields fill-in */}
              {pass && (pass.missingFields?.length ?? 0) > 0 ? (
                <div className="rounded-3xl border-2 border-amber-300 bg-amber-50 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400 text-white text-sm font-black">{pass.missingFields!.length}</span>
                    <div>
                      <p className="font-black text-amber-900">Some fields could not be read from the QR</p>
                      <p className="text-xs text-amber-700">Fill in the missing information manually before proceeding.</p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {pass.missingFields!.map(({ key, label }) => (
                      <label key={key}>
                        <span className="field-label text-amber-800">{label} <span className="text-red-500">*</span></span>
                        <input
                          type="text"
                          className="field-input border-amber-300 bg-white focus:border-amber-500"
                          placeholder={`Enter ${label}`}
                          value={manualOverrides[key] ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setManualOverrides((prev) => ({ ...prev, [key]: val }));
                            setPass((prev) => prev ? { ...prev, [key]: val } : prev);
                            if (key === "ttNumberOnPass") setValue("actualTankTruckNumber", val, { shouldValidate: true });
                          }}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </> : <>
              {/* Manual driver form */}
              <div className="rounded-3xl border-2 border-blue-200 bg-blue-50 p-5">
                <p className="mb-4 font-black text-blue-900">Enter driver details manually</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ManualField label="Driver Name *" error={manualDriverErrors.driverName}>
                    <input
                      list="master-drivers-list"
                      className="field-input"
                      placeholder="Type or select driver..."
                      value={manualDriver.driverName}
                      onChange={(e) => {
                        const val = e.target.value;
                        setManualDriver((p) => ({ ...p, driverName: val }));
                        const driver = masterDrivers.find((d) => d.name === val);
                        if (driver) {
                          setManualDriver((p) => ({
                            ...p,
                            drivingLicenseNumber: driver.drivingLicenseNumber,
                            drivingLicenseExpiryDate: new Date(driver.drivingLicenseExpiryDate).toISOString().slice(0, 10),
                            passValidUntil: new Date(driver.passValidUntil).toISOString().slice(0, 10),
                            ttNumberOnPass: driver.defaultTruckNumber || p.ttNumberOnPass,
                          }));
                        }
                      }}
                    />
                    <datalist id="master-drivers-list">
                      {masterDrivers.map((d) => (
                        <option key={d.id} value={d.name}>{d.drivingLicenseNumber}</option>
                      ))}
                    </datalist>
                  </ManualField>
                  <ManualField label="TT Number on Pass *" error={manualDriverErrors.ttNumberOnPass}>
                    <input
                      list="master-trucks-list"
                      className="field-input uppercase font-black tracking-wider"
                      placeholder="Type or select Tank Truck..."
                      value={manualDriver.ttNumberOnPass}
                      onChange={(e) => setManualDriver((p) => ({ ...p, ttNumberOnPass: e.target.value.toUpperCase() }))}
                    />
                    <datalist id="master-trucks-list">
                      {masterTrucks.map((t) => (
                        <option key={t.id} value={t.ttNumber}>{t.ttNumber}</option>
                      ))}
                    </datalist>
                  </ManualField>
                  <ManualField label="Driving License Number *" error={manualDriverErrors.drivingLicenseNumber}>
                    <input
                      list="master-dls-list"
                      className="field-input"
                      placeholder="e.g. TN7420210005690"
                      value={manualDriver.drivingLicenseNumber}
                      onChange={(e) => {
                        const val = e.target.value;
                        setManualDriver((p) => ({ ...p, drivingLicenseNumber: val }));
                        const driver = masterDrivers.find((d) => d.drivingLicenseNumber === val);
                        if (driver) {
                          setManualDriver((p) => ({
                            ...p,
                            driverName: driver.name,
                            drivingLicenseExpiryDate: new Date(driver.drivingLicenseExpiryDate).toISOString().slice(0, 10),
                            passValidUntil: new Date(driver.passValidUntil).toISOString().slice(0, 10),
                            ttNumberOnPass: driver.defaultTruckNumber || p.ttNumberOnPass,
                          }));
                        }
                      }}
                    />
                    <datalist id="master-dls-list">
                      {masterDrivers.map((d) => (
                        <option key={`dl-${d.id}`} value={d.drivingLicenseNumber}>{d.name}</option>
                      ))}
                    </datalist>
                  </ManualField>
                  <ManualField label="DL Expiry Date *" error={manualDriverErrors.drivingLicenseExpiryDate}>
                    <input type="date" className="field-input" value={manualDriver.drivingLicenseExpiryDate} onChange={(e) => setManualDriver((p) => ({ ...p, drivingLicenseExpiryDate: e.target.value }))} />
                  </ManualField>
                  <ManualField label="Pass Valid Until *" error={manualDriverErrors.passValidUntil}>
                    <input type="date" className="field-input" value={manualDriver.passValidUntil} onChange={(e) => setManualDriver((p) => ({ ...p, passValidUntil: e.target.value }))} />
                  </ManualField>
                  <ManualField label="Crew Type">
                    <select className="field-input" value={manualDriver.crewType} onChange={(e) => setManualDriver((p) => ({ ...p, crewType: e.target.value as typeof manualDriver.crewType }))}>
                      <option value="DRIVER">Driver only</option>
                      <option value="DRIVER_WITH_HELPER">Driver with Helper</option>
                      <option value="CONTRACT_CREW">Contract Crew</option>
                    </select>
                  </ManualField>
                </div>
                <Button type="button" loading={resolving} onClick={() => void submitManualDriver()} className="mt-4">Verify & Save Driver Details</Button>
              </div>
              {pass ? <PassDetails pass={pass} /> : null}
            </>}
            {errors.crewPassId ? <ErrorText>{errors.crewPassId.message}</ErrorText> : null}
          </div> : null}

          {/* ─── STEP 1: VEHICLE & HELPER ────────────────────────────── */}
          {step === 1 ? <div className="grid gap-5 lg:grid-cols-2">
            <Field label="Actual Physical Tank Truck Number" error={errors.actualTankTruckNumber?.message}>
              <input {...register("actualTankTruckNumber")} className="field-input font-black uppercase tracking-wider" placeholder="TN74AZ8730" />
            </Field>
            <div><label className="field-label">TT Number Match (automatic)</label><div className={`flex min-h-13 items-center justify-between rounded-2xl border px-4 ${ttMatch ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"}`}><div><p className={`text-sm font-black ${ttMatch ? "text-emerald-800" : "text-red-800"}`}>{ttMatch ? "YES — Numbers match" : "NO — Mismatch detected"}</p><p className="text-[11px] text-slate-500">TT on pass: {pass?.ttNumberOnPass}</p></div><Badge tone={ttMatch ? "green" : "red"}>{ttMatch ? "Verified" : "Alert"}</Badge></div></div>
            <ToggleField label="ABS" value={typeof values.abs === "boolean" ? values.abs : undefined} error={errors.abs?.message} onChange={(value) => setValue("abs", value, { shouldValidate: true })} />

            {/* Driver confirmation */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-200 p-4"><label className="flex min-h-11 cursor-pointer items-center gap-3"><input type="checkbox" className="h-5 w-5 accent-orange-600" checked={values.driverSignatureConfirmed === true} onChange={(event) => setValue("driverSignatureConfirmed", event.target.checked as true, { shouldValidate: true })} /><span className="text-sm font-black text-iocl-navy">Driver has reviewed and confirmed the gate entry information</span></label>{errors.driverSignatureConfirmed ? <ErrorText>{errors.driverSignatureConfirmed.message}</ErrorText> : null}</div>

            {/* Helper section */}
            <div className={`lg:col-span-2 rounded-3xl border-2 p-5 space-y-4 ${pass?.crewType === 'DRIVER_WITH_HELPER' ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-slate-50'}`}>
              <p className={`font-black ${pass?.crewType === 'DRIVER_WITH_HELPER' ? 'text-indigo-900' : 'text-slate-900'}`}>
                {pass?.crewType === 'DRIVER_WITH_HELPER' ? 'Helper details required' : 'Helper details (optional)'}
              </p>
              <div className="flex gap-2 rounded-2xl border border-indigo-200 bg-white p-1.5">
                <ModeTab active={helperMode === "scan"} icon={<ScanLine className="h-4 w-4" />} label="Scan Helper Pass" onClick={() => { setHelperMode("scan"); setHelperPass(null); setValue("helperName", ""); setValue("helperPassNumber", ""); }} />
                <ModeTab active={helperMode === "manual"} icon={<Keyboard className="h-4 w-4" />} label="Manual" onClick={() => { setHelperMode("manual"); setHelperPass(null); }} />
              </div>
              {helperMode === "scan" ? <>
                <QRScanner onDetected={(v, m) => { void scanHelper(v); }} loading={helperScanResolving} />
                {helperPass ? <div className="rounded-2xl border border-indigo-200 bg-white p-4 text-sm">
                  <p className="font-black text-indigo-900">{helperPass.driverName}</p>
                  <p className="text-xs text-slate-500 mt-1">Crew ID: {helperPass.crewId}</p>
                </div> : null}
              </> : <div className="grid gap-3 sm:grid-cols-2">
                <Field label={`Helper Name ${pass?.crewType === 'DRIVER_WITH_HELPER' ? '*' : '(optional)'}`} error={errors.helperName?.message}>
                  <input
                    list="master-helpers-list"
                    className="field-input"
                    placeholder="Type or select Helper..."
                    value={values.helperName ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setValue("helperName", val, { shouldValidate: true });
                      const helper = masterHelpers.find((h) => h.name === val);
                      if (helper) {
                        setValue("helperPassNumber", helper.helperPassNumber, { shouldValidate: true });
                      }
                    }}
                  />
                  <datalist id="master-helpers-list">
                    {masterHelpers.map((h) => (
                      <option key={h.id} value={h.name}>{h.helperPassNumber}</option>
                    ))}
                  </datalist>
                </Field>
                <Field label="Helper Pass Number" error={errors.helperPassNumber?.message}>
                  <input
                    list="master-hps-list"
                    className="field-input"
                    placeholder="Optional"
                    value={values.helperPassNumber ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setValue("helperPassNumber", val, { shouldValidate: true });
                      const helper = masterHelpers.find((h) => h.helperPassNumber === val);
                      if (helper) {
                        setValue("helperName", helper.name, { shouldValidate: true });
                      }
                    }}
                  />
                  <datalist id="master-hps-list">
                    {masterHelpers.map((h) => (
                      <option key={`hp-${h.id}`} value={h.helperPassNumber}>{h.name}</option>
                    ))}
                  </datalist>
                </Field>
              </div>}
            </div>

            <Field label="Remarks" error={errors.remarks?.message} className="lg:col-span-2">
              <textarea {...register("remarks")} className="field-textarea" placeholder="Operational notes" />
            </Field>
            {!ttMatch ? <div className="lg:col-span-2 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><Info className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="font-black">TT mismatch is flagged for review</p><p className="mt-1 text-xs leading-5">Both numbers are preserved in the audit trail. Record the physical verification reason in Remarks.</p></div></div> : null}
          </div> : null}

          {/* ─── STEP 2: SAFETY CHECK ────────────────────────────────── */}
          {step === 2 ? <div ref={safetyTop}>
            <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black">Physical safety inspection</p><p className="mt-1 text-xs text-blue-700">Every check requires Yes or No.</p></div><Badge tone={completedSafety >= totalSafetyItems - 2 ? "green" : "orange"}>{completedSafety} of {totalSafetyItems} answered</Badge></div>
            <div className="space-y-3">{IN_GATE_SAFETY_ITEMS.map((item, index) => {
              const field = `safetyChecklist.${item.key}` as FieldPath<CreateGateEntryInput>;
              const value = values.safetyChecklist[item.key];
              const itemError = errors.safetyChecklist?.[item.key]?.message;
              return <div key={item.key} className={`grid gap-4 rounded-2xl border p-4 sm:grid-cols-[48px_1fr_auto] sm:items-center ${itemError ? "border-red-300 bg-red-50" : "border-slate-200"}`}>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-black text-iocl-navy">{String(index + 1).padStart(2, "0")}</span>
                <div><p className="text-sm font-black text-iocl-navy">{item.label}</p>{itemError ? <ErrorText>{itemError}</ErrorText> : null}</div>
                <YesNoToggle compact value={typeof value === "boolean" ? value : undefined} onChange={(checked) => setValue(field, checked as never, { shouldValidate: true })} />
              </div>;
            })}</div>
            <div className="mt-5">
              {failedSafety.length ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="font-black">Failed checks</p><p className="mt-1 text-xs">{failedSafety.map((item) => item.label).join(" • ")}</p></div> : null}
            </div>
          </div> : null}

          {/* ─── STEP 3: REVIEW & SUBMIT ─────────────────────────────── */}
          {step === 3 && pass ? <div className="space-y-5">
            {/* Document warning — amber for manual-only info, red only when docs are actually expired */}
            {documentWarnings.length ? (() => {
              const isManualOnly = pass.sourceSystem === "MANUAL_ENTRY" && !documentsExpired;
              return (
                <div className={`rounded-2xl border p-4 text-sm ${isManualOnly ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-800"}`}>
                  <p className="font-black">{isManualOnly ? "Manual entry notice" : "Document warning"}</p>
                  {documentWarnings.filter((w) => !w.startsWith("Manual entry")).map((w) => <p key={w} className="mt-1">• {w}</p>)}
                  {isManualOnly ? <p className="mt-1 text-xs">Driver details entered manually by the operator — no QR scan performed.</p> : null}
                  {documentsExpired ? <p className="mt-2 text-xs">Production IN submission is blocked for expired documents.</p> : null}
                </div>
              );
            })() : null}
            <ReviewSection title="Verified crew pass" icon={<UserRound className="h-5 w-5" />} items={[["Crew ID", pass.crewId], ["Driver", pass.driverName], ["Crew Type", pass.crewType.replaceAll("_", " ")], ["Pass Valid Until", formatIndiaDate(pass.passValidUntil)], ["Driving Licence", pass.drivingLicenseNumber], ["Licence Expiry", formatIndiaDate(pass.drivingLicenseExpiryDate)]]} />
            <ReviewSection title="Vehicle details" icon={<Truck className="h-5 w-5" />} items={[["Actual TT Number", values.actualTankTruckNumber], ["TT on Pass", pass.ttNumberOnPass], ["TT Match", ttMatch ? "YES" : "NO — MISMATCH"], ["ABS", values.abs ? "YES" : "NO"], ["Helper", values.helperName || "Not provided"], ["Driver Confirmation", values.driverSignatureConfirmed ? "CONFIRMED" : "NOT CONFIRMED"], ["Remarks", values.remarks || "—"]]} />
            <ReviewSection title="Safety verification" icon={<ShieldCheck className="h-5 w-5" />} items={[["Answered", `${completedSafety} of ${totalSafetyItems}`], ["Checks Passed", `${totalSafetyItems - failedSafety.length} of ${totalSafetyItems}`], ["Failed Checks", failedSafety.length ? failedSafety.map((item) => item.label).join(", ") : "None"]]} />
            <div className="flex gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
              <FileText className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-black">Submission creates an auditable IN record</p>
                <p className="mt-1 text-xs leading-5 text-orange-700">
                  {pass.sourceSystem === "MANUAL_ENTRY"
                    ? "Serial number, entry date, time and status are generated by the server. Operator-entered details are recorded as submitted."
                    : "Serial number, entry date, time and status are generated by the server. QR-sourced fields remain immutable."}
                </p>
              </div>
            </div>
          </div> : null}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <Button type="button" variant="ghost" disabled={step === 0 || isSubmitting} onClick={() => setStep((value) => Math.max(0, value - 1))} icon={<ArrowLeft className="h-5 w-5" />}>Back</Button>
          {step < 3 ? <Button type="button" onClick={next} icon={<ArrowRight className="h-5 w-5" />} className="min-w-44">Continue</Button> : <Button type="submit" loading={isSubmitting} disabled={documentsExpired} title={documentsExpired ? "Expired pass or driving licence must be renewed before vehicle IN" : undefined} icon={<CheckCircle2 className="h-5 w-5" />} className="min-w-52">{documentsExpired ? "Expired Documents — IN Blocked" : "Confirm Vehicle IN"}</Button>}
        </div>
      </section>
    </form>
  );
}

function ModeTab({ active, icon, label, onClick }: { active: boolean; icon: React.ReactNode; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-black transition ${active ? "bg-iocl-orange text-white shadow-sm" : "text-slate-500 hover:text-iocl-navy"}`}>{icon}{label}</button>;
}
function ManualField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <div><label className="field-label text-blue-800">{label}</label>{children}{error ? <ErrorText>{error}</ErrorText> : null}</div>; }
function Field({ label, error, children, className = "" }: { label: string; error?: string; children: React.ReactNode; className?: string }) { return <div className={className}><label className="field-label">{label}</label>{children}{error ? <ErrorText>{error}</ErrorText> : null}</div>; }
function ToggleField({ label, value, error, onChange }: { label: string; value: boolean | undefined; error?: string; onChange: (value: boolean) => void }) { return <div><label className="field-label">{label}</label><YesNoToggle value={value} onChange={onChange} />{error ? <ErrorText>{error}</ErrorText> : null}</div>; }
function ErrorText({ children }: { children?: React.ReactNode }) { return <p className="mt-1.5 text-xs font-bold text-red-600">{children}</p>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="bg-white p-5"><p className="text-xs font-bold uppercase text-slate-400">{label}</p><p className="mt-2 text-lg font-black text-iocl-navy">{value}</p></div>; }
function ReviewSection({ title, icon, items }: { title: string; icon: React.ReactNode; items: Array<[string, string]> }) { return <div className="overflow-hidden rounded-3xl border border-slate-200"><div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-4 font-black text-iocl-navy">{icon}{title}</div><div className="grid gap-px bg-slate-100 sm:grid-cols-2 xl:grid-cols-3">{items.map(([label, value]) => <div key={label} className="bg-white p-4"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1.5 break-words text-sm font-black text-iocl-navy">{value}</p></div>)}</div></div>; }

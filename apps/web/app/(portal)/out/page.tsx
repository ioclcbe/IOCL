"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { ExitResolveResult, GateEntryRecord } from "@iocl/shared";
import { CheckCircle2, ClipboardCheck, FileText, Keyboard, PencilLine, RefreshCw, ScanLine, ShieldAlert, Truck } from "lucide-react";
import { toast } from "sonner";
import { resolveExitInvoice, submitExit, listEntries } from "../../../lib/api";
import { formatIndiaDate, formatIndiaTime } from "../../../lib/utils";
import { InvoiceScanner } from "../../../components/entry/invoice-scanner";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { PageHeader } from "../../../components/ui/page-header";

// Products matching the physical logbook columns
const PRODUCTS = [
    { key: "qtyMs",     label: "EBMG",    fullName: "EBMG"                          },
    { key: "qtyXpms",   label: "XP95",    fullName: "XP95"                          },
    { key: "qtyFo",     label: "FO",      fullName: "FO"                            },
    { key: "qtyLdo",    label: "LDO",     fullName: "LDO"                           },
    { key: "qtyHsd",    label: "HSD",     fullName: "HSD"                           },
    { key: "qtyBioHsd", label: "B-HSD",   fullName: "B-HSD"                         },
    { key: "qtyXg",     label: "XG",      fullName: "XG"                            },
    { key: "qtySko",    label: "SKO",     fullName: "SKO"                           },
  ] as const;

type ProductKey = typeof PRODUCTS[number]["key"];
type Quantities = Record<ProductKey, string>;

const zeroQuantities: Quantities = {
  qtyMs: "", qtyXpms: "", qtyHsd: "", qtySko: "",
  qtyXg: "", qtyBioHsd: "", qtyFo: "", qtyLdo: "", 
};

function parsedToQuantities(parsed: Record<string, number>): Quantities {
  const result: Quantities = { ...zeroQuantities };
  for (const { key } of PRODUCTS) {
    if (typeof parsed[key] === "number" && parsed[key]! > 0) {
      result[key] = String(parsed[key]);
    }
  }
  return result;
}

export default function OutGatePage() {
  const [inRecords, setInRecords] = useState<GateEntryRecord[]>([]);
  const [showSearchDrop, setShowSearchDrop] = useState(false);

  useEffect(() => {
    listEntries({ status: "IN" }).then(res => setInRecords(res.items)).catch(console.error);
  }, []);
  const [rawQr, setRawQr]           = useState("");
  const [resolved, setResolved]     = useState<ExitResolveResult | null>(null);
  const [quantities, setQuantities] = useState<Quantities>(zeroQuantities);
  const [qtyFromQr, setQtyFromQr]   = useState(false);
  const [editingQty, setEditingQty] = useState(false);
  const [lockNumber, setLockNumber] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading]       = useState(false);
  const [completed, setCompleted]   = useState<GateEntryRecord | null>(null);

  // Scan / Manual exit mode
  const [exitMode, setExitMode]         = useState<"scan" | "manual">("scan");
  const [manualTruck, setManualTruck]   = useState("");
  const [manualInvoice, setManualInvoice] = useState({ invoiceNumber: "", invoiceDate: "", consignee: "" });

  async function resolve(raw: string) {
    setLoading(true); setResolved(null); setCompleted(null);
    setAcknowledged(false); setQuantities(zeroQuantities); setLockNumber("");
    setQtyFromQr(false); setEditingQty(false); setRawQr(raw);
    try {
      const result = await resolveExitInvoice(raw);
      setResolved(result);
      // Auto-fill quantities from parsed invoice QR
      const parsed = result.invoice.parsedQuantities ?? {};
      const hasParsed = Object.values(parsed).some((v) => v > 0);
      if (hasParsed) {
        setQuantities(parsedToQuantities(parsed));
        setQtyFromQr(true);
        toast.success("Invoice matched — quantities auto-filled from QR");
      } else {
        setQtyFromQr(false);
        toast.success("Matching open IN record found — enter quantities manually");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invoice could not be resolved");
    } finally { setLoading(false); }
  }

  async function completeExit() {
    if (!resolved) return;
    const values = Object.fromEntries(
      PRODUCTS.map(({ key }) => [key, quantities[key] === "" ? 0 : Number(quantities[key])])
    ) as Record<ProductKey, number>;
    if (Object.values(values).some((v) => !Number.isFinite(v) || v < 0))
      return toast.error("Enter valid non-negative quantities");
    if (Object.values(values).every((v) => v === 0))
      return toast.error("Enter at least one product quantity");
    if (resolved.warnings.length > 0 && !acknowledged)
      return toast.error("Acknowledge the warnings before confirming exit");
    setLoading(true);
    try {
      const result = await submitExit(resolved.entry.id, {
        rawInvoiceQr: rawQr,
        expectedVersion: resolved.entry.recordVersion,
        ...values, qtyEbms: 0,
        lockNumber,
        warningsAcknowledged: acknowledged,
      });
      setCompleted(result);
      toast.success("Vehicle OUT completed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Exit could not be completed");
    } finally { setLoading(false); }
  }

  // Manual mode: look up open IN record by truck number
  async function lookupByTruck() {
    if (!manualTruck.trim()) return toast.error("Enter the truck number");
    setLoading(true); setResolved(null);
    setAcknowledged(false); setQuantities(zeroQuantities); setLockNumber(""); setQtyFromQr(false);
    // Use a minimal pseudo-QR with just the vehicle number so the resolver can match the open IN record
    const _d = new Date(); const _dt = `${String(_d.getDate()).padStart(2,"0")}.${String(_d.getMonth()+1).padStart(2,"0")}.${_d.getFullYear()}`;
    const pseudoQr = `Inv:MANUAL-${Date.now()} Dt:${_dt} Val:0 Veh:${manualTruck.trim().replace(/[^A-Za-z0-9]/g,"").toUpperCase()} Prd/Qty: Con:MANUAL`;
    try {
      const result = await resolveExitInvoice(pseudoQr);
      setResolved(result);
      setRawQr(pseudoQr);
      // Manual mode: quantities stay blank (must be entered by operator)
      setQtyFromQr(false);
      toast.success("Open IN record found — enter quantities manually");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No open IN record found for that truck");
    } finally { setLoading(false); }
  }

  function reset() {
    setRawQr(""); setResolved(null); setCompleted(null);
    setAcknowledged(false); setQuantities(zeroQuantities); setLockNumber("");
    setQtyFromQr(false); setEditingQty(false);
    setManualTruck(""); setManualInvoice({ invoiceNumber: "", invoiceDate: "", consignee: "" });
  }

  // ── Completed screen ─────────────────────────────────────────────────────
  if (completed) {
    const totalMs  = Number(completed.qtyMs  ?? 0);
    const totalHsd = Number(completed.qtyHsd ?? 0);
    const totalXp  = Number(completed.qtyXpms ?? 0);
    return (
      <div className="mx-auto max-w-3xl">
        <div className="panel overflow-hidden">
          <div className="bg-gradient-to-br from-red-600 to-red-800 px-6 py-10 text-white text-center">
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/15">
              <CheckCircle2 className="h-11 w-11" />
            </span>
            <p className="mt-5 text-xs font-extrabold uppercase tracking-[.2em] text-red-100">Exit successfully recorded</p>
            <h1 className="mt-2 text-3xl font-black">{completed.actualTankTruckNumber}</h1>
            <p className="mt-2 text-sm text-red-100">
              {completed.displaySerial} · OUT at {completed.timeOut ? formatIndiaTime(completed.timeOut) : "—"}
            </p>
          </div>
          <div className="grid gap-px bg-slate-100 sm:grid-cols-4">
            <Summary label="Invoice No"   value={completed.invoiceNumber  ?? "—"} />
            <Summary label="Consignee"    value={completed.invoiceConsignee ?? "—"} />
            <Summary label="MS"           value={`${totalMs} L`} />
            <Summary label="HSD"          value={`${totalHsd} L`} />
          </div>
          <div className="flex flex-col gap-3 p-6 sm:flex-row sm:justify-center">
            <Button type="button" onClick={reset} icon={<RefreshCw className="h-5 w-5" />}>Process Next Exit</Button>
            <Link href={`/entries/${completed.id}`}>
              <Button type="button" variant="secondary" className="w-full">View Locked Record</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Main page ─────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        eyebrow="OUT Gate Security"
        title="Invoice QR & Vehicle Exit"
        description="Scan the dispatch invoice to auto-fill product quantities, verify details, and confirm vehicle OUT."
      />

      {!resolved ? (
        <div className="space-y-5">
          {/* Scan / Manual mode toggle */}
          <div className="flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
            <button
              type="button"
              onClick={() => setExitMode("scan")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${exitMode === "scan" ? "bg-iocl-orange text-white shadow-sm" : "text-slate-500 hover:text-iocl-navy"}`}
            >
              <ScanLine className="h-4 w-4" /> Scan Invoice QR — auto-fill quantities
            </button>
            <button
              type="button"
              onClick={() => setExitMode("manual")}
              className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition ${exitMode === "manual" ? "bg-iocl-orange text-white shadow-sm" : "text-slate-500 hover:text-iocl-navy"}`}
            >
              <Keyboard className="h-4 w-4" /> Manual — enter details manually
            </button>
          </div>

          {exitMode === "scan" ? (
            <section className="panel p-5 sm:p-7">
              <InvoiceScanner onDetected={resolve} loading={loading} />
            </section>
          ) : (
            /* Manual exit — find IN record by truck number, enter all details manually */
            <section className="panel p-5 sm:p-7 space-y-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-iocl-orange"><Truck className="h-6 w-6" /></span>
                <div>
                  <h2 className="text-lg font-black text-iocl-navy">Manual Exit Entry</h2>
                  <p className="text-xs text-slate-500">Enter the truck number to find today's open IN record. All quantities must be entered manually.</p>
                </div>
              </div>
              <div>
                <label className="field-label">Search Open IN Record <span className="text-red-500">*</span></label>
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
                      {inRecords.filter(r => r.actualTankTruckNumber.includes(manualTruck) || r.driverName.toUpperCase().includes(manualTruck) || (r.drivingLicenseNumber || "").toUpperCase().includes(manualTruck)).map(r => (
                        <li key={r.id} className="cursor-pointer px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-0" onClick={() => {
                          setManualTruck(r.actualTankTruckNumber);
                          setShowSearchDrop(false);
                        }}>
                          <div className="font-bold text-sm text-iocl-navy">{r.actualTankTruckNumber}</div>
                          <div className="text-[11px] font-mono text-slate-500">Driver: {r.driverName} | DL: {r.drivingLicenseNumber || "N/A"}</div>
                        </li>
                      ))}
                      {inRecords.filter(r => r.actualTankTruckNumber.includes(manualTruck) || r.driverName.toUpperCase().includes(manualTruck) || (r.drivingLicenseNumber || "").toUpperCase().includes(manualTruck)).length === 0 && (
                        <li className="px-4 py-3 text-sm text-slate-500 text-center">No open IN records found matching "{manualTruck}"</li>
                      )}
                    </ul>
                  )}
                </div>
                <p className="mt-2 text-xs text-slate-400">Quantities cannot be auto-filled in manual mode — they must be entered from the physical invoice.</p>
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {/* ── Invoice & IN-record summary ─────────────────────────────── */}
          <section className="panel overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-widest text-iocl-orange">Invoice matched</p>
                <h2 className="mt-1 text-xl font-black text-iocl-navy">{resolved.entry.actualTankTruckNumber}</h2>
              </div>
              <div className="flex gap-2">
                <Badge tone="green">IN record found</Badge>
                <Badge tone={resolved.entry.ttNumberMatch ? "green" : "red"}>
                  {resolved.entry.ttNumberMatch ? "TT matched" : "TT mismatch"}
                </Badge>
              </div>
            </div>
            <div className="grid gap-px bg-slate-100 md:grid-cols-2 xl:grid-cols-4">
              <Summary label="Invoice Number"        value={resolved.invoice.invoiceNumber} />
              <Summary label="Invoice Date"          value={formatIndiaDate(resolved.invoice.invoiceDate)} />
              <Summary label="Vehicle in Invoice"    value={resolved.invoice.vehicleNumber} />
              <Summary label="Invoice Value"         value={resolved.invoice.invoiceValue ? `₹${Number(resolved.invoice.invoiceValue).toLocaleString("en-IN")}` : "Not provided"} />
              <Summary label="Consignee"             value={resolved.invoice.consignee} />
              <Summary label="Product / Qty (raw)"   value={resolved.invoice.productQuantityRaw} />
              <Summary label="Driver"                value={resolved.entry.driverName} />
              <Summary label="Time IN"               value={formatIndiaTime(resolved.entry.timeIn)} />
            </div>
          </section>

          {/* ── Warnings ──────────────────────────────────────────────── */}
          {resolved.warnings.length > 0 && (
            <section className="rounded-3xl border border-amber-300 bg-amber-50 p-5 text-amber-950">
              <div className="flex gap-3">
                <ShieldAlert className="h-6 w-6 shrink-0 text-amber-700" />
                <div>
                  <h2 className="font-black">Review warnings before exit</h2>
                  {resolved.warnings.map((w) => <p key={w} className="mt-1 text-sm">• {w}</p>)}
                </div>
              </div>
              <label className="mt-4 flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-amber-300 bg-white px-4">
                <input type="checkbox" className="h-5 w-5 accent-orange-600" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
                <span className="text-sm font-bold">I reviewed these warnings and authorize the exit submission</span>
              </label>
            </section>
          )}

          {/* ── Product quantities ────────────────────────────────────── */}
          <section className="panel p-5 sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-700">
                  <ClipboardCheck className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="text-xl font-black text-iocl-navy">Product Quantities &amp; Exit Details</h2>
                  <p className="text-xs text-slate-500">
                    {qtyFromQr && !editingQty
                      ? "Quantities auto-filled from invoice QR. Verify and edit if needed."
                      : "Enter quantities from the dispatch invoice. Leave unused products as 0."}
                  </p>
                </div>
              </div>
              {/* Auto-filled badge + edit toggle */}
              {qtyFromQr && (
                <div className="shrink-0">
                  {!editingQty ? (
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-black text-red-800">From Invoice QR ✓</span>
                      <button
                        type="button"
                        onClick={() => setEditingQty(true)}
                        className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
                      >
                        <PencilLine className="h-3.5 w-3.5" /> Edit
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setQuantities(parsedToQuantities(resolved.invoice.parsedQuantities)); setEditingQty(false); }}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
                    >
                      ↩ Restore from QR
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {/* Lock Number — full width */}
              <label className="sm:col-span-2 xl:col-span-3">
                <span className="field-label">Lock Number</span>
                <input
                  type="text"
                  className="field-input text-lg font-black uppercase"
                  value={lockNumber}
                  onChange={(e) => setLockNumber(e.target.value)}
                  placeholder="Optional — enter new lock number"
                />
              </label>

              {/* Product quantity inputs */}
              {PRODUCTS.map(({ key, label, fullName }) => {
                const isFromQr = qtyFromQr && !editingQty && quantities[key] !== "";
                return (
                  <label key={key}>
                    <span className="field-label">
                      {label} <span className="font-normal text-slate-400">({fullName})</span>
                      {isFromQr && <span className="ml-1 text-[10px] font-black text-red-600">QR</span>}
                    </span>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        inputMode="decimal"
                        className={`field-input pr-10 text-lg font-black ${isFromQr ? "border-red-300 bg-red-50" : ""}`}
                        value={quantities[key]}
                        readOnly={qtyFromQr && !editingQty}
                        onChange={(e) => setQuantities((cur) => ({ ...cur, [key]: e.target.value }))}
                        placeholder="0"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">L</span>
                    </div>
                  </label>
                );
              })}
            </div>

            {/* Live total */}
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-xs font-extrabold uppercase tracking-widest text-red-700">Total loaded</p>
              <p className="mt-1 text-2xl font-black text-red-900">
                {PRODUCTS.reduce((sum, { key }) => sum + (Number(quantities[key]) || 0), 0).toFixed(3)} L
              </p>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-between">
              <Button type="button" variant="ghost" onClick={reset}>Scan Different Invoice</Button>
              <Button type="button" loading={loading} onClick={() => void completeExit()} icon={<Truck className="h-5 w-5" />}>
                Confirm Vehicle OUT
              </Button>
            </div>
          </section>

          <div className="flex gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
            <FileText className="h-5 w-5 shrink-0" />
            <p>OUT submission auto-stamps Time Out, stores the invoice snapshot, records the operator, and writes an audit log. Security users can no longer edit the completed movement; administrators may make audited corrections when required.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white p-4">
      <p className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 break-words text-sm font-black text-iocl-navy">{value}</p>
    </div>
  );
}

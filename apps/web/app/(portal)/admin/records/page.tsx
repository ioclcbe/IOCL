"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { EntryStatus, GateEntryRecord, QuantitySummary } from "@iocl/shared";
import { CalendarDays, ChevronLeft, ChevronRight, FileSpreadsheet, RefreshCw, RotateCcw, Search, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";
import { bulkDeleteEntries, downloadExcel, getReportSummary, listEntries, restoreEntry, softDeleteEntry } from "../../../../lib/api";
import { formatIndiaTime, todayIndiaKey } from "../../../../lib/utils";
import { Badge } from "../../../../components/ui/badge";
import { Button } from "../../../../components/ui/button";
import { PageHeader } from "../../../../components/ui/page-header";

interface Summary { total: number; in: number; out: number; cancelled: number; quantities: QuantitySummary }
const PAGE_SIZE = 50;

export default function AdminRecordsPage() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<EntryStatus | "">("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [items, setItems] = useState<GateEntryRecord[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [records, totals] = await Promise.all([
        listEntries({ dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, search: search || undefined, status: status || undefined, includeDeleted, page, pageSize: PAGE_SIZE }),
        dateFrom ? getReportSummary(dateFrom, dateTo || undefined) : Promise.resolve({ total: 0, in: 0, out: 0, cancelled: 0, quantities: { petrol: "0", diesel: "0", fo: "0", ldo: "0" } } as any),
      ]);
      setItems(records.items); setTotal(records.total); setTotalPages(records.totalPages); setSummary(totals);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Admin register could not be loaded"); }
    finally { setLoading(false); }
  }, [dateFrom, dateTo, search, status, includeDeleted, page]);

  useEffect(() => setPage(1), [dateFrom, dateTo, search, status, includeDeleted]);
  useEffect(() => { const id = window.setTimeout(() => void load(), 200); return () => window.clearTimeout(id); }, [load, reload]);

  async function remove(entry: GateEntryRecord) {
    const reason = window.prompt(`Reason for soft deleting ${entry.displaySerial}:`);
    if (!reason) return;
    setBusy(true);
    try { await softDeleteEntry(entry.id, { reason }); toast.success("Record soft deleted and audited"); setReload((value) => value + 1); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Delete failed"); }
    finally { setBusy(false); }
  }

  async function recover(entry: GateEntryRecord) {
    if (!window.confirm(`Restore ${entry.displaySerial}? The system will re-check open-truck, crew-pass and mobile-token uniqueness.`)) return;
    setBusy(true);
    try { await restoreEntry(entry.id); toast.success("Record restored and audited"); setReload((value) => value + 1); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Restore failed"); }
    finally { setBusy(false); }
  }

  async function bulkDelete() {
    if (!dateFrom) return toast.error("Please select a date first to choose the month");
    const month = dateFrom.slice(0, 7);
    const reason = window.prompt(`Reason for soft deleting all records in ${month}:`);
    if (!reason) return;
    const confirmation = window.prompt('Type DELETE to confirm this recoverable bulk action:');
    if (confirmation?.trim().toUpperCase() !== "DELETE") return toast.error("Bulk deletion cancelled");
    setBusy(true);
    try { const result = await bulkDeleteEntries({ month, reason, confirmation: "DELETE" }); toast.success(`${result.count} record(s) soft deleted`); setReload((value) => value + 1); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Bulk deletion failed"); }
    finally { setBusy(false); }
  }

  async function exportFile() {
    setBusy(true);
    try { await downloadExcel(dateFrom || undefined, dateTo || undefined); toast.success("Excel downloaded"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Export failed"); }
    finally { setBusy(false); }
  }

  const cards = [
    ["Total movements", summary?.total ?? 0], ["Open IN", summary?.in ?? 0], ["Completed OUT", summary?.out ?? 0],
    
  ];

  return <div>
    <PageHeader eyebrow="Administrator · Full history" title="Truck Management Register" description="Review any day, export the physical-register layout, make audited record corrections, and perform recoverable soft deletion." action={<div className="flex flex-wrap gap-2"><Button type="button" disabled={busy} onClick={() => void exportFile()} icon={<FileSpreadsheet className="h-4 w-4" />}>Download Excel</Button></div>} />

    <section className="panel mt-6 mb-6 p-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_1fr_2fr_200px_auto]">
        <label className="relative"><CalendarDays className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input type="date" className="field-input pl-12" title="Start Date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label className="relative"><CalendarDays className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input type="date" className="field-input pl-12" title="End Date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        <label className="relative"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input className="field-input pl-12" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Vehicle, invoice, driver, customer, pass..." /></label>
        <div className="space-y-2"><select className="field-input" value={status} onChange={(event) => setStatus(event.target.value as EntryStatus | "")}><option value="">All statuses</option><option value="IN">IN</option><option value="OUT">OUT</option><option value="CANCELLED">Cancelled</option></select><label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-2 text-xs font-bold text-slate-600"><input type="checkbox" className="h-4 w-4 accent-orange-600" checked={includeDeleted} onChange={(event) => setIncludeDeleted(event.target.checked)} />Show soft-deleted records</label></div>
        <Button type="button" variant="secondary" onClick={() => setReload((value) => value + 1)} icon={<RefreshCw className="h-4 w-4" />}>Refresh</Button>
      </div>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{cards.map(([label,value]) => <div key={String(label)} className="panel p-5"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-3 text-3xl font-black text-iocl-navy">{loading ? "—" : String(value)}</p></div>)}</section>

    <section className="panel mt-5 overflow-hidden"><div className="hidden grid-cols-[1fr_1fr_1fr_.8fr_.8fr_auto] gap-4 border-b bg-slate-50 px-6 py-3 text-[11px] font-black uppercase tracking-wide text-slate-400 lg:grid"><span>Serial / Vehicle</span><span>Driver / Customer</span><span>Invoice / Products</span><span>Movement</span><span>Status</span><span>Actions</span></div><div className="divide-y divide-slate-100">
      {loading ? Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-24 animate-pulse bg-slate-50" />) : items.map((entry) => <div key={entry.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[1fr_1fr_1fr_.8fr_.8fr_auto] lg:items-center lg:px-6"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-iocl-navy"><Truck className="h-5 w-5" /></span><div><Link href={`/entries/${entry.id}`} className="font-black text-iocl-navy hover:text-iocl-orange">{entry.actualTankTruckNumber}</Link><p className="text-xs text-slate-400">{entry.displaySerial}</p></div></div><div><p className="text-sm font-bold text-slate-800">{entry.driverName}</p><p className="truncate text-xs text-slate-500">{entry.customerDestination}</p></div><div><p className="text-sm font-bold text-slate-700">{entry.invoiceNumber ?? "No invoice yet"}</p><p className="text-xs text-slate-400">MS {entry.qtyMs ?? 0} · XPMS {entry.qtyXpms ?? 0} · EBMS {entry.qtyEbms ?? 0} · HSD {entry.qtyHsd ?? 0}</p></div><div><p className="text-sm font-bold">IN {formatIndiaTime(entry.timeIn)}</p><p className="text-xs text-slate-400">OUT {entry.timeOut ? formatIndiaTime(entry.timeOut) : "Pending"}</p></div><div className="flex flex-wrap gap-2"><Badge tone={entry.status === "IN" ? "green" : entry.status === "OUT" ? "red" : "slate"}>{entry.status}</Badge>{entry.isDeleted ? <Badge tone="red">Soft deleted</Badge> : null}{!entry.ttNumberMatch ? <Badge tone="red">Mismatch</Badge> : null}</div><div className="flex gap-2"><Link href={`/entries/${entry.id}`}><Button type="button" variant="secondary" className="min-h-10 px-3">Open</Button></Link>{entry.isDeleted ? <Button type="button" variant="secondary" className="min-h-10 px-3" disabled={busy} onClick={() => void recover(entry)} aria-label={`Restore ${entry.displaySerial}`}><RotateCcw className="h-4 w-4" /></Button> : <Button type="button" variant="danger" className="min-h-10 px-3" disabled={busy} onClick={() => void remove(entry)} aria-label={`Delete ${entry.displaySerial}`}><Trash2 className="h-4 w-4" /></Button>}</div></div>)}
      {!loading && items.length === 0 ? <div className="px-6 py-16 text-center"><Truck className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 font-black text-slate-600">No records for this selection</p></div> : null}
    </div>{!loading && totalPages > 1 ? <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs font-semibold text-slate-500">Showing page {page} of {totalPages} · {total} records</p><div className="flex gap-2"><Button type="button" variant="secondary" className="min-h-10 px-3" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} icon={<ChevronLeft className="h-4 w-4" />}>Previous</Button><Button type="button" variant="secondary" className="min-h-10 px-3" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>Next <ChevronRight className="h-4 w-4" /></Button></div></div> : null}</section>

    <section className="mt-6 rounded-3xl border border-red-200 bg-red-50 p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-black text-red-900">Monthly soft delete</p><p className="mt-1 text-xs text-red-700">Marks records deleted; data and audit history remain recoverable. Selected month: {dateFrom ? dateFrom.slice(0, 7) : "None"}.</p></div><Button type="button" variant="danger" disabled={busy || !dateFrom} onClick={() => void bulkDelete()} icon={<Trash2 className="h-4 w-4" />}>Bulk Delete Month</Button></div></section>
  </div>;
}

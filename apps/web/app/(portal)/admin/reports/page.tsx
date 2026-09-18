"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  CheckCircle2,
  FileSpreadsheet,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { downloadExcel, getReportSummary, DEMO_MODE } from "../../../../lib/api";
import type { DashboardSummary } from "@iocl/shared";
import { Button } from "../../../../components/ui/button";
import { PageHeader } from "../../../../components/ui/page-header";

function todayIso() {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
}

interface PageSummary {
  date: string;
  total: number;
  in: number;
  out: number;
  cancelled: number;
  quantities: DashboardSummary["quantities"];
}

export default function AdminReportsPage() {
  const [date, setDate]           = useState(todayIso());
  const [summary, setSummary]     = useState<PageSummary | null>(null);
  const [summaryLoading, setSL]   = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;
    setSL(true); setSummary(null);
    void getReportSummary(date)
      .then((data) => { if (active) setSummary(data as unknown as PageSummary); })
      .catch(() => { if (active) setSummary(null); })
      .finally(() => { if (active) setSL(false); });
    return () => { active = false; };
  }, [date]);

  async function handleExport() {
    setExporting(true);
    try {
      await downloadExcel(date);
      toast.success(`Excel report for ${date} downloaded`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const qty = summary?.quantities;
  const products = qty ? [
    { label: "EBMG",    value: Number(qty.ms || 0)     },
    { label: "XP95",    value: Number(qty.xpms || 0)   },
    { label: "FO",      value: Number(qty.fo || 0)     },
    { label: "LDO",     value: Number(qty.ldo || 0)    },
    { label: "HSD",     value: Number(qty.hsd || 0)    },
    { label: "B-HSD",   value: Number(qty.bhsd || 0)   },
    { label: "XG",      value: Number(qty.xg || 0)     },
    { label: "SKO",     value: Number(qty.sko || 0)    },
  ] : [];
  const grandTotal = products.reduce((s, p) => s + p.value, 0);

  return (
    <div>
      <PageHeader
        eyebrow="Admin · Reports"
        title="Daily Gate Log Export"
        description="Select a date to preview the day's summary and download a formatted Excel report with product totals."
      />

      {/* Date picker card */}
      <div className="panel mb-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="field-label flex items-center gap-2">
              <Calendar className="h-4 w-4" /> Report Date
            </label>
            <input
              type="date"
              className="field-input mt-1 text-lg font-black"
              value={date}
              max={todayIso()}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <Button
            type="button"
            loading={exporting}
            disabled={DEMO_MODE || !summary || summary.out === 0}
            title={
              DEMO_MODE
                ? "Excel export available in production build"
                : summary?.out === 0
                ? "No completed exits on this date to export"
                : undefined
            }
            onClick={() => void handleExport()}
            icon={<FileSpreadsheet className="h-5 w-5" />}
          >
            Download Excel
          </Button>
        </div>
        {DEMO_MODE && (
          <p className="mt-3 text-xs font-semibold text-orange-600">
            ⚠ Excel export is available only in the connected PostgreSQL production build.
          </p>
        )}
      </div>

      {/* Summary cards */}
      {summaryLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-3xl bg-slate-100" />
          ))}
        </div>
      ) : summary ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total Entries"    value={summary.total}     color="bg-blue-600"    />
            <StatCard label="Currently IN"     value={summary.in}        color="bg-amber-500"   />
            <StatCard label="Exited (OUT)"     value={summary.out}       color="bg-emerald-600" />
            <StatCard label="Grand Total (KL)"  value={grandTotal.toFixed(2)} color="bg-iocl-orange" suffix="KL" />
          </div>

          {/* Product quantities table */}
          <div className="panel overflow-hidden">
            <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
              <TrendingUp className="h-5 w-5 text-iocl-orange" />
              <h2 className="text-base font-black text-iocl-navy">Product Quantities — {date}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-left">
                    <th className="px-5 py-3 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Product</th>
                    <th className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">Total Quantity (KL)</th>
                    <th className="px-5 py-3 text-right text-[11px] font-extrabold uppercase tracking-wider text-slate-400">% of Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products.filter((p) => p.value > 0).map((p) => (
                    <tr key={p.label} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-bold text-iocl-navy">{p.label}</td>
                      <td className="px-5 py-3 text-right font-black text-slate-700">{p.value.toFixed(3)}</td>
                      <td className="px-5 py-3 text-right text-slate-500">
                        {grandTotal > 0 ? ((p.value / grandTotal) * 100).toFixed(1) : "0"}%
                      </td>
                    </tr>
                  ))}
                  {products.every((p) => p.value === 0) && (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-slate-400">
                        No product quantities recorded for this date
                      </td>
                    </tr>
                  )}
                </tbody>
                {grandTotal > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-amber-50">
                      <td className="px-5 py-3 text-sm font-black text-iocl-navy">TOTAL</td>
                      <td className="px-5 py-3 text-right text-sm font-black text-iocl-navy">{grandTotal.toFixed(3)}</td>
                      <td className="px-5 py-3 text-right font-black text-iocl-navy">100%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* What's in the Excel */}
          <div className="mt-5 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="font-black">Excel file includes:</p>
              <p className="mt-1">
                All {summary.total} entries for {date} · Columns: Truck No, Driver, Destination, Time IN/OUT,
                MS, XP 95, HSD, SKO, XG, BIO HSD, FO, LDO quantities ·
                <strong> Totals row auto-summed at bottom</strong>
              </p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, color, suffix }: { label: string; value: number | string; color: string; suffix?: string }) {
  return (
    <div className="panel p-5">
      <p className="text-xs font-extrabold uppercase tracking-widest text-slate-400">{label}</p>
      <p className={`mt-2 text-3xl font-black ${color.includes("bg-") ? "text-iocl-navy" : color}`}>
        {typeof value === "number" ? value.toLocaleString("en-IN") : value}
        {suffix ? <span className="ml-1 text-base font-semibold text-slate-400">{suffix}</span> : null}
      </p>
    </div>
  );
}

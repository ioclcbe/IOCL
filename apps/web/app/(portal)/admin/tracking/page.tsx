"use client";

import { useEffect, useState } from "react";
import { type DashboardSummary, type GateEntryRecord } from "@iocl/shared";
import { formatIndiaDate, formatIndiaTime, todayIndiaKey } from "../../../../lib/utils";
import { getDashboard, listEntries, downloadExcel } from "../../../../lib/api";
import { toast } from "sonner";
import { RefreshCw, Truck, Download } from "lucide-react";
import { PageHeader } from "../../../../components/ui/page-header";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";

export default function LiveTrackingPage() {
  const [allEntries, setAllEntries] = useState<GateEntryRecord[]>([]);
  const [summaryData, setSummaryData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const today = todayIndiaKey();

  async function load() {
    setLoading(true);
    try {
      const [entriesRes, dashRes] = await Promise.all([
        listEntries({ pageSize: 1000, dateFrom: today, dateTo: today }),
        getDashboard()
      ]);
      
      setAllEntries(entriesRes.items || []);
      setSummaryData(dashRes);
    } catch (err) {
      toast.error("Failed to load tracking data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const TrackingRow = ({ item }: { item: GateEntryRecord }) => (
    <tr className="hover:bg-slate-50/50 group transition-colors">
      <td className="p-3 border-b border-slate-100 font-mono text-xs">{item.displaySerial}</td>
      <td className="p-3 border-b border-slate-100 font-black text-iocl-navy uppercase tracking-wider">{item.actualTankTruckNumber}</td>
      <td className="p-3 border-b border-slate-100 text-sm text-slate-700">{item.driverName}</td>
      <td className="p-3 border-b border-slate-100 text-sm text-slate-600 truncate max-w-[150px]" title={item.customerDestination || "N/A"}>{item.customerDestination || "N/A"}</td>
      <td className="p-3 border-b border-slate-100 text-xs font-mono text-slate-500 whitespace-nowrap">
        {formatIndiaTime(item.timeIn)}
      </td>
      <td className="p-3 border-b border-slate-100 text-xs font-mono text-slate-500 whitespace-nowrap">
        {item.timeOut ? formatIndiaTime(item.timeOut) : "-"}
      </td>
      <td className="p-3 border-b border-slate-100 text-sm font-mono text-slate-700">{item.qtyMs || "-"}</td>
      <td className="p-3 border-b border-slate-100 text-sm font-mono text-slate-700">{item.qtyXpms || "-"}</td>
      <td className="p-3 border-b border-slate-100 text-sm font-mono text-slate-700">{item.qtyHsd || "-"}</td>
      <td className="p-3 border-b border-slate-100 text-sm font-mono text-slate-700">{item.qtySko || "-"}</td>
      <td className="p-3 border-b border-slate-100 text-sm font-mono text-slate-700">{item.lockNumber || "-"}</td>
      <td className="p-3 border-b border-slate-100 text-sm text-slate-700 truncate max-w-[150px]" title={item.invoiceConsignee || "N/A"}>{item.invoiceConsignee || "N/A"}</td>
      <td className="p-3 border-b border-slate-100 text-right">
        {item.status === "OUT" ? (
          <Badge tone="slate">EXITED</Badge>
        ) : (
          <Badge tone="blue" className="animate-pulse">INSIDE</Badge>
        )}
      </td>
    </tr>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Admin A Control Room"
        title="Live Gate Tracking"
        description={`Monitoring live gate activity for ${formatIndiaDate(new Date())}`}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => downloadExcel(today, today)} icon={<Download className="h-4 w-4" />}>
              Download Excel
            </Button>
            <Button onClick={load} loading={loading} icon={<RefreshCw className="h-4 w-4" />}>
              Refresh Data
            </Button>
          </div>
        }
      />

      {summaryData && (
        <div className="panel p-0 overflow-hidden mt-6 mb-6">
          <div className="bg-slate-50 border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-black text-iocl-navy">Daily Volume Outflow (Liters)</h2>
          </div>
          <div className="divide-y divide-slate-100">
            <div className="p-5 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Petrol</p>
                <p className="text-2xl font-black text-iocl-orange">{summaryData.quantities.petrol} L</p>
                <div className="mt-3 text-xs text-slate-600 flex flex-col gap-1.5">
                  <div className="flex justify-between border-b border-slate-50 pb-1"><span>MS</span> <span className="font-mono">{summaryData.quantities.ms}</span></div>
                  <div className="flex justify-between border-b border-slate-50 pb-1"><span>XP95</span> <span className="font-mono">{summaryData.quantities.xpms}</span></div>
                  <div className="flex justify-between pb-1"><span>EBMS</span> <span className="font-mono">{summaryData.quantities.ebms}</span></div>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Diesel</p>
                <p className="text-2xl font-black text-blue-600">{summaryData.quantities.diesel} L</p>
                <div className="mt-3 text-xs text-slate-600 flex flex-col gap-1.5">
                  <div className="flex justify-between border-b border-slate-50 pb-1"><span>HSD</span> <span className="font-mono">{summaryData.quantities.hsd}</span></div>
                  <div className="flex justify-between pb-1"><span>BIO HSD</span> <span className="font-mono">{summaryData.quantities.bioHsd}</span></div>
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Other Products</p>
                <div className="mt-1 text-xs text-slate-600 flex flex-col gap-1">
                  <div className="flex justify-between"><span>SKO</span> <span className="font-mono">{summaryData.quantities.sko}</span></div>
                  <div className="flex justify-between"><span>FO</span> <span className="font-mono">{summaryData.quantities.fo}</span></div>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">&nbsp;</p>
                <div className="mt-1 text-xs text-slate-600 flex flex-col gap-1">
                  <div className="flex justify-between"><span>LDO</span> <span className="font-mono">{summaryData.quantities.ldo}</span></div>
                  <div className="flex justify-between"><span>XG</span> <span className="font-mono">{summaryData.quantities.xg}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="panel overflow-hidden flex flex-col">
        <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between">
          <h2 className="font-black text-slate-700 flex items-center gap-2">
            <Truck className="h-5 w-5 text-slate-400" /> Live Data Record Preview
          </h2>
          <Badge tone="slate">{allEntries.length} Total Today</Badge>
        </div>
        <div className="flex-1 overflow-auto max-h-[800px]">
          {loading ? (
            <div className="p-10 text-center text-slate-400">Loading...</div>
          ) : allEntries.length === 0 ? (
            <div className="p-10 text-center text-slate-400">No entries recorded today.</div>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">SL.NO</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Truck No</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Driver</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Destination</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Time IN</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Time OUT</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">MS</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">XP95</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">HSD</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">SKO</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Lock No</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Consignee</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {allEntries.map(item => <TrackingRow key={item.id} item={item} />)}
              </tbody>
            </table>
          )}
        </div>
      </section>

    </div>
  );
}

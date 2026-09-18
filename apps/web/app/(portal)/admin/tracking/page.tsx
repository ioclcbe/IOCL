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
    <tr className="hover:bg-slate-50/50 group transition-colors even:bg-slate-50/30">
      <td className="p-3 border-b border-slate-100 font-mono text-xs">{item.displaySerial}</td>
      <td className="p-3 border-b border-slate-100 font-mono text-xs text-slate-500">{formatIndiaDate(item.businessDate)}</td>
      <td className="p-3 border-b border-slate-100 font-black text-iocl-navy uppercase tracking-wider">{item.actualTankTruckNumber}</td>
      <td className="p-3 border-b border-slate-100 text-sm text-slate-700 truncate max-w-[120px]" title={item.driverName}>{item.driverName}</td>

      <td className="p-3 border-b border-slate-100 text-xs font-bold text-slate-500">{item.abs ? "YES" : "NO"}</td>
      <td className="p-3 border-b border-slate-100 text-xs font-mono text-slate-500 whitespace-nowrap">{formatIndiaTime(item.timeIn)}</td>
      <td className="p-3 border-b border-slate-100 text-xs font-mono text-slate-500 whitespace-nowrap">{item.timeOut ? formatIndiaTime(item.timeOut) : "-"}</td>
      <td className="p-3 border-b border-slate-100 text-sm font-mono text-iocl-orange font-bold">{item.qtyMs || "-"}</td>
      <td className="p-3 border-b border-slate-100 text-sm font-mono text-iocl-orange font-bold">{item.qtyXpms || "-"}</td>
      <td className="p-3 border-b border-slate-100 text-sm font-mono text-slate-900 font-bold">{item.qtyFo || "-"}</td>
      <td className="p-3 border-b border-slate-100 text-sm font-mono text-slate-900 font-bold">{item.qtyLdo || "-"}</td>
      <td className="p-3 border-b border-slate-100 text-sm font-mono text-blue-600 font-bold">{item.qtyHsd || "-"}</td>
      <td className="p-3 border-b border-slate-100 text-sm font-mono text-blue-600 font-bold">{item.qtyBioHsd || "-"}</td>
      <td className="p-3 border-b border-slate-100 text-sm font-mono text-blue-600 font-bold">{item.qtyXg || "-"}</td>
      <td className="p-3 border-b border-slate-100 text-sm font-mono text-yellow-600 font-bold">{item.qtySko || "-"}</td>

      <td className="p-3 border-b border-slate-100 text-sm font-mono text-slate-700">{item.invoiceNumber || "-"}</td>
      <td className="p-3 border-b border-slate-100 text-xs font-mono text-slate-500 whitespace-nowrap">{item.invoiceDate ? formatIndiaDate(item.invoiceDate) : "-"}</td>
      <td className="p-3 border-b border-slate-100 text-sm text-slate-700 truncate max-w-[150px]" title={item.invoiceConsignee || "N/A"}>{item.invoiceConsignee || "N/A"}</td>
      <td className="p-3 border-b border-slate-100 text-xs text-slate-700">{item.createdBy?.name || "-"}</td><td className="p-3 border-b border-slate-100 text-xs text-slate-700">{item.exitCreatedBy?.name || "-"}</td><td className="p-3 border-b border-slate-100 text-right">
        {item.status === "OUT" ? (
          <Badge tone="red">EXITED</Badge>
        ) : (
          <Badge tone="green" className="animate-pulse">INSIDE</Badge>
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
            <h2 className="text-sm font-black text-iocl-navy">Daily Volume Outflow (Kiloliters)</h2>
          </div>
          <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200">
            {/* Left 4 */}
            <div className="flex-1 p-6 flex flex-col">
              <p className="text-3xl font-black text-iocl-orange mb-6">{(Number(summaryData.quantities.ms || 0) + Number(summaryData.quantities.xpms || 0)).toFixed(3)} KL</p>
              <div className="flex flex-col gap-5 text-xl font-bold">
                <div className="flex justify-between border-b border-slate-100 pb-2 text-iocl-orange">
                  <span>EBMG</span> <span className="font-mono">{summaryData.quantities.ms}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2 text-iocl-orange">
                  <span>XP95</span> <span className="font-mono">{summaryData.quantities.xpms}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2 text-slate-900">
                  <span>FO</span> <span className="font-mono">{summaryData.quantities.fo}</span>
                </div>
                <div className="flex justify-between pb-2 text-slate-900">
                  <span>LDO</span> <span className="font-mono">{summaryData.quantities.ldo}</span>
                </div>
              </div>
            </div>
            {/* Right 4 */}
            <div className="flex-1 p-6 flex flex-col">
              <p className="text-3xl font-black text-blue-600 mb-6">{(Number(summaryData.quantities.hsd || 0) + Number(summaryData.quantities.sko || 0) + Number(summaryData.quantities.xg || 0) + Number(summaryData.quantities.bhsd || 0)).toFixed(3)} KL</p>
              <div className="flex flex-col gap-5 text-xl font-bold">
                <div className="flex justify-between border-b border-slate-100 pb-2 text-blue-600">
                  <span>HSD</span> <span className="font-mono">{summaryData.quantities.hsd}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2 text-blue-600">
                  <span>B-HSD</span> <span className="font-mono">{summaryData.quantities.bhsd}</span>
                </div>
                <div className="flex justify-between border-b border-slate-100 pb-2 text-blue-600">
                  <span>XG</span> <span className="font-mono">{summaryData.quantities.xg}</span>
                </div>
                <div className="flex justify-between pb-2 text-yellow-600">
                  <span>SKO</span> <span className="font-mono">{summaryData.quantities.sko}</span>
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
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Truck No</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Driver</th>

                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">ABS</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Time IN</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Time OUT</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">EBMG</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">XP95</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">FO</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">LDO</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">HSD</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">B-HSD</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">XG</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">SKO</th>

                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Invoice No</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Invoice Date</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Consignee</th>
                  <th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Entry By</th><th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Exit By</th><th className="p-3 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Status</th>
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

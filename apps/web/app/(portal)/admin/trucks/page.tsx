"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, getAccessToken } from "../../../../lib/api";
import { Button } from "../../../../components/ui/button";
import { PageHeader } from "../../../../components/ui/page-header";
import { Badge } from "../../../../components/ui/badge";

export default function TrucksPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [ttNumber, setTtNumber] = useState("");
  const [expireDate, setExpireDate] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch("/masters/trucks");
      setItems(res);
      setSelectedIds([]);
    } catch (e) { toast.error("Could not load trucks"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setBusy(true);
    try {
      const token = getAccessToken();
      const res = await fetch(process.env.NEXT_PUBLIC_API_URL + "/masters/trucks/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Successfully imported ${data.inserted} trucks`);
        load();
      } else {
        toast.error(data.error?.message || "Upload failed");
      }
    } catch (e) {
      toast.error("Upload failed");
    } finally {
      setBusy(false);
      e.target.value = ""; // Reset input
    }
  }


  async function addTruck() {
    if (!ttNumber.trim()) return toast.error("Enter a truck number");
    setBusy(true);
    try {
      await apiFetch("/masters/trucks", { method: "POST", body: JSON.stringify({ ttNumber: ttNumber.trim().toUpperCase(), expireDate: expireDate.trim() || null, isActive: true }) });
      toast.success("Truck added");
      setTtNumber("");
      setShowCreate(false);
      load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function bulkDelete() {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} items?`)) return;
    setBusy(true);
    try {
      await apiFetch('/masters/trucks/bulk-delete', { method: 'POST', body: JSON.stringify({ ids: selectedIds }) });
      toast.success(`Deleted ${selectedIds.length} items`);
      setSelectedIds([]);
      load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function deleteTruck(id: string) {
    if (!confirm("Are you sure you want to delete this truck?")) return;
    setBusy(true);
    try {
      await apiFetch(`/masters/trucks/${id}`, { method: "DELETE" });
      toast.success("Truck deleted");
      load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader 
        eyebrow="Admin · Master Data" 
        title="Trucks" 
        description="Manage the database of valid tank trucks for manual entry." 
        
        action={
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-slate-500">Total Trucks: <span className="font-black text-iocl-navy">{items.length}</span></span>
            <div className="flex gap-2">
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-emerald-700">
                Upload Excel
              </span>
              <input type="file" className="hidden" accept=".xlsx" onChange={handleFileUpload} disabled={busy} />
            </label>
            {selectedIds.length > 0 && (
              <Button type="button" variant="ghost" onClick={bulkDelete} disabled={busy} className="text-red-600 bg-red-50 hover:bg-red-100 border border-red-200">
                <Trash2 className="h-4 w-4 mr-2" /> Delete Selected ({selectedIds.length})
              </Button>
            )}
            <Button type="button" onClick={() => setShowCreate(!showCreate)} icon={<Plus className="h-5 w-5" />}>Add Truck</Button>
            </div>
          </div>
        }
 
      />

      {showCreate && (
        <section className="panel mb-6 p-5">
          <h2 className="text-lg font-black text-iocl-navy">Add New Truck</h2>
          <div className="mt-5 grid gap-4 max-w-sm">
            <label>
              <span className="field-label">Truck Number</span>
              <input className="field-input uppercase" value={ttNumber} onChange={(e) => setTtNumber(e.target.value)} placeholder="TN74AZ8730" />
            </label>
            <label>
              <span className="field-label">Expire Date</span>
              <input type="date" className="field-input" value={expireDate} onChange={(e) => setExpireDate(e.target.value)} />
            </label>
          </div>
          <div className="mt-5 flex gap-2">
            <Button type="button" loading={busy} onClick={addTruck}>Save Truck</Button>
            <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </div>
        </section>
      )}

      <div className="panel overflow-hidden">
        {loading ? <div className="p-10 text-center text-slate-500">Loading trucks...</div> : (
          <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-sm min-w-[600px]">
            <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="p-4 w-12"><input type="checkbox" className="h-4 w-4 accent-iocl-orange" checked={items.length > 0 && selectedIds.length === items.length} onChange={(e) => setSelectedIds(e.target.checked ? items.map(i => i.id) : [])} /></th>
                <th className="p-4">Truck Number</th>
                <th className="p-4">Expire Date</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="p-4"><input type="checkbox" className="h-4 w-4 accent-iocl-orange" checked={selectedIds.includes(item.id)} onChange={(e) => { if (e.target.checked) setSelectedIds(s => [...s, item.id]); else setSelectedIds(s => s.filter(id => id !== item.id)); }} /></td>
                  <td className="p-4 font-bold text-iocl-navy">{item.ttNumber}</td>
                  <td className="p-4 text-slate-500">{item.expireDate || "-"}</td>
                  <td className="p-4"><Badge tone={item.isActive ? "green" : "red"}>{item.isActive ? "Active" : "Inactive"}</Badge></td>
                  <td className="p-4 text-right">
                    <button type="button" onClick={() => deleteTruck(item.id)} className="text-red-500 hover:text-red-700 transition" disabled={busy}>
                      <Trash2 className="h-4 w-4 inline-block" />
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-slate-500">No trucks found in database.</td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

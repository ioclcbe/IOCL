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
  const [showCreate, setShowCreate] = useState(false);
  const [ttNumber, setTtNumber] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch("/masters/trucks");
      setItems(res);
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
      await apiFetch("/masters/trucks", { method: "POST", body: JSON.stringify({ ttNumber: ttNumber.trim().toUpperCase(), isActive: true }) });
      toast.success("Truck added");
      setTtNumber("");
      setShowCreate(false);
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
        title="Tank Trucks" 
        description="Manage the database of valid tank trucks for manual entry." 
        
        action={
          <div className="flex gap-2">
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow hover:bg-emerald-700">
                Upload Excel
              </span>
              <input type="file" className="hidden" accept=".xlsx" onChange={handleFileUpload} disabled={busy} />
            </label>
            <Button type="button" onClick={() => setShowCreate(!showCreate)} icon={<Plus className="h-5 w-5" />}>Add Truck</Button>
          </div>
        }
 
      />

      {showCreate && (
        <section className="panel mb-6 p-5">
          <h2 className="text-lg font-black text-iocl-navy">Add New Truck</h2>
          <div className="mt-5 grid gap-4 max-w-sm">
            <label>
              <span className="field-label">Tank Truck Number</span>
              <input className="field-input uppercase" value={ttNumber} onChange={(e) => setTtNumber(e.target.value)} placeholder="TN74AZ8730" />
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
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="p-4">Truck Number</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50">
                  <td className="p-4 font-bold text-iocl-navy">{item.ttNumber}</td>
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
                  <td colSpan={3} className="p-10 text-center text-slate-500">No trucks found in database.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

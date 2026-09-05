const fs = require('fs');
const path = require('path');

const pages = [
  { name: 'trucks', url: '/masters/trucks/bulk-delete', stateTitle: 'ttNumber' },
  { name: 'drivers', url: '/masters/drivers/bulk-delete', stateTitle: 'name' },
  { name: 'helpers', url: '/masters/helpers/bulk-delete', stateTitle: 'name' }
];

for (const p of pages) {
  const file = path.join(__dirname, 'apps', 'web', 'app', '(portal)', 'admin', p.name, 'page.tsx');
  let content = fs.readFileSync(file, 'utf-8');

  // Add state
  const stateSearch = `const [busy, setBusy] = useState(false);`;
  const stateReplace = `const [busy, setBusy] = useState(false);\n  const [selectedIds, setSelectedIds] = useState<string[]>([]);`;
  if (!content.includes('selectedIds')) {
    content = content.replace(stateSearch, stateReplace);
  }

  // Clear selected on load
  content = content.replace('setItems(res);', 'setItems(res);\n      setSelectedIds([]);');

  // Add bulkDelete function
  const bulkFuncSearch = `async function delete`;
  const bulkFuncReplace = `async function bulkDelete() {
    if (selectedIds.length === 0) return;
    if (!confirm(\`Are you sure you want to delete \${selectedIds.length} items?\`)) return;
    setBusy(true);
    try {
      await apiFetch('${p.url}', { method: 'POST', body: JSON.stringify({ ids: selectedIds }) });
      toast.success(\`Deleted \${selectedIds.length} items\`);
      setSelectedIds([]);
      load();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function delete`;
  if (!content.includes('async function bulkDelete')) {
    content = content.replace(bulkFuncSearch, bulkFuncReplace);
  }

  // Add delete selected button in header
  const headerSearch = `<Button type="button" onClick={() => setShowCreate(!showCreate)} icon={<Plus className="h-5 w-5" />}>`;
  const headerReplace = `{selectedIds.length > 0 && (
              <Button type="button" variant="ghost" onClick={bulkDelete} disabled={busy} className="text-red-600 bg-red-50 hover:bg-red-100 border border-red-200">
                <Trash2 className="h-4 w-4 mr-2" /> Delete Selected ({selectedIds.length})
              </Button>
            )}\n            <Button type="button" onClick={() => setShowCreate(!showCreate)} icon={<Plus className="h-5 w-5" />}>`;
  if (!content.includes('Delete Selected')) {
    content = content.replace(headerSearch, headerReplace);
  }

  // Update table responsiveness and headers
  const tableSearch = `<table className="w-full text-left text-sm">`;
  const tableReplace = `<div className="overflow-x-auto w-full">\n          <table className="w-full text-left text-sm min-w-[600px]">`;
  if (!content.includes('min-w-[600px]')) {
    content = content.replace(tableSearch, tableReplace);
  }

  const thRowSearch = `<tr>`;
  const thRowReplace = `<tr>\n                <th className="p-4 w-12"><input type="checkbox" className="h-4 w-4 accent-iocl-orange" checked={items.length > 0 && selectedIds.length === items.length} onChange={(e) => setSelectedIds(e.target.checked ? items.map(i => i.id) : [])} /></th>`;
  if (!content.includes('type="checkbox"')) {
    content = content.replace(thRowSearch, thRowReplace);
  }

  const trRowSearch = `<tr key={item.id} className="hover:bg-slate-50/50">`;
  const trRowReplace = `<tr key={item.id} className="hover:bg-slate-50/50">\n                  <td className="p-4"><input type="checkbox" className="h-4 w-4 accent-iocl-orange" checked={selectedIds.includes(item.id)} onChange={(e) => { if (e.target.checked) setSelectedIds(s => [...s, item.id]); else setSelectedIds(s => s.filter(id => id !== item.id)); }} /></td>`;
  if (content.match(/<tr key=\{item\.id\}/g).length === 1) { // Only replace once in the map
    content = content.replace(trRowSearch, trRowReplace);
  }

  // Close the overflow div after table
  const tableEndSearch = `</table>`;
  const tableEndReplace = `</table>\n          </div>`;
  if (!content.includes('</div>\n        )}')) { // rough check
    content = content.replace(tableEndSearch, tableEndReplace);
  }
  
  // Fix colSpan for empty state
  content = content.replace(/colSpan=\{3\}/g, 'colSpan={4}');
  content = content.replace(/colSpan=\{4\}/g, 'colSpan={5}'); // drivers and helpers might have 4 cols normally, wait let's just do a blanket replacement.
  content = content.replace('colSpan={5}', 'colSpan={6}'); 
  // Let's just remove colSpan and let it be default or 10
  content = content.replace(/colSpan=\{\d+\}/g, 'colSpan={10}');

  fs.writeFileSync(file, content);
  console.log(`Patched ${p.name}`);
}


const fs = require("fs");
const file = "apps/web/app/(portal)/admin/users/page.tsx";
let content = fs.readFileSync(file, "utf8");

const modal = `
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <form onSubmit={confirmResetPassword} className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-black text-slate-900 mb-2">Reset Password</h3>
            <p className="text-sm text-slate-500 mb-6">Enter a new strong password for <strong>{resetTarget.name}</strong> ({resetTarget.employeeCode}). This will revoke all their active sessions.</p>
            <label className="block mb-6">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">New Password</span>
              <input type="text" required minLength={8} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-iocl-orange focus:ring-1 focus:ring-iocl-orange" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimum 8 characters..." />
            </label>
            <div className="flex gap-3">
              <Button type="button" variant="ghost" className="flex-1 min-h-12" onClick={() => setResetTarget(null)}>Cancel</Button>
              <Button type="submit" loading={busy} className="flex-1 min-h-12">Reset Password</Button>
            </div>
          </form>
        </div>
      )}
`;

const insertIndex = content.lastIndexOf("</div>;");
if (insertIndex !== -1 && !content.includes("resetTarget &&")) {
  content = content.substring(0, insertIndex) + modal + content.substring(insertIndex);
  fs.writeFileSync(file, content);
  console.log("Modal injected!");
} else {
  console.log("Could not find insert point or already injected.");
}


const fs = require("fs");
let f = "apps/web/components/layout/portal-shell.tsx";
let c = fs.readFileSync(f, "utf8");

if (!c.includes("Change password")) {
  c = c.replace(/import \{ LogOut, /g, "import { LogOut, KeyRound, X, ");
  
  c = c.replace(/import \{ toast \} from "sonner";/, `import { toast } from "sonner";
import { changePassword } from "../../lib/api";`);

  c = c.replace(/const \[online, setOnline\] = useState\(true\);/, `const [online, setOnline] = useState(true);
  const [showPwd, setShowPwd] = useState(false);
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdForm, setPwdForm] = useState({ currentPassword: "", newPassword: "" });

  async function handlePasswordChange(e) {
    e.preventDefault();
    if (!pwdForm.currentPassword || pwdForm.newPassword.length < 8) return toast.error("Please enter current password and a new password (min 8 chars).");
    setPwdBusy(true);
    try {
      await changePassword(pwdForm);
      toast.success("Password changed! Please log in again.");
      setShowPwd(false);
      logout();
    } catch(err) {
      toast.error(err.message || "Failed to change password");
    } finally {
      setPwdBusy(false);
    }
  }`);

  c = c.replace(/<LogOut className="h-4 w-4" \/> Secure logout<\/button>/, `<LogOut className="h-4 w-4" /> Secure logout</button>
            <button type="button" onClick={() => setShowPwd(true)} className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white/65 transition hover:bg-white/10 hover:text-white"><KeyRound className="h-4 w-4" /> Change password</button>`);

  c = c.replace(/<\/div>\n  \);/, `
      {showPwd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <form onSubmit={handlePasswordChange} className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Change Password</h3>
              <button type="button" onClick={() => setShowPwd(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Current Password</span>
                <input type="password" required className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-iocl-orange focus:ring-1 focus:ring-iocl-orange" value={pwdForm.currentPassword} onChange={e => setPwdForm({ ...pwdForm, currentPassword: e.target.value })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">New Password</span>
                <input type="password" required minLength={8} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-iocl-orange focus:ring-1 focus:ring-iocl-orange" value={pwdForm.newPassword} onChange={e => setPwdForm({ ...pwdForm, newPassword: e.target.value })} />
              </label>
            </div>
            <button type="submit" disabled={pwdBusy} className="mt-6 w-full rounded-xl bg-iocl-orange py-3 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-50">
              {pwdBusy ? "Saving..." : "Change Password"}
            </button>
          </form>
        </div>
      )}
    </div>
  );`);

  fs.writeFileSync(f, c);
}
console.log("Added change password modal to shell");

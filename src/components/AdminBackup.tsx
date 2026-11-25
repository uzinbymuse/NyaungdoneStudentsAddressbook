"use client";

import { useCallback, useEffect, useState } from "react";
import { Database, Download, History, RotateCcw, Upload } from "lucide-react";
import { toWesternDigits } from "@/lib/myanmar-utils";

interface Counts {
  dormitories: number;
  users: number;
  profiles: number;
  consents: number;
  correctionRequests: number;
  contactRequests: number;
  publications: number;
}

interface SnapshotInfo {
  createdAt: string;
  createdById: string | null;
  label: string;
  counts: Counts;
}

const COUNT_LABELS: [keyof Counts, string][] = [
  ["dormitories", "ကျောင်းဆောင်"],
  ["users", "အကောင့်"],
  ["profiles", "Profile"],
  ["consents", "Consent"],
  ["correctionRequests", "ပြင်ဆင်တောင်းဆိုမှု"],
  ["contactRequests", "ဆက်သွယ်တောင်းဆိုမှု"],
  ["publications", "Print Freeze"],
];

function CountsTable({ counts }: { counts: Counts }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-1.5 text-sm sm:grid-cols-4">
      {COUNT_LABELS.map(([key, label]) => (
        <div key={key} className="rounded-lg bg-stone-50 px-3 py-2">
          <div className="text-xs text-stone-500">{label}</div>
          <div className="font-bold text-stone-900">{counts[key]}</div>
        </div>
      ))}
    </div>
  );
}

export default function AdminBackup() {
  const [snapshot, setSnapshot] = useState<SnapshotInfo | null>(null);
  const [needsDbPush, setNeedsDbPush] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [downloadPassword, setDownloadPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [tempPin, setTempPin] = useState("");
  const [preview, setPreview] = useState<{
    exportedAt: string;
    counts: Counts;
    issues: string[];
    encrypted: boolean;
    pinsPreserved: boolean;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/backup/status");
      const data = await res.json();
      setSnapshot(data.snapshot ?? null);
      setNeedsDbPush(data.needsDbPush === true);
    } catch {
      // Status is a nicety — the tab still works without it.
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const doDownload = async () => {
    if (!downloadPassword) {
      setErr("Backup ထုတ်ယူရန် Admin စကားဝှက် ထည့်ပါ။");
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: "download", password: downloadPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Backup ထုတ်မရပါ။");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      a.download = `ndaddbook-backup-${stamp}.enc.json`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloadPassword("");
      setMsg(
        "Backup ထုတ်ယူပြီးပါပြီ — ဖိုင်သည် Admin စကားဝှက်ဖြင့် ကာကွယ်ထားသည်။ Restore လုပ်တိုင်း ထိုစကားဝှက် (backup လုပ်တုန်းက စကားဝှက်) လိုပါမည်။"
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Backup ထုတ်မရပါ။");
    } finally {
      setBusy(false);
    }
  };

  const doPreview = async () => {
    if (!file) {
      setErr("Backup (.json) ဖိုင် ရွေးပါ။");
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const form = new FormData();
      form.append("step", "preview");
      form.append("file", file);
      form.append("adminPassword", adminPassword);
      const res = await fetch("/api/admin/backup", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview ကြည့်မရပါ။");
      setPreview(data);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Preview ကြည့်မရပါ။");
    } finally {
      setBusy(false);
    }
  };

  const doConfirm = async () => {
    if (!file || !preview) return;
    if (!preview.pinsPreserved && tempPin.length !== 6) {
      setErr("ယာယီ PIN ကို ဂဏန်း ၆ လုံး ထည့်ပါ။");
      return;
    }
    if (
      !window.confirm(
        preview.pinsPreserved
          ? "Restore လုပ်လျှင် လက်ရှိဒေတာ အားလုံး အစားထိုးခံရမည်။ အကောင့်များ ကိုယ့် PIN အတိုင်း ဆက်ဝင်လို့ရပါမည်။ Restore မလုပ်မီ လက်ရှိအခြေအနေကို safety snapshot အဖြစ် သိမ်းထားပါမည်။ ဆက်လုပ်မလား?"
          : "Restore လုပ်လျှင် လက်ရှိဒေတာ အားလုံး အစားထိုးခံရမည်။ Restore မလုပ်မီ လက်ရှိအခြေအနေကို safety snapshot အဖြစ် သိမ်းထားပါမည်။ ဆက်လုပ်မလား?"
      )
    ) {
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const form = new FormData();
      form.append("step", "confirm");
      form.append("file", file);
      form.append("adminPassword", adminPassword);
      if (!preview.pinsPreserved) form.append("tempPin", tempPin);
      const res = await fetch("/api/admin/backup", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Restore လုပ်မရပါ။");
      setMsg(
        data.pinsPreserved
          ? `Restore ပြီးပါပြီ — Profile ${data.counts.profiles} ခု၊ အကောင့် ${data.counts.users} ခု ပြန်ထည့်ပြီးပါပြီ။ အကောင့်များ ကိုယ့် PIN အတိုင်း ဆက်ဝင်လို့ရပါပြီ။`
          : `Restore ပြီးပါပြီ — Profile ${data.counts.profiles} ခု၊ အကောင့် ${data.counts.users} ခု ပြန်ထည့်ပြီးပါပြီ။ အဖွဲ့ဝင်များ ယာယီ PIN ဖြင့် ဝင်ပြီး PIN အသစ် ထားရမည် (ရက် ၆၀ အတွင်း)။`
      );
      setPreview(null);
      setFile(null);
      setAdminPassword("");
      setTempPin("");
      loadStatus();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Restore လုပ်မရပါ။");
    } finally {
      setBusy(false);
    }
  };

  const doUndo = async () => {
    if (!snapshot) return;
    if (
      !window.confirm(
        "နောက်ဆုံး Restore ကို ပြန်ဖျက်ပြီး Restore မလုပ်မီ အခြေအနေသို့ ပြန်သွားမည်။ အကောင့်များ၏ စကားဝှက်များလည်း အတိုင်းပြန်ရမည်။ ဆက်လုပ်မလား?"
      )
    ) {
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const res = await fetch("/api/admin/backup/undo", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Undo လုပ်မရပါ။");
      setMsg(
        `Undo ပြီးပါပြီ — Profile ${data.counts.profiles} ခု၊ အကောင့် ${data.counts.users} ခု ပြန်ရောက်ပါပြီ။`
      );
      loadStatus();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Undo လုပ်မရပါ။");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {needsDbPush && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Restore / Undo သုံးဖို့ PC မှာ <code className="font-mono">npx prisma db push</code>{" "}
          တစ်ခါ လုပ်ဖို့ လိုပါတယ် (BackupSnapshot table အတွက်)။ Backup ထုတ်ယူခြင်းကတော့ အခု
          သုံးလို့ ရပါတယ်။
        </div>
      )}

      {msg && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
          {msg}
        </div>
      )}
      {err && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          {err}
        </div>
      )}

      {/* Backup download */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5 text-amber-800" />
          <h2 className="text-lg font-bold text-stone-900">Backup ထုတ်ယူမည်</h2>
        </div>
        <p className="mt-1 text-sm text-stone-600">
          ကျောင်းဆောင်၊ အကောင့်၊ Profile၊ Consent၊ တောင်းဆိုမှုများနှင့် Print Freeze အားလုံး
          ပါသော ဖိုင် ရရှိမည်။ ဖိုင်တွင် ဖုန်းနံပါတ်များ ပါမည် — လုံခြုံသောနေရာတွင်
          သိမ်းပါ။ ဖိုင်သည် <strong>Admin စကားဝှက်ဖြင့် ကာကွယ်ထားသည်</strong> — ဖိုင်ပျောက်သွားလည်း
          စကားဝှက်မသိရင် ဖွင့်လို့မရပါ။ Restore လုပ်လျှင် အကောင့်များ ကိုယ့် PIN အတိုင်း
          ဆက်ဝင်လို့ရပါမည်။ <strong>သတိပြုရန်:</strong> Restore လုပ်တိုင်း backup လုပ်တုန်းက
          Admin စကားဝှက် လိုပါမည် — Admin စကားဝှက် ပြောင်းထားလျှင် အဟောင်းစကားဝှက်နဲ့
          ဖွင့်ရမည်။
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold text-stone-800">
            Admin စကားဝှက်
            <input
              type="password"
              value={downloadPassword}
              onChange={(e) => setDownloadPassword(e.target.value)}
              placeholder="လက်ရှိ Admin စကားဝှက်"
              className="latin-nums ml-2 w-48 rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            onClick={doDownload}
            disabled={busy || !downloadPassword}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-900 disabled:opacity-50"
          >
            <Database className="h-4 w-4" /> Backup ဒေါင်းလုဒ်လုပ်မည်
          </button>
        </div>
      </div>

      {/* Restore */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-amber-800" />
          <h2 className="text-lg font-bold text-stone-900">Backup မှ ပြန်ထည့်မည် (Restore)</h2>
        </div>
        <p className="mt-1 text-sm text-stone-600">
          Restore လုပ်လျှင် လက်ရှိဒေတာ အားလုံး အစားထိုးခံရမည်။ Restore မလုပ်မီ လက်ရှိအခြေအနေကို
          safety snapshot အဖြစ် အလိုအလျောက် သိမ်းထားပါမည်။ <strong>Admin စကားဝှက်ဖြင့်
          ကာကွယ်ထားသော backup ဖိုင်</strong> ဆိုလျှင် အကောင့်များ ကိုယ့် PIN အတိုင်း
          ဆက်ဝင်လို့ရပါမည် (ဖိုင်လုပ်တုန်းက Admin စကားဝှက် လိုပါသည်)။ <strong>အဟောင်း
          ကာကွယ်မထားသော backup ဖိုင်</strong> ဆိုလျှင် ပြန်ထည့်ပြီးသော အကောင့်များအားလုံး
          အောက်ပါ ယာယီ PIN ဖြင့် ဝင်ပြီး PIN အသစ် ထားရမည် (ရက် ၆၀ အတွင်း)။
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold text-stone-800">
            Backup ဖိုင် (.json)
            <input
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
              }}
              className="mt-1 block text-sm"
            />
          </label>
          <label className="text-sm font-semibold text-stone-800">
            Admin စကားဝှက်
            <input
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="backup လုပ်တုန်းက စကားဝှက်"
              className="latin-nums ml-2 w-48 rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          {preview && !preview.encrypted && (
            <label className="text-sm font-semibold text-stone-800">
              ယာယီ PIN (ဂဏန်း ၆ လုံး)
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={tempPin}
                onChange={(e) =>
                  setTempPin(toWesternDigits(e.target.value).replace(/\D/g, "").slice(0, 6))
                }
                placeholder="ဥပမာ - 123789"
                className="latin-nums ml-2 w-32 rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
          )}
          <button
            type="button"
            onClick={doPreview}
            disabled={busy || !file}
            className="rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            အစမ်းကြည့်မည်
          </button>
        </div>

        {preview && (
          <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              ဤ Backup ဖိုင်တွင် ပါဝင်သည်များ (ထုတ်ယူခဲ့သည်:{" "}
              {new Date(preview.exportedAt).toLocaleString("en-GB")})
            </p>
            <p className="mt-1 text-sm text-amber-800">
              {preview.encrypted
                ? "Admin စကားဝှက်ဖြင့် ကာကွယ်ထားသော ဖိုင် — Restore လုပ်လျှင် အကောင့်များ ကိုယ့် PIN အတိုင်း ဆက်ဝင်လို့ရပါမည်။"
                : "ကာကွယ်မထားသော အဟောင်း ဖိုင် — Restore လုပ်လျှင် အကောင့်များ ယာယီ PIN ဖြင့် ဝင်ပြီး PIN အသစ် ထားရမည် (ရက် ၆၀ အတွင်း)။"}
            </p>
            <CountsTable counts={preview.counts} />
            {preview.issues.map((issue) => (
              <p key={issue} className="mt-1 text-sm text-amber-800">
                • {issue}
              </p>
            ))}
            <p className="mt-2 text-sm font-semibold text-red-800">
              သတိပေးချက် — Restore လုပ်လျှင် လက်ရှိဒေတာ အားလုံး အစားထိုးခံရမည်။
            </p>
            <button
              type="button"
              onClick={doConfirm}
              disabled={busy}
              className="mt-3 rounded-xl bg-red-800 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              အတည်ပြု၍ Restore လုပ်မည်
            </button>
          </div>
        )}
      </div>

      {/* Undo */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-amber-800" />
          <h2 className="text-lg font-bold text-stone-900">နောက်ဆုံး Restore ကို ပြန်ဖျက်မည် (Undo)</h2>
        </div>
        {snapshot ? (
          <>
            <p className="mt-1 text-sm text-stone-600">
              Restore မလုပ်မီ သိမ်းထားသော အခြေအနေ —{" "}
              {new Date(snapshot.createdAt).toLocaleString("en-GB")}။ Undo လုပ်လျှင်
              အကောင့်များ၏ စကားဝှက်များလည်း အတိုင်းပြန်ရမည် (ယာယီ PIN မလိုပါ)။
            </p>
            <CountsTable counts={snapshot.counts} />
            <button
              type="button"
              onClick={doUndo}
              disabled={busy}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" /> Undo လုပ်မည်
            </button>
          </>
        ) : (
          <p className="mt-1 text-sm text-stone-600">
            ပြန်ဖျက်စရာ snapshot မရှိသေးပါ — Restore တစ်ခါ လုပ်ပြီးတိုင်း snapshot အသစ်
            သိမ်းထားပါမည်။
          </p>
        )}
      </div>
    </div>
  );
}

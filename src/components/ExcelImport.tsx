"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, FileSpreadsheet, RefreshCw, Upload } from "lucide-react";

interface PreviewRow {
  rowNumber: number;
  fullName: string;
  phonePrimary: string;
  status: "ok" | "error" | "duplicate";
  errors: string[];
  existingCode: string | null;
}

interface PreviewData {
  summary: { total: number; valid: number; errors: number; duplicates: number };
  rows: PreviewRow[];
}

interface ImportResult {
  createdCount: number;
  created: Array<{ alumniCode: string; fullName: string }>;
  skippedDuplicates: number;
  failed: Array<{ rowNumber: number; fullName: string; reason: string }>;
}

interface PendingPerson {
  alumniCode: string;
  fullName: string;
  phoneMasked: string;
  createdAt: string;
  expiresAt: string | null;
  daysLeft: number | null;
}

export default function ExcelImport() {
  const [file, setFile] = useState<File | null>(null);
  const [tempPin, setTempPin] = useState("");
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingPerson[]>([]);

  const loadPending = useCallback(async () => {
    const res = await fetch("/api/admin/import-excel?action=pending");
    if (res.ok) {
      const data = await res.json();
      setPending(data.pending || []);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  async function postStep(step: "preview" | "confirm") {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("step", step);
      if (step === "confirm") form.append("tempPin", tempPin);
      const res = await fetch("/api/admin/import-excel", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ဆောင်ရွက်မှု မအောင်မြင်ပါ။");
        return;
      }
      if (step === "preview") {
        setPreview(data as PreviewData);
        setResult(null);
      } else {
        setResult(data as ImportResult);
        setPreview(null);
        setFile(null);
        setTempPin("");
        loadPending();
      }
    } catch {
      setError("ချိတ်ဆက်မှု အမှားအယွင်း ဖြစ်ပွားပါသည်။");
    } finally {
      setBusy(false);
    }
  }

  const pinOk = /^\d{6}$/.test(tempPin);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6">
      <div className="flex items-center gap-2">
        <FileSpreadsheet className="h-5 w-5 text-amber-800" />
        <h2 className="text-lg font-bold text-stone-900">စာအုပ်ဟောင်း Excel Import</h2>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-stone-600">
        အရင် Print စာအုပ်ထဲက အချက်အလက်တွေကို Template ထဲ ရိုက်ထည့်ပြီး သွင်းပါ။
        သွင်းပြီးသား လူတွေကို <strong>VERIFIED</strong> အတိုင်း တိုက်ရိုက်သွင်းမယ် —
        စာအုပ်ထဲ ချက်ချင်းပါမယ်။ သူတို့က ကိုယ့်ဖုန်းနံပါတ် + ယာယီ PIN နဲ့ Login
        ဝင်ပြီး ပထမအကြိမ်မှာ PIN အသစ် မဖြစ်မနေ ပြောင်းရပါမယ် (ယာယီ PIN သက်တမ်း
        ၆၀ ရက်)။
      </p>

      <div className="mt-3">
        <a
          href="/api/admin/import-excel?action=template"
          className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-100"
        >
          <Download className="h-4 w-4" /> Template (.xlsx) ဒေါင်းလုဒ်လုပ်ရန်
        </a>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
          {error}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className="flex items-center gap-3 rounded-xl border border-stone-300 px-4 py-2.5 text-sm">
          <Upload className="h-4 w-4 shrink-0 text-stone-500" />
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setPreview(null);
              setResult(null);
            }}
            className="w-full text-sm"
          />
        </label>
        <button
          onClick={() => postStep("preview")}
          disabled={!file || busy}
          className="rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-stone-800 disabled:opacity-50"
        >
          {busy ? "စစ်ဆေးနေပါသည်…" : "စစ်ဆေးကြည့်ရန်"}
        </button>
      </div>

      {preview && (
        <div className="mt-4">
          <p className="text-sm text-stone-700">
            စုစုပေါင်း <strong>{preview.summary.total}</strong> တန်း — သွင်းလို့ရတာ{" "}
            <strong className="text-green-700">{preview.summary.valid}</strong> တန်း၊
            မှားနေတာ{" "}
            <strong className="text-red-700">{preview.summary.errors}</strong> တန်း၊
            ရှိပြီးသား (မသွင်းပါ){" "}
            <strong className="text-amber-700">{preview.summary.duplicates}</strong>{" "}
            တန်း
          </p>
          <div className="mt-2 max-h-72 overflow-auto rounded-xl border border-stone-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-stone-100">
                <tr>
                  <th className="p-2">အတန်း</th>
                  <th className="p-2">အမည်</th>
                  <th className="p-2">ဖုန်း</th>
                  <th className="p-2">အခြေအနေ</th>
                  <th className="p-2">မှတ်ချက်</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r) => (
                  <tr key={r.rowNumber} className="border-t border-stone-100">
                    <td className="p-2">{r.rowNumber}</td>
                    <td className="p-2">{r.fullName || "—"}</td>
                    <td className="p-2 latin-nums">{r.phonePrimary || "—"}</td>
                    <td className="p-2">
                      {r.status === "ok" && <span className="text-green-700">မှန်သည်</span>}
                      {r.status === "error" && <span className="text-red-700">မှားနေသည်</span>}
                      {r.status === "duplicate" && (
                        <span className="text-amber-700">ရှိပြီးသား{r.existingCode ? ` (${r.existingCode})` : ""}</span>
                      )}
                    </td>
                    <td className="p-2 text-stone-600">{r.errors.join("; ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold text-stone-800">
              ယာယီ PIN (ဂဏန်း ၆ လုံး)
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={tempPin}
                onChange={(e) => setTempPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="ဥပမာ - 123789"
                className="ml-2 w-32 rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
            <button
              onClick={() => postStep("confirm")}
              disabled={!pinOk || preview.summary.valid === 0 || busy}
              className="rounded-xl bg-amber-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-900 disabled:opacity-50"
            >
              အတည်ပြုပြီး သွင်းမည် ({preview.summary.valid} ဦး)
            </button>
          </div>
          <p className="mt-2 text-xs text-stone-500">
            ယာယီ PIN ကို လူတိုင်းအတွက် တူညီစွာ သုံးပါမယ်။ သွင်းပြီးရင် လူတိုင်းကို
            PIN ပြောပေးပါ — သူတို့ ပထမအကြိမ် Login ဝင်တာနဲ့ PIN အသစ်
            ပြောင်းရပါမယ်။
          </p>
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm">
          <p className="font-bold text-green-900">
            {result.createdCount} ဦး သွင်းပြီးပါပြီ။
            {result.skippedDuplicates > 0 && ` ရှိပြီးသား ${result.skippedDuplicates} ဦး မသွင်းပါ။`}
          </p>
          {result.failed.length > 0 && (
            <p className="mt-1 text-red-800">
              မသွင်းနိုင်တာ {result.failed.length} ဦး:{" "}
              {result.failed.map((f) => `${f.fullName} (အတန်း ${f.rowNumber})`).join(", ")}
            </p>
          )}
          {result.created.length > 0 && (
            <p className="mt-1 text-stone-600">
              ကုဒ်: {result.created.slice(0, 10).map((c) => c.alumniCode).join(", ")}
              {result.created.length > 10 ? ` … (+${result.created.length - 10} ဦး)` : ""}
            </p>
          )}
        </div>
      )}

      <div className="mt-6 border-t border-stone-100 pt-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-stone-900">
            PIN မပြောင်းရသေးသူများ ({pending.length} ဦး)
          </h3>
          <button
            onClick={loadPending}
            className="inline-flex items-center gap-1 rounded-lg border border-stone-300 px-2 py-1 text-xs text-stone-700 hover:bg-stone-100"
          >
            <RefreshCw className="h-3 w-3" /> ပြန်စစ်မည်
          </button>
        </div>
        {pending.length === 0 ? (
          <p className="mt-2 text-xs text-stone-500">
            ယာယီ PIN သုံးနေသူ မရှိပါ။
          </p>
        ) : (
          <div className="mt-2 max-h-56 overflow-auto rounded-xl border border-stone-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-stone-100">
                <tr>
                  <th className="p-2">ကုဒ်</th>
                  <th className="p-2">အမည်</th>
                  <th className="p-2">ဖုန်း</th>
                  <th className="p-2">သက်တမ်း ကျန်ရက်</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((p) => (
                  <tr key={p.alumniCode} className="border-t border-stone-100">
                    <td className="p-2">{p.alumniCode}</td>
                    <td className="p-2">{p.fullName}</td>
                    <td className="p-2 latin-nums">{p.phoneMasked}</td>
                    <td className="p-2">
                      {p.daysLeft !== null ? `${p.daysLeft} ရက်` : "—"}
                      {p.expiresAt ? ` (${new Date(p.expiresAt).toLocaleDateString("en-GB")})` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

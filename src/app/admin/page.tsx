"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BookOpen,
  Check,
  Copy,
  Download,
  FileSpreadsheet,
  KeyRound,
  Printer,
  ShieldAlert,
  Upload,
  X,
} from "lucide-react";

interface AdminAlumni {
  id: string;
  userId?: string | null;
  alumniCode: string;
  fullName: string;
  formerName?: string | null;
  degreeName?: string | null;
  batchYearDisplay: string;
  dormitory: string;
  currentRoleOrMonastery: string;
  countryName: string;
  isDomestic: boolean;
  region?: string | null;
  township?: string | null;
  city: string;
  wardOrVillage?: string | null;
  phonePrimary?: string | null;
  bookConsent: boolean;
  showPhonePrint: boolean;
  referrerName?: string | null;
  bestContactTime?: string | null;
  adminNote?: string | null;
  profileStatus: string;
  isPotentialDuplicate: boolean;
}

interface CorrectionItem {
  id: string;
  reason?: string | null;
  proposedData: Record<string, string>;
  alumni: { alumniCode: string; fullName: string };
}

interface PrintEntry {
  alumniCode: string;
  fullName: string;
  degreeName?: string | null;
  batchYearDisplay: string;
  dormitory: string;
  currentRoleOrMonastery: string;
  isDomestic: boolean;
  countryName: string;
  region?: string | null;
  township?: string | null;
  city: string;
  wardOrVillage?: string | null;
  phone?: string | null;
}

export default function AdminDashboardPage() {
  const [tab, setTab] = useState<"PENDING" | "ALL" | "DUPLICATES" | "CORRECTIONS" | "PRINT" | "IMPORT" | "LOGS">("PENDING");
  const [stats, setStats] = useState({
    total: 0,
    verified: 0,
    pending: 0,
    domestic: 0,
    international: 0,
    pendingCorrections: 0,
  });
  const [alumniList, setAlumniList] = useState<AdminAlumni[]>([]);
  const [corrections, setCorrections] = useState<CorrectionItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; action: string; targetType: string; createdAt: string }>>([]);
  const [printData, setPrintData] = useState<{
    eligibleCount: number;
    domesticCount: number;
    internationalCount: number;
    eligibleEntries: PrintEntry[];
    publications: Array<{ id: string; title: string; frozenAt: string; snapshotCount: number }>;
  } | null>(null);

  const [magicLinkOutput, setMagicLinkOutput] = useState("");
  const [editionTitle, setEditionTitle] = useState("2027 Print Edition");
  const [csvText, setCsvText] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function loadDashboard() {
    setError("");
    const [ovRes, pubRes] = await Promise.all([
      fetch("/api/admin/overview"),
      fetch("/api/admin/publications"),
    ]);
    if (!ovRes.ok) {
      setError("Admin ဝင်ရောက်ခွင့် မရှိပါ။ Admin အကောင့်ဖြင့် Login ဝင်ပါ။");
      return;
    }
    const ov = await ovRes.json();
    setStats(ov.stats);
    setAlumniList(ov.alumniList || []);
    setCorrections(ov.corrections || []);
    setAuditLogs(ov.auditLogs || []);

    if (pubRes.ok) {
      setPrintData(await pubRes.json());
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  async function runAlumniAction(payload: Record<string, unknown>) {
    setNotice("");
    const res = await fetch("/api/admin/alumni", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      if (data.magicLink) {
        setMagicLinkOutput(data.magicLink);
      } else {
        setNotice("ဆောင်ရွက်ချက် အောင်မြင်ပါသည်။");
      }
      loadDashboard();
    }
  }

  function exportCsv(domesticOnly: boolean | null) {
    if (!printData) return;
    const rows = printData.eligibleEntries.filter((e) =>
      domesticOnly === null ? true : e.isDomestic === domesticOnly
    );
    const headers = [
      "AlumniID",
      "FullName",
      "Degree",
      "BatchYear",
      "Dormitory",
      "RoleOrMonastery",
      "Type",
      "Country",
      "Region",
      "Township",
      "City",
      "WardOrVillage",
      "Phone",
    ];
    const csvLines = [
      headers.join(","),
      ...rows.map((r) =>
        [
          r.alumniCode,
          r.fullName,
          r.degreeName || "",
          r.batchYearDisplay,
          r.dormitory,
          r.currentRoleOrMonastery,
          r.isDomestic ? "Domestic" : "International",
          r.countryName,
          r.region || "",
          r.township || "",
          r.city,
          r.wardOrVillage || "",
          r.phone || "",
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];

    // UTF-8 BOM for clean Myanmar rendering in Microsoft Excel
    const blob = new Blob(["\uFEFF" + csvLines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download =
      domesticOnly === true
        ? "nyaungdon-domestic-print.csv"
        : domesticOnly === false
          ? "nyaungdon-international-print.csv"
          : "nyaungdon-all-print.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function freezePublication() {
    const res = await fetch("/api/admin/publications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: editionTitle }),
    });
    if (res.ok) {
      setNotice(`"${editionTitle}" Snapshot ကို အောင်မြင်စွာ Freeze လုပ်ပြီးပါပြီ။`);
      loadDashboard();
    }
  }

  async function handleImportCsv() {
    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const rows = lines.map((line) => {
      const [fullName, batchYearDisplay, dormitory, city, phonePrimary, currentRoleOrMonastery] =
        line.split(",").map((c) => c.trim());
      return {
        fullName,
        batchYearDisplay,
        dormitory,
        city,
        phonePrimary,
        currentRoleOrMonastery,
      };
    });
    await runAlumniAction({ action: "IMPORT_BATCH_ROW", rows });
    setCsvText("");
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900">
          <ShieldAlert className="h-6 w-6" />
          <p className="font-bold">{error}</p>
        </div>
      </div>
    );
  }

  const pendingList = alumniList.filter((a) => a.profileStatus === "PENDING");
  const duplicateList = alumniList.filter((a) => a.isPotentialDuplicate);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Admin စီမံခန့်ခွဲမှု Panel</h1>
          <p className="text-sm text-stone-600">
            စစ်ဆေးအတည်ပြုခြင်း၊ Duplicate ပေါင်းစည်းခြင်းနှင့် Print Book ထုတ်ယူခြင်း
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-stone-200 bg-white p-4 text-center">
          <div className="text-2xl font-bold text-stone-900">{stats.total}</div>
          <div className="text-xs text-stone-500">စုစုပေါင်း</div>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <div className="text-2xl font-bold text-emerald-900">{stats.verified}</div>
          <div className="text-xs text-emerald-700">Verified</div>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
          <div className="text-2xl font-bold text-amber-900">{stats.pending}</div>
          <div className="text-xs text-amber-800">စစ်ဆေးရန်ကျန်</div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4 text-center">
          <div className="text-2xl font-bold text-stone-900">{stats.domestic}</div>
          <div className="text-xs text-stone-500">ပြည်တွင်း</div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4 text-center">
          <div className="text-2xl font-bold text-stone-900">{stats.international}</div>
          <div className="text-xs text-stone-500">ပြည်ပ</div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-4 text-center">
          <div className="text-2xl font-bold text-stone-900">{stats.pendingCorrections}</div>
          <div className="text-xs text-stone-500">ပြင်ဆင်တောင်းဆို</div>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
          {notice}
        </div>
      )}

      {magicLinkOutput && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-bold text-amber-900">
            တစ်ကြိမ်သုံး Magic Login Link (Viber/Telegram မှ ပေးပို့နိုင်သည်)-
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={magicLinkOutput}
              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-1.5 font-mono text-xs"
            />
            <button
              onClick={() => navigator.clipboard.writeText(magicLinkOutput)}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-bold text-white"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-3 text-sm font-semibold">
        {[
          { id: "PENDING", label: `Pending (${pendingList.length})` },
          { id: "ALL", label: `All (${alumniList.length})` },
          { id: "DUPLICATES", label: `Duplicates (${duplicateList.length})` },
          { id: "CORRECTIONS", label: `Corrections (${corrections.length})` },
          { id: "PRINT", label: "Print Book Export" },
          { id: "IMPORT", label: "Batch CSV Import" },
          { id: "LOGS", label: "Audit Logs" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as typeof tab)}
            className={`rounded-xl px-4 py-2 ${
              tab === t.id
                ? "bg-stone-900 text-white"
                : "bg-white text-stone-700 hover:bg-stone-100"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content: PENDING / ALL / DUPLICATES */}
      {(tab === "PENDING" || tab === "ALL" || tab === "DUPLICATES") && (
        <div className="space-y-4">
          {(tab === "PENDING" ? pendingList : tab === "DUPLICATES" ? duplicateList : alumniList).map(
            (item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-stone-100 px-2 py-0.5 font-mono text-xs font-bold">
                        {item.alumniCode}
                      </span>
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                        {item.profileStatus}
                      </span>
                      {item.isPotentialDuplicate && (
                        <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">
                          <AlertTriangle className="h-3 w-3" /> အမည်/ဖုန်းတူ ရှိနိုင်သည်
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1.5 text-lg font-bold text-stone-900">
                      {item.fullName}{" "}
                      <span className="text-sm font-normal text-stone-600">
                        ({item.batchYearDisplay})
                      </span>
                    </h3>
                    <p className="text-sm text-stone-700">
                      {item.dormitory} · {item.currentRoleOrMonastery}
                    </p>
                    <p className="text-xs text-stone-500">
                      {item.countryName} {item.region ? `· ${item.region}` : ""} · {item.city} · ဖုန်း:{" "}
                      {item.phonePrimary}
                    </p>
                    {(item.referrerName || item.bestContactTime || item.adminNote) && (
                      <div className="mt-2 rounded-lg bg-stone-50 p-2 text-xs text-stone-600">
                        {item.referrerName && <span>ဆက်သွယ်ပေးသူ: {item.referrerName} · </span>}
                        {item.bestContactTime && <span>ဆက်သွယ်ချိန်: {item.bestContactTime} · </span>}
                        {item.adminNote && <span>မှတ်ချက်: {item.adminNote}</span>}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {item.profileStatus !== "VERIFIED" && (
                      <button
                        onClick={() => runAlumniAction({ action: "APPROVE", alumniId: item.id })}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-800"
                      >
                        <Check className="h-3.5 w-3.5" /> Approve
                      </button>
                    )}
                    {item.profileStatus !== "REJECTED" && (
                      <button
                        onClick={() => runAlumniAction({ action: "REJECT", alumniId: item.id })}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
                      >
                        <X className="h-3.5 w-3.5" /> Reject
                      </button>
                    )}
                    {item.userId && (
                      <button
                        onClick={() =>
                          runAlumniAction({ action: "GENERATE_MAGIC_LINK", userId: item.userId })
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-amber-700 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-50"
                      >
                        <KeyRound className="h-3.5 w-3.5" /> Magic Link
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {/* Tab Content: CORRECTIONS */}
      {tab === "CORRECTIONS" && (
        <div className="space-y-3">
          {corrections.length === 0 && (
            <p className="rounded-2xl bg-white p-6 text-center text-sm text-stone-500">
              ပြင်ဆင်ရန် တောင်းဆိုချက် မရှိသေးပါ။
            </p>
          )}
          {corrections.map((c) => (
            <div key={c.id} className="rounded-2xl border border-stone-200 bg-white p-5">
              <p className="font-bold text-stone-900">
                [{c.alumni.alumniCode}] {c.alumni.fullName}
              </p>
              <pre className="mt-2 overflow-x-auto rounded-lg bg-stone-50 p-3 text-xs">
                {JSON.stringify(c.proposedData, null, 2)}
              </pre>
              {c.reason && <p className="mt-2 text-xs text-stone-600">အကြောင်းအရင်း: {c.reason}</p>}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() =>
                    runAlumniAction({ action: "APPROVE_CORRECTION", correctionId: c.id })
                  }
                  className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white"
                >
                  Approve Change
                </button>
                <button
                  onClick={() =>
                    runAlumniAction({ action: "REJECT_CORRECTION", correctionId: c.id })
                  }
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-700"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab Content: PRINT */}
      {tab === "PRINT" && printData && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-amber-200 bg-white p-6">
            <div className="flex items-center gap-2 text-amber-900">
              <BookOpen className="h-5 w-5" />
              <h2 className="text-lg font-bold">Print Book Export & Edition Freeze</h2>
            </div>
            <p className="mt-1 text-sm text-stone-600">
              Print စာအုပ်တွင် ပါဝင်ရန် သဘောတူထားသော Verified ကျောင်းသားဟောင်း{" "}
              <strong>{printData.eligibleCount}</strong> ဦး (ပြည်တွင်း {printData.domesticCount} · ပြည်ပ{" "}
              {printData.internationalCount})
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={() => exportCsv(null)}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800"
              >
                <FileSpreadsheet className="h-4 w-4" /> Excel/CSV (အားလုံး)
              </button>
              <button
                onClick={() => exportCsv(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-stone-50"
              >
                <Download className="h-4 w-4" /> ပြည်တွင်း သီးသန့် CSV
              </button>
              <button
                onClick={() => exportCsv(false)}
                className="inline-flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold hover:bg-stone-50"
              >
                <Download className="h-4 w-4" /> ပြည်ပ သီးသန့် CSV
              </button>
              <Link
                href="/admin/print"
                className="inline-flex items-center gap-2 rounded-xl bg-amber-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-900"
              >
                <Printer className="h-4 w-4" /> Print-Ready PDF View ဖွင့်ရန်
              </Link>
            </div>

            <div className="mt-6 border-t border-stone-200 pt-5">
              <h3 className="text-sm font-bold text-stone-800">
                Publication Snapshot သိမ်းဆည်းရန် (PRINT-FINAL Freeze)
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  type="text"
                  value={editionTitle}
                  onChange={(e) => setEditionTitle(e.target.value)}
                  className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
                />
                <button
                  onClick={freezePublication}
                  className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-bold text-white"
                >
                  Freeze Snapshot
                </button>
              </div>
              {printData.publications.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-stone-600">
                  {printData.publications.map((pub) => (
                    <li key={pub.id}>
                      • <strong>{pub.title}</strong> — {pub.snapshotCount} ဦး (Frozen:{" "}
                      {new Date(pub.frozenAt).toLocaleString()})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: BATCH IMPORT */}
      {tab === "IMPORT" && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-amber-800" />
            <h2 className="text-lg font-bold text-stone-900">
              Batch ကိုယ်စားလှယ်များထံမှ CSV Import လုပ်ရန်
            </h2>
          </div>
          <p className="mt-1 text-xs text-stone-600">
            တစ်ကြောင်းလျှင် တစ်ဦးနှုန်းဖြင့်{" "}
            <code>အမည်, ဘွဲ့ရနှစ်, ကျောင်းဆောင်, မြို့, ဖုန်းနံပါတ်, လက်ရှိတာဝန်</code> ပုံစံအတိုင်း ထည့်ပါ (Zawgyi ဖြစ်ပါက Unicode သို့ အလိုအလျောက် ပြောင်းပေးပါမည်)။
          </p>
          <textarea
            rows={6}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="အရှင်ကုသလ, ၁၃၆၅, ပင်မကျောင်းဆောင်, ရန်ကုန်, 09790001122, စာချ"
            className="mt-3 w-full rounded-xl border border-stone-300 p-3 font-mono text-xs"
          />
          <button
            onClick={handleImportCsv}
            className="mt-3 rounded-xl bg-amber-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-900"
          >
            Import as Pending
          </button>
        </div>
      )}

      {/* Tab Content: AUDIT LOGS */}
      {tab === "LOGS" && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="text-lg font-bold text-stone-900">Recent Audit Logs</h2>
          <div className="mt-3 space-y-2 text-xs">
            {auditLogs.map((l) => (
              <div key={l.id} className="flex justify-between border-b border-stone-100 py-1.5">
                <span className="font-mono font-semibold text-stone-800">
                  {l.action} ({l.targetType})
                </span>
                <span className="text-stone-500">{new Date(l.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

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
  Pencil,
  Printer,
  ShieldAlert,
  Upload,
  X,
} from "lucide-react";
import { COUNTRIES } from "@/lib/mimu-locations";
import { DORMITORY_OTHER } from "@/lib/dormitories";
import { toWesternDigits } from "@/lib/myanmar-utils";
import ExcelImport from "@/components/ExcelImport";
import AdminBackup from "@/components/AdminBackup";

interface AdminAlumni {
  id: string;
  userId?: string | null;
  alumniCode: string;
  monkOrLay: string;
  fullName: string;
  formerName?: string | null;
  birthplace: string;
  degreeName?: string | null;
  batchYearDisplay: string;
  batchYearMm?: number | null;
  batchYearApprox?: boolean;
  dormitory: string;
  stayPeriod?: string | null;
  currentRoleOrMonastery: string;
  currentMonastery?: string | null;
  messageToAlumni?: string | null;
  countryCode?: string;
  countryName: string;
  isDomestic: boolean;
  region?: string | null;
  township?: string | null;
  city: string;
  wardOrVillage?: string | null;
  phonePrimary?: string | null;
  phoneSecondary?: string | null;
  viber?: string | null;
  telegram?: string | null;
  email?: string | null;
  facebook?: string | null;
  showPhoneWeb?: boolean;
  showViberTgWeb?: boolean;
  showEmailFbWeb?: boolean;
  showWardWeb?: boolean;
  showPhonePrint: boolean;
  showWardPrint?: boolean;
  bookConsent: boolean;
  referrerName?: string | null;
  bestContactTime?: string | null;
  adminNote?: string | null;
  profileStatus: string;
  isPotentialDuplicate: boolean;
}

interface DormitoryItem {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

interface EditFormState {
  monkOrLay: string;
  fullName: string;
  formerName: string;
  birthplace: string;
  degreeName: string;
  batchYearDisplay: string;
  batchYearApprox: boolean;
  dormitory: string;
  dormitoryOther: string;
  stayPeriod: string;
  currentRoleOrMonastery: string;
  currentMonastery: string;
  messageToAlumni: string;
  countryCode: string;
  countryName: string;
  countryOther: string;
  region: string;
  township: string;
  city: string;
  wardOrVillage: string;
  phonePrimary: string;
  phoneSecondary: string;
  viber: string;
  telegram: string;
  email: string;
  facebook: string;
  showPhoneWeb: boolean;
  showViberTgWeb: boolean;
  showEmailFbWeb: boolean;
  showWardWeb: boolean;
  showPhonePrint: boolean;
  showWardPrint: boolean;
  adminNote: string;
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
  birthplace: string;
  degreeName?: string | null;
  batchYearDisplay: string;
  dormitory: string;
  currentRoleOrMonastery: string;
  currentMonastery?: string | null;
  isDomestic: boolean;
  countryName: string;
  region?: string | null;
  township?: string | null;
  city: string;
  wardOrVillage?: string | null;
  phone?: string | null;
}

export default function AdminDashboardPage() {
  const [tab, setTab] = useState<"PENDING" | "ALL" | "DUPLICATES" | "CORRECTIONS" | "PRINT" | "IMPORT" | "BACKUP" | "LOGS" | "DORMITORIES" | "SETTINGS">("PENDING");
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

  // Dormitory list management (admin-managed, DB-backed; may be empty)
  const [dormitories, setDormitories] = useState<DormitoryItem[]>([]);
  const [newDormName, setNewDormName] = useState("");
  const [renamingDorm, setRenamingDorm] = useState<{ id: string; name: string } | null>(null);

  // Admin direct edit of one alumni record
  const [editTarget, setEditTarget] = useState<AdminAlumni | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [editError, setEditError] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Admin's own login credentials (email + password)
  const [credEmail, setCredEmail] = useState("");
  const [credCurrent, setCredCurrent] = useState("");
  const [credPassword, setCredPassword] = useState("");
  const [credConfirm, setCredConfirm] = useState("");
  const [credError, setCredError] = useState("");
  const [credSuccess, setCredSuccess] = useState("");
  const [credSaving, setCredSaving] = useState(false);
  const [credLoaded, setCredLoaded] = useState(false);

  const activeDormitoryNames = dormitories.filter((d) => d.isActive).map((d) => d.name);

  async function loadDormitories() {
    try {
      const res = await fetch("/api/admin/dormitories");
      if (res.ok) {
        const data = await res.json();
        setDormitories(data.dormitories || []);
      }
    } catch {
      // Dormitory list is optional for the rest of the panel.
    }
  }

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
    loadDormitories();
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (tab === "SETTINGS" && !credLoaded) {
      setCredLoaded(true);
      fetch("/api/admin/change-credentials")
        .then((r) => r.json())
        .then((d) => setCredEmail(d.loginEmail || ""))
        .catch(() => {});
    }
  }, [tab, credLoaded]);

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setCredError("");
    setCredSuccess("");
    if (credPassword && credPassword !== credConfirm) {
      setCredError("စကားဝှက်အသစ် နှစ်ကြိမ် တူညီစွာ ရိုက်ထည့်ပါ။");
      return;
    }
    setCredSaving(true);
    try {
      const res = await fetch("/api/admin/change-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: credCurrent,
          newEmail: credEmail,
          newPassword: credPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCredError(data.error || "ပြောင်းလဲရာတွင် အမှားအယွင်း ဖြစ်ပွားပါသည်။");
        return;
      }
      setCredSuccess(
        "Admin Login အချက်အလက် ပြောင်းလဲပြီးပါပြီ။ နောက်တစ်ကြိမ် Login ဝင်လျှင် အသစ်ကို သုံးပါ။"
      );
      if (data.loginEmail) setCredEmail(data.loginEmail);
      setCredCurrent("");
      setCredPassword("");
      setCredConfirm("");
    } catch {
      setCredError("ချိတ်ဆက်မှု အမှားအယွင်း ဖြစ်ပွားပါသည်။");
    } finally {
      setCredSaving(false);
    }
  }

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

  async function runDormitoryAction(
    method: "POST" | "PATCH" | "DELETE",
    payload?: Record<string, unknown>
  ) {
    setNotice("");
    const url =
      method === "DELETE" && payload?.id
        ? `/api/admin/dormitories?id=${payload.id}`
        : "/api/admin/dormitories";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "DELETE" ? undefined : JSON.stringify(payload || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setDormitories(data.dormitories || []);
      setNotice("ကျောင်းဆောင်စာရင်း ပြင်ဆင်ပြီးပါပြီ။");
    } else {
      setNotice(data.error || "ကျောင်းဆောင်စာရင်း ပြင်ဆင်ရာတွင် အမှားအယွင်း ဖြစ်ပွားပါသည်။");
    }
  }

  function openEdit(item: AdminAlumni) {
    const inList = activeDormitoryNames.includes(item.dormitory);
    setEditTarget(item);
    setEditError("");
    setEditForm({
      monkOrLay: item.monkOrLay || "MONK",
      fullName: item.fullName || "",
      formerName: item.formerName || "",
      birthplace: item.birthplace || "",
      degreeName: item.degreeName || "",
      batchYearDisplay: item.batchYearDisplay || "",
      batchYearApprox: Boolean(item.batchYearApprox),
      dormitory: inList ? item.dormitory : DORMITORY_OTHER,
      dormitoryOther: inList ? "" : item.dormitory || "",
      stayPeriod: item.stayPeriod || "",
      currentRoleOrMonastery: item.currentRoleOrMonastery || "",
      currentMonastery: item.currentMonastery || "",
      messageToAlumni: item.messageToAlumni || "",
      countryCode: item.countryCode || "MM",
      countryName: item.countryName || "မြန်မာ",
      countryOther: "",
      region: item.region || "",
      township: item.township || "",
      city: item.city || "",
      wardOrVillage: item.wardOrVillage || "",
      phonePrimary: item.phonePrimary || "",
      phoneSecondary: item.phoneSecondary || "",
      viber: item.viber || "",
      telegram: item.telegram || "",
      email: item.email || "",
      facebook: item.facebook || "",
      showPhoneWeb: Boolean(item.showPhoneWeb),
      showViberTgWeb: Boolean(item.showViberTgWeb),
      showEmailFbWeb: Boolean(item.showEmailFbWeb),
      showWardWeb: item.showWardWeb !== false,
      showPhonePrint: Boolean(item.showPhonePrint),
      showWardPrint: item.showWardPrint !== false,
      adminNote: item.adminNote || "",
    });
  }

  async function saveEdit() {
    if (!editTarget || !editForm) return;
    setEditError("");
    setEditSaving(true);
    try {
      const res = await fetch("/api/admin/alumni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ADMIN_EDIT",
          alumniId: editTarget.id,
          fields: editForm,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditError(data.error || "ပြင်ဆင်ရာတွင် အမှားအယွင်း ဖြစ်ပွားပါသည်။");
        return;
      }
      setNotice(
        `ပြင်ဆင်ပြီးပါပြီ။${data.changedFields?.length ? ` (${data.changedFields.join(", ")})` : ""}`
      );
      setEditTarget(null);
      setEditForm(null);
      loadDashboard();
    } catch {
      setEditError("ချိတ်ဆက်မှု အမှားအယွင်း ဖြစ်ပွားပါသည်။");
    } finally {
      setEditSaving(false);
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
      "Birthplace",
      "Degree",
      "BatchYear",
      "Dormitory",
      "CurrentMonastery",
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
          r.birthplace || "",
          r.degreeName || "",
          r.batchYearDisplay,
          r.dormitory,
          r.currentMonastery || "",
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
      const [fullName, batchYearDisplay, dormitory, city, phonePrimary, currentRoleOrMonastery, birthplace] =
        line.split(",").map((c) => c.trim());
      return {
        fullName,
        batchYearDisplay,
        dormitory,
        city,
        phonePrimary,
        currentRoleOrMonastery,
        // 7th column, optional: old 6-column rows keep working as before.
        birthplace,
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
  const inp = "mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm";
  const lbl = "block text-xs font-bold text-stone-700";
  const setEdit = (patch: Partial<EditFormState>) =>
    setEditForm((prev) => (prev ? { ...prev, ...patch } : prev));

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
          { id: "IMPORT", label: "Excel / CSV Import" },
          { id: "BACKUP", label: "Backup / Restore" },
          { id: "DORMITORIES", label: `ကျောင်းဆောင် (${dormitories.length})` },
          { id: "LOGS", label: "Audit Logs" },
          { id: "SETTINGS", label: "Login အချက်အလက်" },
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
                    {(item.degreeName || item.birthplace) && (
                      <p className="text-sm font-medium text-amber-900">
                        {item.degreeName}
                        {item.degreeName && item.birthplace ? " · " : ""}
                        {item.birthplace ? `မွေးဇာတိ: ${item.birthplace}` : ""}
                      </p>
                    )}
                    <p className="text-sm text-stone-700">
                      {item.dormitory}
                      {item.currentMonastery ? ` · ${item.currentMonastery}` : ""} ·{" "}
                      {item.currentRoleOrMonastery}
                    </p>
                    <p className="text-xs text-stone-500">
                      {item.countryName} {item.region ? `· ${item.region}` : ""} · {item.city} · ဖုန်း:{" "}
                      <span className="latin-nums">{item.phonePrimary}</span>
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
                    <button
                      onClick={() => openEdit(item)}
                      className="inline-flex items-center gap-1 rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-stone-700"
                    >
                      <Pencil className="h-3.5 w-3.5" /> ပြင်ဆင်မည်
                    </button>
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
              Print စာအုပ်တွင် ပါဝင်ရန် သဘောတူထားသော Verified ဗဟန်း-ညောင်တုန်းနွယ်ဖွား{" "}
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
        <div className="space-y-4">
          <ExcelImport />
          <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-amber-800" />
            <h2 className="text-lg font-bold text-stone-900">
              Batch ကိုယ်စားလှယ်များထံမှ CSV Import လုပ်ရန်
            </h2>
          </div>
          <p className="mt-1 text-xs text-stone-600">
            တစ်ကြောင်းလျှင် တစ်ဦးနှုန်းဖြင့်{" "}
            <code>အမည်, ဘွဲ့ရနှစ်, ကျောင်းဆောင်, မြို့, ဖုန်းနံပါတ်, လက်ရှိတာဝန်, မွေးဇာတိမြို့ (ရွေးချယ်)</code> ပုံစံအတိုင်း ထည့်ပါ (Zawgyi ဖြစ်ပါက Unicode သို့ အလိုအလျောက် ပြောင်းပေးပါမည်)။ မွေးဇာတိမြို့ မပါတဲ့ အဟောင်း ၆ ကော်လံ ပုံစံလည်း ဆက်သုံးလို့ ရပါတယ်။
          </p>
          <textarea
            rows={6}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="အရှင်ကုသလ, ၁၃၆၅, ကျောင်းဆောင်အမည်, ရန်ကုန်, 09790001122, စာချ, အရာတော်၊ မုံရွာ"
            className="mt-3 w-full rounded-xl border border-stone-300 p-3 font-mono text-xs"
          />
          <button
            onClick={handleImportCsv}
            className="mt-3 rounded-xl bg-amber-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-900"
          >
            Import as Pending
          </button>
          </div>
        </div>
      )}

      {/* Tab Content: BACKUP / RESTORE */}
      {tab === "BACKUP" && <AdminBackup />}

      {/* Tab Content: DORMITORIES */}
      {tab === "DORMITORIES" && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <h2 className="text-lg font-bold text-stone-900">ကျောင်းဆောင်စာရင်း စီမံခန့်ခွဲရန်</h2>
          <p className="mt-1 text-sm text-stone-600">
            စာရင်းသွင်းဖောင်နှင့် Directory ရှာဖွေမှုတွင် ပြမည့် ကျောင်းဆောင်အမည်များ။ စာရင်း ဗလာဖြစ်နေလည်း
            ရပါသည် — ထိုအခါ &ldquo;အခြား&rdquo; ဖြင့် အမည်ကို ကိုယ်တိုင် ရေးထည့်နိုင်သည်။ အမည်ပြင်လိုက်လျှင် ထို
            ကျောင်းဆောင်တွင် နေခဲ့ဖူးသော ဗဟန်း-ညောင်တုန်းနွယ်ဖွားအားလုံး၏ မှတ်တမ်းပါ အမည်သစ်ဖြင့် လိုက်ပြောင်းပေးမည်။
            ဖျောက်ထားခြင်း / ဖျက်ခြင်းသည် ကျောင်းသားမှတ်တမ်းကို လုံးဝ မထိခိုက်ပါ။
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <input
              type="text"
              value={newDormName}
              onChange={(e) => setNewDormName(e.target.value)}
              placeholder="ကျောင်းဆောင်အမည် အသစ် ရေးပါ"
              className="min-w-64 flex-1 rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
            <button
              onClick={() => {
                if (!newDormName.trim()) return;
                runDormitoryAction("POST", { action: "CREATE", name: newDormName });
                setNewDormName("");
              }}
              className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-bold text-white"
            >
              အသစ်ထည့်မည်
            </button>
          </div>

          {dormitories.length === 0 && (
            <p className="mt-4 rounded-xl bg-stone-50 p-4 text-center text-sm text-stone-500">
              ကျောင်းဆောင်စာရင်း ဗလာဖြစ်နေပါသည်။ အထက်မှ အမည်အသစ် ထည့်သွင်းပါ။
            </p>
          )}

          <div className="mt-4 space-y-2">
            {dormitories.map((d, index) => {
              const inUse = alumniList.filter((a) => a.dormitory === d.name).length;
              return (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 p-3"
                >
                  <div>
                    {renamingDorm?.id === d.id ? (
                      <span className="flex flex-wrap gap-2">
                        <input
                          type="text"
                          value={renamingDorm.name}
                          onChange={(e) =>
                            setRenamingDorm({ id: d.id, name: e.target.value })
                          }
                          className="rounded-lg border border-stone-300 px-2 py-1 text-sm"
                        />
                        <button
                          onClick={() => {
                            runDormitoryAction("PATCH", {
                              action: "RENAME",
                              id: d.id,
                              name: renamingDorm.name,
                            });
                            setRenamingDorm(null);
                          }}
                          className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-bold text-white"
                        >
                          သိမ်းမည်
                        </button>
                        <button
                          onClick={() => setRenamingDorm(null)}
                          className="rounded-lg border border-stone-300 px-3 py-1 text-xs font-bold"
                        >
                          မလုပ်တော့
                        </button>
                      </span>
                    ) : (
                      <span className="font-bold text-stone-900">
                        {d.name}
                        {!d.isActive && (
                          <span className="ml-2 rounded bg-stone-200 px-2 py-0.5 text-xs font-bold text-stone-600">
                            ဖျောက်ထားသည်
                          </span>
                        )}
                      </span>
                    )}
                    <span className="ml-3 text-xs text-stone-500">သုံးနေသူ {inUse} ဦး</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setRenamingDorm({ id: d.id, name: d.name })}
                      className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-bold hover:bg-stone-50"
                    >
                      အမည်ပြင်မည်
                    </button>
                    <button
                      onClick={() => {
                        const next = [...dormitories];
                        const target = index - 1;
                        if (target < 0) return;
                        [next[index], next[target]] = [next[target], next[index]];
                        runDormitoryAction("PATCH", {
                          action: "REORDER",
                          orderedIds: next.map((x) => x.id),
                        });
                      }}
                      disabled={index === 0}
                      className="rounded-lg border border-stone-300 px-2 py-1.5 text-xs font-bold hover:bg-stone-50 disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => {
                        const next = [...dormitories];
                        const target = index + 1;
                        if (target >= next.length) return;
                        [next[index], next[target]] = [next[target], next[index]];
                        runDormitoryAction("PATCH", {
                          action: "REORDER",
                          orderedIds: next.map((x) => x.id),
                        });
                      }}
                      disabled={index === dormitories.length - 1}
                      className="rounded-lg border border-stone-300 px-2 py-1.5 text-xs font-bold hover:bg-stone-50 disabled:opacity-40"
                    >
                      ↓
                    </button>
                    <button
                      onClick={() =>
                        runDormitoryAction("PATCH", {
                          action: "SET_ACTIVE",
                          id: d.id,
                          isActive: !d.isActive,
                        })
                      }
                      className="rounded-lg border border-amber-700 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-50"
                    >
                      {d.isActive ? "ဖျောက်ထားမည်" : "ပြန်ဖော်မည်"}
                    </button>
                    <button
                      onClick={() => {
                        if (
                          window.confirm(
                            `“${d.name}” ကို စာရင်းမှ ဖျက်မည်လား။ ကျောင်းသားမှတ်တမ်းများမပျက်ပါ။`
                          )
                        ) {
                          runDormitoryAction("DELETE", { id: d.id });
                        }
                      }}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
                    >
                      ဖျက်မည်
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
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

      {/* Tab Content: SETTINGS (admin login credentials) */}
      {tab === "SETTINGS" && (
        <div className="rounded-2xl border border-stone-200 bg-white p-6">
          <div className="flex items-center gap-2 text-stone-900">
            <KeyRound className="h-5 w-5 text-amber-800" />
            <h2 className="text-lg font-bold">Admin Login အချက်အလက် ပြောင်းလဲရန်</h2>
          </div>
          <p className="mt-1 text-sm text-stone-600">
            လက်ရှိ Login အီးမေးလ် (username) နှင့် စကားဝှက်ကို ပြောင်းလဲနိုင်ပါသည်။ လက်ရှိ စကားဝှက်ကို
            အမြဲတမ်း ထည့်ရပါမည်။ ပြောင်းလဲလိုသော အကွက်ကိုသာ ဖြည့်ပါ — စကားဝှက်အသစ်သည် အနည်းဆုံး စာလုံး
            ၆ လုံး ရှိရပါမည်။
          </p>
          <form onSubmit={submitCredentials} className="mt-4 grid max-w-2xl gap-3">
            <div>
              <label className="block text-sm font-semibold text-stone-800">
                Login အီးမေးလ် (username)
              </label>
              <input
                type="email"
                value={credEmail}
                onChange={(e) => setCredEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-stone-800">လက်ရှိ စကားဝှက် *</label>
              <input
                type="password"
                value={credCurrent}
                onChange={(e) => setCredCurrent(e.target.value)}
                className="latin-nums mt-1 w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-stone-800">စကားဝှက်အသစ်</label>
                <input
                  type="password"
                  value={credPassword}
                  onChange={(e) => setCredPassword(e.target.value)}
                  placeholder="မပြောင်းလိုလျှင် ဗလာထားပါ"
                  className="latin-nums mt-1 w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-stone-800">
                  စကားဝှက်အသစ် (ထပ်ရိုက်ပါ)
                </label>
                <input
                  type="password"
                  value={credConfirm}
                  onChange={(e) => setCredConfirm(e.target.value)}
                  className="latin-nums mt-1 w-full rounded-xl border border-stone-300 px-4 py-2.5 text-sm"
                />
              </div>
            </div>
            <div>
              <button
                type="submit"
                disabled={credSaving}
                className="rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {credSaving ? "ပြောင်းလဲနေပါသည်..." : "ပြောင်းလဲသိမ်းဆည်းမည်"}
              </button>
            </div>
          </form>
          {credError && (
            <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
              {credError}
            </p>
          )}
          {credSuccess && (
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
              {credSuccess}
            </p>
          )}
        </div>
      )}

      {/* Admin Edit modal */}
      {editTarget && editForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-3xl rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-stone-900">
                  ပြင်ဆင်မည် — [{editTarget.alumniCode}] {editTarget.fullName}
                </h2>
                <p className="mt-1 text-xs text-stone-600">
                  အခြေအနေ ({editTarget.profileStatus}) ကို မထိခိုက်ပါ — PENDING ဖြစ်နေလျှင် ပြင်ပြီးလည်း
                  PENDING အတိုင်းပဲ ကျန်မည်။ Approve ကို သပ်သပ် လုပ်ရမည်။
                </p>
              </div>
              <button
                onClick={() => {
                  setEditTarget(null);
                  setEditForm(null);
                }}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
                {editError}
              </div>
            )}

            <div className="mt-5 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={lbl}>ရဟန်း / လူ</label>
                  <select
                    value={editForm.monkOrLay}
                    onChange={(e) => setEdit({ monkOrLay: e.target.value })}
                    className={inp}
                  >
                    <option value="MONK">ရဟန်း</option>
                    <option value="LAY">လူ</option>
                  </select>
                </div>
                <div>
                  <label className={lbl}>အမည် *</label>
                  <input
                    value={editForm.fullName}
                    onChange={(e) => setEdit({ fullName: e.target.value })}
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>ယခင်အမည်</label>
                  <input
                    value={editForm.formerName}
                    onChange={(e) => setEdit({ formerName: e.target.value })}
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>မွေးဇာတိမြို့</label>
                  <input
                    value={editForm.birthplace}
                    onChange={(e) => setEdit({ birthplace: e.target.value })}
                    placeholder="ဥပမာ - အရာတော်၊ မုံရွာ"
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>အမြင့်ဆုံးအတန်း</label>
                  <input
                    value={editForm.degreeName}
                    onChange={(e) => setEdit({ degreeName: e.target.value })}
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>ဘွဲ့ရနှစ် (မြန်မာသက္ကရာဇ်)</label>
                  <input
                    value={editForm.batchYearDisplay}
                    onChange={(e) => setEdit({ batchYearDisplay: e.target.value })}
                    className={inp}
                  />
                  <label className="mt-2 flex items-center gap-2 text-xs text-stone-600">
                    <input
                      type="checkbox"
                      checked={editForm.batchYearApprox}
                      onChange={(e) => setEdit({ batchYearApprox: e.target.checked })}
                      className="h-4 w-4 accent-amber-800"
                    />
                    ခန့်မှန်းနှစ် ဖြစ်ပါသည်
                  </label>
                </div>
                <div>
                  <label className={lbl}>နေခဲ့သော ကျောင်းဆောင် *</label>
                  <select
                    value={editForm.dormitory}
                    onChange={(e) => setEdit({ dormitory: e.target.value })}
                    className={inp}
                  >
                    {[...activeDormitoryNames, DORMITORY_OTHER].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  {editForm.dormitory === DORMITORY_OTHER && (
                    <input
                      value={editForm.dormitoryOther}
                      onChange={(e) => setEdit({ dormitoryOther: e.target.value })}
                      placeholder="ကျောင်းဆောင်အမည် ရေးပါ"
                      className={`${inp} mt-2`}
                    />
                  )}
                </div>
                <div>
                  <label className={lbl}>ကျောင်းတွင် နေခဲ့သော ခုနှစ် (မှ — အထိ)</label>
                  <input
                    value={editForm.stayPeriod}
                    onChange={(e) => setEdit({ stayPeriod: e.target.value })}
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>လက်ရှိကျောင်းတိုက်-ကျောင်းဆောင်</label>
                  <input
                    value={editForm.currentMonastery}
                    onChange={(e) => setEdit({ currentMonastery: e.target.value })}
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>အလုပ်/တာဝန် *</label>
                  <input
                    value={editForm.currentRoleOrMonastery}
                    onChange={(e) => setEdit({ currentRoleOrMonastery: e.target.value })}
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>နိုင်ငံ</label>
                  <select
                    value={editForm.countryCode}
                    onChange={(e) => {
                      const code = e.target.value;
                      const found = COUNTRIES.find((c) => c.code === code);
                      setEdit({
                        countryCode: code,
                        countryName: code === "OTHER" ? editForm.countryName : found?.nameMm || "",
                      });
                    }}
                    className={inp}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.nameMm}
                      </option>
                    ))}
                  </select>
                  {editForm.countryCode === "OTHER" && (
                    <input
                      value={editForm.countryOther || editForm.countryName}
                      onChange={(e) =>
                        setEdit({ countryOther: e.target.value, countryName: e.target.value })
                      }
                      placeholder="နိုင်ငံအမည် ရေးပါ"
                      className={`${inp} mt-2`}
                    />
                  )}
                </div>
                <div>
                  <label className={lbl}>တိုင်းဒေသကြီး / ပြည်နယ်</label>
                  <input
                    value={editForm.region}
                    onChange={(e) => setEdit({ region: e.target.value })}
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>မြို့နယ်</label>
                  <input
                    value={editForm.township}
                    onChange={(e) => setEdit({ township: e.target.value })}
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>မြို့ *</label>
                  <input
                    value={editForm.city}
                    onChange={(e) => setEdit({ city: e.target.value })}
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>ရွာ / ရပ်ကွက်</label>
                  <input
                    value={editForm.wardOrVillage}
                    onChange={(e) => setEdit({ wardOrVillage: e.target.value })}
                    className={inp}
                  />
                </div>
                <div>
                  <label className={lbl}>ဖုန်း (အဓိက) *</label>
                  <input
                    value={editForm.phonePrimary}
                    onChange={(e) => setEdit({ phonePrimary: e.target.value })}
                    className={`${inp} latin-nums`}
                  />
                </div>
                <div>
                  <label className={lbl}>ဖုန်း (ဒုတိယ)</label>
                  <input
                    value={editForm.phoneSecondary}
                    onChange={(e) => setEdit({ phoneSecondary: toWesternDigits(e.target.value) })}
                    className={`${inp} latin-nums`}
                  />
                </div>
                <div>
                  <label className={lbl}>Viber</label>
                  <input
                    value={editForm.viber}
                    onChange={(e) => setEdit({ viber: toWesternDigits(e.target.value) })}
                    className={`${inp} latin-nums`}
                  />
                </div>
                <div>
                  <label className={lbl}>Telegram</label>
                  <input
                    value={editForm.telegram}
                    onChange={(e) => setEdit({ telegram: toWesternDigits(e.target.value) })}
                    className={`${inp} latin-nums`}
                  />
                </div>
                <div>
                  <label className={lbl}>Email</label>
                  <input
                    value={editForm.email}
                    onChange={(e) => setEdit({ email: toWesternDigits(e.target.value) })}
                    className={`${inp} latin-nums`}
                  />
                </div>
                <div>
                  <label className={lbl}>Facebook</label>
                  <input
                    value={editForm.facebook}
                    onChange={(e) => setEdit({ facebook: toWesternDigits(e.target.value) })}
                    className={`${inp} latin-nums`}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={lbl}>ဗဟန်း-ညောင်တုန်းနွယ်ဖွားထံ ပေးလိုသော စကား</label>
                  <textarea
                    rows={2}
                    value={editForm.messageToAlumni}
                    onChange={(e) => setEdit({ messageToAlumni: e.target.value })}
                    className={inp}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={lbl}>Admin မှတ်ချက် (Admin သာ မြင်ရမည်)</label>
                  <textarea
                    rows={2}
                    value={editForm.adminNote}
                    onChange={(e) => setEdit({ adminNote: e.target.value })}
                    className={inp}
                  />
                </div>
              </div>

              <div>
                <p className="text-sm font-bold text-stone-800">မြင်နိုင်ခွင့် ရွေးချယ်မှု</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(
                    [
                      ["showPhoneWeb", "ဖုန်း — Web မှာ ပြမည်"],
                      ["showViberTgWeb", "Viber / Telegram — Web မှာ ပြမည်"],
                      ["showEmailFbWeb", "Email / Facebook — Web မှာ ပြမည်"],
                      ["showWardWeb", "ရွာ / ရပ်ကွက် — Web မှာ ပြမည်"],
                      ["showPhonePrint", "ဖုန်း — Print စာအုပ်မှာ ပြမည်"],
                      ["showWardPrint", "ရွာ / ရပ်ကွက် — Print စာအုပ်မှာ ပြမည်"],
                    ] as Array<[keyof EditFormState, string]>
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 text-sm text-stone-700">
                      <input
                        type="checkbox"
                        checked={Boolean(editForm[key])}
                        onChange={(e) => setEdit({ [key]: e.target.checked } as Partial<EditFormState>)}
                        className="h-4 w-4 accent-amber-800"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={saveEdit}
                  disabled={editSaving}
                  className="rounded-xl bg-stone-900 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {editSaving ? "သိမ်းနေပါသည်…" : "သိမ်းဆည်းမည်"}
                </button>
                <button
                  onClick={() => {
                    setEditTarget(null);
                    setEditForm(null);
                  }}
                  className="rounded-xl border border-stone-300 px-5 py-2.5 text-sm font-bold"
                >
                  မလုပ်တော့
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

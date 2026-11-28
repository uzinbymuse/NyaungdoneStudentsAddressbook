"use client";

import { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, ChevronDown, ChevronUp, Clock, Edit3, KeyRound } from "lucide-react";
import { dedupeAddressParts, toWesternDigits } from "@/lib/myanmar-utils";
import { COUNTRIES, MYANMAR_REGIONS } from "@/lib/mimu-locations";

interface ProfileData {
  id: string;
  alumniCode: string;
  fullName: string;
  formerName?: string | null;
  birthplace: string;
  degreeName?: string | null;
  batchYearDisplay: string;
  dormitory: string;
  stayPeriod?: string | null;
  currentRoleOrMonastery: string;
  currentMonastery?: string | null;
  countryCode: string;
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
  showPhoneWeb: boolean;
  showViberTgWeb: boolean;
  showEmailFbWeb: boolean;
  showWardWeb: boolean;
  showPhonePrint: boolean;
  showWardPrint: boolean;
  profileStatus: string;
  lastConfirmedAt?: string | null;
  consents: Array<{ consentType: string; granted: boolean }>;
  correctionRequests: Array<{ id: string; status: string; createdAt: string; reason?: string | null }>;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  // Correction request (Tier 2 — identity/school fields, admin approval).
  const [corrFullName, setCorrFullName] = useState("");
  const [corrDegree, setCorrDegree] = useState("");
  const [corrBatch, setCorrBatch] = useState("");
  const [corrDormitory, setCorrDormitory] = useState("");
  const [corrBirthplace, setCorrBirthplace] = useState("");
  const [corrReason, setCorrReason] = useState("");

  // Direct self-edit (Tier 1 — contacts + current address + current
  // monastery/role). Pre-filled from the profile once it loads.
  const [editPhone, setEditPhone] = useState("");
  const [editPhoneSecondary, setEditPhoneSecondary] = useState("");
  const [editViber, setEditViber] = useState("");
  const [editTelegram, setEditTelegram] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editFacebook, setEditFacebook] = useState("");
  const [editCountryCode, setEditCountryCode] = useState("MM");
  const [editCountryOther, setEditCountryOther] = useState("");
  const [editRegion, setEditRegion] = useState("");
  const [editTownship, setEditTownship] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editWard, setEditWard] = useState("");
  const [editMonastery, setEditMonastery] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");

  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  const [openManageCard, setOpenManageCard] = useState(false);
  const [manageTab, setManageTab] = useState<"SELF_EDIT" | "CORRECTION" | "PASSWORD">("SELF_EDIT");

  async function loadAll() {
    setLoading(true);
    try {
      const pRes = await fetch("/api/profile");
      if (pRes.ok) {
        const pData = await pRes.json();
        setProfile(pData.profile);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("registered") === "1") {
      setNotice(
        "ဖောင်ဖြည့်တာ အောင်မြင်သွားပါပြီ! ကျေးဇူးတင်ပါသည်ဘုရား။ Admin မှ စစ်ဆေးအတည်ပြုပြီးပါက ကျောင်းသားဟောင်းများ စာရင်းကို ဝင်ရောက်ကြည့်ရှုနိုင်ပါမည်။"
      );
      window.history.replaceState(null, "", "/profile");
    } else if (sp.get("pinChanged") === "1") {
      setNotice(
        "PIN ပြောင်းလဲမှု အောင်မြင်ပါသည်။ PIN အသစ်နဲ့ login ဝင်နိုင်ပါပြီ။"
      );
      window.history.replaceState(null, "", "/profile");
    }
  }, []);

  // Fill the direct-edit form from the loaded profile (also refreshes
  // it after a save, via loadAll).
  useEffect(() => {
    if (!profile) return;
    setEditPhone(profile.phonePrimary || "");
    setEditPhoneSecondary(profile.phoneSecondary || "");
    setEditViber(profile.viber || "");
    setEditTelegram(profile.telegram || "");
    setEditEmail(profile.email || "");
    setEditFacebook(profile.facebook || "");
    setEditCountryCode(profile.countryCode || "MM");
    setEditCountryOther(profile.countryCode === "OTHER" ? profile.countryName : "");
    setEditRegion(profile.region || "");
    setEditTownship(profile.township || "");
    setEditCity(profile.city || "");
    setEditWard(profile.wardOrVillage || "");
    setEditMonastery(profile.currentMonastery || "");
    setEditRole(profile.currentRoleOrMonastery || "");
  }, [profile]);

  const editTownships = MYANMAR_REGIONS[editRegion] || [];
  const editIsDomestic = editCountryCode === "MM";

  function handleEditCountryChange(code: string) {
    if (code === "MM") {
      const first = MYANMAR_REGIONS["ရန်ကုန်တိုင်းဒေသကြီး"]?.[0] || "";
      setEditCountryCode(code);
      setEditRegion("ရန်ကုန်တိုင်းဒေသကြီး");
      setEditTownship(first);
      setEditCity("");
    } else {
      setEditCountryCode(code);
      setEditRegion("");
      setEditTownship("");
    }
  }

  function handleEditRegionChange(newRegion: string) {
    const nextTownships = MYANMAR_REGIONS[newRegion] || [];
    setEditRegion(newRegion);
    setEditTownship(nextTownships[0] || "");
  }

  async function submitSelfEdit(e: React.FormEvent) {
    e.preventDefault();
    setEditError("");
    setEditSuccess("");
    setEditSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "UPDATE_SELF",
          fields: {
            phonePrimary: editPhone,
            phoneSecondary: editPhoneSecondary,
            viber: editViber,
            telegram: editTelegram,
            email: editEmail,
            facebook: editFacebook,
            countryCode: editCountryCode,
            countryOther: editCountryOther,
            region: editRegion,
            township: editTownship,
            city: editCity,
            wardOrVillage: editWard,
            currentMonastery: editMonastery,
            currentRoleOrMonastery: editRole,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || "ပြင်ဆင်ရာတွင် အမှားအယွင်း ဖြစ်ပွားပါသည်။");
        return;
      }
      if (data.changedFields?.length === 0) {
        setEditSuccess("ပြောင်းလဲစရာ မရှိပါ။");
      } else if (data.phoneChanged) {
        setEditSuccess(
          "သိမ်းဆည်းပြီးပါပြီ။ ဖုန်းနံပါတ် ပြောင်းသွားပြီမို့ နောက်တစ်ခါ Login ဝင်တဲ့အခါ ဖုန်းအသစ်နဲ့ ဝင်ရပါမယ်။"
        );
      } else {
        setEditSuccess("သိမ်းဆည်းပြီးပါပြီ။ Admin ထံ ပြောင်းလဲမှု မှတ်တမ်း ရောက်ရှိပါပြီ။");
      }
      loadAll();
    } catch {
      setEditError("ချိတ်ဆက်မှု အမှားအယွင်း ဖြစ်ပွားပါသည်။");
    } finally {
      setEditSaving(false);
    }
  }

  async function submitCorrection(e: React.FormEvent) {
    e.preventDefault();
    const proposedData: Record<string, string> = {};
    if (corrFullName.trim()) proposedData.fullName = corrFullName.trim();
    if (corrDegree.trim()) proposedData.degreeName = corrDegree.trim();
    if (corrBatch.trim()) proposedData.batchYearDisplay = corrBatch.trim();
    if (corrDormitory.trim()) proposedData.dormitory = corrDormitory.trim();
    if (corrBirthplace.trim()) proposedData.birthplace = corrBirthplace.trim();

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposedData, reason: corrReason }),
    });
    if (res.ok) {
      setNotice("ပြင်ဆင်ရန် တောင်းဆိုချက်ကို Admin ထံ ပေးပို့ပြီးပါပြီ။");
      setCorrFullName("");
      setCorrDegree("");
      setCorrBatch("");
      setCorrDormitory("");
      setCorrBirthplace("");
      setCorrReason("");
      loadAll();
    }
  }

  async function submitPasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwError("");
    setPwSuccess("");
    if (pwNew !== pwConfirm) {
      setPwError("စကားဝှက်အသစ် နှစ်ကြိမ် တူညီစွာ ရိုက်ထည့်ပါ။");
      return;
    }
    setPwSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwError(data.error || "ပြောင်းလဲရာတွင် အမှားအယွင်း ဖြစ်ပွားပါသည်။");
        return;
      }
      setPwSuccess("Login စကားဝှက် ပြောင်းလဲပြီးပါပြီ။ နောက်တစ်ကြိမ် Login ဝင်လျှင် စကားဝှက်အသစ်ကို သုံးပါ။");
      setPwCurrent("");
      setPwNew("");
      setPwConfirm("");
    } catch {
      setPwError("ချိတ်ဆက်မှု အမှားအယွင်း ဖြစ်ပွားပါသည်။");
    } finally {
      setPwSaving(false);
    }
  }

  if (loading) {
    return <div className="mx-auto max-w-4xl px-4 py-12 text-center text-stone-500">ဖတ်ရှုနေပါသည်...</div>;
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center text-stone-600">
        Profile ကြည့်ရှုရန် Login ဝင်ပေးပါ။
      </div>
    );
  }

  const bookConsent =
    profile.consents.find((c) => c.consentType === "BOOK_PUBLICATION")?.granted ?? false;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      {notice && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          {notice}
        </div>
      )}

      {/* Status Card */}
      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-block rounded-md bg-stone-100 px-2.5 py-1 font-mono text-xs font-bold text-stone-700">
              {profile.alumniCode}
            </span>
            <h1 className="mt-2 text-2xl font-bold text-stone-900">{profile.fullName}</h1>
            <p className="text-sm text-stone-600">
              {profile.degreeName ? `${profile.degreeName} · ` : ""}
              {profile.birthplace ? `မွေးဇာတိ: ${profile.birthplace} · ` : ""}
              {profile.batchYearDisplay} · {profile.dormitory}
            </p>
          </div>

          <div>
            {profile.profileStatus === "VERIFIED" ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-bold text-emerald-900">
                <CheckCircle2 className="h-4 w-4" />
                အတည်ပြုပြီး (Verified)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-4 py-1.5 text-sm font-bold text-amber-900">
                <Clock className="h-4 w-4" />
                Admin စစ်ဆေးဆဲ ({profile.profileStatus})
              </span>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-2 text-sm text-stone-700 sm:grid-cols-2">
          {profile.currentMonastery ? (
            <p>
              <strong>လက်ရှိကျောင်းတိုက်:</strong> {profile.currentMonastery}
            </p>
          ) : null}
          <p>
            <strong>အလုပ်/တာဝန်:</strong> {profile.currentRoleOrMonastery}
          </p>
          <p>
            <strong>နေထိုင်ရာ:</strong> {profile.countryName} · {profile.region || ""} · {profile.city}
          </p>
          <p>
            <strong>ဖုန်း (အဓိက):</strong>{" "}
            <span className="latin-nums">{profile.phonePrimary}</span>
          </p>
          <p>
            <strong>နောက်ဆုံးအတည်ပြုချိန်:</strong>{" "}
            {profile.lastConfirmedAt
              ? new Date(profile.lastConfirmedAt).toLocaleDateString("en-GB")
              : "မရှိသေးပါ"}
          </p>
        </div>
      </div>

      {/* Print Proof Preview */}
      <div className="rounded-3xl border border-amber-200 bg-amber-50/50 p-6">
        <div className="flex items-center gap-2 text-amber-900">
          <BookOpen className="h-5 w-5" />
          <h2 className="text-lg font-bold">Print စာအုပ်တွင် ပါဝင်မည့် နမူနာပုံစံ (Print Proof)</h2>
        </div>
        {bookConsent ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-white p-4 text-sm text-stone-800">
            <p className="font-bold">
              [{profile.alumniCode}] {profile.fullName}
              {profile.degreeName ? ` (${profile.degreeName})` : ""}
              {profile.birthplace ? ` · မွေးဇာတိ: ${profile.birthplace}` : ""}
              {profile.batchYearDisplay && profile.batchYearDisplay !== "မသတ်မှတ်"
                ? ` — ${profile.batchYearDisplay}`
                : ""}
            </p>
            <p className="mt-1">
              {dedupeAddressParts([
                profile.dormitory !== "မသတ်မှတ်" ? profile.dormitory : null,
                profile.currentMonastery,
                profile.currentRoleOrMonastery,
              ]).join(" · ")}
            </p>
            <p className="mt-1">
              {dedupeAddressParts([
                profile.isDomestic ? null : profile.countryName,
                profile.region,
                profile.township,
                profile.city,
                profile.showWardPrint ? profile.wardOrVillage : null,
              ]).join("၊ ")}
            </p>
            <p className="mt-1 text-stone-600">
              ဖုန်း:{" "}
              {profile.showPhonePrint ? (
                <span className="latin-nums">{profile.phonePrimary}</span>
              ) : (
                "(စာအုပ်တွင် မထည့်ပါ)"
              )}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-stone-600">
            လက်ရှိတွင် Print စာအုပ်၌ ပါဝင်ရန် ရွေးချယ်ထားခြင်း မရှိသေးပါ (Web စာရင်းတွင်သာ ပါဝင်ပါမည်)။
          </p>
        )}
      </div>

      {/* Combined Collapsible Card: Self-Edit, Request Correction & Change Password */}
      <div className="rounded-3xl border border-stone-200 bg-white shadow-sm">
        <button
          type="button"
          onClick={() => setOpenManageCard(!openManageCard)}
          className="flex w-full items-center justify-between p-6 text-left"
          aria-expanded={openManageCard}
        >
          <div>
            <div className="flex items-center gap-2 text-stone-900">
              <Edit3 className="h-5 w-5 text-amber-800" />
              <h2 className="text-lg font-bold">
                အချက်အလက် ပြင်ဆင်ရန် နှင့် စကားဝှက် (PIN) ပြောင်းလဲရန်
              </h2>
            </div>
            <p className="mt-1 text-xs text-stone-500">
              ဆက်သွယ်ရန်/လိပ်စာ ပြင်ဆင်ခြင်း၊ အမည်/ဘွဲ့ ပြင်ဆင်တောင်းဆိုခြင်းနှင့် PIN ပြောင်းလဲခြင်း
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-semibold text-amber-900">
            {openManageCard ? (
              <>
                <span>ခေါက်သိမ်းမည်</span>
                <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                <span>ဖွင့်ကြည့်မည်</span>
                <ChevronDown className="h-4 w-4" />
              </>
            )}
          </span>
        </button>

        {openManageCard && (
          <div className="border-t border-stone-200 px-6 pb-6 pt-4">
            {/* Inner 3-Tab Switcher */}
            <div className="flex flex-wrap gap-2 border-b border-stone-200 pb-3 text-xs font-semibold sm:text-sm">
              <button
                type="button"
                onClick={() => setManageTab("SELF_EDIT")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 ${
                  manageTab === "SELF_EDIT"
                    ? "bg-amber-800 text-white"
                    : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                }`}
              >
                <Edit3 className="h-4 w-4" />
                <span>ဆက်သွယ်ရန်နှင့် လိပ်စာ</span>
              </button>
              <button
                type="button"
                onClick={() => setManageTab("CORRECTION")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 ${
                  manageTab === "CORRECTION"
                    ? "bg-amber-800 text-white"
                    : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                }`}
              >
                <Edit3 className="h-4 w-4" />
                <span>အမည်/ဘွဲ့ ပြင်ဆင်တောင်းဆို</span>
              </button>
              <button
                type="button"
                onClick={() => setManageTab("PASSWORD")}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 ${
                  manageTab === "PASSWORD"
                    ? "bg-amber-800 text-white"
                    : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                }`}
              >
                <KeyRound className="h-4 w-4" />
                <span>စကားဝှက် (PIN) ပြောင်းရန်</span>
              </button>
            </div>

            {manageTab === "SELF_EDIT" && (
              <div className="pt-4">
                <p className="text-xs text-stone-600">
                  ဒီအချက်တွေကို ပြင်လိုက်တာနဲ့ တန်းပြောင်းလဲပါမယ်။ ဖုန်းအဓိက ပြောင်းလိုက်ရင် နောက်တစ်ခါ Login
                  ဝင်တဲ့အခါ ဖုန်းအသစ်နဲ့ ဝင်ရပါမယ်။ ပြောင်းလဲမှုတိုင်းကို Admin က စာရင်းမှာ မြင်ရပါမယ်။
                </p>
                <form onSubmit={submitSelfEdit} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-semibold text-stone-800">
              ဖုန်းနံပါတ် (အဓိက) <span className="text-red-600">*</span>
            </span>
            <input
              type="text"
              required
              value={editPhone}
              onChange={(e) => setEditPhone(toWesternDigits(e.target.value))}
              className="latin-nums mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-stone-800">ဖုန်း (အရန်)</span>
            <input
              type="text"
              value={editPhoneSecondary}
              onChange={(e) => setEditPhoneSecondary(toWesternDigits(e.target.value))}
              className="latin-nums mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-stone-800">Viber</span>
            <input
              type="text"
              value={editViber}
              onChange={(e) => setEditViber(toWesternDigits(e.target.value))}
              className="latin-nums mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-stone-800">Telegram</span>
            <input
              type="text"
              value={editTelegram}
              onChange={(e) => setEditTelegram(toWesternDigits(e.target.value))}
              className="latin-nums mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-stone-800">အီးမေးလ်</span>
            <input
              type="text"
              value={editEmail}
              onChange={(e) => setEditEmail(toWesternDigits(e.target.value))}
              className="latin-nums mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-stone-800">Facebook</span>
            <input
              type="text"
              value={editFacebook}
              onChange={(e) => setEditFacebook(toWesternDigits(e.target.value))}
              className="latin-nums mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-stone-800">နိုင်ငံ</span>
            <select
              value={editCountryCode}
              onChange={(e) => handleEditCountryChange(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.nameMm} ({c.nameEn})
                </option>
              ))}
            </select>
          </label>
          {editCountryCode === "OTHER" && (
            <label className="block text-sm">
              <span className="font-semibold text-stone-800">နိုင်ငံအမည်</span>
              <input
                type="text"
                value={editCountryOther}
                onChange={(e) => setEditCountryOther(e.target.value)}
                className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
              />
            </label>
          )}
          {editIsDomestic ? (
            <>
              <label className="block text-sm">
                <span className="font-semibold text-stone-800">
                  တိုင်းဒေသကြီး / ပြည်နယ် <span className="text-red-600">*</span>
                </span>
                <select
                  value={editRegion}
                  onChange={(e) => handleEditRegionChange(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
                >
                  {Object.keys(MYANMAR_REGIONS).map((reg) => (
                    <option key={reg} value={reg}>
                      {reg}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-stone-800">
                  မြို့နယ်/မြို့ <span className="text-red-600">*</span>
                </span>
                <select
                  value={editTownship}
                  onChange={(e) => setEditTownship(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
                >
                  {editTownships.map((ts) => (
                    <option key={ts} value={ts}>
                      {ts}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label className="block text-sm">
                <span className="font-semibold text-stone-800">ပြည်နယ် / ဒေသ (ရှိလျှင်)</span>
                <input
                  type="text"
                  value={editRegion}
                  onChange={(e) => setEditRegion(e.target.value)}
                  placeholder="ဥပမာ - Bangkok / California"
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-sm">
                <span className="font-semibold text-stone-800">
                  မြို့နယ်/မြို့ <span className="text-red-600">*</span>
                </span>
                <input
                  type="text"
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                />
              </label>
            </>
          )}
          <label className="block text-sm">
            <span className="font-semibold text-stone-800">ရွာ/ရပ်ကွက်</span>
            <input
              type="text"
              value={editWard}
              onChange={(e) => setEditWard(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold text-stone-800">လက်ရှိကျောင်းတိုက်-ကျောင်းဆောင်</span>
            <input
              type="text"
              value={editMonastery}
              onChange={(e) => setEditMonastery(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-semibold text-stone-800">
              အလုပ်/တာဝန် <span className="text-red-600">*</span>
            </span>
            <input
              type="text"
              required
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={editSaving}
              className="rounded-xl bg-amber-800 px-4 py-2 text-sm font-bold text-white hover:bg-amber-900 disabled:opacity-60"
            >
              {editSaving ? "သိမ်းနေပါသည်..." : "သိမ်းဆည်းမည်"}
            </button>
          </div>
        </form>
        {editError && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
            {editError}
          </p>
        )}
                {editSuccess && (
                  <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                    {editSuccess}
                  </p>
                )}
              </div>
            )}

            {manageTab === "CORRECTION" && (
              <div className="pt-4">
                <p className="text-xs text-stone-600">
                  အမည်၊ အမြင့်ဆုံး သင်ယူ/အောင်ခဲ့သည့် အတန်း၊ ကျောင်းသို့ရောက်သည့်ခုနှစ်၊ ကျောင်းဆောင်၊
                  မွေးဇာတိမြို့ — ဒီအချက်တွေကတော့ Admin မှ စစ်ဆေးအတည်ပြုပြီးမှသာ အဓိကမှတ်တမ်းတွင်
                  ပြောင်းလဲပါမည်။ ဆက်သွယ်ရန်နှင့် လိပ်စာကိုတော့ ကိုယ်တိုင်တန်း ပြင်နိုင်ပါသည်။
                </p>
                <form onSubmit={submitCorrection} className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            type="text"
            value={corrFullName}
            onChange={(e) => setCorrFullName(e.target.value)}
            placeholder="အမည် (အသစ်)"
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={corrDegree}
            onChange={(e) => setCorrDegree(e.target.value)}
            placeholder="အမြင့်ဆုံး သင်ယူ/အောင်ခဲ့သည့် အတန်း (အသစ်)"
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={corrBatch}
            onChange={(e) => setCorrBatch(e.target.value)}
            placeholder="ကျောင်းသို့ရောက်သည့်ခုနှစ် (အသစ်)"
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={corrDormitory}
            onChange={(e) => setCorrDormitory(e.target.value)}
            placeholder="ကျောင်းဆောင် (အသစ်)"
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={corrBirthplace}
            onChange={(e) => setCorrBirthplace(e.target.value)}
            placeholder="မွေးဇာတိမြို့ (အသစ်)"
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={corrReason}
            onChange={(e) => setCorrReason(e.target.value)}
            placeholder="ပြင်ဆင်ရသည့် အကြောင်းအရင်း / အခြားအချက်"
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm sm:col-span-2"
          />
                  <button
                    type="submit"
                    className="rounded-xl bg-amber-800 px-4 py-2 text-sm font-bold text-white hover:bg-amber-900"
                  >
                    ပြင်ဆင်ချက် တင်ပြမည်
                  </button>
                </form>
              </div>
            )}

            {manageTab === "PASSWORD" && (
              <div className="pt-4">
                <p className="text-xs text-stone-600">
                  လက်ရှိ စကားဝှက်ကို ထည့်ပြီး အသစ်ပြောင်းနိုင်ပါသည်။ စကားဝှက်အသစ်သည် အနည်းဆုံး စာလုံး ၆ လုံး
                  ရှိရပါမည်။
                </p>
                <form onSubmit={submitPasswordChange} className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            type="password"
            value={pwCurrent}
            onChange={(e) => setPwCurrent(e.target.value)}
            placeholder="လက်ရှိ စကားဝှက်"
            className="latin-nums rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={pwNew}
            onChange={(e) => setPwNew(e.target.value)}
            placeholder="စကားဝှက်အသစ်"
            className="latin-nums rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={pwConfirm}
            onChange={(e) => setPwConfirm(e.target.value)}
            placeholder="စကားဝှက်အသစ် (ထပ်ရိုက်ပါ)"
            className="latin-nums rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={pwSaving}
            className="rounded-xl bg-amber-800 px-4 py-2 text-sm font-bold text-white hover:bg-amber-900 disabled:opacity-60"
          >
            {pwSaving ? "ပြောင်းလဲနေပါသည်..." : "စကားဝှက် ပြောင်းလဲမည်"}
          </button>
        </form>
        {pwError && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
            {pwError}
          </p>
        )}
                {pwSuccess && (
                  <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                    {pwSuccess}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

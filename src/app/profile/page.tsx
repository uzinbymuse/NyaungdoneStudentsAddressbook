"use client";

import { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, Clock, Edit3, KeyRound } from "lucide-react";
import { dedupeAddressParts } from "@/lib/myanmar-utils";

interface ProfileData {
  id: string;
  alumniCode: string;
  fullName: string;
  formerName?: string | null;
  degreeName?: string | null;
  batchYearDisplay: string;
  dormitory: string;
  stayPeriod?: string | null;
  currentRoleOrMonastery: string;
  currentMonastery?: string | null;
  countryName: string;
  isDomestic: boolean;
  region?: string | null;
  township?: string | null;
  city: string;
  wardOrVillage?: string | null;
  phonePrimary?: string | null;
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

interface ContactReqItem {
  id: string;
  message: string;
  status: string;
  sender?: {
    profile?: {
      alumniCode: string;
      fullName: string;
      batchYearDisplay: string;
      city: string;
      countryName: string;
    } | null;
  };
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [incomingReqs, setIncomingReqs] = useState<ContactReqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const [corrRole, setCorrRole] = useState("");
  const [corrMonastery, setCorrMonastery] = useState("");
  const [corrCity, setCorrCity] = useState("");
  const [corrPhone, setCorrPhone] = useState("");
  const [corrReason, setCorrReason] = useState("");

  const [pwCurrent, setPwCurrent] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [pRes, cRes] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/contact-requests"),
      ]);
      if (pRes.ok) {
        const pData = await pRes.json();
        setProfile(pData.profile);
      }
      if (cRes.ok) {
        const cData = await cRes.json();
        setIncomingReqs(cData.incoming || []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function submitCorrection(e: React.FormEvent) {
    e.preventDefault();
    const proposedData: Record<string, string> = {};
    if (corrRole.trim()) proposedData.currentRoleOrMonastery = corrRole.trim();
    if (corrMonastery.trim()) proposedData.currentMonastery = corrMonastery.trim();
    if (corrCity.trim()) proposedData.city = corrCity.trim();
    if (corrPhone.trim()) proposedData.phonePrimary = corrPhone.trim();

    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ proposedData, reason: corrReason }),
    });
    if (res.ok) {
      setNotice("ပြင်ဆင်ရန် တောင်းဆိုချက်ကို Admin ထံ ပေးပို့ပြီးပါပြီ။");
      setCorrRole("");
      setCorrCity("");
      setCorrPhone("");
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

  async function handleContactDecision(id: string, status: "ACCEPTED" | "DECLINED") {
    await fetch("/api/contact-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    loadAll();
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
              {profile.degreeName ? ` (${profile.degreeName})` : ""} — {profile.batchYearDisplay}
            </p>
            <p className="mt-1">
              {profile.dormitory}
              {profile.currentMonastery ? ` · ${profile.currentMonastery}` : ""} ·{" "}
              {profile.currentRoleOrMonastery}
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

      {/* Incoming Contact Requests */}
      {incomingReqs.length > 0 && (
        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-stone-900">ဆက်သွယ်ရန် တောင်းဆိုချက်များ</h2>
          <div className="mt-4 space-y-3">
            {incomingReqs.map((r) => (
              <div key={r.id} className="rounded-xl border border-stone-200 p-4 text-sm">
                <p className="font-bold">
                  {r.sender?.profile?.fullName || "ကျောင်းသားဟောင်း"} (
                  {r.sender?.profile?.batchYearDisplay || ""})
                </p>
                <p className="mt-1 text-stone-700">{r.message}</p>
                <div className="mt-3 flex items-center gap-2">
                  {r.status === "PENDING" ? (
                    <>
                      <button
                        onClick={() => handleContactDecision(r.id, "ACCEPTED")}
                        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        လက်ခံမည် (ဖုန်းမျှဝေမည်)
                      </button>
                      <button
                        onClick={() => handleContactDecision(r.id, "DECLINED")}
                        className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium"
                      >
                        ငြင်းပယ်မည်
                      </button>
                    </>
                  ) : (
                    <span className="text-xs font-semibold text-stone-500">Status: {r.status}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request Correction */}
      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-stone-900">
          <Edit3 className="h-5 w-5 text-amber-800" />
          <h2 className="text-lg font-bold">အချက်အလက် ပြင်ဆင်ရန် တောင်းဆိုခြင်း</h2>
        </div>
        <p className="mt-1 text-xs text-stone-600">
          Admin မှ စစ်ဆေးအတည်ပြုပြီးမှသာ အဓိကမှတ်တမ်းတွင် ပြောင်းလဲပါမည်။
        </p>
        <form onSubmit={submitCorrection} className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            type="text"
            value={corrMonastery}
            onChange={(e) => setCorrMonastery(e.target.value)}
            placeholder="လက်ရှိကျောင်းတိုက် (အသစ်)"
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={corrRole}
            onChange={(e) => setCorrRole(e.target.value)}
            placeholder="လက်ရှိတာဝန် (အသစ်)"
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={corrCity}
            onChange={(e) => setCorrCity(e.target.value)}
            placeholder="လက်ရှိမြို့ (အသစ်)"
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            value={corrPhone}
            onChange={(e) => setCorrPhone(e.target.value)}
            placeholder="ဖုန်းနံပါတ် (အသစ်)"
            className="latin-nums rounded-xl border border-stone-300 px-3 py-2 text-sm"
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

      {/* Change Login Password */}
      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 text-stone-900">
          <KeyRound className="h-5 w-5 text-amber-800" />
          <h2 className="text-lg font-bold">Login စကားဝှက် (PIN) ပြောင်းလဲရန်</h2>
        </div>
        <p className="mt-1 text-xs text-stone-600">
          လက်ရှိ စကားဝှက်ကို ထည့်ပြီး အသစ်ပြောင်းနိုင်ပါသည်။ စကားဝှက်အသစ်သည် အနည်းဆုံး စာလုံး ၆ လုံး
          ရှိရပါမည်။
        </p>
        <form onSubmit={submitPasswordChange} className="mt-4 grid gap-3 sm:grid-cols-3">
          <input
            type="password"
            value={pwCurrent}
            onChange={(e) => setPwCurrent(e.target.value)}
            placeholder="လက်ရှိ စကားဝှက်"
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={pwNew}
            onChange={(e) => setPwNew(e.target.value)}
            placeholder="စကားဝှက်အသစ်"
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={pwConfirm}
            onChange={(e) => setPwConfirm(e.target.value)}
            placeholder="စကားဝှက်အသစ် (ထပ်ရိုက်ပါ)"
            className="rounded-xl border border-stone-300 px-3 py-2 text-sm"
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
    </div>
  );
}

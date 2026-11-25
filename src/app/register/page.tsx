"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRIES, DORMITORY_SUGGESTIONS, MYANMAR_REGIONS } from "@/lib/mimu-locations";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    monkOrLay: "MONK",
    fullName: "",
    formerName: "",
    degreeName: "",
    batchYearDisplay: "",
    batchYearApprox: false,
    dormitory: DORMITORY_SUGGESTIONS[0],
    dormitoryOther: "",
    stayPeriod: "",
    countryCode: "MM",
    countryOther: "",
    region: "ရန်ကုန်တိုင်းဒေသကြီး",
    township: "ကမာရွတ်",
    city: "",
    wardOrVillage: "",
    currentRoleOrMonastery: "",
    messageToAlumni: "",
    phonePrimary: "",
    phoneSecondary: "",
    viber: "",
    telegram: "",
    email: "",
    facebook: "",
    password: "",
    showPhoneWeb: false,
    showViberTgWeb: false,
    showEmailFbWeb: false,
    showWardWeb: true,
    showWardPrint: true,
    adminNote: "",
    referrerName: "",
    bestContactTime: "",
    printExclusionNote: "",
    consentPolicy: false,
    consentWebDirectory: false,
    consentBookPublication: false,
    consentBookPhone: false,
  });

  const isDomestic = form.countryCode === "MM";
  const townships = MYANMAR_REGIONS[form.region] || [];

  function handleRegionChange(newRegion: string) {
    const nextTownships = MYANMAR_REGIONS[newRegion] || [];
    setForm((prev) => ({
      ...prev,
      region: newRegion,
      township: nextTownships[0] || "",
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const finalDorm = form.dormitory === "အခြား" ? form.dormitoryOther : form.dormitory;

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          dormitory: finalDorm || form.dormitory,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "စာရင်းသွင်းရာတွင် အမှားအယွင်း ဖြစ်ပွားပါသည်။");
        setLoading(false);
        return;
      }
      router.push("/profile?registered=1");
      router.refresh();
    } catch {
      setError("ချိတ်ဆက်မှု အမှားအယွင်း ဖြစ်ပွားပါသည်။");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded-3xl border border-amber-200 bg-white p-6 shadow-sm sm:p-10">
        <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">
          ကျောင်းသားဟောင်း စာရင်းသွင်းရန် ဖောင်
        </h1>
        <p className="mt-2 text-base text-stone-600">
          ပါဠိတက္ကသိုလ် ညောင်တုန်း ကျောင်းသားဟောင်းများ အချင်းချင်း ဆက်သွယ်နိုင်ရန်နှင့် လိပ်စာစာအုပ် ထုတ်ဝေနိုင်ရန် ဖြည့်သွင်းပေးပါ။
        </p>

        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <strong>သတိပြုရန်-</strong> မှတ်ပုံတင်အမှတ် (NRC)၊ မွေးနေ့အတိအကျ၊ ဘဏ်အကောင့်နှင့်
            အိမ်အမှတ်အတိအကျတို့ကို <strong>လုံးဝ မတောင်းပါ</strong>။ ရွာ/ရပ်ကွက် အဆင့်သာ ရေးပါ။
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-8 space-y-10">
          {/* Part A */}
          <section className="space-y-4">
            <h2 className="border-b border-stone-200 pb-2 text-xl font-bold text-amber-900">
              အပိုင်း (က) — တင်သူအကြောင်း
            </h2>

            <div>
              <label className="block text-base font-semibold text-stone-800">
                ရဟန်း / လူ ခွဲခြားမှု <span className="text-red-600">*</span>
              </label>
              <select
                value={form.monkOrLay}
                onChange={(e) => setForm({ ...form, monkOrLay: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base"
              >
                <option value="MONK">ရဟန်း / သာမဏေ</option>
                <option value="LAY">လူဝတ်လဲပြီး (လူပုဂ္ဂိုလ်)</option>
                <option value="NUN">သီလရှင်</option>
                <option value="OTHER">အခြား</option>
              </select>
            </div>

            <div>
              <label className="block text-base font-semibold text-stone-800">
                အမည် (ဘွဲ့အမည် / လက်ရှိ အခေါ်အမည်) <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                placeholder="ဥပမာ - အရှင်ဥတ္တမ (သို့မဟုတ်) ဦးဥတ္တမ"
                className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-3 text-base"
              />
            </div>

            <div>
              <label className="block text-base font-semibold text-stone-800">
                ယခင် အမည် (သံဃာအမည် / လူအမည် ပြောင်းခဲ့လျှင်)
              </label>
              <input
                type="text"
                value={form.formerName}
                onChange={(e) => setForm({ ...form, formerName: e.target.value })}
                placeholder="သူငယ်ချင်းများ မှတ်မိစေရန် (ရွေးချယ်)"
                className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-3 text-base"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-base font-semibold text-stone-800">
                  ရရှိခဲ့သော ဘွဲ့ (သို့) ဂုဏ်ထူးဘွဲ့
                </label>
                <input
                  type="text"
                  value={form.degreeName}
                  onChange={(e) => setForm({ ...form, degreeName: e.target.value })}
                  placeholder="ဥပမာ - ဓမ္မာစရိယ၊ B.A., M.A."
                  className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-3 text-base"
                />
              </div>

              <div>
                <label className="block text-base font-semibold text-stone-800">
                  ကျောင်းဝင်/ဘွဲ့ရ မြန်မာခုနှစ် (Batch) <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.batchYearDisplay}
                  onChange={(e) => setForm({ ...form, batchYearDisplay: e.target.value })}
                  placeholder="ဥပမာ - ၁၃၆၅ (သို့) မမှတ်မိ"
                  className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-3 text-base"
                />
                <label className="mt-2 inline-flex items-center gap-2 text-sm text-stone-600">
                  <input
                    type="checkbox"
                    checked={form.batchYearApprox}
                    onChange={(e) => setForm({ ...form, batchYearApprox: e.target.checked })}
                    className="h-4 w-4 rounded accent-amber-800"
                  />
                  <span>ခန့်မှန်းနှစ် ဖြစ်ပါသည် (အတိအကျ မမှတ်မိပါ)</span>
                </label>
              </div>
            </div>
          </section>

          {/* Part B */}
          <section className="space-y-4">
            <h2 className="border-b border-stone-200 pb-2 text-xl font-bold text-amber-900">
              အပိုင်း (ခ) — ကျောင်းတွင် နေခဲ့စဉ်က အချက်များ
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-base font-semibold text-stone-800">
                  နေခဲ့သော ကျောင်းဆောင် <span className="text-red-600">*</span>
                </label>
                <select
                  value={form.dormitory}
                  onChange={(e) => setForm({ ...form, dormitory: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base"
                >
                  {DORMITORY_SUGGESTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                {form.dormitory === "အခြား" && (
                  <input
                    type="text"
                    required
                    value={form.dormitoryOther}
                    onChange={(e) => setForm({ ...form, dormitoryOther: e.target.value })}
                    placeholder="ကျောင်းဆောင်အမည် ရေးပါ"
                    className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 text-base"
                  />
                )}
              </div>

              <div>
                <label className="block text-base font-semibold text-stone-800">
                  ကျောင်းတွင် နေခဲ့သော ခုနှစ် (မှ — အထိ)
                </label>
                <input
                  type="text"
                  value={form.stayPeriod}
                  onChange={(e) => setForm({ ...form, stayPeriod: e.target.value })}
                  placeholder="ဥပမာ - ၁၃၆၀ မှ ၁၃၆၅ ထိ"
                  className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-3 text-base"
                />
              </div>
            </div>
          </section>

          {/* Part C */}
          <section className="space-y-4">
            <h2 className="border-b border-stone-200 pb-2 text-xl font-bold text-amber-900">
              အပိုင်း (ဂ) — လက်ရှိ နေထိုင်ရာနှင့် လုပ်ငန်း
            </h2>

            <div>
              <label className="block text-base font-semibold text-stone-800">
                လက်ရှိ နေထိုင်သော နိုင်ငံ <span className="text-red-600">*</span>
              </label>
              <select
                value={form.countryCode}
                onChange={(e) => setForm({ ...form, countryCode: e.target.value })}
                className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.nameMm} ({c.nameEn})
                  </option>
                ))}
              </select>
              {form.countryCode === "OTHER" && (
                <input
                  type="text"
                  required
                  value={form.countryOther}
                  onChange={(e) => setForm({ ...form, countryOther: e.target.value })}
                  placeholder="နိုင်ငံအမည် ရေးပါ"
                  className="mt-2 w-full rounded-xl border border-stone-300 px-4 py-3 text-base"
                />
              )}
            </div>

            {isDomestic ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-base font-semibold text-stone-800">
                    တိုင်းဒေသကြီး / ပြည်နယ် <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={form.region}
                    onChange={(e) => handleRegionChange(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base"
                  >
                    {Object.keys(MYANMAR_REGIONS).map((reg) => (
                      <option key={reg} value={reg}>
                        {reg}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-base font-semibold text-stone-800">မြို့နယ်</label>
                  <select
                    value={form.township}
                    onChange={(e) => setForm({ ...form, township: e.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-4 py-3 text-base"
                  >
                    {townships.map((ts) => (
                      <option key={ts} value={ts}>
                        {ts}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-base font-semibold text-stone-800">
                  ပြည်နယ် / ဒေသ (ရှိလျှင်)
                </label>
                <input
                  type="text"
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  placeholder="ဥပမာ - Bangkok / California"
                  className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-3 text-base"
                />
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-base font-semibold text-stone-800">
                  မြို့ <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="လက်ရှိ နေထိုင်သော မြို့"
                  className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-3 text-base"
                />
              </div>
              <div>
                <label className="block text-base font-semibold text-stone-800">
                  ရွာ / ရပ်ကွက် (အိမ်အမှတ် မရေးပါနှင့်)
                </label>
                <input
                  type="text"
                  value={form.wardOrVillage}
                  onChange={(e) => setForm({ ...form, wardOrVillage: e.target.value })}
                  placeholder="ရွာ သို့မဟုတ် ရပ်ကွက် အဆင့်သာ"
                  className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-3 text-base"
                />
              </div>
            </div>

            <div>
              <label className="block text-base font-semibold text-stone-800">
                လက်ရှိ ကျောင်းတိုက် / အလုပ် / တာဝန် <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                value={form.currentRoleOrMonastery}
                onChange={(e) => setForm({ ...form, currentRoleOrMonastery: e.target.value })}
                placeholder="ဥပမာ - ကျောင်းထိုင် / စာချ / ကျောင်းတိုက်အမည် / အလုပ်အကိုင်"
                className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-3 text-base"
              />
            </div>

            <div>
              <label className="block text-base font-semibold text-stone-800">
                ကျောင်းသားဟောင်းများထံ ပြောလိုသော စကား (အတို)
              </label>
              <textarea
                rows={2}
                value={form.messageToAlumni}
                onChange={(e) => setForm({ ...form, messageToAlumni: e.target.value })}
                placeholder="သူငယ်ချင်းများ မြင်ရမည့် မှတ်ချက် (Admin ထံ အကြံပေးချက်နှင့် မရောပါနှင့်)"
                className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-3 text-base"
              />
            </div>
          </section>

          {/* Part D */}
          <section className="space-y-4">
            <h2 className="border-b border-stone-200 pb-2 text-xl font-bold text-amber-900">
              အပိုင်း (ဃ) — ဆက်သွယ်ရန်နှင့် Login စကားဝှက်
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-base font-semibold text-stone-800">
                  ဖုန်းနံပါတ် (အဓိက) <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.phonePrimary}
                  onChange={(e) => setForm({ ...form, phonePrimary: e.target.value })}
                  placeholder="09... (သို့) +66..."
                  className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-3 text-base"
                />
              </div>
              <div>
                <label className="block text-base font-semibold text-stone-800">
                  ဖုန်းနံပါတ် (အရံ)
                </label>
                <input
                  type="text"
                  value={form.phoneSecondary}
                  onChange={(e) => setForm({ ...form, phoneSecondary: e.target.value })}
                  placeholder="ရွေးချယ်"
                  className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-3 text-base"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-base font-semibold text-stone-800">Viber နံပါတ်</label>
                <input
                  type="text"
                  value={form.viber}
                  onChange={(e) => setForm({ ...form, viber: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-3 text-base"
                />
              </div>
              <div>
                <label className="block text-base font-semibold text-stone-800">Telegram ID</label>
                <input
                  type="text"
                  value={form.telegram}
                  onChange={(e) => setForm({ ...form, telegram: e.target.value })}
                  placeholder="@username"
                  className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-3 text-base"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-base font-semibold text-stone-800">အီးမေးလ်</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-3 text-base"
                />
              </div>
              <div>
                <label className="block text-base font-semibold text-stone-800">Facebook အမည်/လင့်ခ်</label>
                <input
                  type="text"
                  value={form.facebook}
                  onChange={(e) => setForm({ ...form, facebook: e.target.value })}
                  className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-3 text-base"
                />
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <label className="block text-base font-semibold text-stone-800">
                နောင် Login ဝင်ရန် စကားဝှက် (သို့မဟုတ်) ဂဏန်း ၆ လုံး PIN <span className="text-red-600">*</span>
              </label>
              <p className="mt-1 text-xs text-stone-600">
                မိမိမှတ်မိလွယ်သော ဂဏန်း ၆ လုံး (သို့မဟုတ်) စကားဝှက် အနည်းဆုံး ၆ လုံး သတ်မှတ်ပါ။
              </p>
              <div className="relative mt-2">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="အနည်းဆုံး ၆ လုံး"
                  className="w-full rounded-xl border border-stone-300 bg-white px-4 py-3 pr-12 text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-stone-500"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
          </section>

          {/* Part E */}
          <section className="space-y-3">
            <h2 className="border-b border-stone-200 pb-2 text-xl font-bold text-amber-900">
              အပိုင်း (င) — ဘာကို ဘယ်မှာ ပြမလဲ (ကိုယ်တိုင်ရွေးချယ်ရန်)
            </h2>
            <p className="text-sm text-stone-600">
              မရွေးထားသော အချက်ကို Web ပေါ်တွင် မပြပါ — ဖုန်းမပြသော်လည်း အခြားသူများက ဆက်သွယ်ရန် တောင်းဆိုချက် (Contact Request) ပေးပို့နိုင်ပါသည်။
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex items-center gap-3 rounded-xl border border-stone-200 p-3.5 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.showPhoneWeb}
                  onChange={(e) => setForm({ ...form, showPhoneWeb: e.target.checked })}
                  className="h-5 w-5 rounded accent-amber-800"
                />
                <span>Web တွင် ဖုန်းနံပါတ် ပြမည်</span>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-stone-200 p-3.5 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.showViberTgWeb}
                  onChange={(e) => setForm({ ...form, showViberTgWeb: e.target.checked })}
                  className="h-5 w-5 rounded accent-amber-800"
                />
                <span>Web တွင် Viber / Telegram ပြမည်</span>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-stone-200 p-3.5 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.showEmailFbWeb}
                  onChange={(e) => setForm({ ...form, showEmailFbWeb: e.target.checked })}
                  className="h-5 w-5 rounded accent-amber-800"
                />
                <span>Web တွင် Email / Facebook ပြမည်</span>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-stone-200 p-3.5 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={form.showWardWeb}
                  onChange={(e) => setForm({ ...form, showWardWeb: e.target.checked })}
                  className="h-5 w-5 rounded accent-amber-800"
                />
                <span>Web တွင် ရွာ / ရပ်ကွက် ပြမည်</span>
              </label>

              <label className="flex items-center gap-3 rounded-xl border border-stone-200 p-3.5 text-sm font-medium sm:col-span-2">
                <input
                  type="checkbox"
                  checked={form.showWardPrint}
                  onChange={(e) => setForm({ ...form, showWardPrint: e.target.checked })}
                  className="h-5 w-5 rounded accent-amber-800"
                />
                <span>Print စာအုပ်တွင် ရွာ / ရပ်ကွက် ထည့်မည် (မခြစ်ပါက မြို့အဆင့်သာ ပါမည်)</span>
              </label>
            </div>
          </section>

          {/* Part F */}
          <section className="space-y-4 rounded-2xl border border-stone-200 bg-stone-50 p-5">
            <div className="flex items-center gap-2 text-stone-900">
              <Lock className="h-5 w-5 text-amber-800" />
              <h2 className="text-lg font-bold">အပိုင်း (စ) — Admin သာ မြင်ရမည့် အချက်များ</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold text-stone-800">
                  မည်သူ့မှတစ်ဆင့် သိရှိခဲ့သနည်း
                </label>
                <input
                  type="text"
                  value={form.referrerName}
                  onChange={(e) => setForm({ ...form, referrerName: e.target.value })}
                  placeholder="အတည်ပြုရာတွင် အထောက်အကူပြုရန်"
                  className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-stone-800">
                  အတည်ပြုရန် ဖုန်းဆက်နိုင်သော အချိန်
                </label>
                <input
                  type="text"
                  value={form.bestContactTime}
                  onChange={(e) => setForm({ ...form, bestContactTime: e.target.value })}
                  placeholder="ဥပမာ - ညနေ ၆ နာရီ နောက်ပိုင်း"
                  className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-800">
                Admin ထံ သိစေလိုသော အကြံပေးချက် / Print တွင် မထည့်စေလိုသော အချက်
              </label>
              <textarea
                rows={2}
                value={form.adminNote}
                onChange={(e) => setForm({ ...form, adminNote: e.target.value })}
                className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm"
              />
            </div>
          </section>

          {/* Consents */}
          <section className="space-y-3 rounded-2xl border-2 border-amber-300 bg-amber-50/60 p-6">
            <h2 className="text-xl font-bold text-stone-900">သဘောတူညီချက် (Checkbox ၄ ခု)</h2>

            <label className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-xs">
              <input
                type="checkbox"
                required
                checked={form.consentPolicy}
                onChange={(e) => setForm({ ...form, consentPolicy: e.target.checked })}
                className="mt-1 h-5 w-5 shrink-0 rounded accent-amber-800"
              />
              <span className="text-sm leading-relaxed text-stone-800">
                <strong className="text-red-700">[မဖြစ်မနေ]</strong> ကိုယ်ရေးအချက်အလက် မူဝါဒများကို ဖတ်ပြီး နားလည်ပါသည်။ ကျွန်ုပ် ဖြည့်သော အချက်အလက်များသည် မှန်ကန်ပါသည်။
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-xs">
              <input
                type="checkbox"
                required
                checked={form.consentWebDirectory}
                onChange={(e) => setForm({ ...form, consentWebDirectory: e.target.checked })}
                className="mt-1 h-5 w-5 shrink-0 rounded accent-amber-800"
              />
              <span className="text-sm leading-relaxed text-stone-800">
                <strong className="text-red-700">[မဖြစ်မနေ]</strong> ကျွန်ုပ်၏ အမည်၊ ဘွဲ့၊ ဘွဲ့ရနှစ်၊ ကျောင်းဆောင်၊ လက်ရှိ မြို့နှင့် နိုင်ငံ၊ လက်ရှိ တာဝန်တို့ကို အတည်ပြုပြီးသော ကျောင်းသားဟောင်းများသာ ကြည့်နိုင်သော Web စာရင်းတွင် ပြရန် သဘောတူပါသည်။
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-xs">
              <input
                type="checkbox"
                checked={form.consentBookPublication}
                onChange={(e) => setForm({ ...form, consentBookPublication: e.target.checked })}
                className="mt-1 h-5 w-5 shrink-0 rounded accent-amber-800"
              />
              <span className="text-sm leading-relaxed text-stone-800">
                <strong className="text-amber-800">[ရွေးချယ်ခွင့်]</strong> ကျွန်ုပ်၏ အချက်အလက်များကို Print လိပ်စာစာအုပ်တွင် ထည့်သွင်း ထုတ်ဝေရန် သဘောတူပါသည်။
              </span>
            </label>

            <label className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-xs">
              <input
                type="checkbox"
                checked={form.consentBookPhone}
                onChange={(e) => setForm({ ...form, consentBookPhone: e.target.checked })}
                className="mt-1 h-5 w-5 shrink-0 rounded accent-amber-800"
              />
              <span className="text-sm leading-relaxed text-stone-800">
                <strong className="text-amber-800">[ရွေးချယ်ခွင့်]</strong> ကျွန်ုပ်၏ ဖုန်းနံပါတ်ကို Print လိပ်စာစာအုပ်တွင် ထည့်သွင်းရန် သဘောတူပါသည်။
              </span>
            </label>
          </section>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-800 px-8 py-4 text-lg font-bold text-white shadow-md hover:bg-amber-900 disabled:opacity-60"
          >
            <CheckCircle2 className="h-6 w-6" />
            <span>{loading ? "ပေးပို့နေပါသည်..." : "စာရင်းတင်သွင်းမည်"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

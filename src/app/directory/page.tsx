"use client";

import { useEffect, useState } from "react";
import { COUNTRIES, MYANMAR_REGIONS } from "@/lib/mimu-locations";
import { fetchDormitoryNames } from "@/lib/dormitories";
import { dedupeAddressParts } from "@/lib/myanmar-utils";
import { Lock, Mail, MapPin, Phone, Search, Send, UserCheck, AlertCircle } from "lucide-react";

interface AlumniItem {
  id: string;
  alumniCode: string;
  monkOrLay: string;
  fullName: string;
  formerName?: string | null;
  degreeName?: string | null;
  batchYearDisplay: string;
  dormitory: string;
  stayPeriod?: string | null;
  currentRoleOrMonastery: string;
  messageToAlumni?: string | null;
  countryCode: string;
  countryName: string;
  isDomestic: boolean;
  region?: string | null;
  township?: string | null;
  city: string;
  wardOrVillage?: string | null;
  phoneDisplay?: string | null;
  phoneRevealed: boolean;
  viber?: string | null;
  telegram?: string | null;
  email?: string | null;
  facebook?: string | null;
}

export default function DirectoryPage() {
  const [results, setResults] = useState<AlumniItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [batch, setBatch] = useState("");
  const [dormitory, setDormitory] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");

  const [requestTarget, setRequestTarget] = useState<AlumniItem | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestStatus, setRequestStatus] = useState("");

  // Dormitory filter options come from the database (admin-managed).
  // An empty list is fine — the filter then offers only "အားလုံး".
  const [dormitoryOptions, setDormitoryOptions] = useState<string[]>([]);
  useEffect(() => {
    fetchDormitoryNames().then(setDormitoryOptions);
  }, []);

  async function fetchDirectory() {
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (batch) params.set("batch", batch);
    if (dormitory) params.set("dormitory", dormitory);
    if (country) params.set("country", country);
    if (region) params.set("region", region);

    try {
      const res = await fetch(`/api/directory?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "ဝင်ရောက်ကြည့်ရှုခွင့် မရှိပါ။");
        setResults([]);
      } else {
        setResults(data.results || []);
      }
    } catch {
      setError("ချိတ်ဆက်မှု အမှားအယွင်း ဖြစ်ပွားပါသည်။");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDirectory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSendRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!requestTarget) return;
    setRequestStatus("");

    const res = await fetch("/api/contact-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        receiverAlumniId: requestTarget.id,
        message: requestMessage,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setRequestStatus(data.error || "ပေးပို့မှု မအောင်မြင်ပါ။");
    } else {
      setRequestStatus("ဆက်သွယ်ရန် တောင်းဆိုချက် ပေးပို့ပြီးပါပြီ။ ပိုင်ရှင် လက်ခံပါက ဖုန်း/ဆက်သွယ်ရန် ပေါ်လာပါမည်။");
      setRequestMessage("");
      setTimeout(() => {
        setRequestTarget(null);
        setRequestStatus("");
      }, 2000);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">ကျောင်းသားဟောင်းများ ရှာဖွေရန်</h1>
            <p className="mt-1 text-sm text-stone-600">
              အတည်ပြုပြီးသား ကျောင်းသားဟောင်းများသာ ကြည့်နိုင်သော စာရင်း (တစ်ကြိမ်လျှင် အများဆုံး ၂၀ ဦးသာ ပြသပါမည်)
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
            <UserCheck className="h-4 w-4" />
            <span>Verified Members Only</span>
          </div>
        </div>

        {/* Search Filters */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            fetchDirectory();
          }}
          className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
        >
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="အမည် / ဘွဲ့ / ID (ND-...)"
            className="rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm lg:col-span-2"
          />
          <input
            type="text"
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            placeholder="ခုနှစ် (ဥပမာ ၁၃၆၈)"
            className="rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm"
          />
          <select
            value={dormitory}
            onChange={(e) => setDormitory(e.target.value)}
            className="rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm"
          >
            <option value="">ကျောင်းဆောင်အားလုံး</option>
            {dormitoryOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm"
          >
            <option value="">နိုင်ငံအားလုံး</option>
            {COUNTRIES.filter((c) => c.code !== "OTHER").map((c) => (
              <option key={c.code} value={c.code}>
                {c.nameMm}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-900"
          >
            <Search className="h-4 w-4" />
            <span>ရှာမည်</span>
          </button>
        </form>

        {country === "MM" && (
          <div className="mt-3 flex items-center gap-2">
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">တိုင်းဒေသကြီး / ပြည်နယ်အားလုံး</option>
              {Object.keys(MYANMAR_REGIONS).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-6 text-amber-900">
          <AlertCircle className="mt-0.5 h-6 w-6 shrink-0" />
          <div>
            <p className="font-bold">{error}</p>
            <p className="mt-1 text-sm">
              သင့်အကောင့်ကို Admin မှ စစ်ဆေးအတည်ပြုပြီးမှသာ Directory ကို ဝင်ရောက်ကြည့်ရှုနိုင်ပါမည်။
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="mt-10 text-center text-stone-500">ရှာဖွေနေပါသည်...</div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {results.map((item) => (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white p-6 shadow-xs"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-block rounded-md bg-stone-100 px-2 py-0.5 text-xs font-mono font-semibold text-stone-600">
                      {item.alumniCode}
                    </span>
                    <h2 className="mt-1 text-lg font-bold text-stone-900">{item.fullName}</h2>
                    {item.formerName && (
                      <p className="text-xs text-stone-500">ယခင်အမည်: {item.formerName}</p>
                    )}
                    {item.degreeName && (
                      <p className="text-sm font-medium text-amber-900">{item.degreeName}</p>
                    )}
                  </div>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                    {item.batchYearDisplay}
                  </span>
                </div>

                <div className="mt-4 space-y-1.5 text-sm text-stone-700">
                  <p>
                    <strong>ကျောင်းဆောင်:</strong> {item.dormitory}
                    {item.stayPeriod ? ` (${item.stayPeriod})` : ""}
                  </p>
                  <p>
                    <strong>လက်ရှိတာဝန်:</strong> {item.currentRoleOrMonastery}
                  </p>
                  <p className="flex items-start gap-1.5">
                    <MapPin className="mt-1 h-4 w-4 shrink-0 text-stone-500" />
                    <span>
                      {dedupeAddressParts([
                        item.countryName,
                        item.region,
                        item.township,
                        item.city,
                        item.wardOrVillage,
                      ]).join(" · ")}
                    </span>
                  </p>

                  {item.phoneDisplay && (
                    <p className="flex items-center gap-1.5">
                      <Phone className="h-4 w-4 shrink-0 text-stone-500" />
                      <span>{item.phoneDisplay}</span>
                      {!item.phoneRevealed && (
                        <span className="inline-flex items-center gap-1 rounded bg-stone-100 px-2 py-0.5 text-xs text-stone-500">
                          <Lock className="h-3 w-3" /> ဖုံးကွယ်ထားသည်
                        </span>
                      )}
                    </p>
                  )}

                  {(item.viber || item.telegram) && (
                    <p className="text-xs text-stone-600">
                      {item.viber ? `Viber: ${item.viber}` : ""}{" "}
                      {item.telegram ? `Telegram: ${item.telegram}` : ""}
                    </p>
                  )}

                  {item.email && (
                    <p className="flex items-center gap-1.5 text-xs text-stone-600">
                      <Mail className="h-3.5 w-3.5" />
                      <span>{item.email}</span>
                    </p>
                  )}

                  {item.messageToAlumni && (
                    <p className="mt-2 rounded-xl bg-stone-50 p-3 text-xs italic text-stone-600">
                      “{item.messageToAlumni}”
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-5 border-t border-stone-100 pt-4">
                <button
                  onClick={() => setRequestTarget(item)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-700 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-50"
                >
                  <Send className="h-4 w-4" />
                  <span>ဆက်သွယ်ရန် တောင်းဆိုမည်</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && results.length === 0 && (
        <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-8 text-center text-stone-500">
          ရှာဖွေမှုနှင့် ကိုက်ညီသော ကျောင်းသားဟောင်း မတွေ့ရှိပါ။
        </div>
      )}

      {/* Contact Request Modal */}
      {requestTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-stone-900">
              {requestTarget.fullName} ထံ ဆက်သွယ်ရန် တောင်းဆိုခြင်း
            </h3>
            <p className="mt-1 text-xs text-stone-600">
              ပိုင်ရှင်က လက်ခံမှသာ ဖုန်းနံပါတ်နှင့် ဆက်သွယ်ရန် အချက်အလက်များကို မျှဝေပေးပါမည်။
            </p>
            {requestStatus && (
              <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                {requestStatus}
              </div>
            )}
            <form onSubmit={handleSendRequest} className="mt-4 space-y-4">
              <textarea
                rows={3}
                required
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="မိမိအမည်၊ ကျောင်းဆောင်နှင့် ဆက်သွယ်လိုသည့် အကြောင်းအရာကို ရေးပါ..."
                className="w-full rounded-xl border border-stone-300 p-3 text-sm"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRequestTarget(null)}
                  className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-medium"
                >
                  ပိတ်မည်
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-amber-800 px-4 py-2 text-sm font-bold text-white hover:bg-amber-900"
                >
                  တောင်းဆိုချက် ပို့မည်
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";

type CheckStatus =
  | "VERIFIED"
  | "PENDING"
  | "NEEDS_CORRECTION"
  | "NOT_FOUND";

// "Am I already in the directory?" — phone-number check on the home page.
// Shows only whether the number is listed, never any personal details.
export default function MembershipCheck() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState<CheckStatus | null>(null);
  const [degree, setDegree] = useState<string | null>(null);

  async function handleCheck(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setStatus(null);
    setDegree(null);
    setLoading(true);
    try {
      const res = await fetch("/api/check-membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "စစ်ဆေးရာတွင် အမှားအယွင်း ဖြစ်ပွားပါသည်။");
        return;
      }
      setStatus(data.status as CheckStatus);
      setDegree(typeof data.degree === "string" ? data.degree : null);
    } catch {
      setError("ချိတ်ဆက်မှု အမှားအယွင်း ဖြစ်ပွားပါသည်။");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-amber-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-lg font-bold text-stone-900">
        ကိုယ့်အချက်အလက် စာရင်းထဲပါပြီးလား စစ်ဆေးရန်
      </h2>
      <p className="mt-1 text-sm text-stone-600">
        ကိုယ့်ဖုန်းနံပါတ် ရိုက်ထည့်ပြီး စစ်ဆေးနိုင်ပါသည်။ ပါဝင်ပါက ဘွဲ့ကိုပါ ပြပေးပါမည်။
      </p>

      <form onSubmit={handleCheck} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="ဥပမာ - 09xxxxxxxxx"
          className="flex-1 rounded-xl border border-stone-300 px-4 py-3 text-base"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-amber-800 px-6 py-3 text-base font-bold text-white hover:bg-amber-900 disabled:opacity-60"
        >
          {loading ? "စစ်ဆေးနေပါသည်..." : "စစ်ဆေးမည်"}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
          {error}
        </p>
      )}

      {status === "VERIFIED" && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-bold">သင့်အချက်အလက် စာရင်းထဲမှာ ပါဝင်ပါသည်။</p>
          {degree && (
            <p className="mt-1">
              ဘွဲ့ — <strong>{degree}</strong>
            </p>
          )}
          <p className="mt-1">
            <Link href="/login" className="font-bold underline">
              Login ဝင်ပြီး
            </Link>{" "}
            ကိုယ့်အချက်အလက်ကို ကြည့်ရှု/ပြင်ဆင်နိုင်ပါသည်။
          </p>
        </div>
      )}

      {status === "PENDING" && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-bold">စာရင်းတင်ပြီးပါပြီ — Admin အတည်ပြုရန် စောင့်ဆိုင်းနေပါသည်။</p>
          {degree && (
            <p className="mt-1">
              ဘွဲ့ — <strong>{degree}</strong>
            </p>
          )}
          <p className="mt-1">
            အတည်ပြုပြီးပါက{" "}
            <Link href="/login" className="font-bold underline">
              Login ဝင်ပြီး
            </Link>{" "}
            ကြည့်ရှုနိုင်ပါသည်။ ကြာနေပါက Admin ကို Telegram{" "}
            <a
              href="https://t.me/upanna"
              target="_blank"
              rel="noreferrer"
              className="font-bold underline"
            >
              @upanna
            </a>{" "}
            မှာ ဆက်သွယ်နိုင်ပါသည်။
          </p>
        </div>
      )}

      {status === "NEEDS_CORRECTION" && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-bold">စာရင်းထဲမှာ ပါဝင်သော်လည်း ပြင်ဆင်ရန် လိုအပ်နေပါသည်။</p>
          {degree && (
            <p className="mt-1">
              ဘွဲ့ — <strong>{degree}</strong>
            </p>
          )}
          <p className="mt-1">
            <Link href="/login" className="font-bold underline">
              Login ဝင်ပြီး
            </Link>{" "}
            စစ်ဆေးပေးပါ။
          </p>
        </div>
      )}

      {status === "NOT_FOUND" && (
        <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-800">
          <p className="font-bold">သင့်အချက်အလက် စာရင်းထဲမှာ မပါဝင်သေးပါ။</p>
          <p className="mt-1">
            <Link href="/register" className="font-bold text-amber-800 underline">
              ဤနေရာတွင် စာရင်းသွင်းနိုင်ပါသည်။
            </Link>
          </p>
        </div>
      )}
    </section>
  );
}

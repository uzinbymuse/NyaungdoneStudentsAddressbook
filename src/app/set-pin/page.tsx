"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut } from "lucide-react";

export default function SetPinPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 6) {
      setError("PIN အသစ်သည် အနည်းဆုံး စာလုံး ၆ လုံး ရှိရပါမည်။");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("PIN အသစ် နှစ်ခု မတူပါ။");
      return;
    }
    if (newPassword === currentPassword) {
      setError("PIN အသစ်သည် ယာယီ PIN နှင့် မတူရပါမည်။");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "PIN ပြောင်းလဲမှု မအောင်မြင်ပါ။");
        setLoading(false);
        return;
      }
      router.push("/profile");
      router.refresh();
    } catch {
      setError("ချိတ်ဆက်မှု အမှားအယွင်း ဖြစ်ပွားပါသည်။");
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-3xl border border-amber-200 bg-white p-8 shadow-sm">
        <img
          src="/logo.png"
          alt="ပါဠိတက္ကသိုလ် ညောင်တုန်း လိုဂို"
          className="mx-auto h-24 w-auto object-contain"
        />
        <div className="mt-4 flex items-center gap-2 text-amber-800">
          <KeyRound className="h-6 w-6" />
          <span className="text-sm font-semibold">PIN အသစ် သတ်မှတ်ရန်</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-stone-900">
          ကိုယ့် PIN ကိုယ် ပြောင်းပါ
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Admin ပေးထားတဲ့ ယာယီ PIN နဲ့ ဝင်ထားပါတယ်။ ကိုယ်ပိုင် PIN အသစ်
          ပြောင်းပြီးမှ တခြားစာမျက်နှာတွေ သုံးလို့ရပါမယ်။ PIN အသစ်ကို
          ဘယ်သူ့ကိုမှ မပြောပါနဲ့။
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label className="block text-base font-semibold text-stone-800">
              ယာယီ PIN (လက်ရှိ)
            </label>
            <input
              type="password"
              required
              inputMode="numeric"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-3 text-base text-stone-900 focus:border-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>
          <div>
            <label className="block text-base font-semibold text-stone-800">
              PIN အသစ် (အနည်းဆုံး ၆ လုံး)
            </label>
            <input
              type="password"
              required
              inputMode="numeric"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-3 text-base text-stone-900 focus:border-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>
          <div>
            <label className="block text-base font-semibold text-stone-800">
              PIN အသစ် (ထပ်ရိုက်ပါ)
            </label>
            <input
              type="password"
              required
              inputMode="numeric"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-3 text-base text-stone-900 focus:border-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-stone-900 px-4 py-3 text-base font-bold text-white hover:bg-stone-800 disabled:opacity-50"
          >
            {loading ? "ပြောင်းလဲနေပါသည်…" : "PIN အသစ် သတ်မှတ်မည်"}
          </button>
        </form>

        <button
          onClick={handleLogout}
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-800"
        >
          <LogOut className="h-4 w-4" /> ထွက်မည်
        </button>
        <p className="mt-4 text-xs text-stone-500">
          PIN မေ့သွားရင် Admin ထံ ဆက်သွယ်ပါ —{" "}
          <Link href="https://t.me/upanna" className="text-amber-800 underline">
            Telegram @upanna
          </Link>
        </p>
      </div>
    </div>
  );
}

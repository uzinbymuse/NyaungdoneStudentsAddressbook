"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login မအောင်မြင်ပါ။");
        setLoading(false);
        return;
      }

      if (data.role === "ADMIN") {
        router.push("/admin");
      } else if (data.mustChangePin) {
        router.push("/set-pin");
      } else if (data.profileStatus === "VERIFIED") {
        router.push("/directory");
      } else {
        router.push("/profile");
      }
      router.refresh();
    } catch {
      setError("ချိတ်ဆက်မှု အမှားအယွင်း ဖြစ်ပွားပါသည်။");
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm">
        <img
          src="/logo.png"
          alt="ပါဠိတက္ကသိုလ် ညောင်တုန်း လိုဂို"
          className="mx-auto h-24 w-auto object-contain"
        />
        <div className="mt-4 flex items-center gap-2 text-amber-800">
          <ShieldCheck className="h-6 w-6" />
          <span className="text-sm font-semibold">Members-Only Access</span>
        </div>

        <h1 className="mt-2 text-2xl font-bold text-stone-900">အကောင့်သို့ ဝင်ရောက်ရန်</h1>
        <p className="mt-1 text-sm text-stone-600">
          စာရင်းသွင်းစဉ်က အသုံးပြုခဲ့သော ဖုန်းနံပါတ် (သို့မဟုတ် အီးမေးလ်) နှင့် စကားဝှက်ကို ထည့်ပါ။
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label className="block text-base font-semibold text-stone-800">
              ဖုန်းနံပါတ် (သို့မဟုတ်) အီးမေးလ်
            </label>
            <input
              type="text"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="ဥပမာ - 09791234567"
              className="latin-nums mt-1.5 w-full rounded-xl border border-stone-300 px-4 py-3 text-base text-stone-900 focus:border-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
            />
          </div>

          <div>
            <label className="block text-base font-semibold text-stone-800">စကားဝှက် (Password / PIN)</label>
            <div className="relative mt-1.5">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="စကားဝှက် ထည့်ပါ"
                className="latin-nums w-full rounded-xl border border-stone-300 px-4 py-3 pr-12 text-base text-stone-900 focus:border-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"
                aria-label="Toggle password visibility"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-800 px-6 py-3.5 text-base font-bold text-white hover:bg-amber-900 disabled:opacity-60"
          >
            <LogIn className="h-5 w-5" />
            <span>{loading ? "ဝင်ရောက်နေပါသည်..." : "Login ဝင်မည်"}</span>
          </button>
        </form>

        <div className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">စကားဝှက် မေ့သွားပါသလား?</p>
          <p className="mt-1 text-xs leading-relaxed">
            လူကြီးမင်းများအတွက် စကားဝှက်မေ့သွားပါက Admin ထံ ဆက်သွယ်၍{" "}
            <strong>တစ်ချက်နှိပ် Login Link (Magic Link)</strong> တောင်းယူနိုင်ပါသည်။
            <br />
            Telegram:{" "}
            <a
              href="https://t.me/upanna"
              target="_blank"
              rel="noreferrer"
              className="font-bold text-amber-800 underline"
            >
              @upanna
            </a>
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-stone-600">
          စာရင်းမသွင်းရသေးပါက{" "}
          <Link href="/register" className="font-bold text-amber-800 underline">
            ဤနေရာတွင် စာရင်းသွင်းပါ
          </Link>
        </p>
      </div>
    </div>
  );
}

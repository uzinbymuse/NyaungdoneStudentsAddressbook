import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BookOpen, Search, Shield, Users } from "lucide-react";
import MembershipCheck from "@/components/MembershipCheck";

export const instant = false;

export default async function HomePage() {
  let verified = 0;
  let domestic = 0;
  let international = 0;

  try {
    const groups = await prisma.alumniProfile.groupBy({
      by: ["isDomestic"],
      where: { profileStatus: "VERIFIED" },
      _count: { _all: true },
    });
    for (const g of groups) {
      if (g.isDomestic) domestic = g._count._all;
      else international = g._count._all;
    }
    verified = domestic + international;
  } catch {
    // Fallback if DB is not reachable during static check
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Hero Section */}
      <section className="rounded-3xl border border-amber-200 bg-white p-8 shadow-sm sm:p-12">
        <img
          src="/logo.png"
          alt="ပါဠိတက္ကသိုလ် ညောင်တုန်းကျောင်းတိုက် လိုဂို"
          className="h-28 w-auto object-contain"
        />
        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-1.5 text-sm font-semibold text-amber-900">
          <Shield className="h-4 w-4" />
          <span>ဗဟန်း-ညောင်တုန်းနွယ်ဖွားများအတွက်သာ</span>
        </div>

        <h1 className="mt-5 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
          ပါဠိတက္ကသိုလ် ညောင်တုန်းကျောင်းတိုက်
          <span className="mt-1 block text-amber-800">
            ဗဟန်း-ညောင်တုန်းနွယ်ဖွား မှတ်တမ်းနှင့် လိပ်စာစာအုပ်
          </span>
        </h1>

        <p className="mt-4 max-w-3xl text-lg text-stone-700">
          ပညာသင်ကြားခဲ့ဖူးသော ဗဟန်း-ညောင်တုန်းနွယ်ဖွား (ရဟန်း/လူ) များ အချင်းချင်း ပြန်လည်ရှာဖွေဆက်သွယ်နိုင်ရန်နှင့်
          မည်သူမျှ မကျန်ရစ်သော ပြည်တွင်း/ပြည်ပ လိပ်စာစာအုပ် ထုတ်ဝေနိုင်ရန် ရည်ရွယ်၍ စနစ်တကျ စုဆောင်းထားပါသည်။
        </p>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/register"
            className="inline-flex items-center justify-center rounded-xl bg-amber-800 px-6 py-4 text-base font-bold text-white shadow-sm hover:bg-amber-900"
          >
            စာရင်းအသစ် ဖြည့်သွင်းရန်
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-xl border-2 border-stone-300 bg-white px-6 py-4 text-base font-bold text-stone-800 hover:bg-stone-50"
          >
            Login ဝင်၍ စစ်ဆေး/ရှာဖွေရန်
          </Link>
        </div>
      </section>

      {/* Aggregate Counts (No personal info exposed publicly) */}
      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm">
          <Users className="mx-auto h-7 w-7 text-amber-800" />
          <div className="mt-2 text-3xl font-bold text-stone-900">{verified}</div>
          <div className="mt-1 text-sm font-medium text-stone-600">အတည်ပြုပြီး ဗဟန်း-ညောင်တုန်းနွယ်ဖွား</div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm">
          <BookOpen className="mx-auto h-7 w-7 text-emerald-700" />
          <div className="mt-2 text-3xl font-bold text-stone-900">{domestic}</div>
          <div className="mt-1 text-sm font-medium text-stone-600">ပြည်တွင်း နေထိုင်သူများ</div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm">
          <Search className="mx-auto h-7 w-7 text-sky-700" />
          <div className="mt-2 text-3xl font-bold text-stone-900">{international}</div>
          <div className="mt-1 text-sm font-medium text-stone-600">ပြည်ပ နေထိုင်သူများ</div>
        </div>
      </section>

      <MembershipCheck />

      {/* Trust & Privacy Guarantees */}
      <p className="mt-8 text-center text-sm leading-relaxed text-stone-600">
        ဤစာရင်းသည် ပါဠိတက္ကသိုလ် ညောင်တုန်းကျောင်းတိုက် ဗဟန်း-ညောင်တုန်းနွယ်ဖွားအတွက်သာ ဖြစ်ပါသည်။ အတည်ပြုပြီးသော
        ဗဟန်း-ညောင်တုန်းနွယ်ဖွားသာ Login ဝင်၍ ကြည့်ရှုနိုင်ပါသည်။
      </p>

      <p className="mt-8 text-center text-sm text-stone-600">
        Admin ကို ဆက်သွယ်ရန် — Telegram:{" "}
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
  );
}

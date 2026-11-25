import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { decryptField } from "@/lib/crypto";
import { dedupeAddressParts } from "@/lib/myanmar-utils";
import { PrintTriggerButton } from "@/components/PrintTriggerButton";

export const instant = false;

export default async function AdminPrintBookPage() {
  const admin = await requireAdmin();
  if (!admin) {
    redirect("/login");
  }

  const verified = await prisma.alumniProfile.findMany({
    where: { profileStatus: "VERIFIED" },
    include: { consents: true },
    orderBy: [
      { isDomestic: "desc" },
      { region: "asc" },
      { countryName: "asc" },
      { batchYearMm: "asc" },
      { fullName: "asc" },
    ],
  });

  const eligible = verified.filter(
    (p) => p.consents.find((c) => c.consentType === "BOOK_PUBLICATION")?.granted === true
  );
  const domestic = eligible.filter((e) => e.isDomestic);
  const international = eligible.filter((e) => !e.isDomestic);

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-stone-900">
      <div className="no-print mb-6 flex items-center justify-between border-b border-stone-200 pb-4">
        <div>
          <h1 className="text-xl font-bold">Print-Ready Alumni Directory Preview</h1>
          <p className="text-xs text-stone-500">
            Browser မှ Print (Save as PDF) နှိပ်၍ စာအုပ်ပုံစံ PDF ထုတ်ယူနိုင်ပါသည်။
          </p>
        </div>
        <PrintTriggerButton />
      </div>

      {/* Book Cover / Header */}
      <div className="border-b-2 border-stone-800 pb-6 text-center">
        <img
          src="/logo.png"
          alt="ပါဠိတက္ကသိုလ် ညောင်တုန်း လိုဂို"
          className="mx-auto h-32 w-auto object-contain"
        />
        <h1 className="mt-3 text-2xl font-bold">ပါဠိတက္ကသိုလ် ညောင်တုန်း</h1>
        <h2 className="mt-1 text-xl font-semibold">ဗဟန်း-ညောင်တုန်းနွယ်ဖွား လိပ်စာစာအုပ်</h2>
        <p className="mt-2 text-sm text-stone-600">
          (ဗဟန်း-ညောင်တုန်းနွယ်ဖွားအတွက်သာ — ခွင့်ပြုချက်ရရှိသူ {eligible.length} ဦး)
        </p>
      </div>

      {/* Part 1: Domestic */}
      <section className="mt-8">
        <h2 className="border-b border-stone-400 pb-2 text-lg font-bold">
          အပိုင်း (၁) — ပြည်တွင်းနေ ဗဟန်း-ညောင်တုန်းနွယ်ဖွား ({domestic.length} ဦး)
        </h2>
        <div className="mt-4 space-y-4">
          {domestic.map((p) => (
            <div key={p.id} className="break-inside-avoid border-b border-stone-200 pb-3 text-sm">
              <div className="font-bold">
                [{p.alumniCode}] {p.fullName}
                {p.degreeName ? ` (${p.degreeName})` : ""} — {p.batchYearDisplay}
              </div>
              <div className="text-stone-700">
                {p.dormitory}
                {p.currentMonastery ? ` · ${p.currentMonastery}` : ""} ·{" "}
                {p.currentRoleOrMonastery}
              </div>
              <div className="text-stone-700">
                {dedupeAddressParts([
                  p.region,
                  p.township,
                  p.city,
                  p.showWardPrint ? p.wardOrVillage : null,
                ]).join("၊ ")}
              </div>
              {p.showPhonePrint && (
                <div className="text-stone-700">
                  ဖုန်း: <span className="latin-nums">{decryptField(p.phonePrimaryEnc)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Part 2: International */}
      <section className="mt-10 break-before-page">
        <h2 className="border-b border-stone-400 pb-2 text-lg font-bold">
          အပိုင်း (၂) — ပြည်ပရောက် ဗဟန်း-ညောင်တုန်းနွယ်ဖွား ({international.length} ဦး)
        </h2>
        <div className="mt-4 space-y-4">
          {international.map((p) => (
            <div key={p.id} className="break-inside-avoid border-b border-stone-200 pb-3 text-sm">
              <div className="font-bold">
                [{p.alumniCode}] {p.fullName}
                {p.degreeName ? ` (${p.degreeName})` : ""} — {p.batchYearDisplay}
              </div>
              <div className="text-stone-700">
                {p.dormitory}
                {p.currentMonastery ? ` · ${p.currentMonastery}` : ""} ·{" "}
                {p.currentRoleOrMonastery}
              </div>
              <div className="text-stone-700">
                {dedupeAddressParts([
                  p.countryName,
                  p.region,
                  p.city,
                  p.showWardPrint ? p.wardOrVillage : null,
                ]).join("၊ ")}
              </div>
              {p.showPhonePrint && (
                <div className="text-stone-700">
                  ဖုန်း: <span className="latin-nums">{decryptField(p.phonePrimaryEnc)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

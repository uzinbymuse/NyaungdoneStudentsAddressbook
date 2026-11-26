import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireVerifiedMember } from "@/lib/auth";
import { decryptField } from "@/lib/crypto";
import {
  buildSearchNameKey,
  maskPhone,
  normalizeMyanmarText,
  toWesternDigits,
} from "@/lib/myanmar-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { getHiddenContactIds } from "@/lib/hidden-contacts";

export async function GET(req: NextRequest) {
  const session = await requireVerifiedMember();
  if (!session) {
    return NextResponse.json(
      { error: "အတည်ပြုပြီးသော ဗဟန်း-ညောင်တုန်းနွယ်ဖွားသာ ဝင်ရောက်ကြည့်ရှုနိုင်ပါသည်။" },
      { status: 403 }
    );
  }

  const rl = checkRateLimit(`dir:${session.userId}`, 30, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `ရှာဖွေမှု အကြိမ်ရေ များနေပါသည်။ ${rl.retryAfterSeconds} စက္ကန့်အကြာမှ ထပ်မံရှာဖွေပါ။` },
      { status: 429 }
    );
  }

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() || "";
  const batchRaw = sp.get("batch")?.trim() || "";
  const dormitory = sp.get("dormitory")?.trim() || "";
  const countryCode = sp.get("country")?.trim() || "";
  const region = sp.get("region")?.trim() || "";

  const normalizedQ = q ? buildSearchNameKey(q) : "";
  const batchDigits = batchRaw ? toWesternDigits(batchRaw).match(/\d{4}/) : null;
  const batchYearMm = batchDigits ? parseInt(batchDigits[0], 10) : null;

  // Web contacts are visible to every logged-in verified member — no
  // more contact requests. Only profiles the admin hid (hideContactsWeb)
  // stay masked/hidden. `omit` keeps this query working before `npx
  // prisma db push` adds the new column; the helper returns an empty
  // set in that window.
  const hiddenIds = await getHiddenContactIds();

  const records = await prisma.alumniProfile.findMany({
    where: {
      profileStatus: "VERIFIED",
      ...(batchYearMm ? { batchYearMm } : {}),
      ...(dormitory ? { dormitory: { contains: normalizeMyanmarText(dormitory), mode: "insensitive" } } : {}),
      ...(countryCode ? { countryCode } : {}),
      ...(region ? { region: { contains: normalizeMyanmarText(region), mode: "insensitive" } } : {}),
      ...(q
        ? {
            OR: [
              { normalizedName: { contains: normalizedQ, mode: "insensitive" } },
              { fullName: { contains: normalizeMyanmarText(q), mode: "insensitive" } },
              { formerName: { contains: normalizeMyanmarText(q), mode: "insensitive" } },
              { degreeName: { contains: normalizeMyanmarText(q), mode: "insensitive" } },
              { alumniCode: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    take: 20, // Anti-scraping: max 20 results per query
    orderBy: [{ batchYearMm: "asc" }, { fullName: "asc" }],
    omit: { hideContactsWeb: true },
  });

  const results = records.map((r) => {
    const hidden = hiddenIds.has(r.id);
    const rawPhone = decryptField(r.phonePrimaryEnc);

    return {
      id: r.id,
      alumniCode: r.alumniCode,
      monkOrLay: r.monkOrLay,
      fullName: r.fullName,
      formerName: r.formerName,
      birthplace: r.birthplace,
      degreeName: r.degreeName,
      batchYearDisplay: r.batchYearDisplay,
      dormitory: r.dormitory,
      stayPeriod: r.stayPeriod,
      currentRoleOrMonastery: r.currentRoleOrMonastery,
      currentMonastery: r.currentMonastery,
      messageToAlumni: r.messageToAlumni,
      photoUrl: r.photoUrl,
      countryCode: r.countryCode,
      countryName: r.countryName,
      isDomestic: r.isDomestic,
      region: r.region,
      township: r.township,
      city: r.city,
      wardOrVillage: r.showWardWeb ? r.wardOrVillage : null,
      phoneDisplay: hidden ? (rawPhone ? maskPhone(rawPhone) : null) : rawPhone,
      viber: hidden ? null : decryptField(r.viberEnc),
      telegram: hidden ? null : decryptField(r.telegramEnc),
      email: hidden ? null : decryptField(r.emailEnc),
      facebook: hidden ? null : decryptField(r.facebookEnc),
      lastConfirmedAt: r.lastConfirmedAt,
    };
  });

  return NextResponse.json({ results, maxLimit: 20 });
}

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

export async function GET(req: NextRequest) {
  const session = await requireVerifiedMember();
  if (!session) {
    return NextResponse.json(
      { error: "အတည်ပြုပြီးသော ကျောင်းသားဟောင်းများသာ ဝင်ရောက်ကြည့်ရှုနိုင်ပါသည်။" },
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
    include: {
      receivedContactReqs: {
        where: { senderId: session.userId, status: "ACCEPTED" },
        select: { id: true },
      },
    },
  });

  const results = records.map((r) => {
    const hasAcceptedContact = r.receivedContactReqs.length > 0;
    const rawPhone = decryptField(r.phonePrimaryEnc);
    const canSeePhone = r.showPhoneWeb || hasAcceptedContact;

    return {
      id: r.id,
      alumniCode: r.alumniCode,
      monkOrLay: r.monkOrLay,
      fullName: r.fullName,
      formerName: r.formerName,
      degreeName: r.degreeName,
      batchYearDisplay: r.batchYearDisplay,
      dormitory: r.dormitory,
      stayPeriod: r.stayPeriod,
      currentRoleOrMonastery: r.currentRoleOrMonastery,
      messageToAlumni: r.messageToAlumni,
      photoUrl: r.photoUrl,
      countryCode: r.countryCode,
      countryName: r.countryName,
      isDomestic: r.isDomestic,
      region: r.region,
      township: r.township,
      city: r.city,
      wardOrVillage: r.showWardWeb ? r.wardOrVillage : null,
      phoneDisplay: canSeePhone ? rawPhone : rawPhone ? maskPhone(rawPhone) : null,
      phoneRevealed: canSeePhone,
      viber: r.showViberTgWeb || hasAcceptedContact ? decryptField(r.viberEnc) : null,
      telegram: r.showViberTgWeb || hasAcceptedContact ? decryptField(r.telegramEnc) : null,
      email: r.showEmailFbWeb || hasAcceptedContact ? decryptField(r.emailEnc) : null,
      facebook: r.showEmailFbWeb || hasAcceptedContact ? decryptField(r.facebookEnc) : null,
      lastConfirmedAt: r.lastConfirmedAt,
    };
  });

  return NextResponse.json({ results, maxLimit: 20 });
}

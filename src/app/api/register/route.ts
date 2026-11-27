import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { encryptField, hmacLookup } from "@/lib/crypto";
import {
  buildSearchNameKey,
  normalizeMyanmarText,
  normalizePhoneForHash,
  toWesternDigits,
} from "@/lib/myanmar-utils";
import { COUNTRIES } from "@/lib/mimu-locations";
import { generateNextAlumniCode } from "@/lib/alumni-code";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = checkRateLimit(`register:${ip}`, 5, 10 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "စာရင်းသွင်းမှု များနေပါသည်။ ခေတ္တစောင့်ပြီးမှ ပြန်ကြိုးစားပါ။" },
        { status: 429 }
      );
    }

    const body = await req.json();

    // No consent checkboxes on the form anymore (admin decision
    // 2026-11-25): submitting the form itself implies agreement to the
    // members-only web directory and to the print book.

    const fullName = normalizeMyanmarText(String(body.fullName || ""));
    const birthplace = normalizeMyanmarText(String(body.birthplace || ""));
    const degreeName = normalizeMyanmarText(String(body.degreeName || ""));
    const batchYearDisplayRaw = normalizeMyanmarText(String(body.batchYearDisplay || ""));
    const batchYearDisplay = batchYearDisplayRaw || "မသတ်မှတ်";
    const dormitoryRaw = normalizeMyanmarText(String(body.dormitory || ""));
    const dormitory = dormitoryRaw && dormitoryRaw !== "အခြား" ? dormitoryRaw : "မသတ်မှတ်";
    const currentMonastery = normalizeMyanmarText(String(body.currentMonastery || ""));
    const currentRoleOrMonastery =
      normalizeMyanmarText(String(body.currentRoleOrMonastery || "")) || currentMonastery;
    const phonePrimary = toWesternDigits(String(body.phonePrimary || "")).trim();
    const city = normalizeMyanmarText(String(body.city || ""));
    const password = String(body.password || "");
    const isDomestic = String(body.countryCode || "MM").trim() === "MM";
    // Domestic users pick a township (မြို့နယ်) and no longer enter a
    // separate city (မြို့) — the township is stored as the city.
    // Foreign users have no township: the form's domestic township
    // dropdown is hidden for them, so any township value in the request
    // is a stale default (e.g. ကမာရွတ်) and must not be stored.
    const township =
      isDomestic && body.township ? normalizeMyanmarText(String(body.township)) : null;

    if (
      !fullName ||
      !birthplace ||
      !currentMonastery ||
      !phonePrimary ||
      !((isDomestic && township) || (!isDomestic && city)) ||
      password.length < 6
    ) {
      return NextResponse.json(
        { error: "မဖြစ်မနေ ဖြည့်သွင်းရမည့် အချက်အလက်များနှင့် စကားဝှက် (အနည်းဆုံး ၆ လုံး) ကို ပြည့်စုံစွာ ဖြည့်ပါ။" },
        { status: 400 }
      );
    }

    const countryCode = String(body.countryCode || "MM").trim();
    const countryObj = COUNTRIES.find((c) => c.code === countryCode);
    const countryName =
      countryCode === "OTHER"
        ? normalizeMyanmarText(String(body.countryOther || "အခြား"))
        : countryObj?.nameMm || "မြန်မာ";

    const region = body.region ? normalizeMyanmarText(String(body.region)) : null;
    const wardOrVillage = body.wardOrVillage
      ? normalizeMyanmarText(String(body.wardOrVillage))
      : null;

    if (isDomestic && !region) {
      return NextResponse.json(
        { error: "ပြည်တွင်းနေထိုင်သူအတွက် တိုင်းဒေသကြီး / ပြည်နယ်ကို ရွေးချယ်ပါ။" },
        { status: 400 }
      );
    }

    const phoneNorm = normalizePhoneForHash(phonePrimary);
    const phoneLookupHash = hmacLookup(phoneNorm);

    // Check if login phone already exists
    const existingUser = await prisma.user.findUnique({
      where: { loginPhoneHash: phoneLookupHash },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: "ဤဖုန်းနံပါတ်ဖြင့် စာရင်းသွင်းပြီးသား ဖြစ်နေပါသည်။ Login ဝင်၍ စစ်ဆေးပါ။" },
        { status: 409 }
      );
    }

    const emailRaw = toWesternDigits(String(body.email || "")).trim().toLowerCase();
    if (emailRaw) {
      const existingEmail = await prisma.user.findUnique({
        where: { loginEmail: emailRaw },
      });
      if (existingEmail) {
        return NextResponse.json(
          { error: "ဤအီးမေးလ်ဖြင့် စာရင်းသွင်းပြီးသား ဖြစ်နေပါသည်။ Login ဝင်၍ စစ်ဆေးပါ။" },
          { status: 409 }
        );
      }
    }

    const batchDigits = toWesternDigits(batchYearDisplay).match(/\d{4}/);
    const batchYearMm = batchDigits ? parseInt(batchDigits[0], 10) : null;

    const passwordHash = await hashPassword(password);

    const monkOrLay = ["MONK", "LAY", "NUN", "OTHER"].includes(body.monkOrLay)
      ? body.monkOrLay
      : "MONK";

    let result: { user: { id: string }; profile: { id: string; alumniCode: string } } | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const alumniCode = await generateNextAlumniCode();
      try {
        result = await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              loginPhoneHash: phoneLookupHash,
              loginEmail: emailRaw || null,
              passwordHash,
              role: "MEMBER",
              accountStatus: "ACTIVE",
            },
          });

          const profile = await tx.alumniProfile.create({
            data: {
              userId: user.id,
              alumniCode,
              monkOrLay,
              fullName,
              normalizedName: buildSearchNameKey(fullName),
              formerName: body.formerName ? normalizeMyanmarText(String(body.formerName)) : null,
              birthplace,
              degreeName: degreeName || null,
              batchYearMm,
              batchYearDisplay,
              batchYearApprox: Boolean(body.batchYearApprox),
              dormitory,
              stayPeriod: body.stayPeriod ? normalizeMyanmarText(String(body.stayPeriod)) : null,
              currentRoleOrMonastery,
              currentMonastery: currentMonastery || null,
              messageToAlumni: body.messageToAlumni
                ? normalizeMyanmarText(String(body.messageToAlumni))
                : null,
              countryCode,
              countryName,
              isDomestic,
              region,
              township,
              city: isDomestic ? township || "" : city,
              wardOrVillage,
              phonePrimaryEnc: encryptField(phonePrimary)!,
              phoneLookupHash,
              phoneSecondaryEnc: encryptField(toWesternDigits(String(body.phoneSecondary || "")).trim()),
              viberEnc: encryptField(toWesternDigits(String(body.viber || "")).trim()),
              telegramEnc: encryptField(toWesternDigits(String(body.telegram || "")).trim()),
              emailEnc: encryptField(emailRaw),
              facebookEnc: encryptField(toWesternDigits(String(body.facebook || "")).trim()),
              // Part (င) visibility choices were removed from the form
              // (admin decision 2026-11-25). Defaults are the old form
              // defaults: phone / Viber / Email hidden on the web, ward
              // shown on web and in print. The member can change all of
              // these later on their Profile page.
              showPhoneWeb: false,
              showViberTgWeb: false,
              showEmailFbWeb: false,
              showWardWeb: true,
              showPhonePrint: true, // phone is always in the print book (admin decision 2026-11-25); a member can turn it off on their Profile page
              showWardPrint: true,
              adminNote: body.adminNote ? normalizeMyanmarText(String(body.adminNote)) : null,
              referrerName: body.referrerName ? normalizeMyanmarText(String(body.referrerName)) : null,
              bestContactTime: body.bestContactTime
                ? normalizeMyanmarText(String(body.bestContactTime))
                : null,
              printExclusionNote: body.printExclusionNote
                ? normalizeMyanmarText(String(body.printExclusionNote))
                : null,
              profileStatus: "PENDING",
              consents: {
                // Registration implies agreement: web directory + print
                // book are granted (so no alumnus is left out of the book),
                // and phone is included in the print book too (admin
                // decision 2026-11-25). The member can change both later
                // on their Profile page.
                create: [
                  { consentType: "POLICY_AGREED", granted: true },
                  { consentType: "WEB_DIRECTORY", granted: true },
                  { consentType: "BOOK_PUBLICATION", granted: true },
                  { consentType: "BOOK_PHONE", granted: true },
                ],
              },
            },
          });

          return { user, profile };
        });
        break;
      } catch (txErr: unknown) {
        const errObj = txErr as { code?: string; meta?: { target?: string[] } };
        if (errObj?.code === "P2002") {
          const target = errObj.meta?.target || [];
          if (target.includes("loginPhoneHash") || target.includes("loginEmail")) {
            return NextResponse.json(
              { error: "ဤဖုန်းနံပါတ် (သို့) အီးမေးလ်ဖြင့် စာရင်းသွင်းပြီးသား ဖြစ်နေပါသည်။ Login ဝင်၍ စစ်ဆေးပါ။" },
              { status: 409 }
            );
          }
          if (target.includes("alumniCode") && attempt < 2) {
            continue;
          }
        }
        throw txErr;
      }
    }

    if (!result) {
      throw new Error("Could not generate unique alumniCode");
    }

    await setSessionCookie({
      userId: result.user.id,
      role: "MEMBER",
      profileStatus: "PENDING",
      alumniId: result.profile.id,
    });

    await logAudit({
      actorId: result.user.id,
      action: "ALUMNI_REGISTERED",
      targetType: "AlumniProfile",
      targetId: result.profile.id,
      details: { alumniCode: result.profile.alumniCode },
    });

    return NextResponse.json({
      ok: true,
      alumniCode: result.profile.alumniCode,
    });
  } catch (err) {
    console.error("Registration error:", err);
    return NextResponse.json(
      { error: "စာရင်းသွင်းရာတွင် အမှားအယွင်း ဖြစ်ပွားပါသည်။" },
      { status: 500 }
    );
  }
}

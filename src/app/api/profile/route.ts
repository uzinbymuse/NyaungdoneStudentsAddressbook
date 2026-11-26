import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticated } from "@/lib/auth";
import { decryptField, encryptField, hmacLookup } from "@/lib/crypto";
import {
  normalizeMyanmarText,
  normalizePhoneForHash,
  toWesternDigits,
} from "@/lib/myanmar-utils";
import { COUNTRIES } from "@/lib/mimu-locations";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = await requireAuthenticated();
  if (!session || !session.alumniId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await prisma.alumniProfile.findUnique({
    where: { id: session.alumniId },
    include: {
      consents: true,
      correctionRequests: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!profile) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    profile: {
      id: profile.id,
      alumniCode: profile.alumniCode,
      monkOrLay: profile.monkOrLay,
      fullName: profile.fullName,
      formerName: profile.formerName,
      birthplace: profile.birthplace,
      degreeName: profile.degreeName,
      batchYearDisplay: profile.batchYearDisplay,
      batchYearApprox: profile.batchYearApprox,
      dormitory: profile.dormitory,
      stayPeriod: profile.stayPeriod,
      currentRoleOrMonastery: profile.currentRoleOrMonastery,
      currentMonastery: profile.currentMonastery,
      messageToAlumni: profile.messageToAlumni,
      countryCode: profile.countryCode,
      countryName: profile.countryName,
      isDomestic: profile.isDomestic,
      region: profile.region,
      township: profile.township,
      city: profile.city,
      wardOrVillage: profile.wardOrVillage,
      phonePrimary: decryptField(profile.phonePrimaryEnc),
      phoneSecondary: decryptField(profile.phoneSecondaryEnc),
      viber: decryptField(profile.viberEnc),
      telegram: decryptField(profile.telegramEnc),
      email: decryptField(profile.emailEnc),
      facebook: decryptField(profile.facebookEnc),
      showPhoneWeb: profile.showPhoneWeb,
      showViberTgWeb: profile.showViberTgWeb,
      showEmailFbWeb: profile.showEmailFbWeb,
      showWardWeb: profile.showWardWeb,
      showPhonePrint: profile.showPhonePrint,
      showWardPrint: profile.showWardPrint,
      profileStatus: profile.profileStatus,
      verifiedAt: profile.verifiedAt,
      lastConfirmedAt: profile.lastConfirmedAt,
      consents: profile.consents,
      correctionRequests: profile.correctionRequests,
    },
  });
}

/**
 * Members can directly toggle their own Privacy/Consent settings or confirm annual accuracy.
 */
export async function PATCH(req: NextRequest) {
  const session = await requireAuthenticated();
  if (!session || !session.alumniId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (body.action === "CONFIRM_ACCURACY") {
    await prisma.alumniProfile.update({
      where: { id: session.alumniId },
      data: { lastConfirmedAt: new Date() },
    });
    await logAudit({
      actorId: session.userId,
      action: "ANNUAL_ACCURACY_CONFIRMED",
      targetType: "AlumniProfile",
      targetId: session.alumniId,
    });
    return NextResponse.json({ ok: true });
  }

  // --- Member direct self-edit (Tier 1 only): contacts + current
  // address + current monastery/role. Applies immediately, no admin
  // approval — every change is audit-logged so the admin sees it in
  // the "ပြောင်းထားသူများ" list. Identity/school fields (name, degree,
  // batch year, dormitory, birthplace) are NOT editable here; they go
  // through the correction-request flow (POST below). ---
  if (body.action === "UPDATE_SELF") {
    const rl = checkRateLimit(`selfedit:${session.userId}`, 10, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `ပြင်ဆင်မှု အကြိမ်ရေ များနေပါသည်။ ${rl.retryAfterSeconds} စက္ကန့်အကြာမှ ထပ်မံပြင်ပါ။` },
        { status: 429 }
      );
    }

    const f = (body.fields || {}) as Record<string, unknown>;
    const existing = await prisma.alumniProfile.findUnique({
      where: { id: session.alumniId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const str = (v: unknown) => String(v ?? "");
    const norm = (v: unknown) => normalizeMyanmarText(str(v));
    const normOrNull = (v: unknown) => {
      const n = norm(v);
      return n ? n : null;
    };

    const phonePrimary = toWesternDigits(str(f.phonePrimary)).trim();
    const currentRoleOrMonastery = norm(f.currentRoleOrMonastery);
    if (!phonePrimary || !currentRoleOrMonastery) {
      return NextResponse.json(
        { error: "ဖုန်းနံပါတ်နှင့် အလုပ်/တာဝန်တို့ကို ပြည့်စုံစွာ ဖြည့်ပါ။" },
        { status: 400 }
      );
    }

    const countryCode = str(f.countryCode || existing.countryCode || "MM").trim();
    const countryObj = COUNTRIES.find((c) => c.code === countryCode);
    const countryName =
      countryCode === "OTHER"
        ? norm(f.countryOther || f.countryName || "အခြား")
        : countryObj?.nameMm || norm(f.countryName) || existing.countryName;
    const isDomestic = countryCode === "MM";
    const region = normOrNull(f.region);
    const township = isDomestic ? normOrNull(f.township) : null;
    const city = isDomestic ? township || "" : norm(f.city);
    if (isDomestic && (!region || !township)) {
      return NextResponse.json(
        { error: "တိုင်းဒေသကြီး/ပြည်နယ်နှင့် မြို့နယ်ကို ရွေးပါ။" },
        { status: 400 }
      );
    }
    if (!isDomestic && !city) {
      return NextResponse.json(
        { error: "မြို့နယ်/မြို့ကို ဖြည့်ပါ။" },
        { status: 400 }
      );
    }

    const emailRaw = toWesternDigits(str(f.email)).trim().toLowerCase();
    const oldEmail = decryptField(existing.emailEnc) || "";
    const newPhoneHash = hmacLookup(normalizePhoneForHash(phonePrimary));

    // Phone / email are also the login identifiers: refuse if another
    // account already uses the new value (mirror ADMIN_EDIT).
    if (newPhoneHash !== existing.phoneLookupHash) {
      const clash = await prisma.alumniProfile.findFirst({
        where: { phoneLookupHash: newPhoneHash, id: { not: existing.id } },
      });
      if (clash) {
        return NextResponse.json(
          { error: "ဤဖုန်းနံပါတ်ဖြင့် အခြားမှတ်တမ်း ရှိပြီးသား ဖြစ်နေပါသည်။" },
          { status: 409 }
        );
      }
      if (existing.userId) {
        const userClash = await prisma.user.findFirst({
          where: { loginPhoneHash: newPhoneHash, id: { not: existing.userId } },
        });
        if (userClash) {
          return NextResponse.json(
            { error: "ဤဖုန်းနံပါတ်ဖြင့် အခြားအကောင့် ရှိပြီးသား ဖြစ်နေပါသည်။" },
            { status: 409 }
          );
        }
      }
    }
    if (emailRaw && emailRaw !== oldEmail) {
      const emailClash = await prisma.user.findUnique({ where: { loginEmail: emailRaw } });
      if (emailClash && emailClash.id !== existing.userId) {
        return NextResponse.json(
          { error: "ဤအီးမေးလ်ဖြင့် အခြားအကောင့် ရှိပြီးသား ဖြစ်နေပါသည်။" },
          { status: 409 }
        );
      }
    }

    const updateData: Record<string, unknown> = {
      countryCode,
      countryName,
      isDomestic,
      region,
      township,
      city,
      wardOrVillage: normOrNull(f.wardOrVillage),
      currentMonastery: normOrNull(f.currentMonastery),
      currentRoleOrMonastery,
      phonePrimaryEnc: encryptField(phonePrimary),
      phoneLookupHash: newPhoneHash,
      phoneSecondaryEnc: encryptField(toWesternDigits(str(f.phoneSecondary)).trim()),
      viberEnc: encryptField(toWesternDigits(str(f.viber)).trim()),
      telegramEnc: encryptField(toWesternDigits(str(f.telegram)).trim()),
      emailEnc: encryptField(emailRaw),
      facebookEnc: encryptField(toWesternDigits(str(f.facebook)).trim()),
    };

    const oldValues: Record<string, unknown> = {
      countryCode: existing.countryCode,
      countryName: existing.countryName,
      region: existing.region,
      township: existing.township,
      city: existing.city,
      wardOrVillage: existing.wardOrVillage,
      currentMonastery: existing.currentMonastery,
      currentRoleOrMonastery: existing.currentRoleOrMonastery,
      phonePrimary,
      phoneSecondary: decryptField(existing.phoneSecondaryEnc),
      viber: decryptField(existing.viberEnc),
      telegram: decryptField(existing.telegramEnc),
      email: oldEmail,
      facebook: decryptField(existing.facebookEnc),
    };

    const LABELS: Record<string, string> = {
      phonePrimary: "ဖုန်း (အဓိက)",
      phoneSecondary: "ဖုန်း (အရန်)",
      viber: "Viber",
      telegram: "Telegram",
      email: "အီးမေးလ်",
      facebook: "Facebook",
      countryCode: "နိုင်ငံ",
      region: "တိုင်း/ပြည်နယ်",
      township: "မြို့နယ်/မြို့",
      city: "မြို့",
      wardOrVillage: "ရွာ/ရပ်ကွက်",
      currentMonastery: "လက်ရှိကျောင်းတိုက်",
      currentRoleOrMonastery: "အလုပ်/တာဝန်",
    };
    const changes: Array<{ field: string; label: string; old: string; new: string }> = [];
    for (const key of Object.keys(updateData)) {
      if (key === "phonePrimaryEnc" || key === "phoneLookupHash" || key === "isDomestic") continue;
      if (key === "city" && isDomestic) continue; // domestic city always mirrors the township — one entry is enough
      const next = updateData[key];
      const prev = oldValues[key];
      if (String(next ?? "") !== String(prev ?? "")) {
        const oldText = key === "countryCode" ? String(existing.countryName || prev || "") : String(prev ?? "");
        const newText = key === "countryCode" ? String(countryName || next || "") : String(next ?? "");
        changes.push({ field: key, label: LABELS[key] || key, old: oldText, new: newText });
      }
    }
    const phoneChanged = newPhoneHash !== existing.phoneLookupHash;
    if (phoneChanged) {
      changes.push({
        field: "phonePrimary",
        label: "ဖုန်း (အဓိက)",
        old: decryptField(existing.phonePrimaryEnc) || "",
        new: phonePrimary,
      });
    }

    if (changes.length === 0) {
      return NextResponse.json({ ok: true, changedFields: [], phoneChanged: false });
    }

    await prisma.$transaction(async (tx) => {
      await tx.alumniProfile.update({ where: { id: existing.id }, data: updateData });
      if (existing.userId) {
        // Login uses the phone/email: keep the login identifiers in sync.
        await tx.user.update({
          where: { id: existing.userId },
          data: { loginPhoneHash: newPhoneHash, loginEmail: emailRaw || null },
        });
      }
    });

    await logAudit({
      actorId: session.userId,
      action: "PROFILE_SELF_UPDATED",
      targetType: "AlumniProfile",
      targetId: existing.id,
      details: {
        alumniCode: existing.alumniCode,
        changedFields: changes.map((c) => c.field),
        changes,
      },
    });

    return NextResponse.json({
      ok: true,
      changedFields: changes.map((c) => c.field),
      phoneChanged,
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.alumniProfile.update({
      where: { id: session.alumniId },
      data: {
        showPhoneWeb: Boolean(body.showPhoneWeb),
        showViberTgWeb: Boolean(body.showViberTgWeb),
        showEmailFbWeb: Boolean(body.showEmailFbWeb),
        showWardWeb: Boolean(body.showWardWeb),
        showPhonePrint: Boolean(body.showPhonePrint),
        showWardPrint: Boolean(body.showWardPrint),
      },
    });

    if (typeof body.consentBookPublication === "boolean") {
      await tx.consent.upsert({
        where: {
          alumniId_consentType: {
            alumniId: session.alumniId!,
            consentType: "BOOK_PUBLICATION",
          },
        },
        update: { granted: body.consentBookPublication, recordedAt: new Date() },
        create: {
          alumniId: session.alumniId!,
          consentType: "BOOK_PUBLICATION",
          granted: body.consentBookPublication,
        },
      });
    }

    if (typeof body.showPhonePrint === "boolean") {
      await tx.consent.upsert({
        where: {
          alumniId_consentType: {
            alumniId: session.alumniId!,
            consentType: "BOOK_PHONE",
          },
        },
        update: { granted: body.showPhonePrint, recordedAt: new Date() },
        create: {
          alumniId: session.alumniId!,
          consentType: "BOOK_PHONE",
          granted: body.showPhonePrint,
        },
      });
    }
  });

  await logAudit({
    actorId: session.userId,
    action: "PRIVACY_SETTINGS_UPDATED",
    targetType: "AlumniProfile",
    targetId: session.alumniId,
  });

  return NextResponse.json({ ok: true });
}

/**
 * Submit a Correction Request (requires Admin approval before overwriting verified record).
 */
export async function POST(req: NextRequest) {
  const session = await requireAuthenticated();
  if (!session || !session.alumniId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const reason = normalizeMyanmarText(String(body.reason || ""));
  const proposedData = body.proposedData;

  if (!proposedData || typeof proposedData !== "object") {
    return NextResponse.json({ error: "ပြင်ဆင်လိုသော အချက်အလက် ထည့်သွင်းပါ။" }, { status: 400 });
  }

  const created = await prisma.correctionRequest.create({
    data: {
      alumniId: session.alumniId,
      submittedById: session.userId,
      proposedData,
      reason: reason || null,
    },
  });

  await logAudit({
    actorId: session.userId,
    action: "CORRECTION_REQUEST_SUBMITTED",
    targetType: "CorrectionRequest",
    targetId: created.id,
  });

  return NextResponse.json({ ok: true, id: created.id });
}

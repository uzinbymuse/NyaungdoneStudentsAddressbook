import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuthenticated } from "@/lib/auth";
import { decryptField } from "@/lib/crypto";
import { normalizeMyanmarText } from "@/lib/myanmar-utils";
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

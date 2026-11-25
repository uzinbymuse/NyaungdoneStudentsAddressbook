import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { encryptField, hashToken, hmacLookup, decryptField } from "@/lib/crypto";
import {
  buildSearchNameKey,
  normalizeMyanmarText,
  normalizePhoneForHash,
  toWesternDigits,
} from "@/lib/myanmar-utils";
import { generateNextAlumniCode } from "@/lib/alumni-code";
import { COUNTRIES } from "@/lib/mimu-locations";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const action = String(body.action || "");

  if (action === "APPROVE" || action === "REJECT" || action === "HIDE") {
    const alumniId = String(body.alumniId || "");
    const statusMap: Record<string, "VERIFIED" | "REJECTED" | "HIDDEN"> = {
      APPROVE: "VERIFIED",
      REJECT: "REJECTED",
      HIDE: "HIDDEN",
    };
    const nextStatus = statusMap[action];

    const updated = await prisma.alumniProfile.update({
      where: { id: alumniId },
      data: {
        profileStatus: nextStatus,
        verifiedById: action === "APPROVE" ? admin.userId : undefined,
        verifiedAt: action === "APPROVE" ? new Date() : undefined,
        lastConfirmedAt: action === "APPROVE" ? new Date() : undefined,
      },
    });

    await logAudit({
      actorId: admin.userId,
      action: `ALUMNI_${action}`,
      targetType: "AlumniProfile",
      targetId: alumniId,
      details: { alumniCode: updated.alumniCode },
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "GENERATE_MAGIC_LINK") {
    const userId = String(body.userId || "");
    if (!userId) {
      return NextResponse.json({ error: "User ID missing" }, { status: 400 });
    }
    const rawToken = crypto.randomBytes(24).toString("hex");
    const tokenHash = hashToken(rawToken);
    const expires = new Date(Date.now() + 1000 * 60 * 60 * 48); // 48 hours

    await prisma.user.update({
      where: { id: userId },
      data: {
        magicTokenHash: tokenHash,
        magicTokenExpiresAt: expires,
      },
    });

    await logAudit({
      actorId: admin.userId,
      action: "MAGIC_LINK_GENERATED",
      targetType: "User",
      targetId: userId,
    });

    const origin = req.nextUrl.origin;
    return NextResponse.json({
      ok: true,
      magicLink: `${origin}/api/auth/magic?token=${rawToken}`,
    });
  }

  if (action === "MERGE_DUPLICATE") {
    const keepId = String(body.keepId || "");
    const archiveId = String(body.archiveId || "");
    if (!keepId || !archiveId || keepId === archiveId) {
      return NextResponse.json({ error: "Invalid IDs" }, { status: 400 });
    }

    await prisma.alumniProfile.update({
      where: { id: archiveId },
      data: {
        profileStatus: "MERGED",
        mergedIntoId: keepId,
      },
    });

    await logAudit({
      actorId: admin.userId,
      action: "DUPLICATE_MERGED",
      targetType: "AlumniProfile",
      targetId: archiveId,
      details: { mergedIntoId: keepId },
    });

    return NextResponse.json({ ok: true });
  }

  if (action === "APPROVE_CORRECTION" || action === "REJECT_CORRECTION") {
    const correctionId = String(body.correctionId || "");
    const cr = await prisma.correctionRequest.findUnique({ where: { id: correctionId } });
    if (!cr) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (action === "APPROVE_CORRECTION") {
      const p = cr.proposedData as Record<string, string | undefined>;
      const updateFields: Record<string, unknown> = {};
      if (p.fullName) {
        updateFields.fullName = normalizeMyanmarText(p.fullName);
        updateFields.normalizedName = buildSearchNameKey(p.fullName);
      }
      if (p.degreeName !== undefined) updateFields.degreeName = normalizeMyanmarText(p.degreeName || "");
      if (p.currentRoleOrMonastery) {
        updateFields.currentRoleOrMonastery = normalizeMyanmarText(p.currentRoleOrMonastery);
      }
      if (p.city) updateFields.city = normalizeMyanmarText(p.city);
      if (p.wardOrVillage !== undefined) {
        updateFields.wardOrVillage = normalizeMyanmarText(p.wardOrVillage || "");
      }
      if (p.dormitory) {
        updateFields.dormitory = normalizeMyanmarText(p.dormitory);
      }
      if (p.batchYearDisplay) {
        updateFields.batchYearDisplay = normalizeMyanmarText(p.batchYearDisplay);
        const batchDigits = toWesternDigits(p.batchYearDisplay).match(/\d{4}/);
        updateFields.batchYearMm = batchDigits ? parseInt(batchDigits[0], 10) : null;
      }
      if (p.countryCode) {
        const cc = String(p.countryCode).trim();
        updateFields.countryCode = cc;
        updateFields.isDomestic = cc === "MM";
        if (p.countryName) {
          updateFields.countryName = normalizeMyanmarText(p.countryName);
        } else {
          const countryObj = COUNTRIES.find((c) => c.code === cc);
          if (countryObj) updateFields.countryName = countryObj.nameMm;
        }
      }
      if (p.region !== undefined) {
        updateFields.region = p.region ? normalizeMyanmarText(p.region) : null;
      }
      if (p.township !== undefined) {
        updateFields.township = p.township ? normalizeMyanmarText(p.township) : null;
      }
      if (p.phonePrimary) {
        const cleanPhone = toWesternDigits(p.phonePrimary).trim();
        updateFields.phonePrimaryEnc = encryptField(cleanPhone);
        updateFields.phoneLookupHash = hmacLookup(normalizePhoneForHash(cleanPhone));
      }

      await prisma.$transaction([
        prisma.alumniProfile.update({
          where: { id: cr.alumniId },
          data: updateFields,
        }),
        prisma.correctionRequest.update({
          where: { id: correctionId },
          data: { status: "APPROVED", reviewedById: admin.userId, reviewedAt: new Date() },
        }),
      ]);
    } else {
      await prisma.correctionRequest.update({
        where: { id: correctionId },
        data: { status: "REJECTED", reviewedById: admin.userId, reviewedAt: new Date() },
      });
    }

    await logAudit({
      actorId: admin.userId,
      action: action,
      targetType: "CorrectionRequest",
      targetId: correctionId,
    });

    return NextResponse.json({ ok: true });
  }

  // --- Admin direct edit of any alumni profile field. profileStatus is
  // deliberately NOT touched: editing a PENDING record must not
  // auto-verify it; verification stays a separate APPROVE action. ---
  if (action === "ADMIN_EDIT") {
    const alumniId = String(body.alumniId || "");
    const f = (body.fields || {}) as Record<string, unknown>;
    const existing = await prisma.alumniProfile.findUnique({ where: { id: alumniId } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const str = (v: unknown) => String(v ?? "");
    const norm = (v: unknown) => normalizeMyanmarText(str(v));
    const normOrNull = (v: unknown) => {
      const n = norm(v);
      return n ? n : null;
    };

    const fullName = norm(f.fullName);
    const dormitory =
      str(f.dormitory) === "အခြား" ? norm(f.dormitoryOther) : norm(f.dormitory);
    const currentRoleOrMonastery = norm(f.currentRoleOrMonastery);
    const city = norm(f.city);
    const phonePrimary = toWesternDigits(str(f.phonePrimary)).trim();

    if (!fullName || !dormitory || !currentRoleOrMonastery || !city || !phonePrimary) {
      return NextResponse.json(
        { error: "အမည်၊ ကျောင်းဆောင်၊ လက်ရှိတာဝန်၊ မြို့နှင့် ဖုန်းနံပါတ်တို့ကို ပြည့်စုံစွာ ဖြည့်ပါ။" },
        { status: 400 }
      );
    }

    const batchYearDisplay = norm(f.batchYearDisplay);
    const batchDigits = toWesternDigits(batchYearDisplay).match(/\d{4}/);
    const batchYearMm = batchDigits ? parseInt(batchDigits[0], 10) : null;

    const countryCode = str(f.countryCode || "MM").trim();
    const countryObj = COUNTRIES.find((c) => c.code === countryCode);
    const countryName =
      countryCode === "OTHER"
        ? norm(f.countryOther || f.countryName || "အခြား")
        : countryObj?.nameMm || norm(f.countryName) || "မြန်မာ";

    const newPhoneHash = hmacLookup(normalizePhoneForHash(phonePrimary));
    const emailRaw = str(f.email).trim().toLowerCase();
    const oldEmail = decryptField(existing.emailEnc) || "";

    // Phone / email are also the login identifiers: refuse if another
    // account already uses the new value.
    if (newPhoneHash !== existing.phoneLookupHash) {
      const clash = await prisma.alumniProfile.findFirst({
        where: { phoneLookupHash: newPhoneHash, id: { not: alumniId } },
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

    const monkOrLay = ["MONK", "LAY", "NUN", "OTHER"].includes(str(f.monkOrLay))
      ? (str(f.monkOrLay) as "MONK" | "LAY" | "NUN" | "OTHER")
      : existing.monkOrLay;

    const updateData: Record<string, unknown> = {
      monkOrLay,
      fullName,
      normalizedName: buildSearchNameKey(fullName),
      formerName: normOrNull(f.formerName),
      degreeName: normOrNull(f.degreeName),
      batchYearDisplay,
      batchYearMm,
      batchYearApprox: Boolean(f.batchYearApprox),
      dormitory,
      stayPeriod: normOrNull(f.stayPeriod),
      currentRoleOrMonastery,
      messageToAlumni: normOrNull(f.messageToAlumni),
      countryCode,
      countryName,
      isDomestic: countryCode === "MM",
      region: normOrNull(f.region),
      township: normOrNull(f.township),
      city,
      wardOrVillage: normOrNull(f.wardOrVillage),
      phonePrimaryEnc: encryptField(phonePrimary),
      phoneLookupHash: newPhoneHash,
      phoneSecondaryEnc: encryptField(str(f.phoneSecondary)),
      viberEnc: encryptField(str(f.viber)),
      telegramEnc: encryptField(str(f.telegram)),
      emailEnc: encryptField(emailRaw),
      facebookEnc: encryptField(str(f.facebook)),
      showPhoneWeb: Boolean(f.showPhoneWeb),
      showViberTgWeb: Boolean(f.showViberTgWeb),
      showEmailFbWeb: Boolean(f.showEmailFbWeb),
      showWardWeb: Boolean(f.showWardWeb),
      showPhonePrint: Boolean(f.showPhonePrint),
      showWardPrint: Boolean(f.showWardPrint),
      adminNote: normOrNull(f.adminNote),
    };

    // Changed-field list for the audit log (contacts compared decrypted).
    const oldValues: Record<string, unknown> = {
      monkOrLay: existing.monkOrLay,
      fullName: existing.fullName,
      formerName: existing.formerName,
      degreeName: existing.degreeName,
      batchYearDisplay: existing.batchYearDisplay,
      batchYearMm: existing.batchYearMm,
      batchYearApprox: existing.batchYearApprox,
      dormitory: existing.dormitory,
      stayPeriod: existing.stayPeriod,
      currentRoleOrMonastery: existing.currentRoleOrMonastery,
      messageToAlumni: existing.messageToAlumni,
      countryCode: existing.countryCode,
      countryName: existing.countryName,
      region: existing.region,
      township: existing.township,
      city: existing.city,
      wardOrVillage: existing.wardOrVillage,
      phonePrimary,
      phoneSecondary: decryptField(existing.phoneSecondaryEnc),
      viber: decryptField(existing.viberEnc),
      telegram: decryptField(existing.telegramEnc),
      email: oldEmail,
      facebook: decryptField(existing.facebookEnc),
      showPhoneWeb: existing.showPhoneWeb,
      showViberTgWeb: existing.showViberTgWeb,
      showEmailFbWeb: existing.showEmailFbWeb,
      showWardWeb: existing.showWardWeb,
      showPhonePrint: existing.showPhonePrint,
      showWardPrint: existing.showWardPrint,
      adminNote: existing.adminNote,
    };
    const changedFields = Object.keys(updateData).filter((key) => {
      if (key === "phonePrimaryEnc" || key === "phoneLookupHash") return false;
      if (key === "normalizedName" || key === "isDomestic") return false;
      const next = updateData[key];
      const prev = oldValues[key];
      return String(next ?? "") !== String(prev ?? "");
    });
    if (newPhoneHash !== existing.phoneLookupHash) changedFields.push("phonePrimary");

    await prisma.$transaction(async (tx) => {
      await tx.alumniProfile.update({ where: { id: alumniId }, data: updateData });
      if (existing.userId) {
        await tx.user.update({
          where: { id: existing.userId },
          data: {
            loginPhoneHash: newPhoneHash,
            loginEmail: emailRaw || null,
          },
        });
      }
    });

    await logAudit({
      actorId: admin.userId,
      action: "ADMIN_EDIT",
      targetType: "AlumniProfile",
      targetId: alumniId,
      details: { alumniCode: existing.alumniCode, changedFields },
    });

    return NextResponse.json({ ok: true, changedFields });
  }

  if (action === "IMPORT_BATCH_ROW") {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    let importedCount = 0;

    for (const row of rows) {
      const fullName = normalizeMyanmarText(String(row.fullName || ""));
      const phone = toWesternDigits(String(row.phonePrimary || "")).trim();
      const batchYearDisplay = normalizeMyanmarText(String(row.batchYearDisplay || "မမှတ်မိ"));
      const dormitory = normalizeMyanmarText(String(row.dormitory || "မသတ်မှတ်"));
      const city = normalizeMyanmarText(String(row.city || "မသတ်မှတ်"));
      const currentRole = normalizeMyanmarText(String(row.currentRoleOrMonastery || "-"));

      if (!fullName || !phone) continue;

      const alumniCode = await generateNextAlumniCode();
      const batchDigits = toWesternDigits(batchYearDisplay).match(/\d{4}/);
      const batchYearMm = batchDigits ? parseInt(batchDigits[0], 10) : null;
      const countryCode = String(row.countryCode || "MM");

      await prisma.alumniProfile.create({
        data: {
          alumniCode,
          fullName,
          normalizedName: buildSearchNameKey(fullName),
          degreeName: row.degreeName ? normalizeMyanmarText(String(row.degreeName)) : null,
          batchYearMm,
          batchYearDisplay,
          dormitory,
          currentRoleOrMonastery: currentRole,
          countryCode,
          countryName: row.countryName ? normalizeMyanmarText(String(row.countryName)) : "မြန်မာ",
          isDomestic: countryCode === "MM",
          region: row.region ? normalizeMyanmarText(String(row.region)) : null,
          township: row.township ? normalizeMyanmarText(String(row.township)) : null,
          city,
          wardOrVillage: row.wardOrVillage ? normalizeMyanmarText(String(row.wardOrVillage)) : null,
          phonePrimaryEnc: encryptField(phone)!,
          phoneLookupHash: hmacLookup(normalizePhoneForHash(phone)),
          profileStatus: "PENDING",
        },
      });
      importedCount++;
    }

    await logAudit({
      actorId: admin.userId,
      action: "BATCH_IMPORT",
      targetType: "AlumniProfile",
      details: { importedCount },
    });

    return NextResponse.json({ ok: true, importedCount });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

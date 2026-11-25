import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { encryptField, hashToken, hmacLookup } from "@/lib/crypto";
import {
  buildSearchNameKey,
  normalizeMyanmarText,
  normalizePhoneForHash,
  toWesternDigits,
} from "@/lib/myanmar-utils";
import { generateNextAlumniCode } from "@/lib/alumni-code";
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

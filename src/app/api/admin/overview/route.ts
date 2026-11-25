import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { decryptField } from "@/lib/crypto";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const [allProfiles, corrections, auditLogs] = await Promise.all([
    prisma.alumniProfile.findMany({
      where: { profileStatus: { not: "MERGED" } },
      orderBy: { createdAt: "desc" },
      include: { consents: true },
    }),
    prisma.correctionRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: {
        alumni: { select: { alumniCode: true, fullName: true } },
      },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  ]);

  const stats = {
    total: allProfiles.length,
    verified: allProfiles.filter((p) => p.profileStatus === "VERIFIED").length,
    pending: allProfiles.filter((p) => p.profileStatus === "PENDING").length,
    domestic: allProfiles.filter((p) => p.isDomestic && p.profileStatus === "VERIFIED").length,
    international: allProfiles.filter((p) => !p.isDomestic && p.profileStatus === "VERIFIED").length,
    pendingCorrections: corrections.length,
  };

  // Detect potential duplicates by normalizedName or phoneLookupHash
  const nameGroups = new Map<string, typeof allProfiles>();
  const phoneGroups = new Map<string, typeof allProfiles>();
  for (const p of allProfiles) {
    if (p.normalizedName) {
      const arr = nameGroups.get(p.normalizedName) ?? [];
      arr.push(p);
      nameGroups.set(p.normalizedName, arr);
    }
    if (p.phoneLookupHash) {
      const arr = phoneGroups.get(p.phoneLookupHash) ?? [];
      arr.push(p);
      phoneGroups.set(p.phoneLookupHash, arr);
    }
  }

  const duplicateIds = new Set<string>();
  for (const grp of [...nameGroups.values(), ...phoneGroups.values()]) {
    if (grp.length > 1) {
      grp.forEach((p) => duplicateIds.add(p.id));
    }
  }

  const alumniList = allProfiles.map((p) => ({
    id: p.id,
    userId: p.userId,
    alumniCode: p.alumniCode,
    monkOrLay: p.monkOrLay,
    fullName: p.fullName,
    formerName: p.formerName,
    degreeName: p.degreeName,
    batchYearDisplay: p.batchYearDisplay,
    batchYearMm: p.batchYearMm,
    batchYearApprox: p.batchYearApprox,
    dormitory: p.dormitory,
    stayPeriod: p.stayPeriod,
    currentRoleOrMonastery: p.currentRoleOrMonastery,
    currentMonastery: p.currentMonastery,
    messageToAlumni: p.messageToAlumni,
    countryCode: p.countryCode,
    countryName: p.countryName,
    isDomestic: p.isDomestic,
    region: p.region,
    township: p.township,
    city: p.city,
    wardOrVillage: p.wardOrVillage,
    phonePrimary: decryptField(p.phonePrimaryEnc),
    phoneSecondary: decryptField(p.phoneSecondaryEnc),
    viber: decryptField(p.viberEnc),
    telegram: decryptField(p.telegramEnc),
    email: decryptField(p.emailEnc),
    facebook: decryptField(p.facebookEnc),
    showPhoneWeb: p.showPhoneWeb,
    showViberTgWeb: p.showViberTgWeb,
    showEmailFbWeb: p.showEmailFbWeb,
    showWardWeb: p.showWardWeb,
    showPhonePrint: p.showPhonePrint,
    showWardPrint: p.showWardPrint,
    bookConsent:
      p.consents.find((c) => c.consentType === "BOOK_PUBLICATION")?.granted ?? false,
    adminNote: p.adminNote,
    referrerName: p.referrerName,
    bestContactTime: p.bestContactTime,
    printExclusionNote: p.printExclusionNote,
    profileStatus: p.profileStatus,
    isPotentialDuplicate: duplicateIds.has(p.id),
    createdAt: p.createdAt,
  }));

  return NextResponse.json({
    stats,
    alumniList,
    corrections,
    auditLogs,
  });
}

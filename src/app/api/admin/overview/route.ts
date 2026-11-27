import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { decryptField } from "@/lib/crypto";
import { getHiddenContactIds } from "@/lib/hidden-contacts";

const PAGE_SIZE = 50;

// List tabs that page through the directory. Other tabs (corrections,
// print, logs, …) do not paginate here.
const LIST_TABS = ["PENDING", "ALL", "DUPLICATES"] as const;
type ListTab = (typeof LIST_TABS)[number];

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;

  // Single-record fetch (used by the "ပြင်ဆင်မည်" button on the CHANGES
  // tab, so it can open the edit modal for a record that may not be on
  // the currently loaded page).
  const alumniId = sp.get("alumniId");
  if (alumniId) {
    const row = await prisma.alumniProfile.findUnique({
      where: { id: alumniId },
      include: {
        consents: { where: { consentType: "BOOK_PUBLICATION" }, select: { granted: true } },
      },
      omit: { hideContactsWeb: true },
    });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const hiddenIds = await getHiddenContactIds();
    return NextResponse.json({ alumni: mapProfile(row, hiddenIds.has(row.id), false) });
  }

  const tabRaw = sp.get("tab") || "ALL";
  const tab: ListTab = (LIST_TABS as readonly string[]).includes(tabRaw)
    ? (tabRaw as ListTab)
    : "ALL";
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);

  // Lightweight pass over every (non-merged) profile — only tiny columns,
  // no decrypt, no consents join — to compute stats, duplicates and
  // per-dormitory usage cheaply.
  const [lite, corrections, auditLogs, hiddenIds, selfEditLogs] = await Promise.all([
    prisma.alumniProfile.findMany({
      where: { profileStatus: { not: "MERGED" } },
      select: {
        id: true,
        userId: true,
        alumniCode: true,
        fullName: true,
        normalizedName: true,
        phoneLookupHash: true,
        profileStatus: true,
        isDomestic: true,
        dormitory: true,
      },
    }),
    prisma.correctionRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "desc" },
      include: { alumni: { select: { alumniCode: true, fullName: true } } },
    }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    getHiddenContactIds(),
    prisma.auditLog.findMany({
      where: { action: "PROFILE_SELF_UPDATED" },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  // Duplicate detection by normalizedName or phoneLookupHash.
  const seenName = new Set<string>();
  const seenPhone = new Set<string>();
  const dupName = new Set<string>();
  const dupPhone = new Set<string>();
  for (const p of lite) {
    if (p.normalizedName) {
      if (seenName.has(p.normalizedName)) dupName.add(p.normalizedName);
      seenName.add(p.normalizedName);
    }
    if (p.phoneLookupHash) {
      if (seenPhone.has(p.phoneLookupHash)) dupPhone.add(p.phoneLookupHash);
      seenPhone.add(p.phoneLookupHash);
    }
  }
  const duplicateIds = new Set<string>();
  for (const p of lite) {
    if (
      (p.normalizedName && dupName.has(p.normalizedName)) ||
      (p.phoneLookupHash && dupPhone.has(p.phoneLookupHash))
    ) {
      duplicateIds.add(p.id);
    }
  }

  const dormitoryUsage: Record<string, number> = {};
  for (const p of lite) {
    dormitoryUsage[p.dormitory] = (dormitoryUsage[p.dormitory] ?? 0) + 1;
  }

  const stats = {
    total: lite.length,
    verified: lite.filter((p) => p.profileStatus === "VERIFIED").length,
    pending: lite.filter((p) => p.profileStatus === "PENDING").length,
    domestic: lite.filter((p) => p.isDomestic && p.profileStatus === "VERIFIED").length,
    international: lite.filter((p) => !p.isDomestic && p.profileStatus === "VERIFIED").length,
    pendingCorrections: corrections.length,
    duplicateCount: duplicateIds.size,
  };

  // Filter + count for the requested tab.
  let where: Prisma.AlumniProfileWhereInput;
  let listTotal: number;
  if (tab === "PENDING") {
    where = { profileStatus: "PENDING" };
    listTotal = stats.pending;
  } else if (tab === "DUPLICATES") {
    where = { id: { in: [...duplicateIds] } };
    listTotal = duplicateIds.size;
  } else {
    where = { profileStatus: { not: "MERGED" } };
    listTotal = stats.total;
  }

  const pageRows = await prisma.alumniProfile.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      consents: { where: { consentType: "BOOK_PUBLICATION" }, select: { granted: true } },
    },
    omit: { hideContactsWeb: true },
  });

  const alumniList = pageRows.map((p) =>
    mapProfile(p, hiddenIds.has(p.id), duplicateIds.has(p.id))
  );

  const byUserId = new Map<string, (typeof lite)[number]>();
  for (const p of lite) {
    if (p.userId) byUserId.set(p.userId, p);
  }

  // Members' direct self-edits (Tier 1): who, when, and old -> new per
  // field. Actor is matched to the profile by userId in O(1).
  const selfEdits = selfEditLogs.map((l) => {
    const p = l.actorId ? byUserId.get(l.actorId) : undefined;
    const details = (l.details || {}) as {
      changes?: Array<{ field: string; label: string; old: string; new: string }>;
    };
    return {
      id: l.id,
      createdAt: l.createdAt,
      alumniId: l.targetId,
      alumniCode: p?.alumniCode || "",
      fullName: p?.fullName || "",
      changes: details.changes || [],
    };
  });

  return NextResponse.json({
    stats,
    alumniList,
    corrections,
    auditLogs,
    selfEdits,
    dormitoryUsage,
    listTotal,
    page,
    pageSize: PAGE_SIZE,
    tab,
  });
}

type PageRow = Prisma.AlumniProfileGetPayload<{
  include: { consents: { select: { granted: true } } };
  omit: { hideContactsWeb: true };
}>;

function mapProfile(p: PageRow, hidden: boolean, isDuplicate: boolean) {
  return {
    id: p.id,
    userId: p.userId,
    alumniCode: p.alumniCode,
    monkOrLay: p.monkOrLay,
    fullName: p.fullName,
    formerName: p.formerName,
    birthplace: p.birthplace,
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
    hideContactsWeb: hidden,
    showWardWeb: p.showWardWeb,
    showPhonePrint: p.showPhonePrint,
    showWardPrint: p.showWardPrint,
    bookConsent: p.consents[0]?.granted ?? false,
    adminNote: p.adminNote,
    referrerName: p.referrerName,
    bestContactTime: p.bestContactTime,
    printExclusionNote: p.printExclusionNote,
    profileStatus: p.profileStatus,
    isPotentialDuplicate: isDuplicate,
    createdAt: p.createdAt,
  };
}

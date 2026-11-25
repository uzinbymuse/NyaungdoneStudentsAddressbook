import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { decryptField } from "@/lib/crypto";
import { logAudit } from "@/lib/audit";

async function buildPrintEligibleList() {
  const verified = await prisma.alumniProfile.findMany({
    where: { profileStatus: "VERIFIED" },
    include: { consents: true },
    orderBy: [{ isDomestic: "desc" }, { region: "asc" }, { countryName: "asc" }, { batchYearMm: "asc" }, { fullName: "asc" }],
  });

  return verified
    .filter((p) => {
      const bookConsent = p.consents.find((c) => c.consentType === "BOOK_PUBLICATION")?.granted;
      return bookConsent === true;
    })
    .map((p) => ({
      alumniCode: p.alumniCode,
      fullName: p.fullName,
      formerName: p.formerName,
      birthplace: p.birthplace,
      degreeName: p.degreeName,
      batchYearDisplay: p.batchYearDisplay,
      dormitory: p.dormitory,
      currentRoleOrMonastery: p.currentRoleOrMonastery,
      currentMonastery: p.currentMonastery,
      isDomestic: p.isDomestic,
      countryName: p.countryName,
      region: p.region,
      township: p.township,
      city: p.city,
      wardOrVillage: p.showWardPrint ? p.wardOrVillage : null,
      phone: p.showPhonePrint ? decryptField(p.phonePrimaryEnc) : null,
      printExclusionNote: p.printExclusionNote,
    }));
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const [eligibleEntries, publications] = await Promise.all([
    buildPrintEligibleList(),
    prisma.publication.findMany({
      orderBy: { frozenAt: "desc" },
      select: {
        id: true,
        title: true,
        frozenAt: true,
        snapshotCount: true,
      },
    }),
  ]);

  return NextResponse.json({
    eligibleCount: eligibleEntries.length,
    domesticCount: eligibleEntries.filter((e) => e.isDomestic).length,
    internationalCount: eligibleEntries.filter((e) => !e.isDomestic).length,
    eligibleEntries,
    publications,
  });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const title = String(body.title || "").trim() || `Print Edition ${new Date().getFullYear()}`;
  const entries = await buildPrintEligibleList();

  const publication = await prisma.publication.create({
    data: {
      title,
      snapshotCount: entries.length,
      snapshotData: entries,
      createdById: admin.userId,
    },
  });

  await logAudit({
    actorId: admin.userId,
    action: "PUBLICATION_FROZEN",
    targetType: "Publication",
    targetId: publication.id,
    details: { title, snapshotCount: entries.length },
  });

  return NextResponse.json({ ok: true, publication });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { normalizeMyanmarText } from "@/lib/myanmar-utils";
import { logAudit } from "@/lib/audit";
import { DORMITORY_OTHER } from "@/lib/dormitories";

async function listAll() {
  return prisma.dormitory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  return NextResponse.json({ dormitories: await listAll() });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const action = String(body.action || "");

  // --- Create a new dormitory ---
  if (action === "CREATE") {
    const name = normalizeMyanmarText(String(body.name || ""));
    if (!name || name === DORMITORY_OTHER) {
      return NextResponse.json(
        { error: "ကျောင်းဆောင်အမည် မှန်ကန်စွာ ထည့်သွင်းပါ။" },
        { status: 400 }
      );
    }
    const existing = await prisma.dormitory.findUnique({ where: { name } });
    if (existing) {
      return NextResponse.json(
        { error: "ဤအမည်ဖြင့် ကျောင်းဆောင် ရှိပြီးသား ဖြစ်နေပါသည်။" },
        { status: 409 }
      );
    }
    const maxOrder = await prisma.dormitory.aggregate({ _max: { sortOrder: true } });
    const created = await prisma.dormitory.create({
      data: { name, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
    });
    await logAudit({
      actorId: admin.userId,
      action: "DORMITORY_CREATED",
      targetType: "Dormitory",
      targetId: created.id,
      details: { name },
    });
    return NextResponse.json({ ok: true, dormitories: await listAll() });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await req.json();
  const action = String(body.action || "");

  // --- Rename: also updates every alumni profile whose dormitory text
  // exactly equals the old name, in the same transaction. ---
  if (action === "RENAME") {
    const id = String(body.id || "");
    const name = normalizeMyanmarText(String(body.name || ""));
    if (!id || !name || name === DORMITORY_OTHER) {
      return NextResponse.json(
        { error: "ကျောင်းဆောင်အမည် မှန်ကန်စွာ ထည့်သွင်းပါ။" },
        { status: 400 }
      );
    }
    const current = await prisma.dormitory.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (current.name === name) {
      return NextResponse.json({ ok: true, dormitories: await listAll() });
    }
    const clash = await prisma.dormitory.findUnique({ where: { name } });
    if (clash) {
      return NextResponse.json(
        { error: "ဤအမည်ဖြင့် ကျောင်းဆောင် ရှိပြီးသား ဖြစ်နေပါသည်။" },
        { status: 409 }
      );
    }
    const { count } = await prisma.$transaction(async (tx) => {
      await tx.dormitory.update({ where: { id }, data: { name } });
      return tx.alumniProfile.updateMany({
        where: { dormitory: current.name },
        data: { dormitory: name },
      });
    });
    await logAudit({
      actorId: admin.userId,
      action: "DORMITORY_RENAMED",
      targetType: "Dormitory",
      targetId: id,
      details: { oldName: current.name, newName: name, updatedProfiles: count },
    });
    return NextResponse.json({ ok: true, dormitories: await listAll() });
  }

  // --- Deactivate / reactivate. Never deletes alumni and never changes
  // any stored dormitory text — it only hides the name from future
  // dropdowns. Every dormitory, including the last one, may be
  // deactivated, leaving the list empty. ---
  if (action === "SET_ACTIVE") {
    const id = String(body.id || "");
    const isActive = Boolean(body.isActive);
    const current = await prisma.dormitory.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.dormitory.update({ where: { id }, data: { isActive } });
    await logAudit({
      actorId: admin.userId,
      action: isActive ? "DORMITORY_REACTIVATED" : "DORMITORY_DEACTIVATED",
      targetType: "Dormitory",
      targetId: id,
      details: { name: current.name },
    });
    return NextResponse.json({ ok: true, dormitories: await listAll() });
  }

  // --- Reorder: orderedIds is the full list of ids in the new order. ---
  if (action === "REORDER") {
    const orderedIds = Array.isArray(body.orderedIds)
      ? body.orderedIds.map((v: unknown) => String(v))
      : [];
    if (orderedIds.length === 0) {
      return NextResponse.json({ error: "orderedIds missing" }, { status: 400 });
    }
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.dormitory.update({ where: { id }, data: { sortOrder: index } })
      )
    );
    await logAudit({
      actorId: admin.userId,
      action: "DORMITORIES_REORDERED",
      targetType: "Dormitory",
      details: { orderedIds },
    });
    return NextResponse.json({ ok: true, dormitories: await listAll() });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const id = req.nextUrl.searchParams.get("id") || "";
  const current = await prisma.dormitory.findUnique({ where: { id } });
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Deletes only the Dormitory row. Alumni profiles keep their stored
  // dormitory text untouched, so no alumni record is ever lost.
  await prisma.dormitory.delete({ where: { id } });
  await logAudit({
    actorId: admin.userId,
    action: "DORMITORY_DELETED",
    targetType: "Dormitory",
    targetId: id,
    details: { name: current.name },
  });
  return NextResponse.json({ ok: true, dormitories: await listAll() });
}

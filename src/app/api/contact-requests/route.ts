import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireVerifiedMember } from "@/lib/auth";
import { normalizeMyanmarText } from "@/lib/myanmar-utils";
import { logAudit } from "@/lib/audit";

export async function GET() {
  const session = await requireVerifiedMember();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const incoming = session.alumniId
    ? await prisma.contactRequest.findMany({
        where: { receiverAlumniId: session.alumniId },
        orderBy: { createdAt: "desc" },
        include: {
          sender: {
            select: {
              id: true,
              profile: {
                select: {
                  alumniCode: true,
                  fullName: true,
                  batchYearDisplay: true,
                  dormitory: true,
                  city: true,
                  countryName: true,
                },
              },
            },
          },
        },
      })
    : [];

  const outgoing = await prisma.contactRequest.findMany({
    where: { senderId: session.userId },
    orderBy: { createdAt: "desc" },
    include: {
      receiverAlumni: {
        select: {
          id: true,
          alumniCode: true,
          fullName: true,
          batchYearDisplay: true,
        },
      },
    },
  });

  return NextResponse.json({ incoming, outgoing });
}

export async function POST(req: NextRequest) {
  const session = await requireVerifiedMember();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const receiverAlumniId = String(body.receiverAlumniId || "");
  const message = normalizeMyanmarText(String(body.message || ""));

  if (!receiverAlumniId || !message) {
    return NextResponse.json(
      { error: "ဆက်သွယ်လိုသော အကြောင်းအရာကို ရေးသားပါ။" },
      { status: 400 }
    );
  }

  if (receiverAlumniId === session.alumniId) {
    return NextResponse.json({ error: "မိမိကိုယ်တိုင်ထံ တောင်းဆို၍ မရပါ။" }, { status: 400 });
  }

  const existing = await prisma.contactRequest.findFirst({
    where: {
      senderId: session.userId,
      receiverAlumniId,
      status: { in: ["PENDING", "ACCEPTED"] },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "ဆက်သွယ်ရန် တောင်းဆိုချက် ပေးပို့ပြီးသား ဖြစ်ပါသည်။" },
      { status: 409 }
    );
  }

  const created = await prisma.contactRequest.create({
    data: {
      senderId: session.userId,
      receiverAlumniId,
      message,
    },
  });

  await logAudit({
    actorId: session.userId,
    action: "CONTACT_REQUEST_SENT",
    targetType: "ContactRequest",
    targetId: created.id,
  });

  return NextResponse.json({ ok: true, id: created.id });
}

export async function PATCH(req: NextRequest) {
  const session = await requireVerifiedMember();
  if (!session || !session.alumniId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const body = await req.json();
  const id = String(body.id || "");
  const status = body.status === "ACCEPTED" ? "ACCEPTED" : "DECLINED";

  const reqRecord = await prisma.contactRequest.findUnique({ where: { id } });
  if (!reqRecord || reqRecord.receiverAlumniId !== session.alumniId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.contactRequest.update({
    where: { id },
    data: { status },
  });

  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireAdmin, verifyPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

// Admin changes their own login email (the username they log in with)
// and/or password. The current password must always be given.
// GET returns the current login email so the form can show it.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "Admin သာ ဝင်ရောက်နိုင်ပါသည်။" },
      { status: 403 }
    );
  }
  const user = await prisma.user.findUnique({
    where: { id: admin.userId },
    select: { loginEmail: true },
  });
  return NextResponse.json({ loginEmail: user?.loginEmail || "" });
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "Admin သာ ဝင်ရောက်နိုင်ပါသည်။" },
        { status: 403 }
      );
    }

    const rl = checkRateLimit(
      `admin-change-credentials:${admin.userId}`,
      10,
      60 * 1000
    );
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: `ကြိုးစားမှု အကြိမ်ရေ များနေပါသည်။ ${rl.retryAfterSeconds} စက္ကန့်အကြာမှ ပြန်ကြိုးစားပါ။`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const currentPassword = String(body.currentPassword || "");
    const newEmail = String(body.newEmail || "").trim().toLowerCase();
    const newPassword = String(body.newPassword || "");
    if (!currentPassword) {
      return NextResponse.json(
        { error: "လက်ရှိ စကားဝှက် ထည့်သွင်းပါ။" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: admin.userId },
      select: { id: true, passwordHash: true, loginEmail: true },
    });
    if (!user) {
      return NextResponse.json({ error: "အကောင့် မတွေ့ပါ။" }, { status: 404 });
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "လက်ရှိ စကားဝှက် မှားယွင်းနေပါသည်။" },
        { status: 401 }
      );
    }

    const data: { loginEmail?: string; passwordHash?: string } = {};
    let emailChanged = false;
    let passwordChanged = false;

    if (newEmail && newEmail !== (user.loginEmail || "").toLowerCase()) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        return NextResponse.json(
          { error: "အီးမေးလ် မှန်ကန်စွာ ထည့်သွင်းပါ။" },
          { status: 400 }
        );
      }
      const clash = await prisma.user.findFirst({
        where: { loginEmail: newEmail, id: { not: user.id } },
        select: { id: true },
      });
      if (clash) {
        return NextResponse.json(
          { error: "ဤအီးမေးလ်ကို အခြားအကောင့်တွင် အသုံးပြုထားပါသည်။" },
          { status: 409 }
        );
      }
      data.loginEmail = newEmail;
      emailChanged = true;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        return NextResponse.json(
          { error: "စကားဝှက်အသစ်သည် အနည်းဆုံး စာလုံး ၆ လုံး ရှိရပါမည်။" },
          { status: 400 }
        );
      }
      data.passwordHash = await hashPassword(newPassword);
      passwordChanged = true;
    }

    if (!emailChanged && !passwordChanged) {
      return NextResponse.json(
        { error: "ပြောင်းလဲလိုသော အီးမေးလ် (သို့မဟုတ်) စကားဝှက် ထည့်သွင်းပါ။" },
        { status: 400 }
      );
    }

    await prisma.user.update({ where: { id: user.id }, data });
    await logAudit({
      actorId: user.id,
      action: "ADMIN_CREDENTIALS_CHANGED",
      targetType: "User",
      targetId: user.id,
      details: { emailChanged, passwordChanged },
    });
    return NextResponse.json({
      ok: true,
      loginEmail: data.loginEmail ?? user.loginEmail,
    });
  } catch {
    return NextResponse.json(
      { error: "ပြောင်းလဲရာတွင် အမှားအယွင်း ဖြစ်ပွားပါသည်။" },
      { status: 500 }
    );
  }
}

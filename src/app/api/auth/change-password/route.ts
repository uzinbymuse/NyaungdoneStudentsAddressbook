import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, hashPassword, setSessionCookie, verifyPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

// Any logged-in user changes their own login password — members call
// it their PIN. The current password must be given, and the new one
// must be at least 6 characters.
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return NextResponse.json(
        { error: "Login ဝင်ပြီးမှ ပြောင်းလဲနိုင်ပါသည်။" },
        { status: 401 }
      );
    }

    const rl = checkRateLimit(`change-password:${session.userId}`, 10, 60 * 1000);
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
    const newPassword = String(body.newPassword || "");
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "လက်ရှိနှင့် အသစ် စကားဝှက် နှစ်ခုလုံး ထည့်သွင်းပါ။" },
        { status: 400 }
      );
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "စကားဝှက်အသစ်သည် အနည်းဆုံး စာလုံး ၆ လုံး ရှိရပါမည်။" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        passwordHash: true,
        passwordIsTemporary: true,
        role: true,
        profile: { select: { id: true, profileStatus: true } },
      },
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

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await hashPassword(newPassword),
        // A changed password is never temporary again — this also lifts
        // the forced-PIN-change gate for imported accounts.
        passwordIsTemporary: false,
        tempPasswordExpiresAt: null,
      },
    });
    // Re-issue the session without the must-change-PIN flag.
    await setSessionCookie({
      userId: user.id,
      role: user.role,
      profileStatus: user.profile?.profileStatus ?? "PENDING",
      alumniId: user.profile?.id,
      mustChangePin: false,
    });
    await logAudit({
      actorId: user.id,
      action: "PASSWORD_CHANGED",
      targetType: "User",
      targetId: user.id,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "ပြောင်းလဲရာတွင် အမှားအယွင်း ဖြစ်ပွားပါသည်။" },
      { status: 500 }
    );
  }
}

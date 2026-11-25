import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { hmacLookup } from "@/lib/crypto";
import { normalizePhoneForHash } from "@/lib/myanmar-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = checkRateLimit(`login:${ip}`, 10, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: `ကြိုးစားမှု အကြိမ်ရေ များနေပါသည်။ ${rl.retryAfterSeconds} စက္ကန့်အကြာမှ ပြန်ကြိုးစားပါ။` },
        { status: 429 }
      );
    }

    const body = await req.json();
    const identifier = String(body.identifier || "").trim();
    const password = String(body.password || "");

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "ဖုန်းနံပါတ် (သို့မဟုတ်) အီးမေးလ်နှင့် စကားဝှက် ထည့်သွင်းပါ။" },
        { status: 400 }
      );
    }

    const isEmail = identifier.includes("@");
    const user = await prisma.user.findFirst({
      where: isEmail
        ? { loginEmail: identifier.toLowerCase() }
        : { loginPhoneHash: hmacLookup(normalizePhoneForHash(identifier)) },
      include: {
        profile: { select: { id: true, profileStatus: true } },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "အကောင့် သို့မဟုတ် စကားဝှက် မှားယွင်းနေပါသည်။" },
        { status: 401 }
      );
    }

    if (user.accountStatus === "SUSPENDED") {
      return NextResponse.json(
        { error: "ဤအကောင့်ကို ယာယီပိတ်ထားပါသည်။ Admin ထံ ဆက်သွယ်ပါ။" },
        { status: 403 }
      );
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await logAudit({
        actorId: user.id,
        action: "LOGIN_FAILED",
        targetType: "User",
        targetId: user.id,
      });
      return NextResponse.json(
        { error: "အကောင့် သို့မဟုတ် စကားဝှက် မှားယွင်းနေပါသည်။" },
        { status: 401 }
      );
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    await setSessionCookie({
      userId: user.id,
      role: user.role,
      profileStatus: user.profile?.profileStatus ?? "PENDING",
      alumniId: user.profile?.id,
    });

    await logAudit({
      actorId: user.id,
      action: "LOGIN_SUCCESS",
      targetType: "User",
      targetId: user.id,
    });

    return NextResponse.json({
      ok: true,
      role: user.role,
      profileStatus: user.profile?.profileStatus ?? "PENDING",
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hmacLookup } from "@/lib/crypto";
import { normalizePhoneForHash, toWesternDigits } from "@/lib/myanmar-utils";
import { checkRateLimit } from "@/lib/rate-limit";

// Public "am I already in the directory?" check, by phone number only.
// Privacy: the answer is only a status (VERIFIED / PENDING /
// NEEDS_CORRECTION / NOT_FOUND) plus — when the number is listed — the
// name, so the person can confirm the record is really theirs. No
// address or contact details are ever shown, and the submitted phone
// number is never stored or logged. The lookup uses the HMAC hash, the
// same way login does, so the number itself is never decrypted or
// compared in plain text.
export async function POST(req: NextRequest) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = checkRateLimit(`check-membership:${ip}`, 10, 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: `ကြိုးစားမှု အကြိမ်ရေ များနေပါသည်။ ${rl.retryAfterSeconds} စက္ကန့်အကြာမှ ပြန်ကြိုးစားပါ။`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const rawPhone = toWesternDigits(String(body.phone || "")).trim();
    const digits = rawPhone.replace(/[^0-9]/g, "");
    if (digits.length < 9 || digits.length > 15) {
      return NextResponse.json(
        { error: "ဖုန်းနံပါတ် မှန်ကန်စွာ ထည့်သွင်းပါ။" },
        { status: 400 }
      );
    }

    const profile = await prisma.alumniProfile.findFirst({
      where: {
        phoneLookupHash: hmacLookup(normalizePhoneForHash(rawPhone)),
      },
      select: { profileStatus: true, fullName: true },
    });

    if (!profile) {
      return NextResponse.json({ status: "NOT_FOUND" });
    }

    // HIDDEN / MERGED / REJECTED profiles are not active directory
    // entries, so they answer the same as "not found".
    if (
      profile.profileStatus === "VERIFIED" ||
      profile.profileStatus === "PENDING" ||
      profile.profileStatus === "NEEDS_CORRECTION"
    ) {
      const rawName = (profile.fullName || "").trim();
      const chars = Array.from(rawName);
      const maskedName =
        chars.length <= 3
          ? chars.length > 0
            ? `${chars[0]}***`
            : undefined
          : `${chars.slice(0, 3).join("")}***${chars[chars.length - 1]}`;
      return NextResponse.json({
        status: profile.profileStatus,
        name: maskedName,
      });
    }
    return NextResponse.json({ status: "NOT_FOUND" });
  } catch {
    return NextResponse.json(
      { error: "စစ်ဆေးရာတွင် အမှားအယွင်း ဖြစ်ပွားပါသည်။" },
      { status: 500 }
    );
  }
}

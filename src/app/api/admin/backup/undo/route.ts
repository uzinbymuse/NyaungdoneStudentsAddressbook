import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { undoLastRestore } from "@/lib/backup";

function isMissingTable(err: unknown): boolean {
  return (err as { code?: string })?.code === "P2021";
}

/** Undo the last restore (restores the safety snapshot, passwords kept). */
export async function POST() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin သာ လုပ်ဆောင်နိုင်ပါသည်။" }, { status: 403 });
  }

  const rl = checkRateLimit(`backup-undo:${session.userId}`, 5, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `ကြိုးစားမှု များနေပါသည်။ ${rl.retryAfterSeconds} စက္ကန့်အကြာမှ ပြန်ကြိုးစားပါ။` },
      { status: 429 }
    );
  }

  try {
    const result = await undoLastRestore(session.userId);
    await logAudit({
      actorId: session.userId,
      action: "RESTORE_UNDONE",
      targetType: "Backup",
      details: { counts: result.counts, restoredFrom: result.restoredFrom },
    });
    return NextResponse.json({
      counts: result.counts,
      snapshotAt: result.snapshotAt,
      restoredFrom: result.restoredFrom,
    });
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json(
        { error: "BackupSnapshot table မရှိသေးပါ — PC မှာ `npx prisma db push` တစ်ခါ လုပ်ပေးပါ။" },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Undo လုပ်မရပါ။" },
      { status: 400 }
    );
  }
}

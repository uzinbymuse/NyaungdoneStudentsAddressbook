import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { toWesternDigits } from "@/lib/myanmar-utils";
import { isValidTempPin } from "@/lib/excel-import";
import { applyRestore, buildBackupData } from "@/lib/backup";
import {
  MAX_BACKUP_FILE_BYTES,
  validateBackupData,
} from "@/lib/backup-format";

function isMissingTable(err: unknown): boolean {
  return (err as { code?: string })?.code === "P2021";
}

const DB_PUSH_MSG =
  "BackupSnapshot table မရှိသေးပါ — PC မှာ `npx prisma db push` တစ်ခါ လုပ်ပေးပါ။";

/** Download a full backup (.json). No password hashes are included. */
export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin သာ လုပ်ဆောင်နိုင်ပါသည်။" }, { status: 403 });
  }
  const data = await buildBackupData(prisma, { includeSecrets: false });
  await logAudit({
    actorId: session.userId,
    action: "BACKUP_EXPORTED",
    targetType: "Backup",
    details: { counts: data.counts },
  });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="ndaddbook-backup-${stamp}.json"`,
    },
  });
}

/**
 * POST form fields: step=preview|confirm, file (.json backup), tempPin
 * (6 digits, required for confirm — restored accounts log in with it
 * and must change it on first login).
 */
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin သာ လုပ်ဆောင်နိုင်ပါသည်။" }, { status: 403 });
  }

  const rl = checkRateLimit(`backup:${session.userId}`, 10, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `ကြိုးစားမှု များနေပါသည်။ ${rl.retryAfterSeconds} စက္ကန့်အကြာမှ ပြန်ကြိုးစားပါ။` },
      { status: 429 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Form data ဖတ်မရပါ။" }, { status: 400 });
  }
  const step = String(form.get("step") || "");
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Backup (.json) ဖိုင် ရွေးပါ။" }, { status: 400 });
  }
  if (file.size > MAX_BACKUP_FILE_BYTES) {
    return NextResponse.json({ error: "ဖိုင်က 5MB ထက် ကြီးနေပါသည်။" }, { status: 400 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return NextResponse.json({ error: "JSON ဖိုင် မမှန်ပါ — parse လုပ်မရပါ။" }, { status: 400 });
  }

  let validated;
  try {
    validated = validateBackupData(parsed);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Backup ဖိုင် မမှန်ပါ။" },
      { status: 400 }
    );
  }
  const { data, issues } = validated;

  if (step === "preview") {
    return NextResponse.json({
      exportedAt: data.exportedAt,
      counts: data.counts,
      issues,
    });
  }
  if (step !== "confirm") {
    return NextResponse.json({ error: "Unknown step" }, { status: 400 });
  }

  const tempPin = toWesternDigits(String(form.get("tempPin") || ""));
  if (!isValidTempPin(tempPin)) {
    return NextResponse.json({ error: "ယာယီ PIN ကို ဂဏန်း ၆ လုံး ထည့်ပါ။" }, { status: 400 });
  }

  try {
    const result = await applyRestore(data, {
      adminId: session.userId,
      tempPin,
      keepPasswords: false,
      snapshotFirst: true,
    });
    await logAudit({
      actorId: session.userId,
      action: "RESTORE_COMPLETED",
      targetType: "Backup",
      details: { counts: result.counts, snapshotAt: result.snapshotAt },
    });
    return NextResponse.json({
      counts: result.counts,
      snapshotAt: result.snapshotAt,
    });
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ error: DB_PUSH_MSG }, { status: 503 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Restore လုပ်မရပါ။" },
      { status: 400 }
    );
  }
}

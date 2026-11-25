import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, verifyPassword } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { toWesternDigits } from "@/lib/myanmar-utils";
import { isValidTempPin } from "@/lib/excel-import";
import { applyRestore, buildBackupData } from "@/lib/backup";
import {
  decryptBackupFile,
  encryptBackupFile,
  isEncryptedBackup,
} from "@/lib/backup-crypto";
import {
  MAX_BACKUP_FILE_BYTES,
  validateBackupData,
} from "@/lib/backup-format";

function isMissingTable(err: unknown): boolean {
  return (err as { code?: string })?.code === "P2021";
}

const DB_PUSH_MSG =
  "BackupSnapshot table မရှိသေးပါ — PC မှာ `npx prisma db push` တစ်ခါ လုပ်ပေးပါ။";

/**
 * Download an ENCRYPTED backup (JSON body: { step: "download", password }).
 * The password must be the admin's CURRENT login password — it is
 * verified against the stored bcrypt hash, then used as the encryption
 * key (scrypt + AES-256-GCM). The file contains password hashes, so a
 * restore from it keeps every account's own PIN.
 */
async function handleDownload(req: NextRequest, session: { userId: string }) {
  const rl = checkRateLimit(`backup-dl:${session.userId}`, 10, 60 * 1000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `ကြိုးစားမှု များနေပါသည်။ ${rl.retryAfterSeconds} စက္ကန့်အကြာမှ ပြန်ကြိုးစားပါ။` },
      { status: 429 }
    );
  }

  let body: { password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request မမှန်ပါ။" }, { status: 400 });
  }
  const password = String(body.password || "");
  if (!password) {
    return NextResponse.json({ error: "Admin စကားဝှက် ထည့်ပါ။" }, { status: 400 });
  }

  const adminUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { passwordHash: true },
  });
  if (!adminUser || !(await verifyPassword(password, adminUser.passwordHash))) {
    return NextResponse.json({ error: "Admin စကားဝှက် မှားနေပါသည်။" }, { status: 400 });
  }

  const data = await buildBackupData(prisma, { includeSecrets: true });
  const envelope = encryptBackupFile(JSON.stringify(data), password);
  await logAudit({
    actorId: session.userId,
    action: "BACKUP_EXPORTED",
    targetType: "Backup",
    details: { counts: data.counts, encrypted: true },
  });
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return new NextResponse(JSON.stringify(envelope, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="ndaddbook-backup-${stamp}.enc.json"`,
    },
  });
}

/**
 * POST form fields: step=preview|confirm, file (backup .json — encrypted
 * or an old plain file), adminPassword (required for encrypted files:
 * the admin password from WHEN THE BACKUP WAS MADE), tempPin (6 digits,
 * required at confirm only for old plain files — restored accounts log
 * in with it and must change it on first login).
 */
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin သာ လုပ်ဆောင်နိုင်ပါသည်။" }, { status: 403 });
  }

  // JSON body = encrypted-download request; anything else = restore.
  if (req.headers.get("content-type")?.includes("application/json")) {
    return handleDownload(req, session);
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

  // Encrypted file: decrypt with the admin password from when the
  // backup was made (NOT necessarily the current password).
  let encrypted = false;
  if (isEncryptedBackup(parsed)) {
    encrypted = true;
    const adminPassword = String(form.get("adminPassword") || "");
    try {
      parsed = JSON.parse(decryptBackupFile(parsed, adminPassword));
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Backup ဖိုင် ဖွင့်မရပါ။" },
        { status: 400 }
      );
    }
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
  // PINs survive the restore exactly when every account in the file
  // carries its password hash (always true for encrypted backups).
  const pinsPreserved =
    data.users.length > 0 && data.users.every((u) => Boolean(u.passwordHash));

  if (step === "preview") {
    return NextResponse.json({
      exportedAt: data.exportedAt,
      counts: data.counts,
      issues,
      encrypted,
      pinsPreserved,
    });
  }
  if (step !== "confirm") {
    return NextResponse.json({ error: "Unknown step" }, { status: 400 });
  }

  let tempPin: string | undefined;
  if (!pinsPreserved) {
    tempPin = toWesternDigits(String(form.get("tempPin") || ""));
    if (!isValidTempPin(tempPin)) {
      return NextResponse.json({ error: "ယာယီ PIN ကို ဂဏန်း ၆ လုံး ထည့်ပါ။" }, { status: 400 });
    }
  }

  try {
    const result = await applyRestore(data, {
      adminId: session.userId,
      tempPin,
      keepPasswords: pinsPreserved,
      snapshotFirst: true,
    });
    await logAudit({
      actorId: session.userId,
      action: "RESTORE_COMPLETED",
      targetType: "Backup",
      details: {
        counts: result.counts,
        snapshotAt: result.snapshotAt,
        encrypted,
        pinsPreserved,
      },
    });
    return NextResponse.json({
      counts: result.counts,
      snapshotAt: result.snapshotAt,
      pinsPreserved,
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

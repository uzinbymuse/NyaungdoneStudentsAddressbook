import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, hashPassword } from "@/lib/auth";
import { decryptField, encryptField } from "@/lib/crypto";
import { buildXlsx, parseXlsx } from "@/lib/xlsx-mini";
import {
  IMPORT_COLUMNS,
  MAX_IMPORT_FILE_BYTES,
  MAX_IMPORT_ROWS,
  TEMP_PIN_VALIDITY_DAYS,
  isValidTempPin,
  parseImportSheet,
  templateHeaders,
  type ImportRowResult,
  type ValidImportRow,
} from "@/lib/excel-import";
import { COUNTRIES, MYANMAR_REGIONS } from "@/lib/mimu-locations";
import { DORMITORY_OTHER } from "@/lib/dormitories";
import { maskPhone, toWesternDigits } from "@/lib/myanmar-utils";
import { checkRateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

const TEMPLATE_INSTRUCTIONS: string[][] = [
  ["အညွှန်း — စာအုပ်ဟောင်း Excel Import"],
  [""],
  ["၁။ 'အချက်အလက်' စာရွက်မှာ ခေါင်းစဉ် (*) ပါတဲ့ ကော်လံတွေကို မဖြစ်မနေ ဖြည့်ပါ။"],
  ["၂။ ဖုန်းနံပါတ်ကို Text အနေနဲ့ ရိုက်ပါ (မဟုတ်ရင် 0 ပျောက်တတ်ပါတယ်)။"],
  ["၃။ ရဟန်း/လူ ကော်လံမှာ 'ရဟန်း' (သို့) 'လူ' လို့ ရေးပါ။"],
  ["၄။ နိုင်ငံ မဖြည့်ရင် မြန်မာ (ပြည်တွင်း) လို့ သတ်မှတ်ပါတယ်။"],
  ["၅။ ပြည်တွင်းဆို တိုင်း/ပြည်နယ် မဖြစ်မနေ ရွေးပါ။"],
  ["၆။ သွင်းပြီးသား လူတွေက ကိုယ့်ဖုန်းနံပါတ် + Admin ပေးတဲ့ ယာယီ PIN နဲ့ Login ဝင်ပြီး၊"],
  ["    ပထမအကြိမ်မှာ PIN အသစ် မဖြစ်မနေ ပြောင်းရပါမယ် (ယာယီ PIN သက်တမ်း ၆၀ ရက်)။"],
  ["၇။ ဖုန်းနံပါတ် ထပ်နေတဲ့ အတန်းတွေကို မသွင်းပါ (စနစ်ထဲမှာ ရှိပြီးသား လူများ)။"],
  ["၈။ ရဟန်း/လူ၊ ကျောင်းဆောင်၊ နိုင်ငံ၊ တိုင်း/ပြည်နယ်၊ မြို့နယ်/မြို့ ကော်လံတွေမှာ မြှားလေးကို နှိပ်ပြီး စာရင်းထဲက ရွေးပါ (Web ဖောင်မှာပါတဲ့ ရွေးချယ်စရာတွေနဲ့ အတူတူပါ)။ မြို့နယ်စာရင်းမှာ တိုင်းအားလုံးရဲ့ မြို့နယ်တွေ ပါဝင်ပြီး၊ ကိုယ့်တိုင်းနဲ့ ကိုက်တဲ့ မြို့နယ်ကို ရွေးပါ။"],
  ["၉။ စာရင်းထဲမှာ မပါတဲ့ အမည်ကို ရိုက်ထည့်လို့လည်း ရပါတယ် — သွင်းခါနီး စစ်ဆေးတဲ့အချိန်မှာ မှားနေရင် ပြပေးပါမယ်။"],
];

const LISTS_SHEET = "Lists";

/**
 * The downloadable template: the data sheet (header row only) with
 * dropdown lists on the columns that are dropdowns on the web form —
 * monk/lay, dormitory, country, region, township — plus a hidden
 * "Lists" sheet holding the option values. Long lists live on the
 * hidden sheet because an inline list is limited to 255 characters;
 * the dormitory list is read from the DB at download time so it
 * always matches the admin panel.
 */
async function templateWorkbook(): Promise<Buffer> {
  const countries = COUNTRIES.map((c) => c.nameMm);
  const regions = Object.keys(MYANMAR_REGIONS);
  const townshipSet = new Set<string>();
  for (const region of regions) {
    for (const ts of MYANMAR_REGIONS[region]) townshipSet.add(ts);
  }
  const townships = [...townshipSet];
  const dorms = await prisma.dormitory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { name: true },
  });
  const dormitories =
    dorms.length > 0 ? [...dorms.map((d) => d.name), DORMITORY_OTHER] : [];

  const listRows: string[][] = [
    ["နိုင်ငံ", "တိုင်း/ပြည်နယ်", "မြို့နယ်", "ကျောင်းဆောင်"],
  ];
  const maxLen = Math.max(
    countries.length,
    regions.length,
    townships.length,
    dormitories.length
  );
  for (let i = 0; i < maxLen; i++) {
    listRows.push([
      countries[i] ?? "",
      regions[i] ?? "",
      townships[i] ?? "",
      dormitories[i] ?? "",
    ]);
  }
  const lastRow = MAX_IMPORT_ROWS + 1; // header row 1 + up to 1000 data rows
  const range = (col: string, n: number) =>
    `${LISTS_SHEET}!$${col}$2:$${col}$${n + 1}`;
  const validations = [
    { sqref: `B2:B${lastRow}`, formula1: `"ရဟန်း,လူ"` },
    { sqref: `H2:H${lastRow}`, formula1: range("A", countries.length) },
    { sqref: `I2:I${lastRow}`, formula1: range("B", regions.length) },
    { sqref: `J2:J${lastRow}`, formula1: range("C", townships.length) },
    ...(dormitories.length > 0
      ? [{ sqref: `E2:E${lastRow}`, formula1: range("D", dormitories.length) }]
      : []),
  ];

  return buildXlsx([
    {
      name: "အချက်အလက်",
      widths: IMPORT_COLUMNS.map(() => 22),
      rows: [templateHeaders()],
      validations,
    },
    { name: "အညွှန်း", widths: [110], rows: TEMPLATE_INSTRUCTIONS },
    {
      name: LISTS_SHEET,
      widths: [22, 22, 22, 22],
      rows: listRows,
      hidden: true,
    },
  ]);
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const action = req.nextUrl.searchParams.get("action");

  if (action === "template") {
    const buffer = await templateWorkbook();
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          'attachment; filename="nyaungdon-alumni-import-template.xlsx"',
      },
    });
  }

  if (action === "pending") {
    const users = await prisma.user.findMany({
      where: { passwordIsTemporary: true },
      include: { profile: { select: { alumniCode: true, fullName: true, phonePrimaryEnc: true } } },
      orderBy: { createdAt: "desc" },
    });
    const now = Date.now();
    return NextResponse.json({
      pending: users.map((u) => {
        const phone = decryptField(u.profile?.phonePrimaryEnc);
        return {
          alumniCode: u.profile?.alumniCode || "-",
          fullName: u.profile?.fullName || "-",
          phoneMasked: phone ? maskPhone(phone) : "-",
          createdAt: u.createdAt.toISOString(),
          expiresAt: u.tempPasswordExpiresAt?.toISOString() || null,
          daysLeft: u.tempPasswordExpiresAt
            ? Math.max(0, Math.ceil((u.tempPasswordExpiresAt.getTime() - now) / 86400000))
            : null,
        };
      }),
    });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

interface CheckedRow {
  result: ImportRowResult;
  existingCode?: string;
}

/** Re-parse the uploaded file and mark rows that already exist in the DB. */
async function parseAndCheck(file: File): Promise<{
  headerErrors: string[];
  checked: CheckedRow[];
} | { error: string; status: number }> {
  if (file.size > MAX_IMPORT_FILE_BYTES) {
    return { error: "ဖိုင် အရွယ်အစား 5MB ထက် မပိုပါနဲ့။", status: 400 };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length < 4 || buffer.toString("ascii", 0, 2) !== "PK") {
    return { error: "xlsx ဖိုင် မဟုတ်ပါ။ Template ကို ဒေါင်းလုဒ်လုပ်ပြီး ဖြည့်ပါ။", status: 400 };
  }
  let sheetRows: string[][];
  try {
    const sheets = parseXlsx(buffer);
    sheetRows = sheets[0] || [];
  } catch {
    return { error: "xlsx ဖိုင်ကို ဖတ်လို့ မရပါ။ Template အတိုင်း ဖြည့်ထားခြင်း ရှိ/မရှိ စစ်ပါ။", status: 400 };
  }
  const parsed = parseImportSheet(sheetRows);
  if (parsed.headerErrors.length > 0) {
    return { headerErrors: parsed.headerErrors, checked: [] };
  }

  const okRows = parsed.results.filter((r) => r.status === "ok" && r.data);
  const hashes = okRows.map((r) => r.data!.phoneLookupHash);
  const emails = okRows.map((r) => r.data!.email).filter((e): e is string => !!e);

  const existingByHash = new Map<string, string>();
  if (hashes.length > 0) {
    const [users, profiles] = await Promise.all([
      prisma.user.findMany({
        where: { loginPhoneHash: { in: hashes } },
        select: { loginPhoneHash: true, profile: { select: { alumniCode: true } } },
      }),
      prisma.alumniProfile.findMany({
        where: { phoneLookupHash: { in: hashes } },
        select: { phoneLookupHash: true, alumniCode: true },
      }),
    ]);
    for (const u of users) {
      if (u.loginPhoneHash) existingByHash.set(u.loginPhoneHash, u.profile?.alumniCode || "ရှိပြီး");
    }
    for (const p of profiles) {
      if (!existingByHash.has(p.phoneLookupHash)) {
        existingByHash.set(p.phoneLookupHash, p.alumniCode);
      }
    }
  }
  const existingEmails = new Set<string>();
  if (emails.length > 0) {
    const users = await prisma.user.findMany({
      where: { loginEmail: { in: emails } },
      select: { loginEmail: true },
    });
    for (const u of users) if (u.loginEmail) existingEmails.add(u.loginEmail);
  }

  const checked: CheckedRow[] = parsed.results.map((result) => {
    if (result.status !== "ok" || !result.data) return { result };
    const code = existingByHash.get(result.data.phoneLookupHash);
    if (code) {
      return {
        result: {
          ...result,
          status: "error",
          errors: [`ဤဖုန်းနံပါတ်ဖြင့် စာရင်းသွင်းပြီးသား ဖြစ်နေပါသည် (${code})`],
          data: null,
        },
        existingCode: code,
      };
    }
    if (result.data.email && existingEmails.has(result.data.email)) {
      return {
        result: {
          ...result,
          status: "error",
          errors: ["ဤအီးမေးလ်ဖြင့် စာရင်းသွင်းပြီးသား ဖြစ်နေပါသည်။"],
          data: null,
        },
      };
    }
    return { result };
  });

  return { headerErrors: [], checked };
}

function nextAlumniCode(lastCode: string | null, offset: number): string {
  const match = lastCode?.match(/ND-(\d+)/);
  const num = (match ? parseInt(match[1], 10) : 0) + offset;
  return `ND-${String(num).padStart(4, "0")}`;
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  const rl = checkRateLimit(`import-excel:${admin.userId}`, 5, 60 * 1000);
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
    return NextResponse.json({ error: "ဖိုင် ပေးပို့မှု မမှန်ပါ။" }, { status: 400 });
  }
  const step = String(form.get("step") || "");
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "xlsx ဖိုင် ရွေးပါ။" }, { status: 400 });
  }

  const parsed = await parseAndCheck(file);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }
  if (parsed.headerErrors.length > 0) {
    return NextResponse.json({ error: parsed.headerErrors.join(" "), headerErrors: parsed.headerErrors }, { status: 400 });
  }

  const checked = parsed.checked;
  const valid = checked.filter((c) => c.result.status === "ok" && c.result.data);
  const duplicates = checked.filter((c) => c.existingCode).length;
  const errors = checked.filter((c) => c.result.status === "error" && !c.existingCode).length;

  if (step === "preview") {
    return NextResponse.json({
      ok: true,
      summary: {
        total: checked.length,
        valid: valid.length,
        errors,
        duplicates,
      },
      rows: checked.map((c) => ({
        rowNumber: c.result.rowNumber,
        fullName: c.result.fullName,
        phonePrimary: c.result.phonePrimary,
        status: c.existingCode ? "duplicate" : c.result.status,
        errors: c.result.errors,
        existingCode: c.existingCode || null,
      })),
    });
  }

  if (step !== "confirm") {
    return NextResponse.json({ error: "Unknown step" }, { status: 400 });
  }

  const tempPin = toWesternDigits(String(form.get("tempPin") || ""));
  if (!isValidTempPin(tempPin)) {
    return NextResponse.json({ error: "ယာယီ PIN ကို ဂဏန်း ၆ လုံး ထည့်ပါ။" }, { status: 400 });
  }
  if (valid.length === 0) {
    return NextResponse.json({ error: "သွင်းလို့ရတဲ့ အတန်း မရှိပါ။" }, { status: 400 });
  }

  const tempPinHash = await hashPassword(tempPin);
  const expiresAt = new Date(Date.now() + TEMP_PIN_VALIDITY_DAYS * 86400000);
  const lastProfile = await prisma.alumniProfile.findFirst({
    orderBy: { alumniCode: "desc" },
    select: { alumniCode: true },
  });
  const lastCode = lastProfile?.alumniCode || null;

  const created: Array<{ alumniCode: string; fullName: string }> = [];
  const failed: Array<{ rowNumber: number; fullName: string; reason: string }> = [];
  let codeOffset = 1;

  for (const { result } of valid) {
    const data = result.data as ValidImportRow;
    const alumniCode = nextAlumniCode(lastCode, codeOffset);
    codeOffset++;
    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            loginPhoneHash: data.phoneLookupHash,
            loginEmail: data.email,
            passwordHash: tempPinHash,
            passwordIsTemporary: true,
            tempPasswordExpiresAt: expiresAt,
            role: "MEMBER",
            accountStatus: "ACTIVE",
          },
        });
        await tx.alumniProfile.create({
          data: {
            userId: user.id,
            alumniCode,
            monkOrLay: data.monkOrLay,
            fullName: data.fullName,
            normalizedName: data.normalizedName,
            birthplace: data.birthplace,
            degreeName: data.degreeName,
            batchYearMm: data.batchYearMm,
            batchYearDisplay: data.batchYearDisplay,
            dormitory: data.dormitory,
            currentMonastery: data.currentMonastery,
            currentRoleOrMonastery: data.currentRoleOrMonastery,
            countryCode: data.countryCode,
            countryName: data.countryName,
            isDomestic: data.isDomestic,
            region: data.region,
            township: data.township,
            city: data.city,
            wardOrVillage: data.wardOrVillage,
            phonePrimaryEnc: encryptField(data.phonePrimary)!,
            phoneLookupHash: data.phoneLookupHash,
            phoneSecondaryEnc: encryptField(data.phoneSecondary),
            viberEnc: encryptField(data.viber),
            telegramEnc: encryptField(data.telegram),
            emailEnc: encryptField(data.email),
            facebookEnc: encryptField(data.facebook),
            showPhoneWeb: false,
            showViberTgWeb: false,
            showEmailFbWeb: false,
            showWardWeb: true,
            showPhonePrint: true,
            showWardPrint: true,
            profileStatus: "VERIFIED",
            verifiedById: admin.userId,
            verifiedAt: new Date(),
            consents: {
              create: [
                { consentType: "POLICY_AGREED", granted: true },
                { consentType: "WEB_DIRECTORY", granted: true },
                { consentType: "BOOK_PUBLICATION", granted: true },
                { consentType: "BOOK_PHONE", granted: true },
              ],
            },
          },
        });
      });
      created.push({ alumniCode, fullName: data.fullName });
    } catch (err) {
      console.error("Excel import row failed:", result.rowNumber, err);
      failed.push({
        rowNumber: result.rowNumber,
        fullName: data.fullName,
        reason: "သိမ်းဆည်းရာတွင် အမှားအယွင်း ဖြစ်ပွားပါသည်။",
      });
    }
  }

  await logAudit({
    actorId: admin.userId,
    action: "IMPORT_EXCEL",
    targetType: "AlumniProfile",
    details: {
      createdCount: created.length,
      skippedDuplicates: duplicates,
      failedCount: failed.length,
      tempPinExpiresAt: expiresAt.toISOString(),
    },
  });

  return NextResponse.json({
    ok: true,
    createdCount: created.length,
    created,
    skippedDuplicates: duplicates,
    failed,
  });
}

// Backup file format (pure — no Prisma/crypto imports, so it can be
// unit-tested standalone). A backup is a versioned JSON document holding
// every row needed to rebuild the directory: dormitories, users,
// profiles (contacts in plaintext), consents, correction/contact
// requests and print-freeze publications. Audit logs are deliberately
// NOT included — a restore must never erase history.
//
// Password hashes are NEVER written to a downloaded backup file (a
// 6-digit PIN hash is brute-forceable if the file leaks). Restoring
// from a file therefore gives every account a fresh temporary PIN
// chosen by the admin. The automatic safety snapshot stored in the
// database DOES keep hashes, so Undo restores accounts exactly.

export const BACKUP_VERSION = 1;
export const BACKUP_APP = "ndaddbook";
export const MAX_BACKUP_FILE_BYTES = 5 * 1024 * 1024;

export interface BackupCounts {
  dormitories: number;
  users: number;
  profiles: number;
  consents: number;
  correctionRequests: number;
  contactRequests: number;
  publications: number;
  // Index signature so a counts object is a valid Prisma InputJsonObject
  // (used as logAudit details) — every value here is a number.
  [key: string]: number;
}

export interface BackupDormitory {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BackupUser {
  id: string;
  loginPhoneHash: string | null;
  loginEmail: string | null;
  // Present only in DB snapshots, never in downloaded files.
  passwordHash?: string;
  passwordIsTemporary: boolean;
  tempPasswordExpiresAt: string | null;
  magicTokenHash?: string | null;
  magicTokenExpiresAt?: string | null;
  role: string;
  accountStatus: string;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackupProfile {
  id: string;
  userId: string | null;
  alumniCode: string;
  monkOrLay: string;
  fullName: string;
  normalizedName: string;
  formerName: string | null;
  degreeName: string | null;
  batchYearMm: number | null;
  batchYearDisplay: string;
  batchYearApprox: boolean;
  university: string;
  dormitory: string;
  stayPeriod: string | null;
  currentRoleOrMonastery: string;
  currentMonastery: string | null;
  messageToAlumni: string | null;
  photoUrl: string | null;
  countryCode: string;
  countryName: string;
  isDomestic: boolean;
  region: string | null;
  township: string | null;
  city: string;
  wardOrVillage: string | null;
  // Contacts in plaintext (decrypted at export, re-encrypted at restore).
  phonePrimary: string;
  phoneSecondary: string | null;
  viber: string | null;
  telegram: string | null;
  email: string | null;
  facebook: string | null;
  phoneLookupHash: string;
  showPhoneWeb: boolean;
  showViberTgWeb: boolean;
  showEmailFbWeb: boolean;
  showWardWeb: boolean;
  showPhonePrint: boolean;
  showWardPrint: boolean;
  adminNote: string | null;
  referrerName: string | null;
  bestContactTime: string | null;
  printExclusionNote: string | null;
  profileStatus: string;
  mergedIntoId: string | null;
  verifiedById: string | null;
  verifiedAt: string | null;
  lastConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackupConsent {
  id: string;
  alumniId: string;
  consentType: string;
  granted: boolean;
  policyVersion: string;
  recordedAt: string;
}

export interface BackupCorrectionRequest {
  id: string;
  alumniId: string;
  submittedById: string;
  proposedData: unknown;
  reason: string | null;
  status: string;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface BackupContactRequest {
  id: string;
  senderId: string;
  receiverAlumniId: string;
  message: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface BackupPublication {
  id: string;
  title: string;
  frozenAt: string;
  snapshotCount: number;
  snapshotData: unknown;
  createdById: string;
  createdAt: string;
}

export interface BackupData {
  version: number;
  app: string;
  exportedAt: string;
  counts: BackupCounts;
  dormitories: BackupDormitory[];
  users: BackupUser[];
  profiles: BackupProfile[];
  consents: BackupConsent[];
  correctionRequests: BackupCorrectionRequest[];
  contactRequests: BackupContactRequest[];
  publications: BackupPublication[];
}

export function emptyCounts(): BackupCounts {
  return {
    dormitories: 0,
    users: 0,
    profiles: 0,
    consents: 0,
    correctionRequests: 0,
    contactRequests: 0,
    publications: 0,
  };
}

export function countBackup(data: BackupData): BackupCounts {
  return {
    dormitories: data.dormitories.length,
    users: data.users.length,
    profiles: data.profiles.length,
    consents: data.consents.length,
    correctionRequests: data.correctionRequests.length,
    contactRequests: data.contactRequests.length,
    publications: data.publications.length,
  };
}

// --- validation helpers ---

function fail(msg: string): never {
  throw new Error(msg);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function reqStr(row: Record<string, unknown>, field: string, where: string): string {
  const v = row[field];
  if (typeof v !== "string" || v.length === 0) fail(`${where}: ${field} ပျောက်နေသည် သို့မဟုတ် မမှန်ပါ။`);
  return v;
}

function optStr(row: Record<string, unknown>, field: string, where: string): string | null {
  const v = row[field];
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") fail(`${where}: ${field} စာသား ဖြစ်ရမည်။`);
  return v;
}

function reqNum(row: Record<string, unknown>, field: string, where: string): number {
  const v = row[field];
  if (typeof v !== "number" || !Number.isFinite(v)) fail(`${where}: ${field} ဂဏန်း ဖြစ်ရမည်။`);
  return v;
}

function optNum(row: Record<string, unknown>, field: string, where: string): number | null {
  const v = row[field];
  if (v === null || v === undefined) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) fail(`${where}: ${field} ဂဏန်း ဖြစ်ရမည်။`);
  return v;
}

function reqBool(row: Record<string, unknown>, field: string, where: string): boolean {
  const v = row[field];
  if (typeof v !== "boolean") fail(`${where}: ${field} true/false ဖြစ်ရမည်။`);
  return v;
}

function reqDate(row: Record<string, unknown>, field: string, where: string): string {
  const v = row[field];
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) fail(`${where}: ${field} ရက်စွဲ မမှန်ပါ။`);
  return v;
}

function optDate(row: Record<string, unknown>, field: string, where: string): string | null {
  const v = row[field];
  if (v === null || v === undefined) return null;
  if (typeof v !== "string" || Number.isNaN(Date.parse(v))) fail(`${where}: ${field} ရက်စွဲ မမှန်ပါ။`);
  return v;
}

function reqEnum(
  row: Record<string, unknown>,
  field: string,
  allowed: readonly string[],
  where: string
): string {
  const v = reqStr(row, field, where);
  if (!allowed.includes(v)) fail(`${where}: ${field} တန်ဖိုး '${v}' မမှန်ပါ။`);
  return v;
}

function reqArr(v: unknown, field: string): Record<string, unknown>[] {
  if (!Array.isArray(v)) fail(`Backup ဖိုင်: ${field} စာရင်း ပျောက်နေသည်။`);
  for (const row of v) {
    if (!isObj(row)) fail(`Backup ဖိုင်: ${field} ထဲတွင် မမှန်သော အတန်း ပါသည်။`);
  }
  return v as Record<string, unknown>[];
}

const USER_ROLES = ["MEMBER", "ADMIN"] as const;
const ACCOUNT_STATUSES = ["PENDING", "ACTIVE", "SUSPENDED"] as const;
const MONK_OR_LAY = ["MONK", "LAY", "NUN", "OTHER"] as const;
const PROFILE_STATUSES = ["PENDING", "VERIFIED", "NEEDS_CORRECTION", "HIDDEN", "MERGED", "REJECTED"] as const;
const CONSENT_TYPES = ["POLICY_AGREED", "WEB_DIRECTORY", "BOOK_PUBLICATION", "BOOK_PHONE"] as const;
const CORRECTION_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
const CONTACT_STATUSES = ["PENDING", "ACCEPTED", "DECLINED"] as const;

/**
 * Validate a parsed backup JSON document. Throws a Burmese error on any
 * fatal problem (wrong file, wrong version, bad row, broken reference).
 * Returns the typed data plus non-fatal warnings for the preview step.
 */
export function validateBackupData(value: unknown): { data: BackupData; issues: string[] } {
  if (!isObj(value)) fail("Backup ဖိုင် မမှန်ပါ — JSON object ဖြစ်ရမည်။");
  if (value.app !== BACKUP_APP) fail("ဤဖိုင်သည် ndaddbook backup မဟုတ်ပါ။");
  if (value.version !== BACKUP_VERSION) {
    fail(`Backup version ${String(value.version)} ကို မထောက်ပံ့ပါ (လိုအပ်သည် v${BACKUP_VERSION})။`);
  }
  if (typeof value.exportedAt !== "string" || Number.isNaN(Date.parse(value.exportedAt))) {
    fail("Backup ဖိုင်: exportedAt ရက်စွဲ မမှန်ပါ။");
  }

  const issues: string[] = [];
  const seen = new Set<string>();
  const checkUnique = (id: string, where: string) => {
    if (seen.has(id)) fail(`${where}: id '${id}' ထပ်နေသည်။`);
    seen.add(id);
  };

  const dormitories: BackupDormitory[] = reqArr(value.dormitories, "dormitories").map((row, i) => {
    const where = `ကျောင်းဆောင် အတန်း ${i + 1}`;
    const id = reqStr(row, "id", where);
    checkUnique(id, where);
    return {
      id,
      name: reqStr(row, "name", where),
      sortOrder: reqNum(row, "sortOrder", where),
      isActive: reqBool(row, "isActive", where),
      createdAt: reqDate(row, "createdAt", where),
      updatedAt: reqDate(row, "updatedAt", where),
    };
  });

  const users: BackupUser[] = reqArr(value.users, "users").map((row, i) => {
    const where = `အကောင့် အတန်း ${i + 1}`;
    const id = reqStr(row, "id", where);
    checkUnique(id, where);
    return {
      id,
      loginPhoneHash: optStr(row, "loginPhoneHash", where),
      loginEmail: optStr(row, "loginEmail", where),
      passwordHash: optStr(row, "passwordHash", where) ?? undefined,
      passwordIsTemporary: reqBool(row, "passwordIsTemporary", where),
      tempPasswordExpiresAt: optDate(row, "tempPasswordExpiresAt", where),
      magicTokenHash: optStr(row, "magicTokenHash", where) ?? undefined,
      magicTokenExpiresAt: optDate(row, "magicTokenExpiresAt", where) ?? undefined,
      role: reqEnum(row, "role", USER_ROLES, where),
      accountStatus: reqEnum(row, "accountStatus", ACCOUNT_STATUSES, where),
      lastLoginAt: optDate(row, "lastLoginAt", where),
      createdAt: reqDate(row, "createdAt", where),
      updatedAt: reqDate(row, "updatedAt", where),
    };
  });

  const profiles: BackupProfile[] = reqArr(value.profiles, "profiles").map((row, i) => {
    const where = `Profile အတန်း ${i + 1}`;
    const id = reqStr(row, "id", where);
    checkUnique(id, where);
    return {
      id,
      userId: optStr(row, "userId", where),
      alumniCode: reqStr(row, "alumniCode", where),
      monkOrLay: reqEnum(row, "monkOrLay", MONK_OR_LAY, where),
      fullName: reqStr(row, "fullName", where),
      normalizedName: reqStr(row, "normalizedName", where),
      formerName: optStr(row, "formerName", where),
      degreeName: optStr(row, "degreeName", where),
      batchYearMm: optNum(row, "batchYearMm", where),
      batchYearDisplay: reqStr(row, "batchYearDisplay", where),
      batchYearApprox: reqBool(row, "batchYearApprox", where),
      university: reqStr(row, "university", where),
      dormitory: reqStr(row, "dormitory", where),
      stayPeriod: optStr(row, "stayPeriod", where),
      currentRoleOrMonastery: reqStr(row, "currentRoleOrMonastery", where),
      currentMonastery: optStr(row, "currentMonastery", where),
      messageToAlumni: optStr(row, "messageToAlumni", where),
      photoUrl: optStr(row, "photoUrl", where),
      countryCode: reqStr(row, "countryCode", where),
      countryName: reqStr(row, "countryName", where),
      isDomestic: reqBool(row, "isDomestic", where),
      region: optStr(row, "region", where),
      township: optStr(row, "township", where),
      city: reqStr(row, "city", where),
      wardOrVillage: optStr(row, "wardOrVillage", where),
      phonePrimary: reqStr(row, "phonePrimary", where),
      phoneSecondary: optStr(row, "phoneSecondary", where),
      viber: optStr(row, "viber", where),
      telegram: optStr(row, "telegram", where),
      email: optStr(row, "email", where),
      facebook: optStr(row, "facebook", where),
      phoneLookupHash: reqStr(row, "phoneLookupHash", where),
      showPhoneWeb: reqBool(row, "showPhoneWeb", where),
      showViberTgWeb: reqBool(row, "showViberTgWeb", where),
      showEmailFbWeb: reqBool(row, "showEmailFbWeb", where),
      showWardWeb: reqBool(row, "showWardWeb", where),
      showPhonePrint: reqBool(row, "showPhonePrint", where),
      showWardPrint: reqBool(row, "showWardPrint", where),
      adminNote: optStr(row, "adminNote", where),
      referrerName: optStr(row, "referrerName", where),
      bestContactTime: optStr(row, "bestContactTime", where),
      printExclusionNote: optStr(row, "printExclusionNote", where),
      profileStatus: reqEnum(row, "profileStatus", PROFILE_STATUSES, where),
      mergedIntoId: optStr(row, "mergedIntoId", where),
      verifiedById: optStr(row, "verifiedById", where),
      verifiedAt: optDate(row, "verifiedAt", where),
      lastConfirmedAt: optDate(row, "lastConfirmedAt", where),
      createdAt: reqDate(row, "createdAt", where),
      updatedAt: reqDate(row, "updatedAt", where),
    };
  });

  const consents: BackupConsent[] = reqArr(value.consents, "consents").map((row, i) => {
    const where = `Consent အတန်း ${i + 1}`;
    const id = reqStr(row, "id", where);
    checkUnique(id, where);
    return {
      id,
      alumniId: reqStr(row, "alumniId", where),
      consentType: reqEnum(row, "consentType", CONSENT_TYPES, where),
      granted: reqBool(row, "granted", where),
      policyVersion: reqStr(row, "policyVersion", where),
      recordedAt: reqDate(row, "recordedAt", where),
    };
  });

  const correctionRequests: BackupCorrectionRequest[] = reqArr(
    value.correctionRequests,
    "correctionRequests"
  ).map((row, i) => {
    const where = `ပြင်ဆင်တောင်းဆိုမှု အတန်း ${i + 1}`;
    const id = reqStr(row, "id", where);
    checkUnique(id, where);
    return {
      id,
      alumniId: reqStr(row, "alumniId", where),
      submittedById: reqStr(row, "submittedById", where),
      proposedData: row.proposedData ?? null,
      reason: optStr(row, "reason", where),
      status: reqEnum(row, "status", CORRECTION_STATUSES, where),
      reviewedById: optStr(row, "reviewedById", where),
      reviewedAt: optDate(row, "reviewedAt", where),
      createdAt: reqDate(row, "createdAt", where),
    };
  });

  const contactRequests: BackupContactRequest[] = reqArr(
    value.contactRequests,
    "contactRequests"
  ).map((row, i) => {
    const where = `ဆက်သွယ်တောင်းဆိုမှု အတန်း ${i + 1}`;
    const id = reqStr(row, "id", where);
    checkUnique(id, where);
    return {
      id,
      senderId: reqStr(row, "senderId", where),
      receiverAlumniId: reqStr(row, "receiverAlumniId", where),
      message: reqStr(row, "message", where),
      status: reqEnum(row, "status", CONTACT_STATUSES, where),
      createdAt: reqDate(row, "createdAt", where),
      updatedAt: reqDate(row, "updatedAt", where),
    };
  });

  const publications: BackupPublication[] = reqArr(value.publications, "publications").map((row, i) => {
    const where = `Publication အတန်း ${i + 1}`;
    const id = reqStr(row, "id", where);
    checkUnique(id, where);
    return {
      id,
      title: reqStr(row, "title", where),
      frozenAt: reqDate(row, "frozenAt", where),
      snapshotCount: reqNum(row, "snapshotCount", where),
      snapshotData: row.snapshotData ?? null,
      createdById: reqStr(row, "createdById", where),
      createdAt: reqDate(row, "createdAt", where),
    };
  });

  // Cross-reference checks — a restore would fail on broken FKs.
  const userIds = new Set(users.map((u) => u.id));
  const profileIds = new Set(profiles.map((p) => p.id));
  const alumniCodes = new Set<string>();
  for (const p of profiles) {
    if (alumniCodes.has(p.alumniCode)) fail(`Profile: alumniCode '${p.alumniCode}' ထပ်နေသည်။`);
    alumniCodes.add(p.alumniCode);
    if (p.userId !== null && !userIds.has(p.userId)) {
      fail(`Profile ${p.alumniCode}: ချိတ်ထားသော အကောင့် (userId) ဖိုင်ထဲတွင် မရှိပါ။`);
    }
  }
  const loginHashes = new Set<string>();
  for (const u of users) {
    if (u.loginPhoneHash && loginHashes.has(u.loginPhoneHash)) {
      fail("အကောင့်: ဖုန်း hash ထပ်နေသည်။");
    }
    if (u.loginPhoneHash) loginHashes.add(u.loginPhoneHash);
  }
  const consentKeys = new Set<string>();
  for (const c of consents) {
    if (!profileIds.has(c.alumniId)) fail("Consent: ချိတ်ထားသော profile ဖိုင်ထဲတွင် မရှိပါ။");
    const key = `${c.alumniId}:${c.consentType}`;
    if (consentKeys.has(key)) fail("Consent: ထပ်နေသော consent ပါသည်။");
    consentKeys.add(key);
  }
  for (const r of correctionRequests) {
    if (!profileIds.has(r.alumniId)) fail("ပြင်ဆင်တောင်းဆိုမှု: profile ဖိုင်ထဲတွင် မရှိပါ။");
    if (!userIds.has(r.submittedById)) fail("ပြင်ဆင်တောင်းဆိုမှု: တင်သူအကောင့် ဖိုင်ထဲတွင် မရှိပါ။");
  }
  for (const r of contactRequests) {
    if (!userIds.has(r.senderId)) fail("ဆက်သွယ်တောင်းဆိုမှု: ပေးပို့သူအကောင့် ဖိုင်ထဲတွင် မရှိပါ။");
    if (!profileIds.has(r.receiverAlumniId)) fail("ဆက်သွယ်တောင်းဆိုမှု: လက်ခံသူ profile ဖိုင်ထဲတွင် မရှိပါ။");
  }

  // Non-fatal notes for the preview step.
  const usersWithoutProfile = users.filter((u) => !profiles.some((p) => p.userId === u.id)).length;
  if (usersWithoutProfile > 0) {
    issues.push(`အကောင့် ${usersWithoutProfile} ခုတွင် profile ချိတ်မထားပါ (Admin အကောင့် အပါအဝင် ဖြစ်နိုင်သည်)။`);
  }
  const profilesWithoutUser = profiles.filter((p) => p.userId === null).length;
  if (profilesWithoutUser > 0) {
    issues.push(`Profile ${profilesWithoutUser} ခုတွင် login အကောင့် မရှိပါ (import လုပ်ထားသော စာရင်းများ) — ထိုသူများ login ဝင်လို့ မရပါ။`);
  }

  const data: BackupData = {
    version: BACKUP_VERSION,
    app: BACKUP_APP,
    exportedAt: value.exportedAt as string,
    counts: emptyCounts(),
    dormitories,
    users,
    profiles,
    consents,
    correctionRequests,
    contactRequests,
    publications,
  };
  data.counts = countBackup(data);
  return { data, issues };
}

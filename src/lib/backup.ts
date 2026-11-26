import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";
import { getHiddenContactIds } from "./hidden-contacts";
import { decryptField, encryptField } from "./crypto";
import { hashPassword } from "./auth";
import { TEMP_PIN_VALIDITY_DAYS } from "./excel-import";
import {
  BACKUP_APP,
  BACKUP_VERSION,
  countBackup,
  validateBackupData,
  type BackupCounts,
  type BackupData,
} from "./backup-format";

// The DB client used by the backup logic — the shared client, or a
// transaction client while a restore runs.
type Db = Prisma.TransactionClient | typeof prisma;

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);
const reqIso = (d: Date): string => d.toISOString();
const toDate = (s: string): Date => new Date(s);
const toOptDate = (s: string | null): Date | null => (s ? new Date(s) : null);

/**
 * Read the whole directory into a backup document. Contacts are
 * decrypted so the file is portable and human-readable.
 * includeSecrets=true is only for the in-DB safety snapshot, which
 * must restore accounts exactly (downloaded files never get hashes).
 */
export async function buildBackupData(
  db: Db,
  opts: { includeSecrets: boolean }
): Promise<BackupData> {
  const [dormitories, users, profiles, consents, correctionRequests, contactRequests, publications, hiddenIds] =
    await Promise.all([
      db.dormitory.findMany({ orderBy: { createdAt: "asc" } }),
      db.user.findMany({ orderBy: { createdAt: "asc" } }),
      // `omit` keeps the export working before `npx prisma db push`
      // adds the hideContactsWeb column; the helper returns an empty
      // set in that window.
      db.alumniProfile.findMany({ orderBy: { createdAt: "asc" }, omit: { hideContactsWeb: true } }),
      db.consent.findMany({ orderBy: { recordedAt: "asc" } }),
      db.correctionRequest.findMany({ orderBy: { createdAt: "asc" } }),
      db.contactRequest.findMany({ orderBy: { createdAt: "asc" } }),
      db.publication.findMany({ orderBy: { createdAt: "asc" } }),
      getHiddenContactIds(db),
    ]);

  const data: BackupData = {
    version: BACKUP_VERSION,
    app: BACKUP_APP,
    exportedAt: new Date().toISOString(),
    counts: {
      dormitories: 0,
      users: 0,
      profiles: 0,
      consents: 0,
      correctionRequests: 0,
      contactRequests: 0,
      publications: 0,
    },
    dormitories: dormitories.map((d) => ({
      id: d.id,
      name: d.name,
      sortOrder: d.sortOrder,
      isActive: d.isActive,
      createdAt: reqIso(d.createdAt),
      updatedAt: reqIso(d.updatedAt),
    })),
    users: users.map((u) => ({
      id: u.id,
      loginPhoneHash: u.loginPhoneHash,
      loginEmail: u.loginEmail,
      ...(opts.includeSecrets ? { passwordHash: u.passwordHash } : {}),
      passwordIsTemporary: u.passwordIsTemporary,
      tempPasswordExpiresAt: iso(u.tempPasswordExpiresAt),
      ...(opts.includeSecrets
        ? {
            magicTokenHash: u.magicTokenHash,
            magicTokenExpiresAt: iso(u.magicTokenExpiresAt),
          }
        : {}),
      role: u.role,
      accountStatus: u.accountStatus,
      lastLoginAt: iso(u.lastLoginAt),
      createdAt: reqIso(u.createdAt),
      updatedAt: reqIso(u.updatedAt),
    })),
    profiles: profiles.map((p) => ({
      id: p.id,
      userId: p.userId,
      alumniCode: p.alumniCode,
      monkOrLay: p.monkOrLay,
      fullName: p.fullName,
      normalizedName: p.normalizedName,
      formerName: p.formerName,
      birthplace: p.birthplace,
      degreeName: p.degreeName,
      batchYearMm: p.batchYearMm,
      batchYearDisplay: p.batchYearDisplay,
      batchYearApprox: p.batchYearApprox,
      university: p.university,
      dormitory: p.dormitory,
      stayPeriod: p.stayPeriod,
      currentRoleOrMonastery: p.currentRoleOrMonastery,
      currentMonastery: p.currentMonastery,
      messageToAlumni: p.messageToAlumni,
      photoUrl: p.photoUrl,
      countryCode: p.countryCode,
      countryName: p.countryName,
      isDomestic: p.isDomestic,
      region: p.region,
      township: p.township,
      city: p.city,
      wardOrVillage: p.wardOrVillage,
      phonePrimary: decryptField(p.phonePrimaryEnc) ?? "",
      phoneSecondary: decryptField(p.phoneSecondaryEnc),
      viber: decryptField(p.viberEnc),
      telegram: decryptField(p.telegramEnc),
      email: decryptField(p.emailEnc),
      facebook: decryptField(p.facebookEnc),
      phoneLookupHash: p.phoneLookupHash,
      showPhoneWeb: p.showPhoneWeb,
      showViberTgWeb: p.showViberTgWeb,
      showEmailFbWeb: p.showEmailFbWeb,
      showWardWeb: p.showWardWeb,
      showPhonePrint: p.showPhonePrint,
      showWardPrint: p.showWardPrint,
      hideContactsWeb: hiddenIds.has(p.id),
      adminNote: p.adminNote,
      referrerName: p.referrerName,
      bestContactTime: p.bestContactTime,
      printExclusionNote: p.printExclusionNote,
      profileStatus: p.profileStatus,
      mergedIntoId: p.mergedIntoId,
      verifiedById: p.verifiedById,
      verifiedAt: iso(p.verifiedAt),
      lastConfirmedAt: iso(p.lastConfirmedAt),
      createdAt: reqIso(p.createdAt),
      updatedAt: reqIso(p.updatedAt),
    })),
    consents: consents.map((c) => ({
      id: c.id,
      alumniId: c.alumniId,
      consentType: c.consentType,
      granted: c.granted,
      policyVersion: c.policyVersion,
      recordedAt: reqIso(c.recordedAt),
    })),
    correctionRequests: correctionRequests.map((r) => ({
      id: r.id,
      alumniId: r.alumniId,
      submittedById: r.submittedById,
      proposedData: r.proposedData,
      reason: r.reason,
      status: r.status,
      reviewedById: r.reviewedById,
      reviewedAt: iso(r.reviewedAt),
      createdAt: reqIso(r.createdAt),
    })),
    contactRequests: contactRequests.map((r) => ({
      id: r.id,
      senderId: r.senderId,
      receiverAlumniId: r.receiverAlumniId,
      message: r.message,
      status: r.status,
      createdAt: reqIso(r.createdAt),
      updatedAt: reqIso(r.updatedAt),
    })),
    publications: publications.map((p) => ({
      id: p.id,
      title: p.title,
      frozenAt: reqIso(p.frozenAt),
      snapshotCount: p.snapshotCount,
      snapshotData: p.snapshotData,
      createdById: p.createdById,
      createdAt: reqIso(p.createdAt),
    })),
  };
  data.counts = countBackup(data);
  return data;
}

export interface RestoreOptions {
  adminId: string;
  /** Required for restores from a downloaded file (hashes not in file). */
  tempPin?: string;
  /** True when restoring from a DB snapshot (hashes preserved). */
  keepPasswords: boolean;
  /** Save the current state as a safety snapshot first (always true for restores). */
  snapshotFirst: boolean;
}

/**
 * Replace the whole directory with a validated backup document, in one
 * transaction. IDs are preserved, so correction/contact requests and
 * audit references stay valid. Audit logs are never deleted.
 */
export async function applyRestore(
  rawData: unknown,
  opts: RestoreOptions
): Promise<{ counts: BackupCounts; snapshotAt: string | null }> {
  const { data } = validateBackupData(rawData);
  if (!opts.keepPasswords && !opts.tempPin) {
    throw new Error("Restore လုပ်ရန် ယာယီ PIN (ဂဏန်း ၆ လုံး) လိုအပ်ပါသည်။");
  }
  const tempPinHash = opts.keepPasswords
    ? null
    : await hashPassword(opts.tempPin as string);
  const tempPinExpiresAt = opts.keepPasswords
    ? null
    : new Date(Date.now() + TEMP_PIN_VALIDITY_DAYS * 86400000);

  let snapshotAt: string | null = null;
  await prisma.$transaction(async (tx) => {
    if (opts.snapshotFirst) {
      // Save the current state first — the restore can then be undone.
      const current = await buildBackupData(tx, { includeSecrets: true });
      await tx.backupSnapshot.deleteMany({});
      const snap = await tx.backupSnapshot.create({
        data: {
          createdById: opts.adminId,
          label: "restore",
          data: current as unknown as Prisma.InputJsonValue,
        },
      });
      snapshotAt = snap.createdAt.toISOString();
    }

    // Children first (FK-safe order).
    await tx.consent.deleteMany({});
    await tx.correctionRequest.deleteMany({});
    await tx.contactRequest.deleteMany({});
    await tx.alumniProfile.deleteMany({});
    await tx.user.deleteMany({});
    await tx.dormitory.deleteMany({});
    await tx.publication.deleteMany({});

    if (data.dormitories.length > 0) {
      await tx.dormitory.createMany({
        data: data.dormitories.map((d) => ({
          id: d.id,
          name: d.name,
          sortOrder: d.sortOrder,
          isActive: d.isActive,
          createdAt: toDate(d.createdAt),
          updatedAt: toDate(d.updatedAt),
        })),
      });
    }

    if (data.users.length > 0) {
      await tx.user.createMany({
        data: data.users.map((u) => ({
          id: u.id,
          loginPhoneHash: u.loginPhoneHash,
          loginEmail: u.loginEmail,
          passwordHash:
            opts.keepPasswords && u.passwordHash ? u.passwordHash : (tempPinHash as string),
          passwordIsTemporary: opts.keepPasswords ? u.passwordIsTemporary : true,
          tempPasswordExpiresAt: opts.keepPasswords
            ? toOptDate(u.tempPasswordExpiresAt)
            : tempPinExpiresAt,
          magicTokenHash:
            opts.keepPasswords && u.magicTokenHash ? u.magicTokenHash : null,
          magicTokenExpiresAt:
            opts.keepPasswords && u.magicTokenExpiresAt
              ? toDate(u.magicTokenExpiresAt)
              : null,
          role: u.role as "MEMBER" | "ADMIN",
          accountStatus: u.accountStatus as "PENDING" | "ACTIVE" | "SUSPENDED",
          lastLoginAt: opts.keepPasswords ? toOptDate(u.lastLoginAt) : null,
          createdAt: toDate(u.createdAt),
          updatedAt: toDate(u.updatedAt),
        })),
      });
    }

    if (data.profiles.length > 0) {
      await tx.alumniProfile.createMany({
        data: data.profiles.map((p) => ({
          id: p.id,
          userId: p.userId,
          alumniCode: p.alumniCode,
          monkOrLay: p.monkOrLay as "MONK" | "LAY" | "NUN" | "OTHER",
          fullName: p.fullName,
          normalizedName: p.normalizedName,
          formerName: p.formerName,
          birthplace: p.birthplace,
          degreeName: p.degreeName,
          batchYearMm: p.batchYearMm,
          batchYearDisplay: p.batchYearDisplay,
          batchYearApprox: p.batchYearApprox,
          university: p.university,
          dormitory: p.dormitory,
          stayPeriod: p.stayPeriod,
          currentRoleOrMonastery: p.currentRoleOrMonastery,
          currentMonastery: p.currentMonastery,
          messageToAlumni: p.messageToAlumni,
          photoUrl: p.photoUrl,
          countryCode: p.countryCode,
          countryName: p.countryName,
          isDomestic: p.isDomestic,
          region: p.region,
          township: p.township,
          city: p.city,
          wardOrVillage: p.wardOrVillage,
          phonePrimaryEnc: encryptField(p.phonePrimary) as string,
          phoneLookupHash: p.phoneLookupHash,
          phoneSecondaryEnc: encryptField(p.phoneSecondary),
          viberEnc: encryptField(p.viber),
          telegramEnc: encryptField(p.telegram),
          emailEnc: encryptField(p.email),
          facebookEnc: encryptField(p.facebook),
          showPhoneWeb: p.showPhoneWeb,
          showViberTgWeb: p.showViberTgWeb,
          showEmailFbWeb: p.showEmailFbWeb,
          showWardWeb: p.showWardWeb,
          showPhonePrint: p.showPhonePrint,
          showWardPrint: p.showWardPrint,
          hideContactsWeb: p.hideContactsWeb,
          adminNote: p.adminNote,
          referrerName: p.referrerName,
          bestContactTime: p.bestContactTime,
          printExclusionNote: p.printExclusionNote,
          profileStatus: p.profileStatus as
            | "PENDING"
            | "VERIFIED"
            | "NEEDS_CORRECTION"
            | "HIDDEN"
            | "MERGED"
            | "REJECTED",
          mergedIntoId: p.mergedIntoId,
          verifiedById: p.verifiedById,
          verifiedAt: toOptDate(p.verifiedAt),
          lastConfirmedAt: toOptDate(p.lastConfirmedAt),
          createdAt: toDate(p.createdAt),
          updatedAt: toDate(p.updatedAt),
        })),
      });
    }

    if (data.consents.length > 0) {
      await tx.consent.createMany({
        data: data.consents.map((c) => ({
          id: c.id,
          alumniId: c.alumniId,
          consentType: c.consentType as
            | "POLICY_AGREED"
            | "WEB_DIRECTORY"
            | "BOOK_PUBLICATION"
            | "BOOK_PHONE",
          granted: c.granted,
          policyVersion: c.policyVersion,
          recordedAt: toDate(c.recordedAt),
        })),
      });
    }

    if (data.correctionRequests.length > 0) {
      await tx.correctionRequest.createMany({
        data: data.correctionRequests.map((r) => ({
          id: r.id,
          alumniId: r.alumniId,
          submittedById: r.submittedById,
          proposedData: (r.proposedData ?? {}) as Prisma.InputJsonValue,
          reason: r.reason,
          status: r.status as "PENDING" | "APPROVED" | "REJECTED",
          reviewedById: r.reviewedById,
          reviewedAt: toOptDate(r.reviewedAt),
          createdAt: toDate(r.createdAt),
        })),
      });
    }

    if (data.contactRequests.length > 0) {
      await tx.contactRequest.createMany({
        data: data.contactRequests.map((r) => ({
          id: r.id,
          senderId: r.senderId,
          receiverAlumniId: r.receiverAlumniId,
          message: r.message,
          status: r.status as "PENDING" | "ACCEPTED" | "DECLINED",
          createdAt: toDate(r.createdAt),
          updatedAt: toDate(r.updatedAt),
        })),
      });
    }

    if (data.publications.length > 0) {
      await tx.publication.createMany({
        data: data.publications.map((p) => ({
          id: p.id,
          title: p.title,
          frozenAt: toDate(p.frozenAt),
          snapshotCount: p.snapshotCount,
          snapshotData: (p.snapshotData ?? {}) as Prisma.InputJsonValue,
          createdById: p.createdById,
          createdAt: toDate(p.createdAt),
        })),
      });
    }
  });

  return { counts: data.counts, snapshotAt };
}

export interface SnapshotInfo {
  createdAt: string;
  createdById: string | null;
  label: string;
  counts: BackupCounts;
}

/** The latest safety snapshot, if one exists. Throws P2021 before db push. */
export async function getLatestSnapshot(): Promise<SnapshotInfo | null> {
  const snap = await prisma.backupSnapshot.findFirst({
    orderBy: { createdAt: "desc" },
  });
  if (!snap) return null;
  const { data } = validateBackupData(snap.data);
  return {
    createdAt: snap.createdAt.toISOString(),
    createdById: snap.createdById,
    label: snap.label,
    counts: data.counts,
  };
}

/** Restore the latest safety snapshot (keeps passwords — no temp PIN). */
export async function undoLastRestore(adminId: string): Promise<{
  counts: BackupCounts;
  snapshotAt: string | null;
  restoredFrom: string;
}> {
  const snap = await prisma.backupSnapshot.findFirst({
    orderBy: { createdAt: "desc" },
  });
  if (!snap) throw new Error("ပြန်ဖျက်စရာ snapshot မရှိပါ။");
  const result = await applyRestore(snap.data, {
    adminId,
    keepPasswords: true,
    snapshotFirst: true,
  });
  return { ...result, restoredFrom: snap.createdAt.toISOString() };
}

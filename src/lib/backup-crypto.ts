// Password-encrypted backup files (pure — only node:crypto, so it can be
// unit-tested standalone with the TS harness).
//
// A downloaded backup now contains password hashes (so a restore keeps
// every account's own PIN), and the whole file is locked with the
// admin's password: scrypt KDF + AES-256-GCM, same cipher as the field
// encryption in crypto.ts. The password itself is never stored —
// download verifies it against the admin's bcrypt hash first, and
// restore just tries to decrypt (a wrong password fails the GCM auth
// tag, which is how a wrong password is detected).
//
// IMPORTANT UX consequence: the key comes from the password as it was
// WHEN THE BACKUP WAS DOWNLOADED. If the admin changes his password
// afterwards, an old backup still needs the OLD password to open.

import crypto from "crypto";

export const ENCRYPTED_BACKUP_FORMAT = "ndaddbook-backup-encrypted";
export const ENCRYPTED_BACKUP_VERSION = 1;

export interface EncryptedBackupEnvelope {
  format: string;
  version: number;
  kdf: string;
  salt: string;
  iv: string;
  authTag: string;
  data: string;
}

const ALGORITHM = "aes-256-gcm";
const SALT_BYTES = 16;
const IV_BYTES = 12;
const KEY_BYTES = 32;
// scrypt work factors: ~50–100ms on the server, 16MB memory.
const SCRYPT_OPTS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.scryptSync(password, salt, KEY_BYTES, SCRYPT_OPTS);
}

/** True when the parsed JSON value looks like an encrypted backup file. */
export function isEncryptedBackup(value: unknown): value is EncryptedBackupEnvelope {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    v.format === ENCRYPTED_BACKUP_FORMAT &&
    v.version === ENCRYPTED_BACKUP_VERSION &&
    v.kdf === "scrypt" &&
    typeof v.salt === "string" &&
    typeof v.iv === "string" &&
    typeof v.authTag === "string" &&
    typeof v.data === "string"
  );
}

/** Encrypt a backup JSON string with a password. Throws on empty password. */
export function encryptBackupFile(plaintext: string, password: string): EncryptedBackupEnvelope {
  if (!password) throw new Error("စကားဝှက် မပါပါ။");
  const salt = crypto.randomBytes(SALT_BYTES);
  const iv = crypto.randomBytes(IV_BYTES);
  const key = deriveKey(password, salt);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return {
    format: ENCRYPTED_BACKUP_FORMAT,
    version: ENCRYPTED_BACKUP_VERSION,
    kdf: "scrypt",
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64"),
  };
}

/**
 * Decrypt an encrypted backup envelope with a password, returning the
 * inner backup JSON string. Throws a Burmese error when the envelope is
 * malformed or the password is wrong (GCM auth-tag mismatch).
 */
export function decryptBackupFile(envelope: unknown, password: string): string {
  if (!isEncryptedBackup(envelope)) {
    throw new Error("ဤဖိုင်သည် စကားဝှက်ဖြင့် ကာကွယ်ထားသော backup မဟုတ်ပါ။");
  }
  if (!password) throw new Error("Admin စကားဝှက် ထည့်ပါ။");
  try {
    const key = deriveKey(password, Buffer.from(envelope.salt, "base64"));
    const decipher = crypto.createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(envelope.iv, "base64")
    );
    decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(envelope.data, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    throw new Error(
      "Admin စကားဝှက် မှားနေပါသည် — backup လုပ်တုန်းက Admin စကားဝှက်နဲ့ ဖွင့်ကြည့်ပါ။"
    );
  }
}

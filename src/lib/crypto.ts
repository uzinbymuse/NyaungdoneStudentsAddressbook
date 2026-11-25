import crypto from "crypto";
import { SignJWT, jwtVerify } from "jose";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length < 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes).");
  }
  return Buffer.from(hex.slice(0, 64), "hex");
}

function getHashSalt(): string {
  return process.env.HASH_SALT || "default-dev-salt-change-in-production";
}

function getAuthSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET || "default-dev-auth-secret-change-in-production";
  return new TextEncoder().encode(secret);
}

/**
 * Encrypt sensitive text (phone, email, telegram, viber) using AES-256-GCM.
 * Returns "iv:authTag:ciphertext" in base64.
 */
export function encryptField(plaintext: string | null | undefined): string | null {
  if (!plaintext || !plaintext.trim()) return null;
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext.trim(), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

/**
 * Decrypt AES-256-GCM ciphertext back to plaintext.
 */
export function decryptField(payload: string | null | undefined): string | null {
  if (!payload) return null;
  const parts = payload.split(":");
  if (parts.length !== 3) return null;
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(parts[0], "base64");
    const authTag = Buffer.from(parts[1], "base64");
    const encrypted = Buffer.from(parts[2], "base64");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Deterministic HMAC-SHA256 lookup hash for phone duplicate detection & login lookup.
 */
export function hmacLookup(normalizedValue: string): string {
  return crypto
    .createHmac("sha256", getHashSalt())
    .update(normalizedValue.trim().toLowerCase())
    .digest("hex");
}

/**
 * Hash a one-time magic login token before storing in DB.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface SessionPayload {
  userId: string;
  role: "MEMBER" | "ADMIN";
  profileStatus: string;
  alumniId?: string;
  // True while the account still uses its imported temporary PIN.
  // Set at login from the DB; cleared when the PIN is changed.
  mustChangePin?: boolean;
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getAuthSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    return {
      userId: String(payload.userId),
      role: payload.role === "ADMIN" ? "ADMIN" : "MEMBER",
      profileStatus: String(payload.profileStatus || "PENDING"),
      alumniId: payload.alumniId ? String(payload.alumniId) : undefined,
      mustChangePin: payload.mustChangePin === true,
    };
  } catch {
    return null;
  }
}

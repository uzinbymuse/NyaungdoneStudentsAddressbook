import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { encryptField, hmacLookup } from "../src/lib/crypto";
import { buildSearchNameKey, normalizePhoneForHash } from "../src/lib/myanmar-utils";

const prisma = new PrismaClient();

async function main() {
  const adminPhoneNorm = normalizePhoneForHash("09999000001");
  const adminPhoneHash = hmacLookup(adminPhoneNorm);
  // Admin user: created only on first seed, with the password from the
  // ADMIN_PASSWORD env var — never a hardcoded default. Re-running the
  // seed never overwrites the admin password (change it from the admin
  // panel's "Login အချက်အလက်" tab instead).
  const adminEmail = "admin@nyaungdon-alumni.org";
  const existingAdmin = await prisma.user.findUnique({
    where: { loginEmail: adminEmail },
  });
  let admin = existingAdmin;
  if (!admin) {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword || adminPassword.length < 6) {
      throw new Error(
        "ADMIN_PASSWORD env var (at least 6 characters) is required to create the admin user on first seed."
      );
    }
    admin = await prisma.user.create({
      data: {
        loginEmail: adminEmail,
        loginPhoneHash: adminPhoneHash,
        passwordHash: await bcrypt.hash(adminPassword, 12),
        role: "ADMIN",
        accountStatus: "ACTIVE",
      },
    });
  }

  console.log("Seeded Admin user:", admin.loginEmail);

  // Sample Verified Alumni 1 (Domestic)
  const sample1PhoneHash = hmacLookup(normalizePhoneForHash("09791234567"));
  const existing1 = await prisma.alumniProfile.findFirst({
    where: { alumniCode: "ND-0001" },
  });

  if (!existing1) {
    const user1 = await prisma.user.create({
      data: {
        loginPhoneHash: sample1PhoneHash,
        passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 12),
        role: "MEMBER",
        accountStatus: "ACTIVE",
      },
    });

    await prisma.alumniProfile.create({
      data: {
        userId: user1.id,
        alumniCode: "ND-0001",
        monkOrLay: "MONK",
        fullName: "အရှင်နမူနာ (ဓမ္မာစရိယ)",
        normalizedName: buildSearchNameKey("အရှင်နမူနာ"),
        degreeName: "သာသနဓဇဓမ္မာစရိယ",
        batchYearMm: 1368,
        batchYearDisplay: "၁၃၆၈",
        batchYearApprox: false,
        dormitory: "ပင်မကျောင်းဆောင်",
        stayPeriod: "၁၃၆၃ မှ ၁၃၆၈ ထိ",
        currentRoleOrMonastery: "ကျောင်းထိုင်ဆရာတော်",
        currentMonastery: "ညောင်တုန်းမြို့ ကျောင်းတိုက်",
        messageToAlumni: "ခေတ်ပြိုင်သူငယ်ချင်းများ ပြန်လည်ဆုံတွေ့ရန် ကြိုဆိုပါသည်။",
        countryCode: "MM",
        countryName: "မြန်မာ",
        isDomestic: true,
        region: "ဧရာဝတီတိုင်းဒေသကြီး",
        township: "ညောင်တုန်း",
        city: "ညောင်တုန်း",
        wardOrVillage: "အမှတ် (၁) ရပ်ကွက်",
        phonePrimaryEnc: encryptField("09791234567")!,
        phoneLookupHash: sample1PhoneHash,
        viberEnc: encryptField("09791234567"),
        showPhoneWeb: false,
        showViberTgWeb: true,
        showWardWeb: true,
        showPhonePrint: false,
        showWardPrint: true,
        profileStatus: "VERIFIED",
        verifiedById: admin.id,
        verifiedAt: new Date(),
        lastConfirmedAt: new Date(),
        consents: {
          create: [
            { consentType: "POLICY_AGREED", granted: true },
            { consentType: "WEB_DIRECTORY", granted: true },
            { consentType: "BOOK_PUBLICATION", granted: true },
            { consentType: "BOOK_PHONE", granted: false },
          ],
        },
      },
    });
  }

  // Sample Verified Alumni 2 (International)
  const sample2PhoneHash = hmacLookup(normalizePhoneForHash("+66812345678"));
  const existing2 = await prisma.alumniProfile.findFirst({
    where: { alumniCode: "ND-0002" },
  });

  if (!existing2) {
    const user2 = await prisma.user.create({
      data: {
        loginPhoneHash: sample2PhoneHash,
        passwordHash: await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 12),
        role: "MEMBER",
        accountStatus: "ACTIVE",
      },
    });

    await prisma.alumniProfile.create({
      data: {
        userId: user2.id,
        alumniCode: "ND-0002",
        monkOrLay: "LAY",
        fullName: "ဦးသုတ (M.A.)",
        normalizedName: buildSearchNameKey("ဦးသုတ"),
        formerName: "အရှင်သုတ",
        degreeName: "M.A. (Buddhist Studies)",
        batchYearMm: 1372,
        batchYearDisplay: "၁၃၇၂",
        batchYearApprox: false,
        dormitory: "သာသနာ့ရက္ခိတဆောင်",
        stayPeriod: "၁၃၆၇ မှ ၁၃၇၂ ထိ",
        currentRoleOrMonastery: "သာသနာပြု / တက္ကသိုလ်ကထိက",
        countryCode: "TH",
        countryName: "ထိုင်း",
        isDomestic: false,
        region: "Bangkok",
        city: "Bangkok",
        wardOrVillage: "Wat Arun",
        phonePrimaryEnc: encryptField("+66812345678")!,
        phoneLookupHash: sample2PhoneHash,
        telegramEnc: encryptField("@uthuta_nd"),
        showPhoneWeb: false,
        showViberTgWeb: true,
        showWardWeb: false,
        showPhonePrint: false,
        showWardPrint: false,
        profileStatus: "VERIFIED",
        verifiedById: admin.id,
        verifiedAt: new Date(),
        lastConfirmedAt: new Date(),
        consents: {
          create: [
            { consentType: "POLICY_AGREED", granted: true },
            { consentType: "WEB_DIRECTORY", granted: true },
            { consentType: "BOOK_PUBLICATION", granted: true },
            { consentType: "BOOK_PHONE", granted: false },
          ],
        },
      },
    });
  }

  console.log("Seed completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

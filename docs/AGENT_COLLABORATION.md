# Agent နှစ်ဦး ပူးပေါင်းလုပ်ဆောင်မှု မှတ်တမ်း (Multi-Agent Collaboration Log)

ဤဖိုင်သည် **ပါဠိတက္ကသိုလ် ညောင်တုန်း ကျောင်းသားဟောင်းများ မှတ်တမ်းနှင့် ဆက်သွယ်ရေးစနစ်** (`uzinbymuse/NyaungdoneStudentsAddressbook`) တွင် Agent နှစ်ဦး အပြန်အလှန် ညှိနှိုင်းလုပ်ဆောင်ရာ၌ Code Conflict မဖြစ်စေရန်နှင့် Database/Deployment အခြေအနေများ တစ်ပြေးညီ ဖြစ်စေရန် မှတ်တမ်းတင်ထားသော ဖိုင်ဖြစ်ပါသည်။

---

## ၁။ Repository နှင့် Deployment အချက်အလက်များ
* **GitHub Repository:** `https://github.com/uzinbymuse/NyaungdoneStudentsAddressbook.git` (`main` branch)
* **Hosting:** Vercel (`nyaungdone-students-addressbook`) — `main` branch သို့ Push/Merge လုပ်တိုင်း Auto-Deploy ဖြစ်သည်။
* **Database:** Neon Serverless PostgreSQL (`AWS Asia Pacific 1 (Singapore)`)
* **Framework:** Next.js 16 (App Router, `cacheComponents: true`), TypeScript, Tailwind CSS v4, Prisma v6 (`prisma@^6.19.3`)

---

## ၂။ Agent များ၏ အခန်းကဏ္ဍနှင့် ပြီးစီးခဲ့သော လုပ်ငန်းများ

### Agent A (Local Workspace — Antigravity)
* **Commit `f0a1ec2`:** Next.js 16 Setup နှင့် `docs/` ဖိုဒါအတွင်းရှိ PRD, Policy, Security, Print SOP မှတ်စု ၆ ခု တည်ဆောက်ခြင်း။
* **Commit `8fadb50`:** Phase 1 MVP အပြည့်အစုံ တည်ဆောက်ခြင်း-
  * `prisma/schema.prisma` & `prisma/seed.ts` (Admin + Sample Verified Alumni ၂ ဦး)
  * AES-256-GCM Encryption + HMAC-SHA256 Phone Lookup + `jose` HttpOnly JWT Session + Magic Login Link (`/api/auth/magic`)
  * MIMU Regions/Townships + Zawgyi-to-Unicode Normalizer (`src/lib/myanmar-utils.ts`)
  * `/register`, `/login`, `/directory`, `/profile`, `/admin`, `/admin/print`, `/privacy`, မြန်မာဘာသာ `README.md`
* **DB Sync:** Neon PostgreSQL သို့ `npx prisma db push` နှင့် `npx tsx prisma/seed.ts` ဆောင်ရွက်ပြီးစီး။

### Agent B (Cloud / GitHub PR #1 — `feat/admin-edit-dormitories`)
* **Commits `2a36c61`, `1b89ac0`, `260897d`:**
  * `ADMIN_EDIT` action (`/api/admin/alumni`) နှင့် Admin Panel တွင် Row အလိုက် Edit Modal ထည့်သွင်းခြင်း။
  * `APPROVE_CORRECTION` တွင် `dormitory`, `batchYearDisplay`, `countryCode/Name`, `region`, `township` တို့ကိုပါ Update လုပ်နိုင်အောင် တိုးချဲ့ခြင်း။
  * `Dormitory` Prisma Model အသစ်ထည့်သွင်းခြင်း + `/api/dormitories` (Public GET) နှင့် `/api/admin/dormitories` (Admin CRUD + Rename transaction + Reorder) ထည့်သွင်းခြင်း။
  * `Dormitory` table ကို Default အလွတ်ထားပြီး Admin Panel → **"ကျောင်းဆောင်"** Tab မှ စီမံခန့်ခွဲနိုင်ရန် ချိတ်ဆက်ခြင်း။
* **Local Sync:** Agent A မှ `git pull origin main` ဆွဲယူပြီး Neon DB သို့ `npx prisma db push` ထပ်မံ Push လုပ်ပြီးစီး (2026-11-25)။

---

## ၃။ နှစ်ဖက်စလုံး လိုက်နာရမည့် စည်းမျဉ်းများ (Shared Rules for Both Agents)
1. **Pull Before Work:** Code အသစ်မရေးမီ `git pull origin main` အမြဲအရင်လုပ်ပါ (PR Merge လုပ်ပြီးတိုင်း Local နှင့် Sync လုပ်ပါ)။
2. **Prisma Schema Changes:** `prisma/schema.prisma` ကို ပြင်ဆင်ပါက Vercel Build က Database Schema ကို Auto-Push မလုပ်ပေးသောကြောင့် Local မှ **`npx prisma db push`** မဖြစ်မနေ Run ပေးရမည် (သို့မဟုတ် User အား အသိပေးရမည်)။
3. **Next.js 16 Compatibility:**
   * `cacheComponents: true` ဖွင့်ထားသဖြင့် Server Pages များတွင် `export const dynamic = "force-dynamic"` မသုံးရ — လိုအပ်ပါက `export const instant = false;` (သို့) `<Suspense>` သုံးပါ။
   * Middleware အစား `src/proxy.ts` (`export function proxy(...)`) ကိုသာ သုံးပါ။
   * TypeScript strict check (`any[]` callback parameter များကို explicit type `id: string, index: number` ပေးရန်) ကို Vercel Build မတိုင်မီ စစ်ဆေးပါ။
4. **Privacy & Security Rules:**
   * ဖုန်း/Viber/Telegram/Email များကို `encryptField()` ဖြင့်သာ သိမ်းပြီး `phoneLookupHash` ကို `hmacLookup(normalizePhoneForHash(...))` ဖြင့် တည်ဆောက်ပါ။
   * `.env` ဖိုင်ကို Git ထဲ မည်သည့်အခါမျှ မထည့်ရ။
   * Directory API (`/api/directory`) သည် `requireVerifiedMember()` နှင့် Max 20 Results + Rate Limit ကို အမြဲထိန်းသိမ်းရမည်။
5. **Handoff Note:** အပြောင်းအလဲကြီးများ လုပ်ပြီးတိုင်း ဤဖိုင် (`docs/AGENT_COLLABORATION.md`) ၏ အောက်ဆုံးတွင် ရက်စွဲနှင့်တကွ အကျဉ်းချုပ် ဖြည့်စွက်မှတ်တမ်းတင်ပါ။

---

## ၄။ လတ်တလော Update မှတ်တမ်း (Changelog)
| ရက်စွဲ | Agent | ဆောင်ရွက်ချက် | DB Push လို/မလို |
| --- | --- | --- | --- |
| 2026-11-25 | Agent A | Phase 1 MVP + Neon Schema + Seed + Vercel Guide + Burmese README | ပြီးစီး |
| 2026-11-25 | Agent B | PR #1: Admin Edit Modal + DB-managed Dormitory Table & Tab | ပြီးစီး (Agent A မှ `db push` လုပ်ပြီး) |

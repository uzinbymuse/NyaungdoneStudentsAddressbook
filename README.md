# ပါဠိတက္ကသိုလ် ညောင်တုန်း — ကျောင်းသားဟောင်းများ မှတ်တမ်းနှင့် ဆက်သွယ်ရေးစနစ်
**(Nyaungdon Pali University Alumni Directory & Print Book System)**

ပါဠိတက္ကသိုလ် ညောင်တုန်းတွင် ပညာသင်ကြားခဲ့ဖူးသော ကျောင်းသားဟောင်း (ရဟန်း/လူ/သီလရှင်) များ အချင်းချင်း ပြန်လည်ရှာဖွေဆက်သွယ်နိုင်ရန်နှင့် မည်သူမျှ မကျန်ရစ်သော ပြည်တွင်း/ပြည်ပ လိပ်စာစာအုပ် ထုတ်ဝေနိုင်ရန် **Privacy-First Design** ဖြင့် တည်ဆောက်ထားသော Web Application ဖြစ်ပါသည်။

---

## ၁။ အဓိက ရည်ရွယ်ချက်များ
1. ပါဠိတက္ကသိုလ် ညောင်တုန်းတွင် ပညာသင်ကြားခဲ့ဖူးသူအားလုံး၏ မှတ်တမ်းကို စနစ်တကျ စုဆောင်းထိန်းသိမ်းရန်။
2. ကျောင်းသားဟောင်းများ အချင်းချင်း ပြန်လည်ရှာဖွေပြီး ဘေးကင်းလုံခြုံစွာ ဆက်သွယ်နိုင်ရန်။
3. မိမိအချက်အလက် ပါဝင်ပြီး/မပါဝင်သေးကြောင်း စစ်ဆေးနိုင်ပြီး ပြင်ဆင်တောင်းဆိုနိုင်ရန်။
4. အတည်ပြုပြီးသော အချက်အလက်များမှ **ပြည်တွင်း/ပြည်ပ** ခွဲခြား၍ ပုံနှိပ်စာအုပ် (Print Book) ထုတ်ဝေနိုင်ရန်။

---

## ၂။ အဓိက ပါဝင်သော လုပ်ဆောင်ချက်များ (Features)

### Privacy-First & Security Architecture
* **Members-Only Directory:** အများပြည်သူ မြင်နိုင်သော စာရင်း မဟုတ်ပါ။ Admin မှ စစ်ဆေးအတည်ပြုပြီးသော (`VERIFIED`) ကျောင်းသားဟောင်းများသာ Login ဝင်၍ ရှာဖွေနိုင်ပါသည်။ Search Engine (`noindex`) မှလည်း ရှာတွေ့နိုင်မည် မဟုတ်ပါ။
* **AES-256-GCM Encryption:** ဖုန်းနံပါတ်၊ Viber၊ Telegram၊ Email နှင့် Facebook အချက်အလက်များကို Database ထဲတွင် Encrypt လုပ်၍ သိမ်းဆည်းထားပြီး Duplicate စစ်ဆေးရန် HMAC-SHA256 Hash ကိုသာ အသုံးပြုထားပါသည်။
* **Contact Request စနစ်:** ဖုန်းနံပါတ် ဖုံးကွယ်ထားသူထံသို့ ဖုန်းနံပါတ် မမြင်ရဘဲ “ဆက်သွယ်ရန် တောင်းဆိုချက်” ပေးပို့နိုင်ပြီး ပိုင်ရှင်က လက်ခံမှသာ ဆက်သွယ်ရန် မျှဝေပေးပါသည်။
* **Anti-Scraping ကာကွယ်မှု:** ရှာဖွေမှုတိုင်းကို Rate Limit ထားရှိပြီး တစ်ကြိမ်လျှင် အများဆုံး ၂၀ ဦးသာ ပြသပါသည်။ Bulk Export ကို Admin တစ်ဦးတည်းသာ ပြုလုပ်နိုင်ပါသည်။

### ကျောင်းသားဟောင်းများအတွက် လွယ်ကူသော စနစ်
* **အပိုင်း ၆ ပိုင်းပါ မှတ်ပုံတင်ဖောင် (`/register`):** ရဟန်း/လူ ခွဲခြားမှု၊ မြန်မာသက္ကရာဇ် Batch (ခန့်မှန်း/မမှတ်မိ ရွေးချယ်ခွင့်ပါ)၊ MIMU တိုင်းဒေသကြီး/မြို့နယ် Dropdown၊ ပြည်တွင်း/ပြည်ပ အလိုအလျောက်ခွဲခြားမှု၊ Zawgyi မှ Unicode အလိုအလျောက်ပြောင်းလဲမှုနှင့် Granular Consent Checkbox ၄ ခု ပါဝင်ပါသည်။
* **လူကြီးများအတွက် လွယ်ကူသော Login (`/login` & Magic Link):** ဖုန်းနံပါတ်/Email + စကားဝှက် (သို့မဟုတ် ဂဏန်း ၆ လုံး PIN) ဖြင့် ဝင်ရောက်နိုင်သည့်အပြင် စကားဝှက်မေ့သူများအတွက် Admin မှ တစ်ချက်နှိပ် Login Link (**Magic Link**) ထုတ်ပေးနိုင်ပါသည်။
* **ကိုယ်ပိုင် Profile နှင့် Print Proof (`/profile`):** မိမိ Profile စစ်ဆေးခြင်း၊ Web နှင့် Print မြင်နိုင်ခွင့်များကို တစ်ကွက်ချင်းစီ ပြောင်းလဲခြင်း၊ ပြင်ဆင်ချက် တောင်းဆိုခြင်း (Admin Approval ဖြင့်) နှင့် Print စာအုပ်တွင် ပေါ်မည့် နမူနာ (Print Proof) ကြည့်ရှုခြင်းတို့ ပြုလုပ်နိုင်ပါသည်။

### Admin ၁ ဦးတည်း စီမံခန့်ခွဲမှု Panel (`/admin`)
* **Pending Approvals & Magic Link:** စာရင်းအသစ်များကို ကျောင်းမှတ်တမ်းဖြင့် တိုက်စစ် Approve/Reject လုပ်ခြင်းနှင့် Magic Login Link ထုတ်ပေးခြင်း။
* **Duplicate Detection:** အမည်တူ/ဖုန်းတူ ဖြစ်နိုင်ခြေရှိသူများကို အလိုအလျောက် သတိပေးခြင်း။
* **Correction Requests:** ပြင်ဆင်တောင်းဆိုချက်များကို စိစစ်အတည်ပြုခြင်း။
* **Batch Rep CSV Import:** အတန်း/နှစ် ကိုယ်စားလှယ်များထံမှ CSV စာရင်းများကို တစ်ခါတည်း Import လုပ်ခြင်း (Zawgyi → Unicode အလိုအလျောက် ပြောင်းပေးသည်)။
* **Print Book Export & Edition Freeze (`/admin/print`):** Print ခွင့်ပြုချက်ရှိသူများကိုသာ ပြည်တွင်း/ပြည်ပ ခွဲခြား၍ **Excel/CSV (UTF-8 BOM)** ထုတ်ယူခြင်း၊ **Print-Ready PDF** ထုတ်ယူခြင်းနှင့် **Publication Snapshot (Freeze)** သိမ်းဆည်းခြင်း။

---

## ၃။ အသုံးပြုထားသော နည်းပညာများ (Tech Stack)
* **Framework:** Next.js 16 (App Router, Full-Stack TypeScript)
* **Styling:** Tailwind CSS v4 + Lucide Icons
* **Database & ORM:** PostgreSQL (Neon) + Prisma v6
* **Authentication & Security:** `jose` (HttpOnly JWT Session Cookies), `bcryptjs`, AES-256-GCM Encryption, HMAC-SHA256

---

## ၄။ စနစ်ဖွဲ့စည်းပုံ (Project Structure)
```text
├── docs/                        # စီမံကိန်း မှတ်စုများ၊ PRD နှင့် Admin SOP များ
├── prisma/
│   ├── schema.prisma            # PostgreSQL Database Schema
│   └── seed.ts                  # ကနဦး Admin နှင့် နမူနာဒေတာ ထည့်သွင်းရန်
├── src/
│   ├── app/
│   │   ├── api/                 # Backend API Routes (auth, register, directory, profile, admin)
│   │   ├── register/            # အပိုင်း ၆ ပိုင်းပါ မှတ်ပုံတင်ဖောင်
│   │   ├── login/               # Login စာမျက်နှာ
│   │   ├── directory/           # Verified Members-Only Directory
│   │   ├── profile/             # ကိုယ်ပိုင် Profile, Privacy & Print Proof
│   │   ├── admin/               # Admin Panel နှင့် Print-Ready Book View (/admin/print)
│   │   └── privacy/             # ကိုယ်ရေးအချက်အလက် မူဝါဒ
│   ├── components/              # Navbar နှင့် UI Components
│   ├── lib/                     # Crypto, Auth, Prisma, MIMU Locations, Myanmar Text Utils
│   └── proxy.ts                 # Security Headers & noindex Protection
```

---

## ၅။ Local တွင် စတင်တပ်ဆင်အသုံးပြုနည်း

### ၁။ Repository ကို Clone လုပ်ပြီး Package များ Install လုပ်ပါ
```bash
git clone https://github.com/uzinlay85/NyaungdoneStudentsAddressbook.git
cd NyaungdoneStudentsAddressbook
npm install
```

### ၂။ `.env` ဖိုင် တည်ဆောက်ပါ
`.env.example` ကို ကူးယူ၍ `.env` အမည်ဖြင့် သိမ်းဆည်းပြီး အောက်ပါတန်ဖိုးများ ဖြည့်ပါ-
```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST/neondb?sslmode=require"
AUTH_SECRET="your-random-64-char-hex-string"
ENCRYPTION_KEY="your-random-64-char-hex-string"
HASH_SALT="your-random-64-char-hex-string"
```

### ၃။ Database Table များ တည်ဆောက်ပြီး Seed လုပ်ပါ
```bash
npx prisma db push
npx tsx prisma/seed.ts
```

### ၄။ Development Server ဖွင့်ပါ
```bash
npm run dev
```
Browser တွင် `http://localhost:3000` သို့ ဝင်ရောက်ကြည့်ရှုနိုင်ပါသည်။

---

## ၆။ Vercel + Neon တွင် Deploy လုပ်နည်း
1. [Neon](https://neon.tech) တွင် Free PostgreSQL Project (Region: Singapore) တည်ဆောက်ပြီး `DATABASE_URL` ကို ရယူပါ။
2. [Vercel](https://vercel.com) တွင် ဤ GitHub Repository ကို Import လုပ်ပါ။
3. Vercel Project Settings → **Environment Variables** ထဲတွင် `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `HASH_SALT` တို့ကို ထည့်သွင်းပါ။
4. **Deploy** နှိပ်ပါ (Build Command သည် `prisma generate && next build` ကို အလိုအလျောက် Run ပေးပါမည်)။

---

## ၇။ Admin Default Login (စမ်းသပ်ရန်)
`npx tsx prisma/seed.ts` Run ပြီးပါက အောက်ပါ Admin အကောင့်ဖြင့် ဝင်ရောက်နိုင်ပါသည်-
* **Email:** `admin@nyaungdon-alumni.org`
* **Password:** `Admin@ND2026!`

> **အရေးကြီးသတိပေးချက်-** Production တွင် အများပြည်သူ မသုံးစွဲမီ Admin Password ကို မဖြစ်မနေ ပြောင်းလဲထားပါ။

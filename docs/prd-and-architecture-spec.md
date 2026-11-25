# ညောင်တုန်း ပါဠိတက္ကသိုလ် ကျောင်းသားဟောင်းများ မှတ်တမ်းနှင့် ဆက်သွယ်ရေးစနစ်
**Project Definition v1.0 — PRD, Database Design & Security Architecture**

* **Project Name:** Nyaungdon Pali University Alumni Directory & Network
* **Target Users:** 500 – 2,000 ဦး
* **Registration:** All Former Students (ဘွဲ့ရပြီးသူနှင့် ပညာသင်ကြားခဲ့ဖူးသူ နှစ်မျိုးစလုံး)
* **Directory Access:** Verified Members Only
* **Book Distribution:** Alumni Only
* **Verification:** Admin Approval
* **Architecture:** Modular Monolith

---

## ၁။ စီမံကိန်း၏ အဓိကရည်ရွယ်ချက် ၄ ချက်
1. ညောင်တုန်းပါဠိတက္ကသိုလ်မှာ ပညာသင်ကြားခဲ့ဖူးသူအားလုံး၏ မှတ်တမ်းကို စနစ်တကျ စုဆောင်းထိန်းသိမ်းရန်။
2. ကျောင်းသားဟောင်းများ အချင်းချင်း ပြန်လည်ရှာဖွေပြီး ဆက်သွယ်နိုင်ရန်။
3. မိမိအချက်အလက် ပါဝင်ပြီး/မပါဝင်သေးကြောင်း စစ်ဆေးနိုင်ပြီး မှားယွင်းပါက ပြင်ဆင်နိုင်ရန်။
4. အတည်ပြုပြီးသော အချက်အလက်များမှ ပြည်တွင်း/ပြည်ပ Alumni Directory စာအုပ် ထုတ်ဝေနိုင်ရန်။

---

## ၂။ အသုံးပြုသူအမျိုးအစားနှင့် ခွင့်ပြုချက် (User Roles)
| Role | လုပ်ဆောင်ခွင့် |
| --- | --- |
| **Public Visitor** | မိတ်ဆက်စာမျက်နှာ၊ မှတ်ပုံတင် Form ကြည့်နိုင် |
| **Registered Member** | မိမိအချက်အလက် ဖြည့်သွင်း၊ ပြင်ဆင်တောင်းဆိုနိုင် |
| **Verified Member** | Alumni Directory ရှာဖွေ၊ ဆက်သွယ်ရန် တောင်းဆိုနိုင် |
| **Admin** | အတည်ပြုခြင်း၊ စီမံခန့်ခွဲခြင်း၊ စာအုပ်ထုတ်ခြင်း (`Super Admin`, `Verification Admin`, `Book Editor`, `Regional Admin`) |

> **အရေးကြီးစည်းမျဉ်း:** Registered Member တစ်ဦးသည် အချက်အလက်ဖြည့်သွင်းပြီးသည်နှင့် Directory ကို ချက်ချင်းဝင်ကြည့်ခွင့်မရပါ။ Admin က စစ်ဆေးအတည်ပြုပြီးမှ Verified Member ဖြစ်မည်။

---

## ၃။ Web App စာမျက်နှာဖွဲ့စည်းပုံ
* **Public Website:** ပင်မစာမျက်နှာ၊ စီမံကိန်းအကြောင်း၊ မှတ်ပုံတင်ရန်၊ ကိုယ့်အချက်အလက် ရှိ/မရှိ စစ်ဆေးရန်၊ Login၊ Privacy Policy၊ အသုံးပြုမှုစည်းကမ်း
* **Member Dashboard:** ကျွန်ုပ်၏ Profile၊ အချက်အလက် ပြင်ဆင်ရန်၊ ကျောင်းသားဟောင်းများ ရှာဖွေရန်၊ ဆက်သွယ်ရန် တောင်းဆိုချက်များ၊ ကျွန်ုပ်၏ Privacy Settings၊ အချက်အလက်မှန်ကန်ကြောင်း အတည်ပြုရန်
* **Admin Dashboard:** Overview၊ Alumni Management၊ Pending Approvals၊ Correction Requests၊ Duplicate Detection၊ Domestic / International၊ User & Admin Management၊ Privacy & Consent Management၊ Book Publishing၊ Audit Logs၊ Backup & System Settings

---

## ၄။ Registration Workflow (အဆင့် ၆ ဆင့်)
```
Public Visitor -> Register Account -> Submit Alumni Information -> Pending Verification
-> Admin Reviews Data
   ├── Approved (Yes) -> Verified Member -> Access Alumni Directory / Contact Alumni / Update Own Profile
   └── Not Approved (No) -> Request Correction -> Admin Reviews Changes
```

* မှတ်ပုံတင်သူတစ်ဦးချင်းစီကို Unique Alumni ID အလိုအလျောက် ထုတ်ပေးမည် (ဥပမာ- `NYT-ALU-000001`, `NYT-ALU-000002`)။
* ID ကို အမည်၊ ဖုန်းနံပါတ်နှင့် မချိတ်ဆက်ဘဲ သီးခြား Unique Identifier အဖြစ် ထားမည်။

---

## ၅။ Database Design (PostgreSQL)

### ၅.၁ Core Tables
1. **`users`**: `id` (UUID PK), `email`, `password_hash`, `account_status` (`pending`/`active`/`suspended`), `email_verified_at`, `last_login_at`, `created_at`, `updated_at`
2. **`alumni_profiles`**: `id` (UUID PK), `user_id` (FK), `alumni_code` (UK), `degree_name`, `full_name`, `alternate_name`, `photo_path`, `student_type` (`graduated`/`attended`/`other`), `profile_status` (`pending`/`verified`/`rejected`), `verified_by`, `verified_at`, `admin_note`, `created_at`, `updated_at`
   *(မှတ်ချက်: ဘွဲ့မရခဲ့သူများလည်း စာရင်းသွင်းခွင့်ရှိသဖြင့် `degree_name` ကို optional ထားရန်)*
3. **`education_records`**: `id` (UUID PK), `alumni_id` (FK), `institution`, `enrollment_year` (SMALLINT), `completion_year` (SMALLINT), `dormitory`, `other_notes`
4. **`address_records`**: `id` (UUID PK), `alumni_id` (FK), `address_type` (`current`/`hometown`), `country_code` (ISO 3166-1 alpha-2 e.g. `MM`, `SG`), `country_name`, `region`, `district`, `township`, `city`, `locality`, `address_detail`, `is_current`
5. **`contact_details`**: `id` (UUID PK), `alumni_id` (FK), `phone_encrypted`, `phone_lookup_hash` (HMAC), `email_encrypted`, `telegram_encrypted`, `whatsapp_encrypted`, `is_primary`, `updated_at`
6. **`correction_requests`**: `id` (UUID PK), `alumni_id` (FK), `submitted_by` (FK), `field_name`, `old_value` (JSONB), `proposed_value` (JSONB), `reason`, `status` (`pending`/`approved`/`rejected`), `reviewed_by`, `reviewed_at`
7. **`consents`**: `id` (UUID PK), `user_id` (FK), `consent_type` (`data_collection`, `member_directory`, `phone_sharing`, `book_publication`, `photo_publication`), `granted`, `policy_version`, `recorded_at`, `withdrawn_at`

### ၅.၂ Additional Production Tables
`admin_roles`, `contact_requests`, `audit_logs`, `verification_history`, `publications`, `publication_entries`, `dormitories`, `locations`, `data_import_batches`

---

## ၆။ Data Accuracy & Duplicate Detection
* အမည်တူ၊ ဖုန်းနံပါတ်တူ၊ ကျောင်းဝင်နှစ်တူ၊ ကျောင်းဆောင်တူ၊ စာလုံးပေါင်းကွဲများကို တိုက်ဆိုင်စစ်ဆေးပြီး Admin ထံ Review လုပ်ရန် သတိပေးမည် (အလိုအလျောက် Merge မလုပ်ရ)။
* မြန်မာစာ Unicode/Zawgyi နှင့် Space ကွာခြားမှုများအတွက် မူရင်းအမည်ကို မပြောင်းဘဲ Search အတွက် Normalized Name သီးခြားထားမည်။
* **Verification Score** (အမည်/ဘွဲ့၊ ကျောင်းဝင်နှစ်၊ ကျောင်းဆောင်၊ OTP၊ Admin အတည်ပြုချက်) ကို အထောက်အကူအဖြစ် ပြသမည်ဖြစ်သော်လည်း အဆုံးသတ် Verified ကို Admin ကသာ ဆုံးဖြတ်မည်။

---

## ၇။ Security Architecture
**Layers:** Web Browser → HTTPS / Reverse Proxy → Rate Limiting / Bot Protection → Backend API (Auth & AuthZ) → Application Services → PostgreSQL + Encrypted File Storage + Audit Logging + Encrypted Backups

* **Login Security:** Argon2id password hashing, Admin MFA (မဖြစ်မနေ), HttpOnly/Secure/SameSite cookies, Failed login rate limit, Single-use password reset token, Admin session timeout
* **Directory Security:** Verified Member Only search, Owner-consented phone reveal, Admin-only bulk export, Rate limit (IP + Account + Endpoint), Audit log for Admin actions & exports
* **Database Access Control:** Backend API only, Separate Admin/Member APIs, Server-side RBAC, Secret Management for Encryption Keys
* **Privacy:** Contact Request flow for phone/contact sharing; country-based Domestic/International classification (not citizenship).

---

## ၈။ Print Book Publishing System
```
Verified Alumni Records -> Check Book Consent -> Filter Domestic / International
-> Filter Eligible Records -> Admin Preview & Data Accuracy Review
-> Freeze Publication Snapshot -> Generate PDF -> Final Proofreading
-> Print-ready PDF -> Publish Edition (e.g., Edition 1 - 2027, Edition 2 - 2029)
```
* **Publication Snapshot:** စာအုပ်ထုတ်ပြီးနောက် Database ပြင်ဆင်မှုများကြောင့် ထုတ်ပြီးသား Edition Data အလိုအလျောက် မပြောင်းလဲစေရန် Snapshot သီးခြားသိမ်းဆည်းမည်။
* **Field Visibility in Book:** Alumni ID (ထည့်), ဘွဲ့/အမည်/နှစ်/ကျောင်းဆောင်/မြို့/နိုင်ငံ (သဘောတူမှ), ဖုန်းနံပါတ် (သီးခြားခွင့်ပြုမှသာ), လိပ်စာအသေးစိတ် (ပုံမှန်မထည့်), Admin မှတ်ချက် (လုံးဝမထည့်)။

---

## ၉။ Recommended Technology Stack
* **Frontend:** Next.js + TypeScript + Tailwind CSS
* **Backend:** NestJS (Modular Monolith)
* **Database & ORM:** PostgreSQL + Prisma
* **Cache / Rate Limit / OTP (Optional):** Redis
* **Deployment:** Docker + Nginx

---

## ၁၀။ Development Roadmap & Acceptance Criteria
1. Requirements & UI Design
2. Database & Backend
3. Registration & Profile
4. Admin Verification
5. Alumni Directory
6. Privacy & Security
7. Book Publishing
8. Production Testing

*(Acceptance Criteria ၁၃ ချက်နှင့် Pre-start ဆုံးဖြတ်ရန် အချက် ၄ ချက် — Legacy Data Import, Data Ownership, Admin Field Visibility, Hosting & Key Ownership)*

---

## ၁၁။ Next Deliverables Before Coding
1. `PRD.md` — စီမံကိန်းလိုအပ်ချက်အားလုံး
2. `DATABASE_DESIGN.md` — Table, Column, Relationship, Index, Constraints
3. `SECURITY_POLICY.md` — Privacy, RBAC, Encryption, Audit Log, Threat Model
4. `UI_UX_SPEC.md` — Public Website, Member Dashboard, Admin Dashboard & User Workflow

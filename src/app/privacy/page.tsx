export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm sm:p-10">
        <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">
          ကိုယ်ရေးအချက်အလက် လုံခြုံရေးနှင့် အသုံးပြုမှု မူဝါဒ
        </h1>
        <p className="mt-2 text-sm text-stone-500">Policy Version: v1.0 — ပါဠိတက္ကသိုလ် ညောင်တုန်း ကျောင်းသားဟောင်းများ မှတ်တမ်းစနစ်</p>

        <div className="mt-6 space-y-5 text-base text-stone-700">
          <section>
            <h2 className="text-lg font-bold text-stone-900">၁။ အများပြည်သူ မြင်နိုင်သော စာရင်း မဟုတ်ပါ</h2>
            <p className="mt-1">
              ဤစာရင်းကို အများပြည်သူ မည်သူမျှ မမြင်ရပါ။ Admin က အတည်ပြုပြီးသော ကျောင်းသားဟောင်းများသာ Login ဝင်ပြီး ကြည့်နိုင်မည် ဖြစ်ပါသည်။ Google ကဲ့သို့သော ရှာဖွေရေး စနစ်များတွင် ပေါ်မည် မဟုတ်ပါ။
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900">၂။ တစ်ကွက်ချင်းစီ ရွေးချယ်ခွင့်</h2>
            <p className="mt-1">
              သင် ပြရန် ရွေးထားသော အချက်များကိုသာ ပြမည်။ မပြရန် ရွေးထားသော အချက်များကို Admin ကသာ အတည်ပြုရန်နှင့် ဆက်သွယ်ရန်အတွက် မြင်ရမည် ဖြစ်ပါသည်။
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900">၃။ အချက်အလက် အသုံးပြုမှု ကန့်သတ်ချက်</h2>
            <p className="mt-1">
              သင်၏ အချက်အလက်များကို ကျောင်းသားဟောင်းများ ဆက်သွယ်ရေးနှင့် စာအုပ်ထုတ်ဝေရေး ရည်ရွယ်ချက်မှလွဲ၍ ကြော်ငြာ၊ စီးပွားရေး၊ နိုင်ငံရေး သို့မဟုတ် ပြင်ပအဖွဲ့အစည်းများထံ ရောင်းချ/ပေးပို့ခြင်း လုံးဝ မလုပ်ပါ။
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-stone-900">၄။ ပြင်ဆင်ခွင့်နှင့် ဖယ်ရှားခွင့်</h2>
            <p className="mt-1">
              အချက်အလက် မှားနေခြင်း/ပြောင်းလဲသွားခြင်း ရှိလျှင် Admin ထံ အချိန်မရွေး ပြင်ဆင်တောင်းဆိုနိုင်ပါသည်။ Web မှ ဖယ်ရှားရန် တောင်းဆိုပါက ၁၄ ရက်အတွင်း ဆောင်ရွက်ပေးပါမည်။ Print စာအုပ် ရိုက်နှိပ်ပြီးပါက ထုတ်ဝေပြီးသော စာအုပ်များမှ ဖယ်ရှား၍ မရနိုင်ပါ။
            </p>
          </section>

          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <strong>လုံးဝ မတောင်းသော အချက်များ-</strong> မှတ်ပုံတင်အမှတ် (NRC)၊ မွေးနေ့အတိအကျ၊ ဘဏ်အကောင့်နှင့် အိမ်အမှတ်အတိအကျတို့ကို မည်သည့်အခါမျှ မတောင်းပါ။
          </section>
        </div>
      </div>
    </div>
  );
}

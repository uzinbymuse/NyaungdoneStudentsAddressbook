import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";

export const metadata: Metadata = {
  title: "ပါဠိတက္ကသိုလ် ညောင်တုန်းကျောင်းတိုက် — ဗဟန်း-ညောင်တုန်းနွယ်ဖွား မှတ်တမ်းနှင့် ဆက်သွယ်ရေးစနစ်",
  description:
    "ပါဠိတက္ကသိုလ် ညောင်တုန်းကျောင်းတိုက် ဗဟန်း-ညောင်တုန်းနွယ်ဖွား အချင်းချင်း ပြန်လည်ဆက်သွယ်နိုင်ရန်နှင့် လိပ်စာစာအုပ် ထုတ်ဝေနိုင်ရန် Privacy-first Alumni Directory စနစ်",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="my" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#faf8f5] text-stone-900">
        {/* Faint logo watermark behind every page (hidden when printing) */}
        <div
          aria-hidden="true"
          className="no-print pointer-events-none fixed inset-0 z-0 flex items-center justify-center"
        >
          <img
            src="/logo.png"
            alt=""
            className="h-[75vmin] w-auto object-contain opacity-[0.05] select-none"
          />
        </div>
        <Navbar />
        <main className="relative flex-1">{children}</main>
        <footer className="no-print relative border-t border-stone-200 bg-white py-6 text-center text-sm text-stone-600">
          <div className="mx-auto max-w-5xl px-4">
            <p className="font-medium text-stone-800">
              ပါဠိတက္ကသိုလ် ညောင်တုန်းကျောင်းတိုက် — ဗဟန်း-ညောင်တုန်းနွယ်ဖွား မှတ်တမ်းနှင့် ဆက်သွယ်ရေးစနစ်
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Privacy-first Members-Only Directory · ဗဟန်း-ညောင်တုန်းနွယ်ဖွားအတွက်သာ
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

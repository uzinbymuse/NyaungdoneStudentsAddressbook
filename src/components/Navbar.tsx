"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogIn, LogOut, ShieldCheck, User, Users, FileText } from "lucide-react";

interface MeUser {
  id: string;
  role: "MEMBER" | "ADMIN";
  profileStatus: string;
  profile?: {
    fullName: string;
    alumniCode: string;
  } | null;
}

export function Navbar() {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (active) {
          setUser(d.user ?? null);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/");
    router.refresh();
  }

  return (
    <header className="no-print sticky top-0 z-40 border-b border-amber-200/80 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5 text-amber-900">
          <img
            src="/logo.png"
            alt="ပါဠိတက္ကသိုလ် ညောင်တုန်း လိုဂို"
            className="h-11 w-11 shrink-0 object-contain"
          />
          <div>
            <div className="text-base font-bold leading-tight text-stone-900">
              ပါဠိတက္ကသိုလ် ညောင်တုန်း
            </div>
            <div className="text-xs text-amber-800">ဗဟန်း-ညောင်တုန်းနွယ်ဖွား လိပ်စာမှတ်တမ်း</div>
          </div>
        </Link>

        <nav className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <Link
            href="/privacy"
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-stone-700 hover:bg-stone-100"
          >
            <FileText className="h-4 w-4" />
            <span>မူဝါဒ</span>
          </Link>

          {!loading && !user && (
            <>
              <Link
                href="/register"
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-800 px-4 py-2 text-white hover:bg-amber-900"
              >
                <span>စာရင်းသွင်းရန်</span>
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 py-2 text-stone-800 hover:bg-stone-50"
              >
                <LogIn className="h-4 w-4" />
                <span>Login ဝင်ရန်</span>
              </Link>
            </>
          )}

          {!loading && user && (
            <>
              {(user.profileStatus === "VERIFIED" || user.role === "ADMIN") && (
                <Link
                  href="/directory"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-amber-900 hover:bg-amber-100"
                >
                  <Users className="h-4 w-4" />
                  <span>ဗဟန်း-ညောင်တုန်းနွယ်ဖွား</span>
                </Link>
              )}

              <Link
                href="/profile"
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-stone-700 hover:bg-stone-100"
              >
                <User className="h-4 w-4" />
                <span>ကျွန်ုပ်၏ Profile</span>
              </Link>

              {user.role === "ADMIN" && (
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3 py-2 text-white hover:bg-stone-800"
                >
                  <ShieldCheck className="h-4 w-4" />
                  <span>Admin Panel</span>
                </Link>
              )}

              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-2 text-stone-700 hover:bg-stone-100"
              >
                <LogOut className="h-4 w-4" />
                <span>ထွက်ရန်</span>
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

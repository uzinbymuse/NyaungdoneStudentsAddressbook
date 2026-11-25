"use client";

import { Printer } from "lucide-react";

export function PrintTriggerButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-xl bg-amber-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-900"
    >
      <Printer className="h-4 w-4" />
      <span>Print / Save as PDF</span>
    </button>
  );
}

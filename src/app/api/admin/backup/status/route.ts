import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getLatestSnapshot } from "@/lib/backup";

function isMissingTable(err: unknown): boolean {
  return (err as { code?: string })?.code === "P2021";
}

/** Latest safety snapshot info (for the Undo box). */
export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Admin သာ လုပ်ဆောင်နိုင်ပါသည်။" }, { status: 403 });
  }
  try {
    const snapshot = await getLatestSnapshot();
    return NextResponse.json({ snapshot, needsDbPush: false });
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json({ snapshot: null, needsDbPush: true });
    }
    throw err;
  }
}

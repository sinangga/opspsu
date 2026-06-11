import { NextResponse } from "next/server";
import { getCachedPrakiraanSnapshot } from "@/lib/server/prakiraan-cache";

export async function GET() {
  try {
    const record = await getCachedPrakiraanSnapshot();
    return NextResponse.json(record, {
      headers: {
        "Cache-Control": "no-store, no-cache, max-age=0, must-revalidate",
        Pragma: "no-cache",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { fetchPrakiraanBatch } from "@/lib/bmkg";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const data = await fetchPrakiraanBatch();
    return NextResponse.json({ data }, {
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

import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const adm4 = searchParams.get('adm4');
    
    if (!adm4) {
      return NextResponse.json({ error: 'Missing adm4 parameter' }, { status: 400 });
    }

    const response = await fetch(`https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${adm4}`, { cache: 'no-store' });
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

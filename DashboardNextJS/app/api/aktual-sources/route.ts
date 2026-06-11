import { NextResponse } from "next/server";

const ROUND_MS = 5 * 60 * 1000; // 5 minutes

function currentBucketTs() {
  const now = Date.now();
  return Math.floor(now / ROUND_MS) * ROUND_MS;
}

export async function GET() {
  const cb = currentBucketTs();
  const satelitUrl = `https://inderaja.bmkg.go.id/IMAGE/HIMA/H08_EH_Kalbar.png?cb=${cb}`;
  const radarUrl = `https://inderaja.bmkg.go.id/Radar/SINT_SingleLayerCRefQC.png?cb=${cb}`;

  const body = { cb, satelitUrl, radarUrl };
  return new NextResponse(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Ensure no caching on the edge/client; server updates every bucket
      "Cache-Control": "no-store",
    },
  });
}


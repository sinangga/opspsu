import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params; // Fix 1: Await params
    console.log("Tracking API: Received ID from params:", id);
    
    if (!id) {
      return NextResponse.json({ error: "ID Tiket wajib diisi" }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Fix: Search by no_tiket instead of id (UUID)
    // We use eq() for exact match as no_tiket is short and user likely enters it fully
    // But to be safe with case sensitivity, we might want to ensure input is upper/lower matches db
    // Assuming no_tiket in DB is format 'X-xxxx' (mixed or upper).
    const { data: resultData, error } = await supabase
      .from("permohonan_data")
      .select("*")
      .eq('no_tiket', id) 
      .single();

    console.log("Tracking API: Supabase query result - Data:", resultData, "Error:", error);

    if (error || !resultData) {
      return NextResponse.json({ error: "Permohonan tidak ditemukan" }, { status: 404 });
    }

    // Return only necessary data for security
    const safeData = {
      id: resultData.id,
      no_tiket: resultData.no_tiket,
      status: resultData.status || 'pending',
      created_at: resultData.created_at,
      keperluan: resultData.keperluan,
      estimasi_biaya: resultData.estimasi_biaya,
      rejected_reason: resultData.rejected_reason,
      status_bayar: resultData.status_bayar,
    };

    return NextResponse.json({ success: true, data: safeData });

  } catch (error) {
    console.error("Tracking API Error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan server" }, { status: 500 });
  }
}

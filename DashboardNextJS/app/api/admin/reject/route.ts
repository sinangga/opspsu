import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { sendWhatsapp } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  try {
    const { id, reason, email, nama } = await req.json();

    if (!id || !reason) {
      return NextResponse.json({ error: "ID Permohonan dan Alasan wajib diisi" }, { status: 400 });
    }

    // Initialize Admin Client
    const supabase = createAdminClient();

    // 1. Update status di database
    const { data: updatedData, error: dbError } = await supabase
      .from("permohonan_data")
      .update({ 
        status: 'rejected',
        rejected_reason: reason
      })
      .eq('id', id)
      .select()
      .single();

    if (dbError) {
      console.error("Database Update Error:", dbError);
      return NextResponse.json({ 
        error: "Gagal update status database", 
        details: dbError.message 
      }, { status: 500 });
    }

    // 2. Kirim Notifikasi
    try {
      // Email Notification
      if (email || updatedData.email) {
        const targetEmail = email || updatedData.email;
        const targetName = nama || updatedData.nama;
        
        const emailHtml = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #ef4444; padding: 25px; text-align: center;">
              <h2 style="color: #ffffff; margin: 0;">Permohonan Belum Disetujui</h2>
            </div>
            <div style="padding: 30px; color: #334155; line-height: 1.6;">
              <p>Halo <strong>${targetName}</strong>,</p>
              <p>Terima kasih telah mengajukan permohonan data ke BMKG Pangsuma. Kami telah meninjau pengajuan Anda, namun saat ini kami <strong>belum dapat menyetujui</strong> permohonan tersebut.</p>
              
              <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <p style="margin: 0; font-weight: bold; color: #991b1b;">Alasan:</p>
                <p style="margin: 5px 0 0 0; color: #b91c1c;">${reason}</p>
              </div>

              <p>Jika Anda merasa ada kesalahan atau ingin melengkapi berkas yang kurang, silakan ajukan kembali permohonan Anda atau hubungi kami melalui WhatsApp untuk koordinasi lebih lanjut.</p>
              
              <p>Terima kasih atas pengertiannya.</p>
              
              <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                <p style="margin: 0; font-weight: bold;">Stasiun Meteorologi Pangsuma</p>
                <p style="margin: 0; font-size: 13px; color: #64748b;">Badan Meteorologi, Klimatologi, dan Geofisika</p>
              </div>
            </div>
          </div>
        `;

        await sendEmail({
          to: targetEmail,
          subject: `Status Permohonan Data BMKG: Belum Disetujui`,
          html: emailHtml,
          from: '"BMKG Pangsuma" <stamet.pangsuma@gmail.com>'
        });
      }

      // WhatsApp Notification
      if (updatedData.whatsapp) {
        const waMessage = `*Permohonan Belum Disetujui*

Halo ${updatedData.nama},
Mohon maaf, permohonan data Anda BELUM DAPAT DISETUJUI.

Alasan: ${reason}

Silakan cek email Anda untuk detail lebih lengkap atau hubungi kami jika ada pertanyaan.

Terima kasih.
BMKG Pangsuma`;

        await sendWhatsapp({
          to: updatedData.whatsapp,
          message: waMessage
        });
      }

    } catch (notifError) {
      console.error("Notification Sending Error:", notifError);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Unexpected Error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan server internal" }, { status: 500 });
  }
}

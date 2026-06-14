import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { sendWhatsapp } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  try {
    const { id, estimasi_biaya } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "ID Permohonan wajib diisi" }, { status: 400 });
    }

    // Initialize Admin Client
    const supabase = createAdminClient();

    // 1. Update status di database
    const { data: updatedData, error: dbError } = await supabase
      .from("permohonan_data")
      .update({ 
        status: 'approved',
        status_bayar: estimasi_biaya === 0 ? 'free' : 'pending',
        // QR Code will be uploaded in a separate step if needed
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

    // 2. Kirim Email & WhatsApp Notifikasi
    try {
      const isFree = updatedData.estimasi_biaya === 0;
      const cost = updatedData.estimasi_biaya?.toLocaleString('id-ID');

      // Email ke Admin
      const adminEmailHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #0f172a; padding: 20px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0;">Permohonan Data Disetujui</h2>
          </div>
          <div style="padding: 30px; color: #334155;">
            <p>Halo Admin,</p>
            <p>Sebuah permohonan data baru saja <strong>DISETUJUI</strong> dan menunggu proses selanjutnya.</p>
            
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">Pemohon</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; text-align: right;">${updatedData.nama}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">Keperluan</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; text-align: right;">${updatedData.keperluan}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">Estimasi Biaya</td>
                  <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #10b981;">Rp ${cost}</td>
                </tr>
              </table>
            </div>

            <p style="margin-top: 20px; font-size: 14px;">Silakan cek dashboard admin untuk memantau status pembayaran atau mengunggah dokumen data.</p>
          </div>
          <div style="background-color: #f1f5f9; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8;">
            &copy; ${new Date().getFullYear()} Stamet Pangsuma BMKG
          </div>
        </div>
      `;

      await sendEmail({
        to: ['stamet.pangsuma@bmkg.go.id', 'stamet.pangsuma@gmail.com'],
        subject: `[APPROVED] Permohonan Data: ${updatedData.nama}`,
        html: adminEmailHtml,
        from: '"BMKG Pangsuma System" <stamet.pangsuma@gmail.com>'
      });

      // Email ke Pemohon
      if (updatedData.email) {
        const applicantEmailHtml = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #0284c7; padding: 25px; text-align: center;">
              <h2 style="color: #ffffff; margin: 0;">Permohonan Disetujui</h2>
            </div>
            <div style="padding: 30px; color: #334155; line-height: 1.6;">
              <p>Halo <strong>${updatedData.nama}</strong>,</p>
              <p>Terima kasih telah menunggu. Permohonan data Anda telah <strong>DISETUJUI</strong> oleh tim BMKG Pangsuma.</p>
              
              <div style="background-color: #f0fdf4; border: 1px solid #dcfce7; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                  <span style="font-weight: bold; color: #166534;">STATUS: DISETUJUI</span>
                </div>
                <p style="margin: 0; color: #166534;">Estimasi Biaya: <strong style="font-size: 18px;">Rp ${cost}</strong></p>
              </div>

              ${!isFree ? `
                <div style="background-color: #fff7ed; border: 1px solid #ffedd5; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                  <p style="margin: 0; font-size: 14px; color: #9a3412;">
                    <strong>Langkah Selanjutnya:</strong><br>
                    Tim kami akan mengirimkan instruksi pembayaran (QRIS/Transfer) ke WhatsApp atau Email Anda. Setelah pembayaran diverifikasi, data akan segera kami kirimkan.
                  </p>
                </div>
              ` : `
                <p>Karena layanan ini bebas biaya (Gratis) sesuai ketentuan PNBP, tim kami akan segera memproses data Anda dan mengirimkannya dalam waktu dekat.</p>
              `}

              <p>Jika ada pertanyaan lebih lanjut, silakan hubungi kami melalui WhatsApp.</p>
              
              <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; pt-20px; padding-top: 20px;">
                <p style="margin: 0; font-weight: bold;">Stasiun Meteorologi Pangsuma</p>
                <p style="margin: 0; font-size: 13px; color: #64748b;">Badan Meteorologi, Klimatologi, dan Geofisika</p>
              </div>
            </div>
          </div>
        `;

        await sendEmail({
          to: updatedData.email,
          subject: `Status Permohonan Data BMKG: Disetujui`,
          html: applicantEmailHtml,
          from: '"BMKG Pangsuma" <stamet.pangsuma@gmail.com>'
        });
      }

      // WhatsApp ke Pemohon
      if (updatedData.whatsapp) {
        const waMessage = `*Permohonan Disetujui*

Halo ${updatedData.nama},
Permohonan data Anda telah kami SETUJUI.

Estimasi Biaya: Rp ${cost}

${!isFree 
  ? 'Mohon cek Email/WhatsApp Anda secara berkala, kami akan segera mengirimkan instruksi pembayaran.' 
  : 'Karena layanan ini GRATIS, data sedang kami proses dan akan segera dikirim.'}

Terima kasih.
BMKG Pangsuma`;

        await sendWhatsapp({
          to: updatedData.whatsapp,
          message: waMessage
        });
      }

    } catch (notifError) {
      // Log notification error but don't fail the request since DB update succeeded
      console.error("Notification Error:", notifError);
    }

    return NextResponse.json({ success: true, data: updatedData });

  } catch (error) {
    console.error("Unexpected Error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan server internal" }, { status: 500 });
  }
}

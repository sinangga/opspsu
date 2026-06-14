import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { sendWhatsapp } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  try {
    const { id, qr_code_url, virtual_account } = await req.json();

    if (!id) {
      return NextResponse.json({ error: "ID Permohonan wajib diisi" }, { status: 400 });
    }

    if (!qr_code_url && !virtual_account) {
      return NextResponse.json({ error: "Minimal salah satu (QR Code atau Virtual Account) harus diisi" }, { status: 400 });
    }

    // Initialize Admin Client
    const supabase = createAdminClient();

    // 1. Update database
    const updateData: any = {};
    if (qr_code_url !== undefined) updateData.qr_code_url = qr_code_url;
    if (virtual_account !== undefined) updateData.virtual_account = virtual_account;

    const { data: updatedData, error: dbError } = await supabase
      .from("permohonan_data")
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (dbError) {
      console.error("Database Update Error:", dbError);
      return NextResponse.json({ 
        error: "Gagal update data pembayaran", 
        details: dbError.message 
      }, { status: 500 });
    }

    // 2. Kirim Notifikasi
    try {
      // Email Notification
      if (updatedData.email) {
        // Get Public URL for QR if exists
        let qrImageUrl = "";
        if (updatedData.qr_code_url) {
          const { data } = supabase.storage.from("permohonan").getPublicUrl(updatedData.qr_code_url);
          qrImageUrl = data.publicUrl;
        }

        const cost = updatedData.estimasi_biaya?.toLocaleString('id-ID');

        const emailHtml = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #0284c7; padding: 25px; text-align: center;">
              <h2 style="color: #ffffff; margin: 0;">Tagihan Pembayaran</h2>
            </div>
            <div style="padding: 30px; color: #334155; line-height: 1.6;">
              <p>Halo <strong>${updatedData.nama}</strong>,</p>
              <p>Berikut adalah informasi pembayaran untuk permohonan data Anda.</p>
              
              <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <p style="margin: 0 0 10px 0; color: #64748b; font-size: 14px;">Total Tagihan</p>
                <p style="margin: 0; font-size: 24px; font-weight: bold; color: #0f172a;">Rp ${cost}</p>
              </div>

              ${updatedData.virtual_account ? `
                <div style="margin-bottom: 25px;">
                  <h3 style="font-size: 16px; color: #334155; margin-bottom: 10px;">Virtual Account</h3>
                  <div style="background-color: #f1f5f9; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 18px; letter-spacing: 1px; text-align: center; border: 1px dashed #cbd5e1;">
                    ${updatedData.virtual_account}
                  </div>
                </div>
              ` : ''}

              ${qrImageUrl ? `
                <div style="margin-bottom: 25px; text-align: center;">
                  <h3 style="font-size: 16px; color: #334155; margin-bottom: 15px;">QRIS / QR Code</h3>
                  <img src="${qrImageUrl}" alt="QR Code Pembayaran" style="max-width: 250px; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px;">
                  <p style="font-size: 12px; color: #64748b; margin-top: 5px;">Scan QR di atas menggunakan aplikasi pembayaran Anda.</p>
                </div>
              ` : ''}

              <div style="background-color: #fff7ed; border: 1px solid #ffedd5; border-radius: 8px; padding: 15px; margin-top: 20px;">
                <p style="margin: 0; font-size: 14px; color: #9a3412;">
                  <strong>Konfirmasi:</strong><br>
                  Setelah melakukan pembayaran, mohon konfirmasi ke kami melalui WhatsApp dengan menyertakan bukti transfer.
                </p>
              </div>

              <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; pt-20px; padding-top: 20px;">
                <p style="margin: 0; font-weight: bold;">Stasiun Meteorologi Pangsuma</p>
                <p style="margin: 0; font-size: 13px; color: #64748b;">Badan Meteorologi, Klimatologi, dan Geofisika</p>
              </div>
            </div>
          </div>
        `;

        await sendEmail({
          to: updatedData.email,
          subject: `Tagihan Pembayaran: ${updatedData.nama}`,
          html: emailHtml,
          from: '"BMKG Pangsuma" <stamet.pangsuma@gmail.com>'
        });
      }

      // WhatsApp Notification
      if (updatedData.whatsapp) {
        const cost = updatedData.estimasi_biaya?.toLocaleString('id-ID');
        const waMessage = `*Tagihan Pembayaran*

Halo ${updatedData.nama},
Berikut informasi pembayaran untuk permohonan data Anda.

Total Tagihan: Rp ${cost}
${updatedData.virtual_account ? `Virtual Account: ${updatedData.virtual_account}` : ''}

Silakan cek email Anda untuk melihat QRIS atau instruksi pembayaran lebih lengkap.

Mohon segera konfirmasi pembayaran jika sudah ditransfer.

Terima kasih.
BMKG Pangsuma`;

        await sendWhatsapp({
          to: updatedData.whatsapp,
          message: waMessage
        });
      }

    } catch (notifError) {
      console.error("Notification Error:", notifError);
    }

    return NextResponse.json({ success: true, data: updatedData });

  } catch (error) {
    console.error("Unexpected Error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan server internal" }, { status: 500 });
  }
}

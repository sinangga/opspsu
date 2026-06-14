import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email";
import { sendWhatsapp } from "@/lib/whatsapp";

export async function POST(req: NextRequest) {
  try {
    const { id, status } = await req.json();

    if (!id || !status) {
      return NextResponse.json({ error: "ID dan Status wajib diisi" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: updatedData, error: dbError } = await supabase
      .from("permohonan_data")
      .update({ status })
      .eq('id', id)
      .select()
      .single();

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 500 });
    }

    // Optional: Send email if status is 'completed'
    if (status === 'completed') {
      try {
        if (updatedData.email) {
          const emailHtml = `
            <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
              <div style="background-color: #1e293b; padding: 25px; text-align: center;">
                <h2 style="color: #ffffff; margin: 0;">Layanan Selesai</h2>
              </div>
              <div style="padding: 30px; color: #334155; line-height: 1.6;">
                <p>Halo <strong>${updatedData.nama}</strong>,</p>
                <p>Layanan permohonan data Anda dengan keperluan <strong>${updatedData.keperluan}</strong> telah kami tandai sebagai <strong>SELESAI</strong>.</p>
                
                <div style="background-color: #f0f9ff; border: 1px solid #e0f2fe; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
                  <p style="margin: 0; font-weight: bold; color: #0369a1;">Data telah dikirimkan / dapat diambil</p>
                  <p style="margin: 5px 0 0 0; color: #0c4a6e; font-size: 14px;">Silakan cek kotak masuk email Anda atau pesan WhatsApp kami.</p>
                </div>

                <p>Terima kasih telah mempercayai layanan dari Stasiun Meteorologi Pangsuma BMKG. Kami terus berkomitmen untuk memberikan pelayanan informasi meteorologi yang cepat, tepat, dan akurat.</p>
                
                <div style="margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                  <p style="margin: 0; font-weight: bold;">Stasiun Meteorologi Pangsuma</p>
                  <p style="margin: 0; font-size: 13px; color: #64748b;">Badan Meteorologi, Klimatologi, dan Geofisika</p>
                </div>
              </div>
            </div>
          `;

          await sendEmail({
            to: updatedData.email,
            subject: `Layanan BMKG Selesai: ${updatedData.keperluan}`,
            html: emailHtml,
            from: '"BMKG Pangsuma" <stamet.pangsuma@gmail.com>'
          });
        }

        // Send WhatsApp
        if (updatedData.whatsapp) {
          const waMessage = `*Permohonan Selesai*

Halo ${updatedData.nama},
Layanan permohonan data Anda (${updatedData.keperluan}) telah SELESAI.

Data telah kami kirimkan ke email Anda.

Terima kasih telah menggunakan layanan BMKG Pangsuma.`;

          await sendWhatsapp({
            to: updatedData.whatsapp,
            message: waMessage
          });
        }
      } catch (e) {
        console.error("Notification error:", e);
      }
    }

    return NextResponse.json({ success: true, data: updatedData });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

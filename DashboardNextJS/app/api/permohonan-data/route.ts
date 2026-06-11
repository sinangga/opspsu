import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { getBaseUrl } from "@/lib/url";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
      nama, 
      email, 
      whatsapp, 
      keperluan, 
      keterangan, 
      ktp_path, 
      berkas_path,
      universitas,
      nim,
      dosen_pembimbing,
      kontak_dosen,
      judul_skripsi,
      jumlah_hari,
      lokasi_kejadian,
      tanggal_mulai,
      tanggal_selesai,
      estimasi_biaya
    } = body;

    if (!nama || !keperluan) {
      return NextResponse.json(
        { error: "Nama dan Keperluan wajib diisi" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createServiceRoleClient();
    // Insert into Database
    const { data: insertedData, error: dbError } = await supabaseAdmin
      .from("permohonan_data")
      .insert({
        nama,
        email,
        whatsapp,
        keperluan,
        keterangan,
        ktp_url: ktp_path, 
        berkas_url: berkas_path,
        universitas,
        nim,
        dosen_pembimbing,
        kontak_dosen,
        judul_skripsi,
        jumlah_hari,
        lokasi_kejadian,
        tanggal_mulai,
        tanggal_selesai,
        estimasi_biaya,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database Insert Error:", dbError);
      return NextResponse.json(
        { error: "Gagal menyimpan data ke database: " + dbError.message },
        { status: 500 }
      );
    }

    // Gunakan no_tiket yang digenerate oleh database trigger
    // Fallback ke manual logic jika trigger belum aktif (untuk safety)
    const data = insertedData as any;
    const ticketId = data.no_tiket || data.id;
    const shortTicketId = data.no_tiket || ticketId.split('-')[0].toUpperCase();

    // Determine Base URL
    const baseUrl = getBaseUrl(req);

    // 1. Kirim Email Notifikasi ke Admin (Segera)
    try {
      const adminEmailHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
          <div style="background-color: #0f172a; padding: 20px; text-align: center;">
            <h2 style="color: #ffffff; margin: 0;">Permohonan Baru Masuk</h2>
            <p style="color: #94a3b8; margin: 5px 0 0 0;">ID Tiket: #${shortTicketId}</p>
          </div>
          <div style="padding: 30px; color: #334155;">
            <p>Halo Admin,</p>
            <p>Ada permohonan data baru yang perlu ditinjau.</p>
            
            <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">Pemohon</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; text-align: right;">${nama}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; color: #64748b;">Keperluan</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-weight: bold; text-align: right;">${keperluan}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #64748b;">WhatsApp</td>
                  <td style="padding: 8px 0; font-weight: bold; text-align: right;">${whatsapp || '-'}</td>
                </tr>
              </table>
            </div>

            <p style="margin-top: 20px; font-size: 14px; text-align: center;">
              <a href="${baseUrl}/admin" style="background-color: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Buka Dashboard Admin</a>
            </p>
          </div>
        </div>
      `;

      await sendEmail({
        to: 'stamet.pangsuma@gmail.com',
        subject: `[BARU] Permohonan Data: ${nama} (#${shortTicketId})`,
        html: adminEmailHtml,
        from: '"BMKG Pangsuma System" <stamet.pangsuma@gmail.com>'
      });
    } catch (e) {
      console.error("Admin Email Error:", e);
    }

    // 2. Kirim Email Notifikasi ke Pemohon (dengan Tiket ID)
    if (email) {
      try {
        const trackingUrl = `${baseUrl}/tracking?ticket=${ticketId}`;
        const applicantEmailHtml = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
            <div style="background-color: #0284c7; padding: 25px; text-align: center;">
              <h2 style="color: #ffffff; margin: 0;">Permohonan Diterima</h2>
              <p style="color: #e0f2fe; margin: 5px 0 0 0;">Nomor Tiket: #${shortTicketId}</p>
            </div>
            <div style="padding: 30px; color: #334155; line-height: 1.6;">
              <p>Halo <strong>${nama}</strong>,</p>
              <p>Terima kasih telah mengajukan permohonan data ke BMKG Pangsuma. Permohonan Anda telah kami terima dan akan segera ditinjau oleh tim kami.</p>
              
              <div style="background-color: #f0f9ff; border: 1px solid #e0f2fe; border-radius: 8px; padding: 20px; margin: 25px 0;">
                <p style="margin: 0; color: #0369a1; font-size: 14px; text-align: center;">
                  Gunakan nomor tiket di bawah ini untuk melacak status permohonan Anda:
                </p>
                <p style="margin: 10px 0 0 0; font-size: 24px; font-weight: bold; color: #0369a1; text-align: center; letter-spacing: 2px;">
                  ${shortTicketId}
                </p>
              </div>

              <p style="text-align: center;">
                <a href="${trackingUrl}" style="display: inline-block; background-color: #0284c7; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Lacak Status Sekarang</a>
              </p>

              <p style="margin-top: 30px; font-size: 13px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 20px;">
                *Mohon simpan nomor tiket ini. Kami akan memberikan update status melalui email atau WhatsApp setelah permohonan Anda ditinjau.
              </p>
            </div>
          </div>
        `;

        await sendEmail({
          to: email,
          subject: `Konfirmasi Permohonan Data BMKG - #${shortTicketId}`,
          html: applicantEmailHtml,
          from: '"BMKG Pangsuma" <stamet.pangsuma@gmail.com>'
        });
      } catch (e) {
        console.error("Applicant Email Error:", e);
      }
    }

    return NextResponse.json({ success: true, ticketId });
  } catch (error) {
    console.error("Unexpected Error:", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan server internal" },
      { status: 500 }
    );
  }
}
import nodemailer from 'nodemailer';

export async function sendEmail({
  to,
  subject,
  html,
  from
}: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: from || '"Stamet Pangsuma BMKG" <stamet.pangsuma@gmail.com>', // Updated to stamet.pangsuma@gmail.com
    to,
    subject,
    html,
  };

  return await transporter.sendMail(mailOptions);
}

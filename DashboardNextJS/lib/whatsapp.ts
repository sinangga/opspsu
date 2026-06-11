export async function sendWhatsapp({
  to,
  message,
}: {
  to: string;
  message: string;
}) {
  const token = process.env.FONNTE_TOKEN;

  if (!token) {
    console.warn("FONNTE_TOKEN is not set. WhatsApp notification skipped.");
    return;
  }

  // Basic formatting for Indonesian phone numbers
  // Fonnte expects numbers like 0812... or 62812...
  // We'll leave it as is if it starts with 0 or 62.
  let target = to;
  
  // Remove non-numeric characters just in case
  target = target.replace(/[^0-9]/g, '');

  try {
    const formData = new FormData();
    formData.append('target', target);
    formData.append('message', message);

    const response = await fetch('https://api.fonnte.com/send', {
      method: 'POST',
      headers: {
        Authorization: token,
      },
      body: formData,
    });

    const result = await response.json();
    console.log("Fonnte Response:", result);
    return result;
  } catch (error) {
    console.error("WhatsApp Sending Error:", error);
  }
}

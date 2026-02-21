/**
 * WhatsApp notification placeholder.
 * To enable: install twilio, set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in .env
 * Use case: send attendance confirmation to student's phone (unique number, one-time).
 * Proxy/VPN detection is not implemented here; rely on unique phone per student and optional OTP if needed.
 */

// const twilio = require('twilio');

export async function sendAttendanceConfirmation(phone, studentName, status) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return { ok: false, reason: 'WhatsApp not configured' };
  }
  // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // const to = phone.startsWith('+') ? `whatsapp:${phone}` : `whatsapp:+91${phone}`;
  // await client.messages.create({
  //   from: process.env.TWILIO_WHATSAPP_FROM,
  //   to,
  //   body: `Attendance marked: ${status} for ${studentName}. - Besant Attendance`
  // });
  return { ok: true };
}

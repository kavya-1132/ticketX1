const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'sandbox.smtp.mailtrap.io',
      port: Number(process.env.SMTP_PORT) || 2525,
      auth: {
        user: process.env.SMTP_USER || 'test_user',
        pass: process.env.SMTP_PASS || 'test_pass',
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }
  return transporter;
}

/**
 * Send booking confirmation email with embedded QR code
 */
async function sendTicketConfirmationEmail({ to, userName, eventTitle, seats, total, qrCodeDataUrl }) {
  try {
    const seatLabels = seats.map((s) => `Row ${s.row}, Seat ${s.number} (${s.section})`).join(', ');

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #6366f1; margin-bottom: 8px;">TicketX Booking Confirmed!</h1>
        <p>Hi <strong>${userName}</strong>,</p>
        <p>Your tickets for <strong>${eventTitle}</strong> are confirmed and ready.</p>
        <div style="background-color: #1e293b; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Seats:</strong> ${seatLabels}</p>
          <p style="margin: 4px 0;"><strong>Total Paid:</strong> $${total}</p>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <p style="font-size: 12px; color: #94a3b8; margin-bottom: 8px;">Show this QR code at the venue gate for admission:</p>
          ${qrCodeDataUrl ? `<img src="${qrCodeDataUrl}" alt="Ticket QR Code" style="width: 200px; height: 200px; border-radius: 8px; border: 4px solid #6366f1; background: white;" />` : ''}
        </div>
        <p style="font-size: 11px; color: #64748b; text-align: center;">TicketX &copy; 2026. Non-transferable ticket token.</p>
      </div>
    `;

    const transport = getTransporter();
    const info = await transport.sendMail({
      from: '"TicketX" <no-reply@ticketx.com>',
      to,
      subject: `Booking Confirmed: ${eventTitle} (TicketX)`,
      html: htmlContent,
    });

    // eslint-disable-next-line no-console
    console.log(`[Email] Ticket confirmation sent to ${to} (MessageId: ${info.messageId})`);
    return info;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[Email Warning] Could not deliver email to ${to}: ${error.message}`);
    return null;
  }
}

/**
 * Send waitlist offer email with 15-minute countdown alert
 */
async function sendWaitlistOfferEmail({ to, userName, eventTitle, seat, offerExpiresAt }) {
  try {
    const formattedExpiry = new Date(offerExpiresAt).toLocaleTimeString();
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; background-color: #0f172a; color: #f8fafc; padding: 24px; border-radius: 12px; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #10b981; margin-bottom: 8px;">A Seat Just Opened Up for You!</h1>
        <p>Hi <strong>${userName}</strong>,</p>
        <p>Good news! A ticket has become available from the waitlist for <strong>${eventTitle}</strong>.</p>
        <div style="background-color: #1e293b; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Offered Seat:</strong> Row ${seat.row}, Seat ${seat.number} (${seat.section})</p>
          <p style="margin: 4px 0;"><strong>Price:</strong> $${seat.price}</p>
          <p style="margin: 4px 0; color: #f59e0b;"><strong>Offer Expires At:</strong> ${formattedExpiry} (15 minutes)</p>
        </div>
        <p>Log in to TicketX now to claim your reserved seat before time runs out.</p>
        <p style="font-size: 11px; color: #64748b; text-align: center;">TicketX &copy; 2026. FIFO automated waitlist.</p>
      </div>
    `;

    const transport = getTransporter();
    const info = await transport.sendMail({
      from: '"TicketX Waitlist" <waitlist@ticketx.com>',
      to,
      subject: `Waitlist Seat Available: ${eventTitle} (Action Required)`,
      html: htmlContent,
    });

    // eslint-disable-next-line no-console
    console.log(`[Email] Waitlist offer sent to ${to} (MessageId: ${info.messageId})`);
    return info;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[Email Warning] Could not deliver waitlist email to ${to}: ${error.message}`);
    return null;
  }
}

module.exports = {
  sendTicketConfirmationEmail,
  sendWaitlistOfferEmail,
};

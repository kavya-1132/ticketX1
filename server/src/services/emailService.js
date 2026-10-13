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
    });
  }
  return transporter;
}

function emailEnabled() {
  // Tests never send mail; locally, mail is skipped until real SMTP credentials are set
  if (process.env.NODE_ENV === 'test') return false;
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

// Names and titles are user input, so escape them before putting them into HTML
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CLIENT_URL = () => process.env.CLIENT_URL || 'http://localhost:5173';

async function send(message, label) {
  if (!emailEnabled()) {
    // eslint-disable-next-line no-console
    if (process.env.NODE_ENV !== 'test') console.log(`[Email skipped - SMTP not configured] ${label} -> ${message.to}`);
    return null;
  }
  try {
    const info = await getTransporter().sendMail(message);
    // eslint-disable-next-line no-console
    console.log(`[Email] ${label} sent to ${message.to} (MessageId: ${info.messageId})`);
    return info;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`[Email Warning] Could not deliver ${label} to ${message.to}: ${error.message}`);
    return null;
  }
}

/**
 * Booking confirmation with the QR ticket attached inline (cid:ticket-qr).
 * Inline attachments display in Gmail/Outlook; data: URLs are stripped by most clients.
 */
async function sendTicketConfirmationEmail({ to, userName, eventTitle, startsAt, seats, total, qrPng, bookingId }) {
  const seatLabels = seats.map((s) => `Row ${esc(s.row)}, Seat ${esc(s.number)} (${esc(s.section)})`).join('<br/>');
  const when = startsAt ? new Date(startsAt).toUTCString() : '';

  const html = `
    <div style="font-family: Arial, sans-serif; background:#0f172a; color:#f8fafc; padding:24px; border-radius:12px; max-width:600px; margin:0 auto;">
      <h1 style="color:#818cf8; margin:0 0 8px;">Booking confirmed</h1>
      <p>Hi <strong>${esc(userName)}</strong>, your tickets for <strong>${esc(eventTitle)}</strong> are ready.</p>
      <div style="background:#1e293b; padding:16px; border-radius:8px; margin:16px 0;">
        ${when ? `<p style="margin:4px 0;"><strong>When:</strong> ${esc(when)}</p>` : ''}
        <p style="margin:4px 0;"><strong>Seats:</strong><br/>${seatLabels}</p>
        <p style="margin:4px 0;"><strong>Total paid:</strong> $${esc(total)}</p>
        <p style="margin:4px 0;"><strong>Booking ID:</strong> ${esc(bookingId)}</p>
      </div>
      <div style="text-align:center; margin:24px 0;">
        <p style="font-size:12px; color:#94a3b8;">Show this QR code at the entrance. It can be scanned once.</p>
        <img src="cid:ticket-qr" alt="Ticket QR code" width="220" height="220" style="background:#fff; border-radius:8px;" />
      </div>
      <p style="text-align:center;"><a href="${CLIENT_URL()}/my-tickets" style="color:#a5b4fc;">View in My Tickets</a></p>
    </div>`;

  return send(
    {
      from: '"TicketX" <no-reply@ticketx.com>',
      to,
      subject: `Your tickets: ${eventTitle}`,
      html,
      attachments: qrPng ? [{ filename: 'ticket-qr.png', content: qrPng, cid: 'ticket-qr' }] : [],
    },
    'Ticket confirmation'
  );
}

/**
 * A cancelled seat has been offered to this waitlisted customer for 15 minutes.
 */
async function sendWaitlistOfferEmail({ to, userName, eventTitle, eventId, seat, offerExpiresAt }) {
  const expiry = new Date(offerExpiresAt).toUTCString();
  const html = `
    <div style="font-family: Arial, sans-serif; background:#0f172a; color:#f8fafc; padding:24px; border-radius:12px; max-width:600px; margin:0 auto;">
      <h1 style="color:#34d399; margin:0 0 8px;">A seat opened up for you</h1>
      <p>Hi <strong>${esc(userName)}</strong>, a seat for <strong>${esc(eventTitle)}</strong> is being held for you.</p>
      <div style="background:#1e293b; padding:16px; border-radius:8px; margin:16px 0;">
        <p style="margin:4px 0;"><strong>Seat:</strong> Row ${esc(seat.row)}, Seat ${esc(seat.number)} (${esc(seat.section)})</p>
        <p style="margin:4px 0;"><strong>Price:</strong> $${esc(seat.price)}</p>
        <p style="margin:4px 0; color:#fbbf24;"><strong>Offer expires:</strong> ${esc(expiry)} (15 minutes)</p>
      </div>
      <p>If you don't book it in time, it goes to the next person in line.</p>
      <p style="text-align:center;"><a href="${CLIENT_URL()}/events/${esc(eventId)}" style="color:#a5b4fc;">Book this seat now</a></p>
    </div>`;

  return send(
    {
      from: '"TicketX Waitlist" <waitlist@ticketx.com>',
      to,
      subject: `A seat is waiting for you: ${eventTitle}`,
      html,
    },
    'Waitlist offer'
  );
}

module.exports = {
  sendTicketConfirmationEmail,
  sendWaitlistOfferEmail,
};

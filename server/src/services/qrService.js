const crypto = require('crypto');
const QRCode = require('qrcode');

/**
 * A ticket's QR code encodes only a random 128-bit token.
 * It contains no booking or user data, and it can't be guessed or forged.
 */
function generateQrToken() {
  return crypto.randomBytes(16).toString('hex');
}

function qrPayload(qrToken) {
  return `TICKETX:${qrToken}`;
}

/** Accepts either the raw token or the full "TICKETX:<token>" text a scanner returns. */
function parseQrPayload(text) {
  const value = String(text || '').trim();
  const token = value.startsWith('TICKETX:') ? value.slice('TICKETX:'.length) : value;
  return /^[a-f0-9]{32}$/.test(token) ? token : null;
}

function qrDataUrl(qrToken) {
  return QRCode.toDataURL(qrPayload(qrToken), { margin: 1, width: 320 });
}

function qrPngBuffer(qrToken) {
  return QRCode.toBuffer(qrPayload(qrToken), { margin: 1, width: 320 });
}

module.exports = {
  generateQrToken,
  qrPayload,
  parseQrPayload,
  qrDataUrl,
  qrPngBuffer,
};

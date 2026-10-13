const Seat = require('../models/Seat');
const WaitlistEntry = require('../models/WaitlistEntry');
const { emitSeatReleased } = require('../sockets/seatSocket');
const { offerFreedSeatToWaitlist, expireWaitlistOfferAndHandOff } = require('../services/waitlistService');

/**
 * Sweep expired held seats and expired waitlist offers back to available or next in FIFO
 * Runs every 30 seconds as specified
 */
async function cleanExpiredHolds(io) {
  try {
    const now = new Date();

    // 1. Sweep expired waitlist offers (15-min offer window passed)
    const expiredOffers = await WaitlistEntry.find({
      status: 'offered',
      offerExpiresAt: { $lt: now },
    });

    for (const offer of expiredOffers) {
      await expireWaitlistOfferAndHandOff(offer, io);
    }

    // 2. Sweep standard expired held seats (10-min hold window passed)
    const expiredSeats = await Seat.find({
      status: 'held',
      holdUntil: { $lt: now },
    });

    for (const seat of expiredSeats) {
      // Check if someone is on the waitlist for this event
      await offerFreedSeatToWaitlist(seat, io);
    }

    return expiredSeats.length + expiredOffers.length;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Seat Expiry Job Error]:', error.message);
    return 0;
  }
}

let intervalHandle = null;

function startSeatExpiryJob(io, intervalMs = 30000) {
  if (intervalHandle) {
    clearInterval(intervalHandle);
  }

  intervalHandle = setInterval(() => {
    cleanExpiredHolds(io);
  }, intervalMs);

  return intervalHandle;
}

function stopSeatExpiryJob() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

module.exports = {
  cleanExpiredHolds,
  startSeatExpiryJob,
  stopSeatExpiryJob,
};

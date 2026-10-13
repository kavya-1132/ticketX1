const Seat = require('../models/Seat');
const WaitlistEntry = require('../models/WaitlistEntry');
const Booking = require('../models/Booking');
const { handOffSeat, expireOfferAndHandOff, releaseCancelledSeats } = require('../services/waitlistService');

/**
 * Sweep expired waitlist offers and expired seat holds.
 * Runs every 30 seconds.
 *
 * Each seat is moved with handOffSeat(), whose writes are conditional on the seat still
 * being in the state we found it in. If a customer re-holds an expired seat between the
 * find() below and the update, that customer's hold wins and this job simply skips it.
 *
 * @returns {Promise<number>} how many offers/holds were actually processed
 */
async function cleanExpiredHolds(io, { offerDurationMs } = {}) {
  let processed = 0;

  try {
    const now = new Date();

    // 1. Expired waitlist offers (15-minute window passed) -> next person in line
    const expiredOffers = await WaitlistEntry.find(
      { status: 'offered', offerExpiresAt: { $lt: now } },
      { _id: 1 }
    );
    for (const offer of expiredOffers) {
      const result = await expireOfferAndHandOff(offer._id, io, offerDurationMs);
      if (result.outcome !== 'skipped') processed += 1;
    }

    // 2. Ordinary expired holds (10-minute checkout window passed)
    const expiredSeats = await Seat.find(
      { status: 'held', holdUntil: { $lt: new Date() } },
      { _id: 1, eventId: 1, heldBy: 1, holdUntil: 1 }
    );
    for (const seat of expiredSeats) {
      const result = await handOffSeat({
        seatId: seat._id,
        eventId: seat.eventId,
        // Same holder, same expiry: proves nobody re-held it since we read it
        seatStateFilter: { status: 'held', heldBy: seat.heldBy, holdUntil: seat.holdUntil },
        io,
        durationMs: offerDurationMs,
      });
      if (result.outcome !== 'skipped') processed += 1;
    }

    // 3. Self-healing: cancellations whose seats were never released (crash between steps)
    const stuck = await Booking.find({
      status: 'cancelled',
      seatsReleasedAt: null,
      cancelledAt: { $lt: new Date(Date.now() - 60 * 1000) },
    });
    for (const booking of stuck) {
      await releaseCancelledSeats(booking, io);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[Seat Expiry Job Error]:', error.message);
  }

  return processed;
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

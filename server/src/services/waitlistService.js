const WaitlistEntry = require('../models/WaitlistEntry');
const Seat = require('../models/Seat');
const Event = require('../models/Event');
const User = require('../models/User');
const { sendWaitlistOfferEmail } = require('./emailService');
const { emitSeatHeld, emitSeatReleased } = require('../sockets/seatSocket');

const OFFER_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Offers a freed seat to the earliest waiting user in FIFO order
 * If no users are waiting, releases the seat back to 'available'
 *
 * @param {Object} seat - Mongoose Seat document
 * @param {Object} io - Socket.IO instance
 * @param {number} [customDurationMs] - Optional override for testing
 * @returns {Promise<Object|null>} The matched waitlist entry or null if none waiting
 */
async function offerFreedSeatToWaitlist(seat, io, customDurationMs = null) {
  const duration = customDurationMs !== null ? customDurationMs : OFFER_DURATION_MS;
  const now = new Date();
  const offerExpiresAt = new Date(now.getTime() + duration);

  // FIFO: Find the earliest entry with status 'waiting'
  const earliestWaiting = await WaitlistEntry.findOne({
    eventId: seat.eventId,
    status: 'waiting',
  })
    .sort({ createdAt: 1 })
    .populate('userId');

  if (earliestWaiting) {
    // 1. Assign seat to waitlist user
    earliestWaiting.status = 'offered';
    earliestWaiting.offeredSeatId = seat._id;
    earliestWaiting.offerExpiresAt = offerExpiresAt;
    await earliestWaiting.save();

    // 2. Hold the seat for this user for 15 minutes
    seat.status = 'held';
    seat.heldBy = earliestWaiting.userId._id;
    seat.holdUntil = offerExpiresAt;
    seat.bookingId = null;
    await seat.save();

    // 3. Emit real-time Socket.IO update
    emitSeatHeld(io, seat.eventId, seat);

    // 4. Send email notification to user
    const event = await Event.findById(seat.eventId);
    if (earliestWaiting.userId && event) {
      sendWaitlistOfferEmail({
        to: earliestWaiting.userId.email,
        userName: earliestWaiting.userId.name,
        eventTitle: event.title,
        seat,
        offerExpiresAt,
      });
    }

    return earliestWaiting;
  }

  // Nobody waiting on the waitlist -> seat becomes 'available'
  seat.status = 'available';
  seat.heldBy = null;
  seat.holdUntil = null;
  seat.bookingId = null;
  await seat.save();

  emitSeatReleased(io, seat.eventId, seat._id);
  return null;
}

/**
 * Handle an expired waitlist offer:
 * Mark current offer 'expired', and move the seat to the next waiting user (FIFO)
 *
 * @param {Object} entry - WaitlistEntry document
 * @param {Object} io - Socket.IO instance
 * @param {number} [customDurationMs] - Optional duration for the next user
 */
async function expireWaitlistOfferAndHandOff(entry, io, customDurationMs = null) {
  entry.status = 'expired';
  await entry.save();

  const seat = await Seat.findById(entry.offeredSeatId);
  if (!seat) return null;

  // Hand off the seat to the next FIFO entry
  return offerFreedSeatToWaitlist(seat, io, customDurationMs);
}

module.exports = {
  OFFER_DURATION_MS,
  offerFreedSeatToWaitlist,
  expireWaitlistOfferAndHandOff,
};

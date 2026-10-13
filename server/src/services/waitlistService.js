const WaitlistEntry = require('../models/WaitlistEntry');
const Seat = require('../models/Seat');
const Event = require('../models/Event');
const User = require('../models/User');
const Booking = require('../models/Booking');
const { sendWaitlistOfferEmail } = require('./emailService');
const { emitSeatHeld, emitSeatReleased } = require('../sockets/seatSocket');

const OFFER_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

/**
 * Filter that matches a seat a customer could hold right now.
 * Shared with the hold endpoint and the join-waitlist check so "sold out" means the same thing everywhere.
 */
function claimableSeatFilter(eventId, now = new Date()) {
  return {
    eventId,
    $or: [{ status: 'available' }, { status: 'held', holdUntil: { $lt: now } }],
  };
}

/**
 * Hand a freed seat to the next customer on the waitlist, or make it available.
 *
 * WHY THIS IS SAFE UNDER CONCURRENCY
 * `seatStateFilter` describes the state the seat must STILL be in (e.g. "booked under the
 * cancelled booking" or "held by the user whose offer just expired"). Every write below is a
 * single findOneAndUpdate that includes that filter, so if anything else touched the seat in
 * the meantime (a customer grabbed an expired hold, another job run already handed it off),
 * the write matches nothing and we back off. There is no read-then-save of the seat.
 *
 * ORDER MATTERS: the seat is locked FIRST (held, no holder yet), and only the caller that won
 * that lock touches the queue. If the queue were claimed first, two concurrent runs could each
 * take a waiter and the later waiter might end up with the seat, breaking FIFO.
 * The waiting entry is then claimed with one findOneAndUpdate sorted by createdAt.
 *
 * @param {Object} params
 * @param {ObjectId|string} params.seatId
 * @param {ObjectId|string} params.eventId
 * @param {Object} params.seatStateFilter - extra conditions the seat must still satisfy
 * @param {Object} [params.io] - Socket.IO server
 * @param {number} [params.durationMs] - offer window (overridable in tests)
 * @returns {Promise<{outcome: 'offered'|'released'|'skipped', entry?: Object, seat?: Object}>}
 */
async function handOffSeat({ seatId, eventId, seatStateFilter, io, durationMs = OFFER_DURATION_MS }) {
  const now = new Date();
  const offerExpiresAt = new Date(now.getTime() + durationMs);

  // 1. Lock the seat: still in the expected state -> held by nobody until offerExpiresAt.
  //    Customers can't hold it (holdUntil is in the future), and no other hand-off can match it.
  const locked = await Seat.findOneAndUpdate(
    { _id: seatId, ...seatStateFilter },
    { $set: { status: 'held', heldBy: null, holdUntil: offerExpiresAt, bookingId: null } },
    { new: true }
  );
  if (!locked) return { outcome: 'skipped' };

  const lockFilter = { _id: seatId, status: 'held', heldBy: null, holdUntil: offerExpiresAt };

  // 2. Atomically claim the earliest waiting entry for this event (FIFO)
  const entry = await WaitlistEntry.findOneAndUpdate(
    { eventId, status: 'waiting' },
    { $set: { status: 'offered', offeredSeatId: seatId, offerExpiresAt } },
    { sort: { createdAt: 1, _id: 1 }, new: true }
  );

  if (entry) {
    // 3a. Give the locked seat to the waitlisted customer for the offer window
    const seat = await Seat.findOneAndUpdate(
      lockFilter,
      { $set: { heldBy: entry.userId } },
      { new: true }
    );
    if (!seat) {
      // Can't normally happen (we own the lock); keep the customer's place in the queue
      await WaitlistEntry.updateOne(
        { _id: entry._id, status: 'offered' },
        { $set: { status: 'waiting', offeredSeatId: null, offerExpiresAt: null } }
      );
      return { outcome: 'skipped' };
    }

    emitSeatHeld(io, eventId, seat);
    notifyOffer(entry, seat, offerExpiresAt);
    return { outcome: 'offered', entry, seat };
  }

  // 3b. Nobody waiting: the seat goes back on sale
  const seat = await Seat.findOneAndUpdate(
    lockFilter,
    { $set: { status: 'available', heldBy: null, holdUntil: null } },
    { new: true }
  );
  if (!seat) return { outcome: 'skipped' };

  emitSeatReleased(io, eventId, seatId);
  return { outcome: 'released', seat };
}

async function notifyOffer(entry, seat, offerExpiresAt) {
  try {
    const [user, event] = await Promise.all([User.findById(entry.userId), Event.findById(seat.eventId)]);
    if (user && event) {
      await sendWaitlistOfferEmail({
        to: user.email,
        userName: user.name,
        eventTitle: event.title,
        eventId: event._id.toString(),
        seat,
        offerExpiresAt,
      });
    }
  } catch (error) {
    // Email is best-effort; the offer itself is already recorded and visible in the app
    // eslint-disable-next-line no-console
    console.warn('[Waitlist] offer email failed:', error.message);
  }
}

/**
 * Called by the expiry job for an offer whose 15-minute window has passed.
 * Marks the offer expired and passes the seat to the next person in line.
 */
async function expireOfferAndHandOff(entryId, io, durationMs) {
  const now = new Date();

  // Atomically flip offered -> expired so two job runs cannot both process it
  const entry = await WaitlistEntry.findOneAndUpdate(
    { _id: entryId, status: 'offered', offerExpiresAt: { $lt: now } },
    { $set: { status: 'expired' } },
    { new: true }
  );
  if (!entry || !entry.offeredSeatId) return { outcome: 'skipped' };

  return handOffSeat({
    seatId: entry.offeredSeatId,
    eventId: entry.eventId,
    // Only move the seat if it is still the unclaimed offer for this user
    seatStateFilter: { status: 'held', heldBy: entry.userId, holdUntil: { $lt: now } },
    io,
    durationMs,
  });
}

/**
 * Join an event's waitlist. Only allowed when nothing is left to hold.
 * Re-joining after an expired or accepted offer puts the user at the back of the queue.
 */
async function joinWaitlist({ eventId, userId }) {
  const event = await Event.findById(eventId);
  if (!event) throw httpError(404, 'Event not found');
  if (event.status !== 'published') throw httpError(400, 'This event is not open for booking');

  const openSeats = await Seat.countDocuments(claimableSeatFilter(event._id));
  if (openSeats > 0) {
    throw httpError(400, 'Seats are still available for this event - book one instead of joining the waitlist');
  }

  const existing = await WaitlistEntry.findOne({ eventId, userId });
  if (existing && ['waiting', 'offered'].includes(existing.status)) {
    throw httpError(409, 'You are already on the waitlist for this event');
  }

  if (existing) {
    existing.status = 'waiting';
    existing.offeredSeatId = null;
    existing.offerExpiresAt = null;
    existing.createdAt = new Date();
    await existing.save();
    return existing;
  }

  return WaitlistEntry.create({ eventId, userId });
}

/**
 * Leave the waitlist. If the user is holding an offer, the seat moves on to the next person.
 */
async function leaveWaitlist({ eventId, userId, io }) {
  const entry = await WaitlistEntry.findOneAndDelete({
    eventId,
    userId,
    status: { $in: ['waiting', 'offered'] },
  });
  if (!entry) throw httpError(404, 'You are not on the waitlist for this event');

  if (entry.status === 'offered' && entry.offeredSeatId) {
    await handOffSeat({
      seatId: entry.offeredSeatId,
      eventId,
      seatStateFilter: { status: 'held', heldBy: userId },
      io,
    });
  }
  return entry;
}

/**
 * The caller's active waitlist entries, with queue position and any live offer.
 */
async function getMyWaitlist(userId) {
  const entries = await WaitlistEntry.find({ userId, status: { $in: ['waiting', 'offered'] } })
    .populate('eventId', 'title type startsAt')
    .populate('offeredSeatId', 'row number section price')
    .sort({ createdAt: 1 });

  // Skip entries whose event has since been deleted
  const live = entries.filter((entry) => entry.eventId);

  return Promise.all(
    live.map(async (entry) => {
      const obj = entry.toJSON();
      if (entry.status === 'waiting') {
        const ahead = await WaitlistEntry.countDocuments({
          eventId: entry.eventId._id,
          status: 'waiting',
          createdAt: { $lt: entry.createdAt },
        });
        obj.position = ahead + 1;
      }
      return obj;
    })
  );
}

/**
 * Hand every seat of a cancelled booking to the waitlist (or back on sale),
 * then record that the seats were released.
 */
async function releaseCancelledSeats(booking, io) {
  for (const seatId of booking.seatIds) {
    await handOffSeat({
      seatId,
      eventId: booking.eventId,
      // Only touch the seat while it still belongs to this cancelled booking
      seatStateFilter: { status: 'booked', bookingId: booking._id },
      io,
    });
  }
  await Booking.updateOne({ _id: booking._id }, { $set: { seatsReleasedAt: new Date() } });
}

/**
 * After a booking commits, mark any offers covering those seats as accepted.
 */
async function markOffersAccepted({ userId, eventId, seatIds }) {
  await WaitlistEntry.updateMany(
    { userId, eventId, status: 'offered', offeredSeatId: { $in: seatIds } },
    { $set: { status: 'accepted' } }
  );
}

module.exports = {
  OFFER_DURATION_MS,
  claimableSeatFilter,
  handOffSeat,
  expireOfferAndHandOff,
  joinWaitlist,
  leaveWaitlist,
  getMyWaitlist,
  markOffersAccepted,
  releaseCancelledSeats,
};

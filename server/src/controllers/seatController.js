const Seat = require('../models/Seat');
const { emitSeatHeld, emitSeatReleased } = require('../sockets/seatSocket');

/**
 * ATOMIC SEAT HOLD
 * POST /api/seats/:id/hold
 *
 * CONCURRENCY SAFETY & ATOMICITY GUARANTEE:
 * 1. WiredTiger document-level locking ensures only one write operation executes
 *    on a given seat document at any single point in time.
 * 2. By including the seat availability condition directly inside the query filter:
 *      { _id, eventId, $or: [ { status: 'available' }, { status: 'held', holdUntil: { $lt: now } } ] }
 *    MongoDB atomically checks the predicate AND writes the update in a SINGLE atomic step.
 * 3. If 50 concurrent requests arrive at the exact same millisecond:
 *    - The first thread acquires the document lock, matches the filter, updates status to 'held',
 *      and commits.
 *    - All other 49 threads inspect the document with status 'held' and holdUntil > now.
 *    - Their filter matches 0 documents, findOneAndUpdate returns null, and they receive HTTP 409 "Seat just taken".
 * 4. This completely eliminates the Time-Of-Check to Time-Of-Use (TOCTOU) race condition.
 *    We NEVER read the seat first and write second.
 */
async function holdSeat(req, res, next) {
  try {
    const seatId = req.params.id;
    const { eventId } = req.body;
    const userId = req.user._id;
    const now = new Date();

    if (!eventId) {
      return res.status(400).json({ error: 'eventId is required in body' });
    }

    // Rule 6: Max 6 seats held per customer per event
    const activeUserHolds = await Seat.countDocuments({
      eventId,
      heldBy: userId,
      status: 'held',
      holdUntil: { $gt: now },
    });

    if (activeUserHolds >= 6) {
      return res.status(400).json({ error: 'Maximum 6 seats held per customer per event' });
    }

    // 10-minute hold duration
    const holdDurationMs = 10 * 60 * 1000;
    const holdUntil = new Date(now.getTime() + holdDurationMs);

    // Atomic findOneAndUpdate with status filter
    const updatedSeat = await Seat.findOneAndUpdate(
      {
        _id: seatId,
        eventId,
        $or: [
          { status: 'available' },
          { status: 'held', holdUntil: { $lt: now } },
        ],
      },
      {
        $set: {
          status: 'held',
          heldBy: userId,
          holdUntil,
        },
      },
      {
        new: true,
      }
    );

    // No match -> someone else grabbed the lock or seat is already booked/held
    if (!updatedSeat) {
      return res.status(409).json({ error: 'Seat just taken' });
    }

    // Emit live Socket.IO update to all listeners in room event:<eventId>
    const io = req.app.get('io');
    emitSeatHeld(io, eventId, updatedSeat);

    return res.status(200).json({
      message: 'Seat held successfully',
      seat: updatedSeat,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * RELEASE SEAT EARLY
 * POST /api/seats/:id/release
 */
async function releaseSeat(req, res, next) {
  try {
    const seatId = req.params.id;
    const { eventId } = req.body;
    const userId = req.user._id;

    if (!eventId) {
      return res.status(400).json({ error: 'eventId is required in body' });
    }

    // Only the user holding the seat (or an admin) can release it early
    const filter = {
      _id: seatId,
      eventId,
      status: 'held',
    };

    if (req.user.role !== 'admin') {
      filter.heldBy = userId;
    }

    const updatedSeat = await Seat.findOneAndUpdate(
      filter,
      {
        $set: {
          status: 'available',
          heldBy: null,
          holdUntil: null,
        },
      },
      {
        new: true,
      }
    );

    if (!updatedSeat) {
      return res.status(404).json({ error: 'Seat not held by you or already released' });
    }

    // Emit live Socket.IO event
    const io = req.app.get('io');
    emitSeatReleased(io, eventId, seatId);

    return res.status(200).json({
      message: 'Seat released successfully',
      seat: updatedSeat,
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  holdSeat,
  releaseSeat,
};

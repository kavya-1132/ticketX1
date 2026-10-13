const mongoose = require('mongoose');
const Seat = require('../models/Seat');
const Booking = require('../models/Booking');
const { emitSeatBooked } = require('../sockets/seatSocket');

/**
 * CONFIRM BOOKING (MULTI-SEAT ATOMIC CONFIRMATION)
 * POST /api/bookings/confirm
 *
 * Runs inside a single MongoDB ACID Transaction across all selected seats:
 * 1. For every seat, atomically update with filter:
 *      { _id, status: 'held', heldBy: userId, holdUntil: { $gt: now } } -> status 'booked'
 * 2. If ANY seat update matches 0 documents (e.g. expired hold or stolen lock),
 *    the transaction is immediately ABORTED, rolling back all previously updated seats.
 * 3. A Booking record is created inside the transaction with status: 'confirmed'.
 * 4. The transaction commits atomically.
 */
async function confirmBooking(req, res, next) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { eventId, seatIds } = req.body;
    const userId = req.user._id;
    const now = new Date();

    if (!eventId || !Array.isArray(seatIds) || seatIds.length === 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ error: 'eventId and non-empty seatIds array are required' });
    }

    const confirmedSeatIds = [];
    let totalAmount = 0;

    for (const seatId of seatIds) {
      // Atomic verification and update per seat
      const updatedSeat = await Seat.findOneAndUpdate(
        {
          _id: seatId,
          eventId,
          status: 'held',
          heldBy: userId,
          holdUntil: { $gt: now },
        },
        {
          $set: {
            status: 'booked',
          },
        },
        {
          new: true,
          session,
        }
      );

      if (!updatedSeat) {
        // Any seat failure triggers transaction abort for all seats
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({
          error: `Seat ${seatId} hold has expired or is invalid. Booking has been safely aborted.`,
        });
      }

      confirmedSeatIds.push(updatedSeat._id);
      totalAmount += updatedSeat.price;
    }

    // Create booking document inside the transaction
    const [booking] = await Booking.create(
      [
        {
          userId,
          eventId,
          seatIds: confirmedSeatIds,
          total: totalAmount,
          status: 'confirmed',
          createdAt: now,
        },
      ],
      { session }
    );

    // Link bookingId to the booked seats inside the transaction
    await Seat.updateMany(
      { _id: { $in: confirmedSeatIds } },
      { $set: { bookingId: booking._id } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // Emit live Socket.IO notification to all clients watching room event:<eventId>
    const io = req.app.get('io');
    emitSeatBooked(io, eventId, confirmedSeatIds);

    return res.status(201).json({
      message: 'Booking successfully confirmed',
      booking,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
}

/**
 * Get current user's bookings
 * GET /api/bookings/my
 */
async function getMyBookings(req, res, next) {
  try {
    const bookings = await Booking.find({ userId: req.user._id })
      .populate('eventId', 'title type startsAt bannerUrl')
      .populate('seatIds', 'row number section price')
      .sort({ createdAt: -1 });

    return res.status(200).json({ bookings });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  confirmBooking,
  getMyBookings,
};

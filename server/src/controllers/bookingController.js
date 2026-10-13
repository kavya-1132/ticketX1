const mongoose = require('mongoose');
const Seat = require('../models/Seat');
const Booking = require('../models/Booking');
const Event = require('../models/Event');
const { emitSeatBooked } = require('../sockets/seatSocket');
const { generateQrToken, qrDataUrl, qrPngBuffer } = require('../services/qrService');
const { sendTicketConfirmationEmail, sendTicketTransferEmail } = require('../services/emailService');
const User = require('../models/User');
const { markOffersAccepted, releaseCancelledSeats } = require('../services/waitlistService');

/**
 * CONFIRM BOOKING (MULTI-SEAT ATOMIC CONFIRMATION)
 * POST /api/bookings/confirm
 *
 * Runs inside a single MongoDB ACID Transaction across all selected seats:
 * 1. For every seat, atomically update with filter:
 *      { _id, status: 'held', heldBy: userId, holdUntil: { $gt: now } } -> status 'booked'
 * 2. If ANY seat update matches 0 documents (e.g. expired hold or stolen lock),
 *    the transaction is immediately ABORTED, rolling back all previously updated seats.
 * 3. A Booking record (with its random QR token) is created inside the same transaction.
 * 4. The transaction commits atomically. Email + live updates happen only after commit.
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

    const uniqueSeatIds = [...new Set(seatIds.map(String))];
    const confirmedSeats = [];
    let totalAmount = 0;

    for (const seatId of uniqueSeatIds) {
      // Atomic verification and update per seat
      const updatedSeat = await Seat.findOneAndUpdate(
        {
          _id: seatId,
          eventId,
          status: 'held',
          heldBy: userId,
          holdUntil: { $gt: now },
        },
        { $set: { status: 'booked' } },
        { new: true, session }
      );

      if (!updatedSeat) {
        // Any seat failure triggers transaction abort for all seats
        await session.abortTransaction();
        session.endSession();
        return res.status(409).json({
          error: `Seat ${seatId} hold has expired or is invalid. Booking has been safely aborted.`,
        });
      }

      confirmedSeats.push(updatedSeat);
      totalAmount += updatedSeat.price;
    }

    const qrToken = generateQrToken();
    const confirmedSeatIds = confirmedSeats.map((s) => s._id);

    const [booking] = await Booking.create(
      [
        {
          userId,
          eventId,
          seatIds: confirmedSeatIds,
          total: totalAmount,
          status: 'confirmed',
          qrToken,
          createdAt: now,
        },
      ],
      { session }
    );

    // Link bookingId to the booked seats inside the transaction
    await Seat.updateMany(
      { _id: { $in: confirmedSeatIds } },
      { $set: { bookingId: booking._id, heldBy: null, holdUntil: null } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    // ---- After commit: nothing below can undo the booking ----

    // Seats that came from a waitlist offer: mark those offers accepted
    await markOffersAccepted({ userId, eventId, seatIds: confirmedSeatIds });

    const io = req.app.get('io');
    emitSeatBooked(io, eventId, confirmedSeatIds);

    sendConfirmationInBackground(req.user, eventId, confirmedSeats, booking, qrToken);

    const bookingJson = booking.toJSON();
    bookingJson.qrCode = await qrDataUrl(qrToken);

    return res.status(201).json({
      message: 'Booking successfully confirmed',
      booking: bookingJson,
    });
  } catch (error) {
    if (session.inTransaction()) await session.abortTransaction();
    session.endSession();
    next(error);
  }
}

function sendConfirmationInBackground(user, eventId, seats, booking, qrToken) {
  (async () => {
    const event = await Event.findById(eventId);
    const qrPng = await qrPngBuffer(qrToken);
    await sendTicketConfirmationEmail({
      to: user.email,
      userName: user.name,
      eventTitle: event ? event.title : 'your event',
      startsAt: event ? event.startsAt : null,
      seats,
      total: booking.total,
      qrPng,
      bookingId: booking._id.toString(),
    });
  })().catch((err) => {
    // eslint-disable-next-line no-console
    console.warn('[Booking] confirmation email failed:', err.message);
  });
}

/**
 * Shape a booking for its owner, including the QR image for confirmed tickets.
 */
async function toTicketJson(booking) {
  const obj = booking.toJSON();
  if (booking.status === 'confirmed' && booking.qrToken) {
    obj.qrCode = await qrDataUrl(booking.qrToken);
    // Same value the QR encodes, for typing in at the gate if a camera can't read the screen.
    // Only ever returned to the ticket's owner (or an admin).
    obj.ticketCode = booking.qrToken;
  }
  return obj;
}

/**
 * Get current user's bookings (newest first), each confirmed one with its QR code
 * GET /api/bookings/my
 */
async function getMyBookings(req, res, next) {
  try {
    const bookings = await Booking.find({ userId: req.user._id })
      .populate({
        path: 'eventId',
        select: 'title type startsAt bannerUrl venueId',
        populate: { path: 'venueId', select: 'name city' },
      })
      .populate('seatIds', 'row number section price')
      .sort({ createdAt: -1 });

    const tickets = await Promise.all(bookings.map(toTicketJson));
    return res.status(200).json({ bookings: tickets });
  } catch (error) {
    next(error);
  }
}

/**
 * Get one booking (owner or admin only)
 * GET /api/bookings/:id
 */
async function getBookingById(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate({
        path: 'eventId',
        select: 'title type startsAt venueId',
        populate: { path: 'venueId', select: 'name city' },
      })
      .populate('seatIds', 'row number section price');

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const isOwner = booking.userId.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== 'admin') {
      // Same response as "not found" so booking IDs can't be probed
      return res.status(404).json({ error: 'Booking not found' });
    }

    return res.status(200).json({ booking: await toTicketJson(booking) });
  } catch (error) {
    next(error);
  }
}

/**
 * Cancel a confirmed booking
 * POST /api/bookings/:id/cancel
 *
 * 1. One atomic update flips the booking confirmed -> cancelled, and only for its owner,
 *    only if it hasn't been scanned at the gate, and only before the event starts.
 *    Two cancel clicks can't both succeed.
 * 2. Each seat is then offered to the next person on the waitlist (FIFO) or put back on sale.
 */
async function cancelBooking(req, res, next) {
  try {
    const booking = await Booking.findOne({ _id: req.params.id, userId: req.user._id });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const event = await Event.findById(booking.eventId);
    if (event && new Date(event.startsAt) <= new Date()) {
      return res.status(400).json({ error: 'This event has already started and can no longer be cancelled' });
    }

    const cancelled = await Booking.findOneAndUpdate(
      { _id: booking._id, userId: req.user._id, status: 'confirmed', checkedInAt: null },
      { $set: { status: 'cancelled', cancelledAt: new Date() } },
      { new: true }
    );

    if (!cancelled) {
      return res.status(409).json({ error: 'Booking is already cancelled or the ticket has been used' });
    }

    await releaseCancelledSeats(cancelled, req.app.get('io'));

    return res.status(200).json({ message: 'Booking cancelled', booking: cancelled });
  } catch (error) {
    next(error);
  }
}

/**
 * Send a ticket to a friend
 * POST /api/bookings/:id/transfer   { email }
 *
 * One atomic update moves the booking to the recipient AND issues a new QR token, conditioned
 * on the booking still belonging to the sender, being confirmed and not yet scanned. So:
 *  - the sender's old QR code stops working the moment the transfer happens,
 *  - two transfers (or a transfer and a gate scan) racing each other can't both win.
 */
async function transferBooking(req, res, next) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const sender = req.user;

    if (email === sender.email.toLowerCase()) {
      return res.status(400).json({ error: "You can't send a ticket to yourself" });
    }

    const recipient = await User.findOne({ email });
    if (!recipient || recipient.isBlocked) {
      return res.status(404).json({ error: 'No TicketX customer has that email. Ask your friend to sign up first.' });
    }
    if (recipient.role !== 'customer') {
      return res.status(400).json({ error: 'Tickets can only be sent to customer accounts' });
    }

    const booking = await Booking.findOne({ _id: req.params.id, userId: sender._id });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    const event = await Event.findById(booking.eventId);
    if (event && new Date(event.startsAt) <= new Date()) {
      return res.status(400).json({ error: 'This event has already started' });
    }

    const newToken = generateQrToken();
    const moved = await Booking.findOneAndUpdate(
      { _id: booking._id, userId: sender._id, status: 'confirmed', checkedInAt: null },
      { $set: { userId: recipient._id, qrToken: newToken }, $push: { transferredFrom: sender._id } },
      { new: true }
    ).populate('seatIds', 'row number section');

    if (!moved) {
      return res.status(409).json({ error: 'This ticket was cancelled, used or already sent' });
    }

    (async () => {
      const qrPng = await qrPngBuffer(newToken);
      await sendTicketTransferEmail({
        to: recipient.email,
        userName: recipient.name,
        fromName: sender.name,
        eventTitle: event ? event.title : 'your event',
        seats: moved.seatIds,
        qrPng,
        bookingId: moved._id.toString(),
      });
    })().catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[Booking] transfer email failed:', err.message);
    });

    return res.status(200).json({
      message: `Ticket sent to ${recipient.name}`,
      recipient: { name: recipient.name, email: recipient.email },
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  confirmBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  transferBooking,
};

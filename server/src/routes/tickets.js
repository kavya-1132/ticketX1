const express = require('express');
const { body } = require('express-validator');
const { auth, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const Booking = require('../models/Booking');
const { parseQrPayload } = require('../services/qrService');

const router = express.Router();

/**
 * POST /api/tickets/verify   { qrToken }
 * Organiser (for their own events) or admin scans a ticket at the gate.
 *
 * Check-in is one atomic update conditioned on checkedInAt: null, so the same QR code
 * scanned twice (or at two gates at once) is admitted exactly once.
 */
router.post(
  '/verify',
  auth,
  requireRole('organiser', 'admin'),
  validate([body('qrToken').isString().notEmpty().withMessage('qrToken is required')]),
  async (req, res, next) => {
    try {
      const token = parseQrPayload(req.body.qrToken);
      if (!token) return res.status(400).json({ error: 'Not a TicketX QR code' });

      const booking = await Booking.findOne({ qrToken: token })
        .populate('eventId', 'title startsAt organiserId')
        .populate('userId', 'name email')
        .populate('seatIds', 'row number section');

      if (!booking) return res.status(404).json({ valid: false, error: 'Ticket not found' });

      const isOwnEvent = booking.eventId && booking.eventId.organiserId.toString() === req.user._id.toString();
      if (!isOwnEvent && req.user.role !== 'admin') {
        return res.status(403).json({ valid: false, error: 'This ticket is for an event you do not organise' });
      }

      if (booking.status !== 'confirmed') {
        return res.status(409).json({ valid: false, error: 'Ticket was cancelled' });
      }

      const checkedIn = await Booking.findOneAndUpdate(
        { _id: booking._id, status: 'confirmed', checkedInAt: null },
        { $set: { checkedInAt: new Date() } },
        { new: true }
      );

      if (!checkedIn) {
        const fresh = await Booking.findById(booking._id);
        return res.status(409).json({
          valid: false,
          error: 'Ticket already used',
          checkedInAt: fresh ? fresh.checkedInAt : null,
        });
      }

      return res.status(200).json({
        valid: true,
        message: 'Ticket valid - admit',
        ticket: {
          bookingId: booking._id.toString(),
          event: booking.eventId ? booking.eventId.title : 'Unknown event',
          customer: booking.userId ? booking.userId.name : 'Unknown',
          seats: booking.seatIds.map((s) => `${s.row}${s.number} (${s.section})`),
          checkedInAt: checkedIn.checkedInAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;

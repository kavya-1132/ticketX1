const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event ID is required'],
    index: true,
  },
  seatIds: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seat',
      required: true,
    },
  ],
  total: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total cannot be negative'],
  },
  status: {
    type: String,
    enum: ['confirmed', 'cancelled'],
    default: 'confirmed',
    index: true,
  },
  qrToken: {
    type: String,
    index: true,
    sparse: true,
  },
  // Set once when an organiser scans the ticket at the gate; a second scan is rejected
  checkedInAt: {
    type: Date,
    default: null,
  },
  cancelledAt: {
    type: Date,
    default: null,
  },
  // Previous owners, oldest first (filled when a ticket is sent to someone else)
  transferredFrom: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  ],
  // Set after a cancelled booking's seats have been handed to the waitlist / put back on sale.
  // The expiry job retries any cancellation where this is still null (e.g. server crashed mid-way).
  seatsReleasedAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

bookingSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj.__v;
  // The QR token is the ticket itself; it is only sent to the owner through the ticket endpoints
  delete obj.qrToken;
  return obj;
};

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;

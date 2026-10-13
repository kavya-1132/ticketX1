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
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

bookingSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj.__v;
  return obj;
};

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;

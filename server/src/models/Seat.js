const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event ID is required'],
    index: true,
  },
  row: {
    type: String,
    required: [true, 'Seat row is required'],
  },
  number: {
    type: Number,
    required: [true, 'Seat number is required'],
  },
  section: {
    type: String,
    required: [true, 'Section is required'],
    default: 'General',
  },
  price: {
    type: Number,
    required: [true, 'Seat price is required'],
    min: [0, 'Price cannot be negative'],
  },
  status: {
    type: String,
    enum: ['available', 'held', 'booked'],
    default: 'available',
    index: true,
  },
  heldBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  holdUntil: {
    type: Date,
    default: null,
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null,
  },
});

// Indexes required by the spec:
// 1. Efficient event seat filtering by status
seatSchema.index({ eventId: 1, status: 1 });

// 2. High performance background hold expiration queries
seatSchema.index({ status: 1, holdUntil: 1 });

// 3. Strict uniqueness per event, row, and number (prevents duplicate seat generation)
seatSchema.index({ eventId: 1, row: 1, number: 1 }, { unique: true });

seatSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj.__v;
  return obj;
};

const Seat = mongoose.model('Seat', seatSchema);

module.exports = Seat;

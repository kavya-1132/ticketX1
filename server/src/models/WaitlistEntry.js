const mongoose = require('mongoose');

const waitlistEntrySchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: [true, 'Event ID is required'],
    index: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User ID is required'],
    index: true,
  },
  status: {
    type: String,
    enum: ['waiting', 'offered', 'accepted', 'expired'],
    default: 'waiting',
    index: true,
  },
  offeredSeatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seat',
    default: null,
  },
  offerExpiresAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
});

// Compound unique index: One entry per user per event
waitlistEntrySchema.index({ eventId: 1, userId: 1 }, { unique: true });

// FIFO query index: Find earliest 'waiting' entry for an event
waitlistEntrySchema.index({ eventId: 1, status: 1, createdAt: 1 });

// Expiry sweeper index
waitlistEntrySchema.index({ status: 1, offerExpiresAt: 1 });

waitlistEntrySchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj.__v;
  return obj;
};

const WaitlistEntry = mongoose.model('WaitlistEntry', waitlistEntrySchema);

module.exports = WaitlistEntry;

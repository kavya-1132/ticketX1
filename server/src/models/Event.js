const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Event title is required'],
    trim: true,
  },
  type: {
    type: String,
    required: [true, 'Event type is required'],
    enum: {
      values: ['movie', 'concert'],
      message: '{VALUE} is not a valid event type (must be movie or concert)',
    },
    index: true,
  },
  venueId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Venue',
    required: [true, 'Venue reference is required'],
    index: true,
  },
  organiserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Organiser reference is required'],
    index: true,
  },
  startsAt: {
    type: Date,
    required: [true, 'Event start time is required'],
    index: true,
  },
  priceBySection: {
    type: Map,
    of: Number,
    required: [true, 'Price by section mapping is required'],
  },
  status: {
    type: String,
    enum: ['draft', 'published', 'completed', 'cancelled'],
    default: 'published',
    index: true,
  },
  description: {
    type: String,
    default: '',
  },
  bannerUrl: {
    type: String,
    default: '',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

eventSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj.__v;
  return obj;
};

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;

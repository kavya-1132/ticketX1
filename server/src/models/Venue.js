const mongoose = require('mongoose');

const venueSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Venue name is required'],
    trim: true,
  },
  city: {
    type: String,
    required: [true, 'City is required'],
    trim: true,
    index: true,
  },
  layout: {
    rows: {
      type: [String],
      required: [true, 'Rows layout is required'],
      default: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
    },
    seatsPerRow: {
      type: Number,
      required: [true, 'Seats per row is required'],
      min: [1, 'Must have at least 1 seat per row'],
    },
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

venueSchema.methods.toJSON = function () {
  const obj = this.toObject();
  obj.id = obj._id.toString();
  delete obj.__v;
  return obj;
};

const Venue = mongoose.model('Venue', venueSchema);

module.exports = Venue;

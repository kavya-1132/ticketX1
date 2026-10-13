const Seat = require('../models/Seat');

/**
 * Helper to determine section based on row position
 */
function getSectionForRow(rowIndex, totalRows, availableSections) {
  if (!availableSections || availableSections.length === 0) {
    return 'General';
  }
  if (availableSections.length === 1) {
    return availableSections[0];
  }

  const ratio = rowIndex / totalRows;
  if (availableSections.includes('VIP') && ratio < 0.25) {
    return 'VIP';
  }
  if (availableSections.includes('Premium') && ratio < 0.6) {
    return 'Premium';
  }
  if (availableSections.includes('General')) {
    return 'General';
  }

  return availableSections[0];
}

/**
 * Generate seat documents for an event based on venue layout
 * @param {Object} event - Event document
 * @param {Object} venue - Venue document
 * @param {Object} [session] - Optional MongoDB transaction session
 * @returns {Promise<Array>} Inserted seats
 */
async function generateSeatsForEvent(event, venue, session = null) {
  const { rows, seatsPerRow } = venue.layout;
  const priceMap = event.priceBySection instanceof Map
    ? Object.fromEntries(event.priceBySection)
    : event.priceBySection || {};

  const availableSections = Object.keys(priceMap);
  const fallbackPrice = Object.values(priceMap)[0] || 50;

  const seatsToInsert = [];

  rows.forEach((row, rowIndex) => {
    const section = getSectionForRow(rowIndex, rows.length, availableSections);
    const price = priceMap[section] !== undefined ? priceMap[section] : fallbackPrice;

    for (let seatNumber = 1; seatNumber <= seatsPerRow; seatNumber++) {
      seatsToInsert.push({
        eventId: event._id,
        row,
        number: seatNumber,
        section,
        price,
        status: 'available',
        heldBy: null,
        holdUntil: null,
        bookingId: null,
      });
    }
  });

  const insertOptions = session ? { session } : {};
  return Seat.insertMany(seatsToInsert, insertOptions);
}

module.exports = {
  generateSeatsForEvent,
  getSectionForRow,
};

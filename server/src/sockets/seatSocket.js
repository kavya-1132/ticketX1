/**
 * Socket.IO Room & Seat Event Management
 * Each event has a dedicated room: event:<eventId>
 */

function setupSeatSockets(io) {
  io.on('connection', (socket) => {
    socket.on('join:event', (eventId) => {
      if (eventId) {
        socket.join(`event:${eventId}`);
      }
    });

    socket.on('leave:event', (eventId) => {
      if (eventId) {
        socket.leave(`event:${eventId}`);
      }
    });
  });
}

function emitSeatHeld(io, eventId, seat) {
  if (!io) return;
  io.to(`event:${eventId}`).emit('seat:held', {
    seatId: seat._id.toString(),
    eventId: eventId.toString(),
    row: seat.row,
    number: seat.number,
    section: seat.section,
    status: 'held',
    heldBy: seat.heldBy ? seat.heldBy.toString() : null,
    holdUntil: seat.holdUntil,
  });
}

function emitSeatReleased(io, eventId, seatId) {
  if (!io) return;
  io.to(`event:${eventId}`).emit('seat:released', {
    seatId: seatId.toString(),
    eventId: eventId.toString(),
    status: 'available',
  });
}

function emitSeatBooked(io, eventId, seatIds) {
  if (!io) return;
  const ids = Array.isArray(seatIds) ? seatIds.map((id) => id.toString()) : [seatIds.toString()];
  io.to(`event:${eventId}`).emit('seat:booked', {
    seatIds: ids,
    eventId: eventId.toString(),
    status: 'booked',
  });
}

module.exports = {
  setupSeatSockets,
  emitSeatHeld,
  emitSeatReleased,
  emitSeatBooked,
};

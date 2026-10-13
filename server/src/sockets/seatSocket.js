/**
 * Socket.IO Room & Seat Event Management
 * Each event has a dedicated room: event:<eventId>
 */

const ROOM = (eventId) => `event:${eventId}`;

/** Tell everyone looking at an event how many people are looking at it right now. */
function broadcastViewers(io, eventId) {
  const room = io.sockets.adapter.rooms.get(ROOM(eventId));
  io.to(ROOM(eventId)).emit('viewers:count', { eventId: String(eventId), count: room ? room.size : 0 });
}

function setupSeatSockets(io) {
  io.on('connection', (socket) => {
    socket.on('join:event', (eventId) => {
      if (!eventId || typeof eventId !== 'string' || eventId.length > 64) return;
      socket.join(ROOM(eventId));
      broadcastViewers(io, eventId);
    });

    socket.on('leave:event', (eventId) => {
      if (!eventId || typeof eventId !== 'string') return;
      socket.leave(ROOM(eventId));
      broadcastViewers(io, eventId);
    });

    // Before the socket's rooms are cleared, update the counts of every event it was viewing
    socket.on('disconnecting', () => {
      const events = [...socket.rooms].filter((r) => r.startsWith('event:')).map((r) => r.slice(6));
      setImmediate(() => events.forEach((id) => broadcastViewers(io, id)));
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

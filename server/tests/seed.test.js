const User = require('../src/models/User');
const { seedUsers } = require('../src/utils/seed');

describe('Database Seed Script', () => {
  it('should seed 1 admin, 2 organisers, and 5 customers', async () => {
    // Run seed routine against in-memory replica set
    await seedUsers();

    const totalUsers = await User.countDocuments();
    expect(totalUsers).toBe(8);

    const admins = await User.find({ role: 'admin' });
    expect(admins.length).toBe(1);
    expect(admins[0].email).toBe('admin@ticketx.com');

    const organisers = await User.find({ role: 'organiser' });
    expect(organisers.length).toBe(2);
    const orgEmails = organisers.map((o) => o.email).sort();
    expect(orgEmails).toEqual(['cinema@ticketx.com', 'concerts@ticketx.com']);

    const customers = await User.find({ role: 'customer' });
    expect(customers.length).toBe(5);
    const custEmails = customers.map((c) => c.email).sort();
    expect(custEmails).toEqual([
      'alice@ticketx.com',
      'bob@ticketx.com',
      'charlie@ticketx.com',
      'diana@ticketx.com',
      'evan@ticketx.com',
    ]);

    // Test password verification for seeded user
    const alice = await User.findOne({ email: 'alice@ticketx.com' });
    expect(alice).not.toBeNull();
    const isPasswordValid = await alice.comparePassword('Password123!');
    expect(isPasswordValid).toBe(true);

    // Verify events created
    const Venue = require('../src/models/Venue');
    const Event = require('../src/models/Event');
    const Seat = require('../src/models/Seat');

    const Booking = require('../src/models/Booking');

    const venues = await Venue.find({});
    expect(venues.length).toBe(4);

    const events = await Event.find({});
    expect(events.length).toBe(4);

    // The 3 main events each have 200+ seats, all available
    const mainEvents = events.filter((ev) => !ev.title.includes('Waitlist Demo'));
    expect(mainEvents.length).toBe(3);
    for (const ev of mainEvents) {
      const seatsCount = await Seat.countDocuments({ eventId: ev._id });
      expect(seatsCount).toBeGreaterThanOrEqual(200);
    }

    // The waitlist demo event is completely sold out, split across 2 bookings
    const demo = events.find((ev) => ev.title.includes('Waitlist Demo'));
    expect(await Seat.countDocuments({ eventId: demo._id })).toBe(12);
    expect(await Seat.countDocuments({ eventId: demo._id, status: 'booked' })).toBe(12);
    expect(await Booking.countDocuments({ eventId: demo._id, status: 'confirmed' })).toBe(2);
  });
});

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

    // Verify 3 events created
    const Venue = require('../src/models/Venue');
    const Event = require('../src/models/Event');
    const Seat = require('../src/models/Seat');

    const venues = await Venue.find({});
    expect(venues.length).toBe(3);

    const events = await Event.find({});
    expect(events.length).toBe(3);

    // Verify each event has 200+ seats
    for (const ev of events) {
      const seatsCount = await Seat.countDocuments({ eventId: ev._id });
      expect(seatsCount).toBeGreaterThanOrEqual(200);
    }
  });
});

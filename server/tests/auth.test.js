const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/User');
const { generateToken } = require('../src/utils/jwt');

describe('Auth & Role Access Control API', () => {
  describe('POST /api/auth/register', () => {
    it('should successfully register a customer and return token and user', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Jane Customer',
          email: 'jane@example.com',
          password: 'securePassword123',
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.name).toBe('Jane Customer');
      expect(res.body.user.email).toBe('jane@example.com');
      expect(res.body.user.role).toBe('customer');
      expect(res.body.user.passwordHash).toBeUndefined();

      // Verify user in database
      const userInDb = await User.findOne({ email: 'jane@example.com' });
      expect(userInDb).not.toBeNull();
      expect(userInDb.passwordHash).not.toBe('securePassword123');
    });

    it('should register an organiser when role="organiser" is provided', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Music Fest Host',
          email: 'host@musicfest.com',
          password: 'securePassword123',
          role: 'organiser',
        });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('organiser');
    });

    it('should reject registration if email is invalid', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Bad Email',
          email: 'not-an-email',
          password: 'securePassword123',
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    it('should reject registration if password is under 6 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Short Pass',
          email: 'short@example.com',
          password: '123',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/at least 6 characters/i);
    });

    it('should return 409 if email is already registered', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Original User',
          email: 'duplicate@example.com',
          password: 'password123',
        });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Copycat User',
          email: 'duplicate@example.com',
          password: 'password123',
        });

      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already registered/i);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Login User',
          email: 'login@example.com',
          password: 'Password123!',
        });
    });

    it('should successfully log in with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.email).toBe('login@example.com');
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('should fail with 401 on incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid email or password/i);
    });

    it('should fail with 401 on non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/invalid email or password/i);
    });

    it('should fail with 403 if the user is blocked', async () => {
      const user = await User.findOne({ email: 'login@example.com' });
      user.isBlocked = true;
      await user.save();

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'Password123!',
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/account is blocked/i);
    });
  });

  describe('GET /api/auth/me & Role Middleware', () => {
    let customerToken;
    let organiserToken;
    let adminToken;
    let blockedToken;

    beforeEach(async () => {
      const customer = await User.create({
        name: 'Cust User',
        email: 'cust@example.com',
        passwordHash: 'dummyhash',
        role: 'customer',
      });
      customerToken = generateToken(customer);

      const organiser = await User.create({
        name: 'Org User',
        email: 'org@example.com',
        passwordHash: 'dummyhash',
        role: 'organiser',
      });
      organiserToken = generateToken(organiser);

      const admin = await User.create({
        name: 'Admin User',
        email: 'admin@example.com',
        passwordHash: 'dummyhash',
        role: 'admin',
      });
      adminToken = generateToken(admin);

      const blockedUser = await User.create({
        name: 'Blocked User',
        email: 'blocked@example.com',
        passwordHash: 'dummyhash',
        role: 'customer',
        isBlocked: true,
      });
      blockedToken = generateToken(blockedUser);
    });

    it('should return current user info on /api/auth/me with valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('cust@example.com');
      expect(res.body.user.role).toBe('customer');
    });

    it('should reject /api/auth/me without authorization header with 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/token required/i);
    });

    it('should reject blocked users accessing protected routes with 403', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${blockedToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/account is blocked/i);
    });

    it('should enforce role restrictions with requireRole', async () => {
      // Customer accessing customer-only route -> 200
      const resCustOk = await request(app)
        .get('/api/test/customer-only')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(resCustOk.status).toBe(200);

      // Customer accessing organiser-only route -> 403
      const resCustToOrg = await request(app)
        .get('/api/test/organiser-only')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(resCustToOrg.status).toBe(403);
      expect(resCustToOrg.body.error).toMatch(/Forbidden/i);

      // Customer accessing admin-only route -> 403
      const resCustToAdmin = await request(app)
        .get('/api/test/admin-only')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(resCustToAdmin.status).toBe(403);

      // Organiser accessing organiser-only route -> 200
      const resOrgOk = await request(app)
        .get('/api/test/organiser-only')
        .set('Authorization', `Bearer ${organiserToken}`);
      expect(resOrgOk.status).toBe(200);

      // Admin accessing admin-only route -> 200
      const resAdminOk = await request(app)
        .get('/api/test/admin-only')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(resAdminOk.status).toBe(200);
    });

    it('should allow admin to list users and block/unblock a user', async () => {
      // Admin lists users
      const listRes = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.users.length).toBeGreaterThanOrEqual(3);

      // Find customer
      const targetUser = listRes.body.users.find((u) => u.email === 'cust@example.com');
      expect(targetUser.isBlocked).toBe(false);

      // Admin blocks customer
      const blockRes = await request(app)
        .patch(`/api/admin/users/${targetUser.id}/block`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isBlocked: true });

      expect(blockRes.status).toBe(200);
      expect(blockRes.body.user.isBlocked).toBe(true);

      // Blocked customer can no longer access /api/auth/me
      const custCheck = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${customerToken}`);
      expect(custCheck.status).toBe(403);
    });
  });
});

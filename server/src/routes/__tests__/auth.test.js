const request = require('supertest');
const app = require('../../server');
const db = require('../../db/database');
const authService = require('../../services/authService');

// Mock database
jest.mock('../../db/database');

describe('Auth Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register new user successfully', async () => {
      const passwordHash = await authService.hashPassword('password123');
      
      // First call: check if user exists (should return null)
      // Second call: login after registration (should return user)
      db.get
        .mockResolvedValueOnce(null) // No existing user
        .mockResolvedValueOnce({ // User for login
          id: 1,
          name: 'Test User',
          email: 'test@example.com',
          password_hash: passwordHash,
          role: 'USER',
          plan_id: 1
        });
      
      db.run.mockResolvedValue({ lastID: 1 });

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toMatchObject({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'USER',
        plan_id: 1
      });
    });

    it('should return 400 for missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User'
          // Missing email and password
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_FIELDS');
    });

    it('should return 409 for duplicate email', async () => {
      db.get.mockResolvedValue({ id: 1 }); // Existing user

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('EMAIL_EXISTS');
    });

    it('should return 400 for invalid email format', async () => {
      db.get.mockResolvedValue(null); // No existing user

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'invalid-email',
          password: 'password123'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('INVALID_EMAIL');
      expect(response.body.error.message).toBe('Invalid email format');
    });

    it('should return 400 for password too short', async () => {
      db.get.mockResolvedValue(null); // No existing user

      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'short'
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('PASSWORD_TOO_SHORT');
      expect(response.body.error.message).toBe('Password must be at least 8 characters');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login user successfully', async () => {
      const passwordHash = await authService.hashPassword('password123');
      
      db.get.mockResolvedValue({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        password_hash: passwordHash,
        role: 'USER',
        plan_id: 1
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.email).toBe('test@example.com');
    });

    it('should return 400 for missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com'
          // Missing password
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('MISSING_FIELDS');
    });

    it('should return 401 for invalid credentials', async () => {
      db.get.mockResolvedValue(null); // User not found

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return 401 for wrong password', async () => {
      const passwordHash = await authService.hashPassword('correctpassword');
      
      db.get.mockResolvedValue({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        password_hash: passwordHash,
        role: 'USER',
        plan_id: 1
      });

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
      expect(response.body.error.message).toBe('Invalid credentials');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user data with valid token', async () => {
      const passwordHash = await authService.hashPassword('password123');
      
      // Mock for login
      db.get.mockResolvedValueOnce({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        password_hash: passwordHash,
        role: 'USER',
        plan_id: 1
      });

      // Get token by logging in
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      const token = loginResponse.body.token;

      // Mock for getCurrentUser
      db.get.mockResolvedValueOnce({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'USER',
        plan_id: 1,
        created_at: '2024-01-01T00:00:00.000Z'
      });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toMatchObject({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'USER',
        plan_id: 1
      });
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('TOKEN_MISSING');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('TOKEN_INVALID');
    });
  });
});

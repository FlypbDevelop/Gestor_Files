const authService = require('../authService');
const db = require('../../db/database');
const jwt = require('jsonwebtoken');

// Mock database module
jest.mock('../../db/database');

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hashPassword', () => {
    it('should hash password using bcrypt', async () => {
      const password = 'testpassword123';
      const hash = await authService.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.startsWith('$2b$10$')).toBe(true);
    });

    it('should generate different hashes for same password', async () => {
      const password = 'testpassword123';
      const hash1 = await authService.hashPassword(password);
      const hash2 = await authService.hashPassword(password);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('comparePassword', () => {
    it('should return true for matching password', async () => {
      const password = 'testpassword123';
      const hash = await authService.hashPassword(password);
      
      const result = await authService.comparePassword(password, hash);
      expect(result).toBe(true);
    });

    it('should return false for non-matching password', async () => {
      const password = 'testpassword123';
      const hash = await authService.hashPassword(password);
      
      const result = await authService.comparePassword('wrongpassword', hash);
      expect(result).toBe(false);
    });
  });

  describe('validateEmail', () => {
    it('should accept valid email addresses', () => {
      expect(authService.validateEmail('user@example.com')).toBe(true);
      expect(authService.validateEmail('test.user@domain.co.uk')).toBe(true);
      expect(authService.validateEmail('user+tag@example.com')).toBe(true);
    });

    it('should reject invalid email addresses', () => {
      expect(authService.validateEmail('invalid')).toBe(false);
      expect(authService.validateEmail('invalid@')).toBe(false);
      expect(authService.validateEmail('@example.com')).toBe(false);
      expect(authService.validateEmail('user@')).toBe(false);
    });
  });

  describe('validatePassword', () => {
    it('should accept passwords with 8 or more characters', () => {
      expect(authService.validatePassword('12345678')).toBe(true);
      expect(authService.validatePassword('verylongpassword')).toBe(true);
    });

    it('should reject passwords with fewer than 8 characters', () => {
      expect(authService.validatePassword('1234567')).toBe(false);
      expect(authService.validatePassword('short')).toBe(false);
      expect(authService.validatePassword('')).toBe(false);
    });
  });

  describe('register', () => {
    it('should create new user with role USER and plan Free', async () => {
      db.get.mockResolvedValue(null); // No existing user
      db.run.mockResolvedValue({ lastID: 1 });

      const result = await authService.register('Test User', 'test@example.com', 'password123');

      expect(result).toEqual({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'USER',
        plan_id: 1
      });

      expect(db.run).toHaveBeenCalledWith(
        'INSERT INTO users (name, email, password_hash, role, plan_id) VALUES (?, ?, ?, ?, ?)',
        expect.arrayContaining(['Test User', 'test@example.com', expect.any(String), 'USER', 1])
      );
    });

    it('should reject invalid email format', async () => {
      await expect(
        authService.register('Test User', 'invalid-email', 'password123')
      ).rejects.toMatchObject({
        message: 'Invalid email format',
        code: 'INVALID_EMAIL',
        statusCode: 400
      });
    });

    it('should reject password shorter than 8 characters', async () => {
      await expect(
        authService.register('Test User', 'test@example.com', 'short')
      ).rejects.toMatchObject({
        message: 'Password must be at least 8 characters',
        code: 'PASSWORD_TOO_SHORT',
        statusCode: 400
      });
    });

    it('should reject duplicate email with 409 error', async () => {
      db.get.mockResolvedValue({ id: 1 }); // Existing user

      await expect(
        authService.register('Test User', 'test@example.com', 'password123')
      ).rejects.toMatchObject({
        message: 'Email already registered',
        code: 'EMAIL_EXISTS',
        statusCode: 409
      });
    });
  });

  describe('login', () => {
    it('should return token and user data for valid credentials', async () => {
      const passwordHash = await authService.hashPassword('password123');
      
      db.get.mockResolvedValue({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        password_hash: passwordHash,
        role: 'USER',
        plan_id: 1
      });

      const result = await authService.login('test@example.com', 'password123');

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user).toEqual({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'USER',
        plan_id: 1
      });

      // Verify token is valid JWT
      const decoded = jwt.decode(result.token);
      expect(decoded).toHaveProperty('userId', 1);
      expect(decoded).toHaveProperty('email', 'test@example.com');
      expect(decoded).toHaveProperty('role', 'USER');
    });

    it('should return 401 for non-existent user', async () => {
      db.get.mockResolvedValue(null);

      await expect(
        authService.login('nonexistent@example.com', 'password123')
      ).rejects.toMatchObject({
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
        statusCode: 401
      });
    });

    it('should return 401 for incorrect password', async () => {
      const passwordHash = await authService.hashPassword('password123');
      
      db.get.mockResolvedValue({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        password_hash: passwordHash,
        role: 'USER',
        plan_id: 1
      });

      await expect(
        authService.login('test@example.com', 'wrongpassword')
      ).rejects.toMatchObject({
        message: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
        statusCode: 401
      });
    });

    it('should generate token with 24-hour expiration', async () => {
      const passwordHash = await authService.hashPassword('password123');
      
      db.get.mockResolvedValue({
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        password_hash: passwordHash,
        role: 'USER',
        plan_id: 1
      });

      const result = await authService.login('test@example.com', 'password123');
      const decoded = jwt.decode(result.token);
      
      const expiresIn = decoded.exp - decoded.iat;
      expect(expiresIn).toBe(24 * 60 * 60); // 24 hours in seconds
    });
  });

  describe('verifyToken', () => {
    it('should return payload for valid token', async () => {
      const token = jwt.sign(
        { userId: 1, email: 'test@example.com', role: 'USER' },
        process.env.JWT_SECRET || 'dev-secret-change-in-production',
        { expiresIn: '24h' }
      );

      const result = await authService.verifyToken(token);

      expect(result).toEqual({
        userId: 1,
        email: 'test@example.com',
        role: 'USER'
      });
    });

    it('should reject expired token with 401', async () => {
      const token = jwt.sign(
        { userId: 1, email: 'test@example.com', role: 'USER' },
        process.env.JWT_SECRET || 'dev-secret-change-in-production',
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      await expect(
        authService.verifyToken(token)
      ).rejects.toMatchObject({
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED',
        statusCode: 401
      });
    });

    it('should reject invalid token with 401', async () => {
      const invalidToken = 'invalid.token.here';

      await expect(
        authService.verifyToken(invalidToken)
      ).rejects.toMatchObject({
        message: 'Invalid token',
        code: 'TOKEN_INVALID',
        statusCode: 401
      });
    });

    it('should reject token with wrong secret', async () => {
      const token = jwt.sign(
        { userId: 1, email: 'test@example.com', role: 'USER' },
        'wrong-secret',
        { expiresIn: '24h' }
      );

      await expect(
        authService.verifyToken(token)
      ).rejects.toMatchObject({
        message: 'Invalid token',
        code: 'TOKEN_INVALID',
        statusCode: 401
      });
    });
  });
});

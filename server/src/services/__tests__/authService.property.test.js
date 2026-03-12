const fc = require('fast-check');
const authService = require('../authService');
const db = require('../../db/database');
const jwt = require('jsonwebtoken');

// Mock database module
jest.mock('../../db/database');

describe('AuthService - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 1: Valid credentials generate valid 24-hour tokens
   * **Validates: Requirements 1.1**
   */
  describe('Property 1: Valid credentials generate valid 24-hour tokens', () => {
    it('should generate JWT tokens with exactly 24-hour expiration for any valid credentials', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 50 }),
          async (email, password) => {
            // Setup: Mock user in database
            const passwordHash = await authService.hashPassword(password);
            db.get.mockResolvedValue({
              id: 1,
              name: 'Test User',
              email: email,
              password_hash: passwordHash,
              role: 'USER',
              plan_id: 1
            });

            // Act: Login with valid credentials
            const result = await authService.login(email, password);

            // Assert: Token exists and has 24-hour expiration
            expect(result).toHaveProperty('token');
            expect(typeof result.token).toBe('string');

            const decoded = jwt.decode(result.token);
            expect(decoded).toBeDefined();
            expect(decoded).toHaveProperty('userId');
            expect(decoded).toHaveProperty('email', email);
            expect(decoded).toHaveProperty('iat');
            expect(decoded).toHaveProperty('exp');

            // Verify exactly 24 hours (86400 seconds)
            const expiresIn = decoded.exp - decoded.iat;
            expect(expiresIn).toBe(24 * 60 * 60);
          }
        ),
        { numRuns: 100 }
      );
    }, 30000); // 30 second timeout for bcrypt hashing
  });

  /**
   * Property 2: Invalid credentials return 401
   * **Validates: Requirements 1.2**
   */
  describe('Property 2: Invalid credentials return 401', () => {
    it('should return 401 for any invalid email', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 50 }),
          async (email, password) => {
            // Setup: No user found
            db.get.mockResolvedValue(null);

            // Act & Assert: Should throw 401 error
            await expect(
              authService.login(email, password)
            ).rejects.toMatchObject({
              message: 'Invalid credentials',
              code: 'INVALID_CREDENTIALS',
              statusCode: 401
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 401 for any incorrect password', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 50 }),
          fc.string({ minLength: 8, maxLength: 50 }),
          async (email, correctPassword, wrongPassword) => {
            // Skip if passwords happen to match
            fc.pre(correctPassword !== wrongPassword);

            // Setup: Mock user with correct password
            const passwordHash = await authService.hashPassword(correctPassword);
            db.get.mockResolvedValue({
              id: 1,
              name: 'Test User',
              email: email,
              password_hash: passwordHash,
              role: 'USER',
              plan_id: 1
            });

            // Act & Assert: Should throw 401 error with wrong password
            await expect(
              authService.login(email, wrongPassword)
            ).rejects.toMatchObject({
              message: 'Invalid credentials',
              code: 'INVALID_CREDENTIALS',
              statusCode: 401
            });
          }
        ),
        { numRuns: 50 }
      );
    }, 30000); // 30 second timeout for bcrypt hashing
  });

  /**
   * Property 3: Expired tokens are rejected
   * **Validates: Requirements 1.4**
   */
  describe('Property 3: Expired tokens are rejected', () => {
    it('should reject any token with past expiration date', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 1000 }),
          fc.emailAddress(),
          async (userId, email) => {
            // Setup: Create expired token (expired 1 hour ago)
            const token = jwt.sign(
              { userId, email, role: 'USER' },
              process.env.JWT_SECRET || 'dev-secret-change-in-production',
              { expiresIn: '-1h' }
            );

            // Act & Assert: Should throw TOKEN_EXPIRED error
            await expect(
              authService.verifyToken(token)
            ).rejects.toMatchObject({
              message: 'Token has expired',
              code: 'TOKEN_EXPIRED',
              statusCode: 401
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 4: New users get default role and plan
   * **Validates: Requirements 2.1**
   */
  describe('Property 4: New users get default role and plan', () => {
    it('should assign role USER and plan_id 1 (Free) to any new user', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 50 }),
          async (name, email, password) => {
            // Setup: No existing user
            db.get.mockResolvedValue(null);
            db.run.mockResolvedValue({ lastID: 1 });

            // Act: Register new user
            const result = await authService.register(name, email, password);

            // Assert: User has role USER and plan_id 1
            expect(result).toMatchObject({
              id: 1,
              name: name,
              email: email,
              role: 'USER',
              plan_id: 1
            });

            // Verify database call
            expect(db.run).toHaveBeenCalledWith(
              'INSERT INTO users (name, email, password_hash, role, plan_id) VALUES (?, ?, ?, ?, ?)',
              expect.arrayContaining([name, email, expect.any(String), 'USER', 1])
            );
          }
        ),
        { numRuns: 100 }
      );
    }, 30000); // 30 second timeout for bcrypt hashing
  });

  /**
   * Property 5: Duplicate emails are rejected
   * **Validates: Requirements 2.2**
   */
  describe('Property 5: Duplicate emails are rejected', () => {
    it('should return 409 error for any email that already exists', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.emailAddress(),
          fc.string({ minLength: 8, maxLength: 50 }),
          async (name, email, password) => {
            // Setup: Email already exists
            db.get.mockResolvedValue({ id: 1 });

            // Act & Assert: Should throw EMAIL_EXISTS error
            await expect(
              authService.register(name, email, password)
            ).rejects.toMatchObject({
              message: 'Email already registered',
              code: 'EMAIL_EXISTS',
              statusCode: 409
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: Short passwords are rejected
   * **Validates: Requirements 2.3**
   */
  describe('Property 6: Short passwords are rejected', () => {
    it('should reject any password with fewer than 8 characters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.emailAddress(),
          fc.string({ minLength: 0, maxLength: 7 }),
          async (name, email, shortPassword) => {
            // Act & Assert: Should throw PASSWORD_TOO_SHORT error
            await expect(
              authService.register(name, email, shortPassword)
            ).rejects.toMatchObject({
              message: 'Password must be at least 8 characters',
              code: 'PASSWORD_TOO_SHORT',
              statusCode: 400
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 7: Invalid email formats are rejected
   * **Validates: Requirements 2.4**
   */
  describe('Property 7: Invalid email formats are rejected', () => {
    it('should reject any string that does not match valid email format', async () => {
      // Custom arbitrary for invalid emails
      const invalidEmailArbitrary = fc.oneof(
        fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('@')),
        fc.string({ minLength: 1, maxLength: 20 }).map(s => s + '@'),
        fc.string({ minLength: 1, maxLength: 20 }).map(s => '@' + s),
        fc.constant(''),
        fc.constant('invalid'),
        fc.constant('user@'),
        fc.constant('@domain.com'),
        fc.constant('user @domain.com'),
        fc.constant('user@domain .com')
      );

      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 100 }),
          invalidEmailArbitrary,
          fc.string({ minLength: 8, maxLength: 50 }),
          async (name, invalidEmail, password) => {
            // Act & Assert: Should throw INVALID_EMAIL error
            await expect(
              authService.register(name, invalidEmail, password)
            ).rejects.toMatchObject({
              message: 'Invalid email format',
              code: 'INVALID_EMAIL',
              statusCode: 400
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

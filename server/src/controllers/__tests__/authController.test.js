const authController = require('../authController');
const authService = require('../../services/authService');
const db = require('../../db/database');

// Mock dependencies
jest.mock('../../services/authService');
jest.mock('../../db/database');

describe('AuthController', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    
    req = {
      body: {},
      user: {}
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('register', () => {
    it('should register user and return token', async () => {
      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };

      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'USER',
        plan_id: 1
      };

      authService.register.mockResolvedValue(mockUser);
      authService.login.mockResolvedValue({
        token: 'mock-token',
        user: mockUser
      });

      await authController.register(req, res);

      expect(authService.register).toHaveBeenCalledWith('Test User', 'test@example.com', 'password123');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        token: 'mock-token',
        user: mockUser
      });
    });

    it('should return 400 if required fields are missing', async () => {
      req.body = { name: 'Test User' }; // Missing email and password

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'MISSING_FIELDS',
          message: 'Name, email, and password are required'
        }
      });
    });

    it('should return 409 if email already exists', async () => {
      req.body = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      };

      const error = new Error('Email already registered');
      error.code = 'EMAIL_EXISTS';
      error.statusCode = 409;
      authService.register.mockRejectedValue(error);

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'EMAIL_EXISTS',
          message: 'Email already registered'
        }
      });
    });

    it('should return 400 for invalid email format', async () => {
      req.body = {
        name: 'Test User',
        email: 'invalid-email',
        password: 'password123'
      };

      const error = new Error('Invalid email format');
      error.code = 'INVALID_EMAIL';
      error.statusCode = 400;
      authService.register.mockRejectedValue(error);

      await authController.register(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'INVALID_EMAIL',
          message: 'Invalid email format'
        }
      });
    });
  });

  describe('login', () => {
    it('should login user and return token', async () => {
      req.body = {
        email: 'test@example.com',
        password: 'password123'
      };

      const mockResult = {
        token: 'mock-token',
        user: {
          id: 1,
          name: 'Test User',
          email: 'test@example.com',
          role: 'USER',
          plan_id: 1
        }
      };

      authService.login.mockResolvedValue(mockResult);

      await authController.login(req, res);

      expect(authService.login).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should return 400 if required fields are missing', async () => {
      req.body = { email: 'test@example.com' }; // Missing password

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email and password are required'
        }
      });
    });

    it('should return 401 for invalid credentials', async () => {
      req.body = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      const error = new Error('Invalid credentials');
      error.code = 'INVALID_CREDENTIALS';
      error.statusCode = 401;
      authService.login.mockRejectedValue(error);

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid credentials'
        }
      });
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user data', async () => {
      req.user = { userId: 1 };

      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
        role: 'USER',
        plan_id: 1,
        created_at: '2024-01-01T00:00:00.000Z'
      };

      db.get.mockResolvedValue(mockUser);

      await authController.getCurrentUser(req, res);

      expect(db.get).toHaveBeenCalledWith(
        'SELECT id, name, email, role, plan_id, created_at FROM users WHERE id = ?',
        [1]
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ user: mockUser });
    });

    it('should return 404 if user not found', async () => {
      req.user = { userId: 999 };
      db.get.mockResolvedValue(null);

      await authController.getCurrentUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    });

    it('should return 500 on database error', async () => {
      req.user = { userId: 1 };
      db.get.mockRejectedValue(new Error('Database error'));

      await authController.getCurrentUser(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred while fetching user data'
        }
      });
    });
  });
});

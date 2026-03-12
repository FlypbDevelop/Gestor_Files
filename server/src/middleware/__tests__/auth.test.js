const authMiddleware = require('../auth');
const authService = require('../../services/authService');

// Mock authService
jest.mock('../../services/authService');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup request, response, and next mocks
    req = {
      headers: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    next = jest.fn();
  });

  describe('Valid token scenarios', () => {
    it('should attach user data to request when token is valid', async () => {
      // Arrange
      const mockUserData = {
        userId: 1,
        email: 'test@example.com',
        role: 'USER'
      };

      req.headers.authorization = 'Bearer valid-token';
      authService.verifyToken.mockResolvedValue(mockUserData);

      // Act
      await authMiddleware(req, res, next);

      // Assert
      expect(authService.verifyToken).toHaveBeenCalledWith('valid-token');
      expect(req.user).toEqual(mockUserData);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should handle admin role correctly', async () => {
      // Arrange
      const mockAdminData = {
        userId: 2,
        email: 'admin@example.com',
        role: 'ADMIN'
      };

      req.headers.authorization = 'Bearer admin-token';
      authService.verifyToken.mockResolvedValue(mockAdminData);

      // Act
      await authMiddleware(req, res, next);

      // Assert
      expect(req.user).toEqual(mockAdminData);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Missing token scenarios', () => {
    it('should return 401 when Authorization header is missing', async () => {
      // Act
      await authMiddleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'TOKEN_MISSING',
          message: 'No authentication token provided'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when Authorization header is empty', async () => {
      // Arrange
      req.headers.authorization = '';

      // Act
      await authMiddleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'TOKEN_MISSING',
          message: 'No authentication token provided'
        }
      });
    });
  });

  describe('Invalid token format scenarios', () => {
    it('should return 401 when token does not start with Bearer', async () => {
      // Arrange
      req.headers.authorization = 'InvalidFormat token123';

      // Act
      await authMiddleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'TOKEN_INVALID',
          message: 'Invalid token format. Expected: Bearer <token>'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when token has no space separator', async () => {
      // Arrange
      req.headers.authorization = 'Bearertoken123';

      // Act
      await authMiddleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'TOKEN_INVALID',
          message: 'Invalid token format. Expected: Bearer <token>'
        }
      });
    });

    it('should return 401 when token has extra parts', async () => {
      // Arrange
      req.headers.authorization = 'Bearer token123 extra';

      // Act
      await authMiddleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'TOKEN_INVALID',
          message: 'Invalid token format. Expected: Bearer <token>'
        }
      });
    });
  });

  describe('Token verification failure scenarios', () => {
    it('should return 401 when token is expired', async () => {
      // Arrange
      req.headers.authorization = 'Bearer expired-token';
      
      const error = new Error('Token has expired');
      error.code = 'TOKEN_EXPIRED';
      error.statusCode = 401;
      
      authService.verifyToken.mockRejectedValue(error);

      // Act
      await authMiddleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'TOKEN_EXPIRED',
          message: 'Token has expired'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when token is invalid', async () => {
      // Arrange
      req.headers.authorization = 'Bearer invalid-token';
      
      const error = new Error('Invalid token');
      error.code = 'TOKEN_INVALID';
      error.statusCode = 401;
      
      authService.verifyToken.mockRejectedValue(error);

      // Act
      await authMiddleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'TOKEN_INVALID',
          message: 'Invalid token'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 500 for unexpected errors', async () => {
      // Arrange
      req.headers.authorization = 'Bearer some-token';
      
      const error = new Error('Database connection failed');
      
      authService.verifyToken.mockRejectedValue(error);

      // Act
      await authMiddleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred during authentication'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});

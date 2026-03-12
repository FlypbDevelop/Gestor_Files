const roleCheck = require('../roleCheck');

describe('Role Check Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    // Setup request, response, and next mocks
    req = {
      user: null
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    next = jest.fn();
  });

  describe('Authorized access scenarios', () => {
    it('should allow USER role when USER is in allowed roles', () => {
      // Arrange
      req.user = {
        userId: 1,
        email: 'user@example.com',
        role: 'USER'
      };

      const middleware = roleCheck(['USER']);

      // Act
      middleware(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow ADMIN role when ADMIN is in allowed roles', () => {
      // Arrange
      req.user = {
        userId: 2,
        email: 'admin@example.com',
        role: 'ADMIN'
      };

      const middleware = roleCheck(['ADMIN']);

      // Act
      middleware(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should allow USER when both USER and ADMIN are allowed', () => {
      // Arrange
      req.user = {
        userId: 1,
        email: 'user@example.com',
        role: 'USER'
      };

      const middleware = roleCheck(['USER', 'ADMIN']);

      // Act
      middleware(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
    });

    it('should allow ADMIN when both USER and ADMIN are allowed', () => {
      // Arrange
      req.user = {
        userId: 2,
        email: 'admin@example.com',
        role: 'ADMIN'
      };

      const middleware = roleCheck(['USER', 'ADMIN']);

      // Act
      middleware(req, res, next);

      // Assert
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Unauthorized access scenarios', () => {
    it('should return 403 when USER tries to access ADMIN-only endpoint', () => {
      // Arrange
      req.user = {
        userId: 1,
        email: 'user@example.com',
        role: 'USER'
      };

      const middleware = roleCheck(['ADMIN']);

      // Act
      middleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission to access this resource'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when ADMIN tries to access USER-only endpoint', () => {
      // Arrange
      req.user = {
        userId: 2,
        email: 'admin@example.com',
        role: 'ADMIN'
      };

      const middleware = roleCheck(['USER']);

      // Act
      middleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission to access this resource'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when role is not in allowed roles list', () => {
      // Arrange
      req.user = {
        userId: 3,
        email: 'other@example.com',
        role: 'OTHER'
      };

      const middleware = roleCheck(['USER', 'ADMIN']);

      // Act
      middleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission to access this resource'
        }
      });
    });
  });

  describe('Missing authentication scenarios', () => {
    it('should return 401 when req.user is not set', () => {
      // Arrange
      req.user = null;

      const middleware = roleCheck(['USER']);

      // Act
      middleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'TOKEN_MISSING',
          message: 'Authentication required'
        }
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when req.user is undefined', () => {
      // Arrange
      req.user = undefined;

      const middleware = roleCheck(['ADMIN']);

      // Act
      middleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: {
          code: 'TOKEN_MISSING',
          message: 'Authentication required'
        }
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty allowed roles array', () => {
      // Arrange
      req.user = {
        userId: 1,
        email: 'user@example.com',
        role: 'USER'
      };

      const middleware = roleCheck([]);

      // Act
      middleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('should be case-sensitive for role matching', () => {
      // Arrange
      req.user = {
        userId: 1,
        email: 'user@example.com',
        role: 'user' // lowercase
      };

      const middleware = roleCheck(['USER']); // uppercase

      // Act
      middleware(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});

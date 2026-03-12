const fc = require('fast-check');
const roleCheck = require('../roleCheck');

describe('RoleCheck Middleware - Property-Based Tests', () => {
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

  /**
   * Property 8: USER role cannot access admin endpoints
   * **Validates: Requirements 3.1**
   */
  describe('Property 8: USER role cannot access admin endpoints', () => {
    it('should return 403 for any USER attempting to access ADMIN-only endpoints', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          fc.emailAddress(),
          (userId, email) => {
            // Arrange: User with USER role
            req.user = {
              userId: userId,
              email: email,
              role: 'USER'
            };

            // Create middleware that only allows ADMIN
            const middleware = roleCheck(['ADMIN']);

            // Act
            middleware(req, res, next);

            // Assert: Should return 403 and not call next
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
              error: {
                code: 'INSUFFICIENT_PERMISSIONS',
                message: 'You do not have permission to access this resource'
              }
            });
            expect(next).not.toHaveBeenCalled();

            // Reset mocks for next iteration
            res.status.mockClear();
            res.json.mockClear();
            next.mockClear();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return 403 for USER role across various admin-only role configurations', () => {
      // Test with different admin-only role configurations
      const adminOnlyConfigs = fc.constantFrom(
        ['ADMIN'],
        ['ADMIN', 'SUPERADMIN'],
        ['SUPERADMIN', 'ADMIN'],
        ['MODERATOR', 'ADMIN']
      );

      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          fc.emailAddress(),
          adminOnlyConfigs,
          (userId, email, allowedRoles) => {
            // Arrange: User with USER role
            req.user = {
              userId: userId,
              email: email,
              role: 'USER'
            };

            // Create middleware with admin-only roles (USER not included)
            const middleware = roleCheck(allowedRoles);

            // Act
            middleware(req, res, next);

            // Assert: Should return 403
            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
              error: {
                code: 'INSUFFICIENT_PERMISSIONS',
                message: 'You do not have permission to access this resource'
              }
            });
            expect(next).not.toHaveBeenCalled();

            // Reset mocks
            res.status.mockClear();
            res.json.mockClear();
            next.mockClear();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 9: ADMIN role can access admin endpoints
   * **Validates: Requirements 3.2**
   */
  describe('Property 9: ADMIN role can access admin endpoints', () => {
    it('should allow access for any ADMIN user to ADMIN endpoints', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          fc.emailAddress(),
          (userId, email) => {
            // Arrange: User with ADMIN role
            req.user = {
              userId: userId,
              email: email,
              role: 'ADMIN'
            };

            // Create middleware that allows ADMIN
            const middleware = roleCheck(['ADMIN']);

            // Act
            middleware(req, res, next);

            // Assert: Should call next and not return error
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();

            // Reset mocks
            next.mockClear();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow ADMIN access across various role configurations that include ADMIN', () => {
      // Test with different role configurations that include ADMIN
      const adminIncludedConfigs = fc.constantFrom(
        ['ADMIN'],
        ['USER', 'ADMIN'],
        ['ADMIN', 'USER'],
        ['ADMIN', 'MODERATOR'],
        ['USER', 'ADMIN', 'MODERATOR']
      );

      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          fc.emailAddress(),
          adminIncludedConfigs,
          (userId, email, allowedRoles) => {
            // Arrange: User with ADMIN role
            req.user = {
              userId: userId,
              email: email,
              role: 'ADMIN'
            };

            // Create middleware with roles that include ADMIN
            const middleware = roleCheck(allowedRoles);

            // Act
            middleware(req, res, next);

            // Assert: Should call next
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
            expect(res.json).not.toHaveBeenCalled();

            // Reset mocks
            next.mockClear();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow ADMIN to access endpoints that allow both USER and ADMIN', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          fc.emailAddress(),
          (userId, email) => {
            // Arrange: User with ADMIN role
            req.user = {
              userId: userId,
              email: email,
              role: 'ADMIN'
            };

            // Create middleware that allows both USER and ADMIN
            const middleware = roleCheck(['USER', 'ADMIN']);

            // Act
            middleware(req, res, next);

            // Assert: Should call next
            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();

            // Reset mocks
            next.mockClear();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Role check is consistent
   * Verifies that the same user/role combination always produces the same result
   */
  describe('Property: Role check consistency', () => {
    it('should produce consistent results for the same user and allowed roles', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          fc.emailAddress(),
          fc.constantFrom('USER', 'ADMIN'),
          fc.array(fc.constantFrom('USER', 'ADMIN'), { minLength: 1, maxLength: 2 }),
          (userId, email, userRole, allowedRoles) => {
            // First call
            req.user = {
              userId: userId,
              email: email,
              role: userRole
            };

            const middleware = roleCheck(allowedRoles);
            middleware(req, res, next);

            const firstCallNext = next.mock.calls.length;
            const firstCallStatus = res.status.mock.calls.length;

            // Reset mocks
            res.status.mockClear();
            res.json.mockClear();
            next.mockClear();

            // Second call with same parameters
            req.user = {
              userId: userId,
              email: email,
              role: userRole
            };

            middleware(req, res, next);

            const secondCallNext = next.mock.calls.length;
            const secondCallStatus = res.status.mock.calls.length;

            // Assert: Results should be identical
            expect(firstCallNext).toBe(secondCallNext);
            expect(firstCallStatus).toBe(secondCallStatus);

            // Reset for next iteration
            res.status.mockClear();
            res.json.mockClear();
            next.mockClear();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

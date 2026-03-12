/**
 * Role Check Middleware
 * Verifies if authenticated user has required role
 * Requirements: 3.1, 3.2, 3.3
 */

/**
 * Creates middleware to check if user has one of the allowed roles
 * @param {string[]} allowedRoles - Array of roles that are allowed to access the endpoint
 * @returns {Function} Express middleware function
 */
function roleCheck(allowedRoles) {
  return (req, res, next) => {
    // Check if user is authenticated (should be set by auth middleware)
    if (!req.user) {
      return res.status(401).json({
        error: {
          code: 'TOKEN_MISSING',
          message: 'Authentication required'
        }
      });
    }

    // Check if user's role is in the allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission to access this resource'
        }
      });
    }

    // User has required role, continue
    next();
  };
}

module.exports = roleCheck;

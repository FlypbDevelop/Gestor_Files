const authService = require('../services/authService');

/**
 * Authentication Middleware
 * Validates JWT token and attaches user data to request
 * Requirements: 1.1, 1.4, 7.1
 */

/**
 * Middleware to authenticate requests using JWT token
 * Extracts token from Authorization header, verifies it, and attaches user to req.user
 * @param {Express.Request} req - Express request object
 * @param {Express.Response} res - Express response object
 * @param {Express.NextFunction} next - Express next function
 */
async function authMiddleware(req, res, next) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        error: {
          code: 'TOKEN_MISSING',
          message: 'No authentication token provided'
        }
      });
    }

    // Check if header follows "Bearer <token>" format
    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({
        error: {
          code: 'TOKEN_INVALID',
          message: 'Invalid token format. Expected: Bearer <token>'
        }
      });
    }

    const token = parts[1];

    // Verify token using AuthService
    const userData = await authService.verifyToken(token);

    // Attach user data to request
    req.user = userData;

    // Continue to next middleware
    next();
  } catch (error) {
    // Handle token verification errors
    if (error.statusCode === 401) {
      return res.status(401).json({
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    // Handle unexpected errors
    return res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during authentication'
      }
    });
  }
}

module.exports = authMiddleware;

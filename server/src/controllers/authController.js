const authService = require('../services/authService');
const db = require('../db/database');

/**
 * Auth Controller
 * Handles HTTP requests for authentication endpoints
 * Requirements: 1.1, 1.2, 2.1
 */

/**
 * Register new user
 * POST /api/auth/register
 * @param {Express.Request} req - Request with body: { name, email, password }
 * @param {Express.Response} res - Response
 */
async function register(req, res) {
  try {
    const { name, email, password } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        error: {
          code: 'MISSING_FIELDS',
          message: 'Name, email, and password are required'
        }
      });
    }

    // Register user via AuthService
    const user = await authService.register(name, email, password);

    // Generate token for immediate login
    const { token } = await authService.login(email, password);

    res.status(201).json({
      token,
      user
    });
  } catch (error) {
    // Handle specific error codes
    if (error.statusCode === 409) {
      return res.status(409).json({
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    if (error.statusCode === 400) {
      return res.status(400).json({
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    // Handle unexpected errors
    console.error('Registration error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during registration'
      }
    });
  }
}

/**
 * Login user
 * POST /api/auth/login
 * @param {Express.Request} req - Request with body: { email, password }
 * @param {Express.Response} res - Response
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        error: {
          code: 'MISSING_FIELDS',
          message: 'Email and password are required'
        }
      });
    }

    // Authenticate via AuthService
    const result = await authService.login(email, password);

    res.status(200).json(result);
  } catch (error) {
    // Handle authentication errors
    if (error.statusCode === 401) {
      return res.status(401).json({
        error: {
          code: error.code,
          message: error.message
        }
      });
    }

    // Handle unexpected errors
    console.error('Login error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred during login'
      }
    });
  }
}

/**
 * Get current authenticated user
 * GET /api/auth/me
 * @param {Express.Request} req - Request with req.user from auth middleware
 * @param {Express.Response} res - Response
 */
async function getCurrentUser(req, res) {
  try {
    // User data is already attached by auth middleware
    const userId = req.user.userId;

    // Fetch full user data from database
    const user = await db.get(
      'SELECT id, name, email, role, plan_id, created_at FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching user data'
      }
    });
  }
}

module.exports = {
  register,
  login,
  getCurrentUser
};

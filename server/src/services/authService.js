const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db/database');

/**
 * Auth Service
 * Handles authentication, user registration, and JWT token management
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4
 */

const BCRYPT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRATION = '24h';

/**
 * Hash password using bcrypt with 10 rounds
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Compare password with hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if password matches
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Validate email format (RFC 5322)
 * @param {string} email - Email to validate
 * @returns {boolean} True if email is valid
 */
function validateEmail(email) {
  // RFC 5322 compliant email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return emailRegex.test(email);
}

/**
 * Validate password requirements
 * @param {string} password - Password to validate
 * @returns {boolean} True if password is valid
 */
function validatePassword(password) {
  return Boolean(password && password.length >= 8);
}

/**
 * Register new user with role USER and Free plan
 * @param {string} name - User name
 * @param {string} email - User email
 * @param {string} password - User password (min 8 characters)
 * @returns {Promise<{id: number, name: string, email: string, role: string, plan_id: number}>}
 * @throws {Error} If email already exists or validation fails
 */
async function register(name, email, password) {
  // Validate email format
  if (!validateEmail(email)) {
    const error = new Error('Invalid email format');
    error.code = 'INVALID_EMAIL';
    error.statusCode = 400;
    throw error;
  }

  // Validate password length
  if (!validatePassword(password)) {
    const error = new Error('Password must be at least 8 characters');
    error.code = 'PASSWORD_TOO_SHORT';
    error.statusCode = 400;
    throw error;
  }

  // Check if email already exists
  const existingUser = await db.get(
    'SELECT id FROM users WHERE email = ?',
    [email]
  );

  if (existingUser) {
    const error = new Error('Email already registered');
    error.code = 'EMAIL_EXISTS';
    error.statusCode = 409;
    throw error;
  }

  // Hash password
  const passwordHash = await hashPassword(password);

  // Create user with role USER and plan Free (plan_id = 1)
  const result = await db.run(
    'INSERT INTO users (name, email, password_hash, role, plan_id) VALUES (?, ?, ?, ?, ?)',
    [name, email, passwordHash, 'USER', 1]
  );

  // Return user data without password
  return {
    id: result.lastID,
    name,
    email,
    role: 'USER',
    plan_id: 1
  };
}

/**
 * Authenticate user and generate JWT token
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<{token: string, user: object}>}
 * @throws {Error} If credentials are invalid
 */
async function login(email, password) {
  // Find user by email
  const user = await db.get(
    'SELECT id, name, email, password_hash, role, plan_id FROM users WHERE email = ?',
    [email]
  );

  if (!user) {
    const error = new Error('Invalid credentials');
    error.code = 'INVALID_CREDENTIALS';
    error.statusCode = 401;
    throw error;
  }

  // Compare password
  const isPasswordValid = await comparePassword(password, user.password_hash);

  if (!isPasswordValid) {
    const error = new Error('Invalid credentials');
    error.code = 'INVALID_CREDENTIALS';
    error.statusCode = 401;
    throw error;
  }

  // Generate JWT token with 24-hour expiration
  const token = jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRATION }
  );

  // Return token and user data (without password)
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      plan_id: user.plan_id
    }
  };
}

/**
 * Verify JWT token and return payload
 * @param {string} token - JWT token
 * @returns {Promise<{userId: number, email: string, role: string}>}
 * @throws {Error} If token is invalid or expired
 */
async function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    return {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role
    };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      const err = new Error('Token has expired');
      err.code = 'TOKEN_EXPIRED';
      err.statusCode = 401;
      throw err;
    }
    
    const err = new Error('Invalid token');
    err.code = 'TOKEN_INVALID';
    err.statusCode = 401;
    throw err;
  }
}

module.exports = {
  hashPassword,
  comparePassword,
  register,
  login,
  verifyToken,
  validateEmail,
  validatePassword
};

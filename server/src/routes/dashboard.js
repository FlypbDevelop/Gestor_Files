const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const dashboardController = require('../controllers/dashboardController');

/**
 * Dashboard Routes
 * Requirements: 12.1, 12.2, 12.3, 13.1, 13.2, 13.3
 */

// GET /api/dashboard/admin - Admin dashboard stats (ADMIN only)
router.get(
  '/admin',
  authMiddleware,
  roleCheck(['ADMIN']),
  dashboardController.getAdminStats
);

// GET /api/dashboard/user - User dashboard data (authenticated)
router.get(
  '/user',
  authMiddleware,
  dashboardController.getUserDashboard
);

module.exports = router;

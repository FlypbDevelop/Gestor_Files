const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const creditController = require('../controllers/creditController');

/**
 * Credit Routes
 * Purchase credits and list available packages (Phase 2)
 */

// GET /api/credits/packages - List available credit packages
router.get('/packages', authMiddleware, creditController.listPackages);

// POST /api/credits/purchase - Purchase credits (simulated checkout)
router.post('/purchase', authMiddleware, creditController.purchaseCredits);

module.exports = router;

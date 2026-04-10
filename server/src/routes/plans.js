const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const db = require('../db/database');

/**
 * Plans Routes
 * Requisitos: 10.1, 10.2, 10.3, 10.4
 */

// GET /api/plans - Listar todos os planos (autenticado)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const plans = await db.all('SELECT * FROM plans ORDER BY price ASC');
    const parsed = plans.map(p => ({
      ...p,
      features: (() => { try { return JSON.parse(p.features); } catch { return p.features; } })()
    }));
    res.status(200).json(parsed);
  } catch (error) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erro ao listar planos' } });
  }
});

module.exports = router;

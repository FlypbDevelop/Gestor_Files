const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
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

// PUT /api/plans/:id/multiplier - Atualizar o multiplicador de créditos do plano (ADMIN only)
// O admin pode alterar o multiplicador quando quiser; ele define o custo efetivo
// dos downloads avulsos: custo = credit_cost do arquivo x multiplicador do plano.
router.put('/:id/multiplier', authMiddleware, roleCheck(['ADMIN']), async (req, res) => {
  try {
    const planId = parseInt(req.params.id, 10);
    if (isNaN(planId)) {
      return res.status(400).json({ error: { code: 'INVALID_PLAN_ID', message: 'Invalid plan ID' } });
    }

    const { multiplier } = req.body;
    if (multiplier === undefined || multiplier === null || isNaN(Number(multiplier))) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'multiplier is required' } });
    }

    const numeric = Number(multiplier);
    if (numeric <= 0 || numeric > 100) {
      return res.status(400).json({ error: { code: 'INVALID_MULTIPLIER', message: 'Multiplier must be greater than 0' } });
    }

    const plan = await db.get('SELECT * FROM plans WHERE id = ?', [planId]);
    if (!plan) {
      return res.status(404).json({ error: { code: 'PLAN_NOT_FOUND', message: 'Plan not found' } });
    }

    let features = {};
    try { features = JSON.parse(plan.features); } catch { features = {}; }
    features.creditMultiplier = numeric;

    await db.run(
      'UPDATE plans SET features = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [JSON.stringify(features), planId]
    );

    const updated = await db.get('SELECT * FROM plans WHERE id = ?', [planId]);
    res.status(200).json({
      plan: {
        ...updated,
        features: (() => { try { return JSON.parse(updated.features); } catch { return updated.features; } })()
      }
    });
  } catch (error) {
    console.error('Update plan multiplier error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erro ao atualizar o plano' } });
  }
});

module.exports = router;

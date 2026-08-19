const db = require('../db/database');

/**
 * Credit Controller
 * Handles credit package listing and purchase (checkout simulado)
 */

/**
 * List active credit packages
 * GET /api/credits/packages
 */
async function listPackages(req, res) {
  try {
    const packages = await db.all(
      'SELECT id, name, credits, price FROM credit_packages WHERE active = 1 ORDER BY price ASC'
    );
    res.status(200).json(packages);
  } catch (error) {
    console.error('List credit packages error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erro ao listar pacotes de créditos' } });
  }
}

/**
 * Purchase credits (simulated checkout)
 * POST /api/credits/purchase
 * Body: { packageId: number }
 * Simulates a payment gateway and credits the user's account
 */
async function purchaseCredits(req, res) {
  try {
    const userId = req.user.userId;
    const { packageId } = req.body;

    if (!packageId || isNaN(Number(packageId))) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'packageId is required' } });
    }

    // Get the package
    const pkg = await db.get(
      'SELECT id, name, credits, price FROM credit_packages WHERE id = ? AND active = 1',
      [Number(packageId)]
    );

    if (!pkg) {
      return res.status(404).json({ error: { code: 'PACKAGE_NOT_FOUND', message: 'Credit package not found' } });
    }

    // Simulate payment gateway processing
    // In production, this would call Mercado Pago / Stripe API
    const paymentSimulated = {
      id: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: 'approved',
      amount: pkg.price,
      currency: 'BRL',
      method: 'simulated',
    };

    // Atomic credit update
    await db.run('UPDATE users SET credits = credits + ? WHERE id = ?', [pkg.credits, userId]);

    // Record transaction
    await db.run(
      'INSERT INTO credit_transactions (user_id, amount, reason, created_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
      [userId, pkg.credits, 'PURCHASE']
    );

    // Fetch updated user
    const user = await db.get('SELECT id, name, email, role, plan_id, credits, created_at, updated_at FROM users WHERE id = ?', [userId]);

    res.status(200).json({
      message: `Compra de ${pkg.credits} créditos realizada com sucesso`,
      payment: paymentSimulated,
      package: pkg,
      user,
    });
  } catch (error) {
    console.error('Purchase credits error:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Erro ao processar compra de créditos' } });
  }
}

module.exports = {
  listPackages,
  purchaseCredits,
};

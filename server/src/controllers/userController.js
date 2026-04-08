const db = require('../db/database');

/**
 * User Controller
 * Gerencia endpoints de administração de usuários
 * Requisitos: 11.1, 11.2, 11.3, 11.4
 */

/**
 * Listar todos os usuários com seus planos (ADMIN only)
 * GET /api/users
 * @param {Express.Request} req - Request com req.user
 * @param {Express.Response} res - Response
 */
async function listUsers(req, res) {
  try {
    const users = await db.all(
      `SELECT u.id, u.name, u.email, u.role, u.plan_id, u.created_at,
              p.name AS plan_name
       FROM users u
       LEFT JOIN plans p ON u.plan_id = p.id
       ORDER BY u.created_at DESC`
    );

    res.status(200).json({ users });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while listing users'
      }
    });
  }
}

/**
 * Atualizar plano do usuário (ADMIN only)
 * PUT /api/users/:id/plan
 * @param {Express.Request} req - Request com params.id e body: { planId }
 * @param {Express.Response} res - Response
 */
async function updateUserPlan(req, res) {
  try {
    const userId = parseInt(req.params.id, 10);

    if (isNaN(userId)) {
      return res.status(400).json({
        error: {
          code: 'INVALID_USER_ID',
          message: 'Invalid user ID'
        }
      });
    }

    const { planId } = req.body;

    if (planId === undefined || planId === null) {
      return res.status(400).json({
        error: {
          code: 'MISSING_FIELDS',
          message: 'planId is required'
        }
      });
    }

    // Validar que o usuário existe
    const user = await db.get(
      'SELECT id, name, email, role, plan_id FROM users WHERE id = ?',
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

    // Validar que o plano de destino existe
    const plan = await db.get(
      'SELECT id, name FROM plans WHERE id = ?',
      [planId]
    );

    if (!plan) {
      return res.status(404).json({
        error: {
          code: 'PLAN_NOT_FOUND',
          message: 'Plan not found'
        }
      });
    }

    // Atualizar plan_id do usuário
    await db.run(
      'UPDATE users SET plan_id = ? WHERE id = ?',
      [planId, userId]
    );

    // Retornar usuário atualizado
    const updatedUser = await db.get(
      `SELECT u.id, u.name, u.email, u.role, u.plan_id, u.created_at,
              p.name AS plan_name
       FROM users u
       LEFT JOIN plans p ON u.plan_id = p.id
       WHERE u.id = ?`,
      [userId]
    );

    res.status(200).json({ user: updatedUser });
  } catch (error) {
    console.error('Update user plan error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while updating user plan'
      }
    });
  }
}

module.exports = {
  listUsers,
  updateUserPlan
};

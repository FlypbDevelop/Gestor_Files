const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const userController = require('../controllers/userController');

/**
 * User Routes
 * Gerencia endpoints de administração de usuários
 * Requisitos: 11.1, 11.2, 11.3, 11.4
 */

// GET /api/users - Listar todos os usuários com seus planos (ADMIN only)
router.get(
  '/',
  authMiddleware,
  roleCheck(['ADMIN']),
  userController.listUsers
);

// PUT /api/users/:id/plan - Atualizar plano do usuário (ADMIN only)
router.put(
  '/:id/plan',
  authMiddleware,
  roleCheck(['ADMIN']),
  userController.updateUserPlan
);

module.exports = router;

/**
 * Testes de integração para endpoints de gestão de usuários
 * Tests: GET /api/users, PUT /api/users/:id/plan
 * Requisitos: 11.1, 11.2, 11.3, 11.4
 */

jest.mock('../../services/authService');
jest.mock('../../db/database');

const request = require('supertest');
const app = require('../../server');
const authService = require('../../services/authService');
const db = require('../../db/database');

const makeAdminUser = () => ({ userId: 1, email: 'admin@example.com', role: 'ADMIN' });
const makeRegularUser = () => ({ userId: 2, email: 'user@example.com', role: 'USER' });

const mockUser = {
  id: 2,
  name: 'João Silva',
  email: 'joao@example.com',
  role: 'USER',
  plan_id: 1,
  created_at: '2024-01-01T00:00:00.000Z',
  plan_name: 'Free'
};

const mockPlan = { id: 2, name: 'Basic' };

describe('User Endpoints Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /api/users ───────────────────────────────────────────────────────

  describe('GET /api/users', () => {
    it('deve listar todos os usuários como ADMIN', async () => {
      authService.verifyToken.mockResolvedValue(makeAdminUser());
      db.all.mockResolvedValue([mockUser]);

      const res = await request(app)
        .get('/api/users')
        .set('Authorization', 'Bearer valid-admin-token');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('users');
      expect(res.body.users).toHaveLength(1);
      expect(res.body.users[0]).toMatchObject({ email: 'joao@example.com' });
    });

    it('deve retornar 403 quando USER tenta listar usuários (Requisito 3.1)', async () => {
      authService.verifyToken.mockResolvedValue(makeRegularUser());

      const res = await request(app)
        .get('/api/users')
        .set('Authorization', 'Bearer valid-user-token');

      expect(res.status).toBe(403);
    });

    it('deve retornar 401 quando nenhum token é fornecido', async () => {
      const res = await request(app).get('/api/users');

      expect(res.status).toBe(401);
    });
  });

  // ─── PUT /api/users/:id/plan ──────────────────────────────────────────────

  describe('PUT /api/users/:id/plan', () => {
    it('deve atualizar o plano do usuário com sucesso (Requisito 11.1)', async () => {
      authService.verifyToken.mockResolvedValue(makeAdminUser());
      db.get
        .mockResolvedValueOnce(mockUser)   // busca usuário
        .mockResolvedValueOnce(mockPlan)   // busca plano
        .mockResolvedValueOnce({ ...mockUser, plan_id: 2, plan_name: 'Basic' }); // usuário atualizado
      db.run.mockResolvedValue({ changes: 1 });

      const res = await request(app)
        .put('/api/users/2/plan')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ planId: 2 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.plan_id).toBe(2);
      expect(res.body.user.plan_name).toBe('Basic');
    });

    it('deve retornar 404 quando usuário não existe (Requisito 11.3)', async () => {
      authService.verifyToken.mockResolvedValue(makeAdminUser());
      db.get.mockResolvedValueOnce(undefined); // usuário não encontrado

      const res = await request(app)
        .put('/api/users/999/plan')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ planId: 2 });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('deve retornar 404 quando plano não existe (Requisito 11.3)', async () => {
      authService.verifyToken.mockResolvedValue(makeAdminUser());
      db.get
        .mockResolvedValueOnce(mockUser)    // usuário encontrado
        .mockResolvedValueOnce(undefined);  // plano não encontrado

      const res = await request(app)
        .put('/api/users/2/plan')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ planId: 99 });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PLAN_NOT_FOUND');
    });

    it('deve retornar 400 quando planId não é fornecido', async () => {
      authService.verifyToken.mockResolvedValue(makeAdminUser());

      const res = await request(app)
        .put('/api/users/2/plan')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_FIELDS');
    });

    it('deve retornar 400 para ID de usuário inválido', async () => {
      authService.verifyToken.mockResolvedValue(makeAdminUser());

      const res = await request(app)
        .put('/api/users/abc/plan')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ planId: 2 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('INVALID_USER_ID');
    });

    it('deve retornar 403 quando USER tenta atualizar plano (Requisito 3.1)', async () => {
      authService.verifyToken.mockResolvedValue(makeRegularUser());

      const res = await request(app)
        .put('/api/users/2/plan')
        .set('Authorization', 'Bearer valid-user-token')
        .send({ planId: 2 });

      expect(res.status).toBe(403);
    });

    it('deve retornar 401 quando nenhum token é fornecido', async () => {
      const res = await request(app)
        .put('/api/users/2/plan')
        .send({ planId: 2 });

      expect(res.status).toBe(401);
    });

    it('deve permitir downgrade de plano (Requisito 11.4)', async () => {
      authService.verifyToken.mockResolvedValue(makeAdminUser());
      const premiumUser = { ...mockUser, plan_id: 3, plan_name: 'Premium' };
      db.get
        .mockResolvedValueOnce(premiumUser)                          // usuário com plano Premium
        .mockResolvedValueOnce({ id: 1, name: 'Free' })             // plano Free existe
        .mockResolvedValueOnce({ ...mockUser, plan_id: 1, plan_name: 'Free' }); // usuário atualizado
      db.run.mockResolvedValue({ changes: 1 });

      const res = await request(app)
        .put('/api/users/2/plan')
        .set('Authorization', 'Bearer valid-admin-token')
        .send({ planId: 1 });

      expect(res.status).toBe(200);
      expect(res.body.user.plan_id).toBe(1);
      expect(res.body.user.plan_name).toBe('Free');
    });
  });
});

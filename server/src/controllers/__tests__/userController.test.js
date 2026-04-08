/**
 * Testes de integração e unitários para gestão de usuários
 * Tests: GET /api/users, PUT /api/users/:id/plan
 * Requisitos: 11.1, 11.2, 11.3, 11.4
 */

jest.mock('../../services/authService');
jest.mock('../../db/database');

const request = require('supertest');
const app = require('../../server');
const authService = require('../../services/authService');
const db = require('../../db/database');
const { listUsers, updateUserPlan } = require('../userController');

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

// ─── Testes Unitários: updateUserPlan ─────────────────────────────────────────

describe('updateUserPlan (unitário)', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: { id: '2' },
      body: { planId: 2 }
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  /**
   * Requisito 11.1: Atualizar o plan_id do usuário
   * Requisito 11.2: Aplicar novas permissões imediatamente
   */
  it('deve atualizar o plano do usuário com sucesso (upgrade)', async () => {
    // Usuário com plano Free (id=1), fazendo upgrade para Basic (id=2)
    db.get
      .mockResolvedValueOnce({ id: 2, name: 'João Silva', email: 'joao@example.com', role: 'USER', plan_id: 1 })
      .mockResolvedValueOnce({ id: 2, name: 'Basic' })
      .mockResolvedValueOnce({ id: 2, name: 'João Silva', email: 'joao@example.com', role: 'USER', plan_id: 2, created_at: '2024-01-01T00:00:00.000Z', plan_name: 'Basic' });
    db.run.mockResolvedValue({ changes: 1 });

    await updateUserPlan(req, res);

    // Verifica que o banco foi atualizado com o novo plano
    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users'),
      expect.arrayContaining([2, 2])
    );
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.user.plan_id).toBe(2);
    expect(body.user.plan_name).toBe('Basic');
  });

  it('deve atualizar o plano do usuário com sucesso (downgrade)', async () => {
    // Usuário com plano Premium (id=3), fazendo downgrade para Free (id=1)
    req.body = { planId: 1 };
    db.get
      .mockResolvedValueOnce({ id: 2, name: 'Maria', email: 'maria@example.com', role: 'USER', plan_id: 3 })
      .mockResolvedValueOnce({ id: 1, name: 'Free' })
      .mockResolvedValueOnce({ id: 2, name: 'Maria', email: 'maria@example.com', role: 'USER', plan_id: 1, created_at: '2024-01-01T00:00:00.000Z', plan_name: 'Free' });
    db.run.mockResolvedValue({ changes: 1 });

    await updateUserPlan(req, res);

    expect(db.run).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users'),
      expect.arrayContaining([1, 2])
    );
    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.user.plan_id).toBe(1);
    expect(body.user.plan_name).toBe('Free');
  });

  /**
   * Requisito 11.2: Novas permissões aplicadas imediatamente
   * O usuário retornado na resposta já deve refletir o novo plano
   */
  it('deve retornar o usuário com o novo plano na resposta (permissões imediatas)', async () => {
    const usuarioAtualizado = {
      id: 2,
      name: 'Carlos',
      email: 'carlos@example.com',
      role: 'USER',
      plan_id: 3,
      created_at: '2024-01-01T00:00:00.000Z',
      plan_name: 'Premium'
    };
    req.body = { planId: 3 };
    db.get
      .mockResolvedValueOnce({ id: 2, name: 'Carlos', email: 'carlos@example.com', role: 'USER', plan_id: 1 })
      .mockResolvedValueOnce({ id: 3, name: 'Premium' })
      .mockResolvedValueOnce(usuarioAtualizado);
    db.run.mockResolvedValue({ changes: 1 });

    await updateUserPlan(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    // A resposta deve conter o usuário já com o novo plano (permissões imediatas - Req 11.2)
    expect(body.user).toMatchObject({
      id: 2,
      plan_id: 3,
      plan_name: 'Premium'
    });
  });

  /**
   * Requisito 11.3: Validar que o plano de destino existe
   */
  it('deve retornar 404 quando o plano de destino não existe (Requisito 11.3)', async () => {
    req.body = { planId: 99 };
    db.get
      .mockResolvedValueOnce({ id: 2, name: 'João', email: 'joao@example.com', role: 'USER', plan_id: 1 })
      .mockResolvedValueOnce(null); // plano não encontrado

    await updateUserPlan(req, res);

    // Banco NÃO deve ser atualizado quando plano não existe
    expect(db.run).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    const body = res.json.mock.calls[0][0];
    expect(body.error.code).toBe('PLAN_NOT_FOUND');
    expect(body.error.message).toBeDefined();
  });

  it('deve retornar 404 quando o plano retorna undefined (Requisito 11.3)', async () => {
    req.body = { planId: 50 };
    db.get
      .mockResolvedValueOnce({ id: 2, name: 'Ana', email: 'ana@example.com', role: 'USER', plan_id: 1 })
      .mockResolvedValueOnce(undefined); // plano não encontrado (undefined)

    await updateUserPlan(req, res);

    expect(db.run).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].error.code).toBe('PLAN_NOT_FOUND');
  });

  it('deve retornar 404 quando o usuário não existe', async () => {
    db.get.mockResolvedValueOnce(null); // usuário não encontrado

    await updateUserPlan(req, res);

    expect(db.run).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0].error.code).toBe('USER_NOT_FOUND');
  });

  it('deve retornar 400 quando planId não é fornecido', async () => {
    req.body = {};

    await updateUserPlan(req, res);

    expect(db.get).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error.code).toBe('MISSING_FIELDS');
  });

  it('deve retornar 400 para ID de usuário inválido (não numérico)', async () => {
    req.params = { id: 'abc' };

    await updateUserPlan(req, res);

    expect(db.get).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error.code).toBe('INVALID_USER_ID');
  });

  it('deve retornar 500 quando o banco de dados lança erro', async () => {
    db.get.mockRejectedValueOnce(new Error('Falha no banco de dados'));

    await updateUserPlan(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error.code).toBe('INTERNAL_ERROR');
  });
});

// ─── Testes Unitários: listUsers ──────────────────────────────────────────────

describe('listUsers (unitário)', () => {
  let req, res;

  beforeEach(() => {
    jest.clearAllMocks();
    req = { user: { userId: 1, role: 'ADMIN' } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  it('deve retornar lista de usuários com seus planos', async () => {
    const usuarios = [
      { id: 1, name: 'Admin', email: 'admin@example.com', role: 'ADMIN', plan_id: 3, created_at: '2024-01-01T00:00:00.000Z', plan_name: 'Premium' },
      { id: 2, name: 'João', email: 'joao@example.com', role: 'USER', plan_id: 1, created_at: '2024-01-02T00:00:00.000Z', plan_name: 'Free' }
    ];
    db.all.mockResolvedValue(usuarios);

    await listUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body.users).toHaveLength(2);
    expect(body.users[0].plan_name).toBe('Premium');
    expect(body.users[1].plan_name).toBe('Free');
  });

  it('deve retornar lista vazia quando não há usuários', async () => {
    db.all.mockResolvedValue([]);

    await listUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0].users).toEqual([]);
  });

  it('deve retornar 500 quando o banco de dados lança erro', async () => {
    db.all.mockRejectedValueOnce(new Error('Falha no banco de dados'));

    await listUsers(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].error.code).toBe('INTERNAL_ERROR');
  });
});

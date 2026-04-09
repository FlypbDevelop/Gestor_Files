/**
 * Testes de property-based para gestão de planos de usuário
 * Endpoint: PUT /api/users/:id/plan
 * Requisitos: 11.1, 11.2, 11.3, 11.4
 */

jest.mock('../../services/authService');
jest.mock('../../db/database');

const request = require('supertest');
const fc = require('fast-check');
const app = require('../../server');
const authService = require('../../services/authService');
const db = require('../../db/database');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Retorna payload de usuário ADMIN para mock do authService */
const makeAdminUser = () => ({ userId: 1, email: 'admin@example.com', role: 'ADMIN' });

/** Retorna payload de usuário comum para mock do authService */
const makeRegularUser = (id = 2) => ({ userId: id, email: `user${id}@example.com`, role: 'USER' });

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Gera um ID de usuário válido (inteiro positivo) */
const validUserIdArb = fc.integer({ min: 1, max: 9999 });

/** Gera um ID de plano válido (inteiro positivo) */
const validPlanIdArb = fc.integer({ min: 1, max: 100 });

/** Gera um nome de plano válido */
const planNameArb = fc.constantFrom('Free', 'Basic', 'Premium');

/** Gera um registro de usuário completo com plano */
const userRecordArb = fc.record({
  id: validUserIdArb,
  name: fc.string({ minLength: 1, maxLength: 50 }).map(s => s.replace(/\0/g, 'x') || 'User'),
  email: fc.emailAddress(),
  role: fc.constant('USER'),
  plan_id: validPlanIdArb,
  created_at: fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') })
    .map(d => d.toISOString())
});

/** Gera um registro de plano válido */
const planRecordArb = fc.record({
  id: validPlanIdArb,
  name: planNameArb
});

/**
 * Gera um par (usuário, plano destino) onde o plano destino é diferente do plano atual.
 * Simula tanto upgrade quanto downgrade.
 */
const userAndTargetPlanArb = fc
  .tuple(userRecordArb, planRecordArb)
  .filter(([user, targetPlan]) => user.plan_id !== targetPlan.id);

// ─── Property 31: Plan changes update user immediately ────────────────────────

describe('Property 31: Plan changes update user immediately', () => {
  /**
   * **Validates: Requirements 11.1, 11.2, 11.4**
   *
   * Para qualquer usuário válido e plano de destino válido (upgrade ou downgrade),
   * quando o plano é alterado, o sistema deve:
   * - Atualizar o plan_id do usuário imediatamente (Req 11.1)
   * - Retornar o usuário com o novo plano na resposta (Req 11.2)
   * - Permitir tanto upgrade quanto downgrade (Req 11.4)
   */
  describe('deve atualizar o plano do usuário imediatamente para qualquer combinação válida', () => {
    it('deve retornar 200 com o novo plan_id após qualquer mudança de plano válida', async () => {
      await fc.assert(
        fc.asyncProperty(
          userAndTargetPlanArb,
          async ([user, targetPlan]) => {
            jest.clearAllMocks();

            // Configura mock: admin autenticado
            authService.verifyToken.mockResolvedValue(makeAdminUser());

            // Configura mock: usuário encontrado no banco
            db.get
              .mockResolvedValueOnce(user)          // busca do usuário
              .mockResolvedValueOnce(targetPlan)    // busca do plano destino
              .mockResolvedValueOnce({              // usuário atualizado retornado
                ...user,
                plan_id: targetPlan.id,
                plan_name: targetPlan.name
              });

            // Configura mock: UPDATE executado com sucesso
            db.run.mockResolvedValue({ changes: 1 });

            // Executa a requisição de atualização de plano
            const res = await request(app)
              .put(`/api/users/${user.id}/plan`)
              .set('Authorization', 'Bearer valid-admin-token')
              .send({ planId: targetPlan.id });

            // Verifica que a resposta é 200 OK
            expect(res.status).toBe(200);

            // Verifica que o usuário retornado tem o novo plan_id (Req 11.1 e 11.2)
            expect(res.body).toHaveProperty('user');
            expect(res.body.user.plan_id).toBe(targetPlan.id);
            expect(res.body.user.plan_name).toBe(targetPlan.name);

            // Verifica que o banco foi atualizado (db.run chamado com UPDATE)
            expect(db.run).toHaveBeenCalledWith(
              expect.stringContaining('UPDATE users'),
              expect.arrayContaining([targetPlan.id, user.id])
            );
          }
        ),
        { numRuns: 10 }
      );
    }, 30000);

    it('deve permitir downgrade de plano (Req 11.4): de plano maior para menor', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Gera par onde plano destino tem ID menor (simula downgrade)
          fc.tuple(
            fc.integer({ min: 2, max: 9999 }), // userId
            fc.integer({ min: 2, max: 100 }),   // plan_id atual (maior)
            fc.integer({ min: 1, max: 99 })     // plan_id destino (menor)
          ).filter(([, currentPlanId, targetPlanId]) => targetPlanId < currentPlanId),
          async ([userId, currentPlanId, targetPlanId]) => {
            jest.clearAllMocks();

            authService.verifyToken.mockResolvedValue(makeAdminUser());

            const user = { id: userId, name: 'Test User', email: 'test@example.com', role: 'USER', plan_id: currentPlanId };
            const targetPlan = { id: targetPlanId, name: 'Free' };

            db.get
              .mockResolvedValueOnce(user)
              .mockResolvedValueOnce(targetPlan)
              .mockResolvedValueOnce({ ...user, plan_id: targetPlanId, plan_name: 'Free' });

            db.run.mockResolvedValue({ changes: 1 });

            const res = await request(app)
              .put(`/api/users/${userId}/plan`)
              .set('Authorization', 'Bearer valid-admin-token')
              .send({ planId: targetPlanId });

            // Downgrade deve ser aceito com 200 (Req 11.4)
            expect(res.status).toBe(200);
            expect(res.body.user.plan_id).toBe(targetPlanId);
          }
        ),
        { numRuns: 10 }
      );
    }, 15000);

    it('deve permitir upgrade de plano (Req 11.1): de plano menor para maior', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Gera par onde plano destino tem ID maior (simula upgrade)
          fc.tuple(
            fc.integer({ min: 2, max: 9999 }), // userId
            fc.integer({ min: 1, max: 99 }),    // plan_id atual (menor)
            fc.integer({ min: 2, max: 100 })    // plan_id destino (maior)
          ).filter(([, currentPlanId, targetPlanId]) => targetPlanId > currentPlanId),
          async ([userId, currentPlanId, targetPlanId]) => {
            jest.clearAllMocks();

            authService.verifyToken.mockResolvedValue(makeAdminUser());

            const user = { id: userId, name: 'Test User', email: 'test@example.com', role: 'USER', plan_id: currentPlanId };
            const targetPlan = { id: targetPlanId, name: 'Premium' };

            db.get
              .mockResolvedValueOnce(user)
              .mockResolvedValueOnce(targetPlan)
              .mockResolvedValueOnce({ ...user, plan_id: targetPlanId, plan_name: 'Premium' });

            db.run.mockResolvedValue({ changes: 1 });

            const res = await request(app)
              .put(`/api/users/${userId}/plan`)
              .set('Authorization', 'Bearer valid-admin-token')
              .send({ planId: targetPlanId });

            // Upgrade deve ser aceito com 200 (Req 11.1)
            expect(res.status).toBe(200);
            expect(res.body.user.plan_id).toBe(targetPlanId);
          }
        ),
        { numRuns: 10 }
      );
    }, 15000);
  });
});

// ─── Property 32: Invalid plan IDs are rejected ───────────────────────────────

describe('Property 32: Invalid plan IDs are rejected', () => {
  /**
   * **Validates: Requirements 11.3**
   *
   * Para qualquer plan_id que não existe no banco de dados,
   * quando se tenta atribuir ao usuário, o sistema deve rejeitar
   * a operação com erro 404 (PLAN_NOT_FOUND).
   */
  describe('deve rejeitar qualquer plan_id que não existe no banco de dados', () => {
    it('deve retornar 404 PLAN_NOT_FOUND para qualquer plan_id inexistente', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUserIdArb,
          validPlanIdArb,
          async (userId, nonExistentPlanId) => {
            jest.clearAllMocks();

            authService.verifyToken.mockResolvedValue(makeAdminUser());

            // Usuário existe, mas plano NÃO existe
            db.get
              .mockResolvedValueOnce({ id: userId, name: 'Test User', email: 'test@example.com', role: 'USER', plan_id: 1 })
              .mockResolvedValueOnce(undefined); // plano não encontrado

            const res = await request(app)
              .put(`/api/users/${userId}/plan`)
              .set('Authorization', 'Bearer valid-admin-token')
              .send({ planId: nonExistentPlanId });

            // Deve rejeitar com 404 (Req 11.3)
            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe('PLAN_NOT_FOUND');

            // Banco NÃO deve ser atualizado quando plano não existe
            expect(db.run).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 10 }
      );
    }, 15000);

    it('deve rejeitar plan_id nulo ou ausente com 400', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUserIdArb,
          async (userId) => {
            jest.clearAllMocks();

            authService.verifyToken.mockResolvedValue(makeAdminUser());

            // Requisição sem planId no body
            const res = await request(app)
              .put(`/api/users/${userId}/plan`)
              .set('Authorization', 'Bearer valid-admin-token')
              .send({});

            // Deve rejeitar com 400 (campo obrigatório ausente)
            expect(res.status).toBe(400);
            expect(res.body.error.code).toBe('MISSING_FIELDS');

            // Banco NÃO deve ser consultado quando campo obrigatório está ausente
            expect(db.run).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 10 }
      );
    }, 10000);

    it('deve rejeitar quando o usuário alvo não existe (404 USER_NOT_FOUND)', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUserIdArb,
          validPlanIdArb,
          async (userId, planId) => {
            jest.clearAllMocks();

            authService.verifyToken.mockResolvedValue(makeAdminUser());

            // Usuário NÃO existe no banco
            db.get.mockResolvedValueOnce(undefined);

            const res = await request(app)
              .put(`/api/users/${userId}/plan`)
              .set('Authorization', 'Bearer valid-admin-token')
              .send({ planId });

            // Deve retornar 404 USER_NOT_FOUND
            expect(res.status).toBe(404);
            expect(res.body.error.code).toBe('USER_NOT_FOUND');

            // Banco NÃO deve ser atualizado
            expect(db.run).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 10 }
      );
    }, 10000);
  });

  describe('deve rejeitar requisições sem autorização adequada', () => {
    it('deve retornar 403 para qualquer usuário com role USER tentando alterar plano', async () => {
      await fc.assert(
        fc.asyncProperty(
          validUserIdArb,
          validPlanIdArb,
          async (userId, planId) => {
            jest.clearAllMocks();

            // Usuário comum (não ADMIN) tentando alterar plano
            authService.verifyToken.mockResolvedValue(makeRegularUser());

            const res = await request(app)
              .put(`/api/users/${userId}/plan`)
              .set('Authorization', 'Bearer valid-user-token')
              .send({ planId });

            // Deve rejeitar com 403 (Req 3.1)
            expect(res.status).toBe(403);

            // Banco NÃO deve ser consultado
            expect(db.run).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 10 }
      );
    }, 10000);
  });
});

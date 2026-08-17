import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../services/apiClient';
import { User, Plan, ApiRequestError } from '../../types';

/**
 * UserManagement - Componente admin para listar usuários e alterar seus planos.
 * Requisitos: 11.1, 11.2, 11.4
 */
export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingIds, setUpdatingIds] = useState<Set<number>>(new Set());
  const [updateErrors, setUpdateErrors] = useState<Record<number, string>>({});
  const [updateSuccess, setUpdateSuccess] = useState<Record<number, string>>({});
  const [creditInputs, setCreditInputs] = useState<Record<number, string>>({});
  const [creditErrors, setCreditErrors] = useState<Record<number, string>>({});
  const [creditSuccess, setCreditSuccess] = useState<Record<number, string>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [usersData, plansData] = await Promise.all([
        apiClient.listAllUsers(),
        apiClient.listPlans(),
      ]);
      setUsers(usersData);
      setPlans(plansData);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar dados.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getPlanName = (planId: number): string => {
    return plans.find((p) => p.id === planId)?.name ?? `Plano ${planId}`;
  };

  const handleGrantCredits = async (userId: number) => {
    const raw = creditInputs[userId] ?? '';
    const amount = parseInt(raw, 10);
    if (raw.trim() === '' || isNaN(amount) || amount === 0) {
      setCreditErrors((prev) => ({ ...prev, [userId]: 'Informe um valor inteiro diferente de zero.' }));
      return;
    }

    setCreditErrors((prev) => ({ ...prev, [userId]: '' }));
    setCreditSuccess((prev) => ({ ...prev, [userId]: '' }));
    setUpdatingIds((prev) => new Set(prev).add(userId));

    try {
      const updatedUser = await apiClient.grantCredits(userId, amount);
      setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
      setCreditInputs((prev) => ({ ...prev, [userId]: '' }));
      setCreditSuccess((prev) => ({
        ...prev,
        [userId]: `Créditos atualizados (saldo: ${updatedUser.credits}).`,
      }));
      setTimeout(() => {
        setCreditSuccess((prev) => ({ ...prev, [userId]: '' }));
      }, 3000);
    } catch (err) {
      let message = 'Erro ao atualizar créditos.';
      if (err instanceof ApiRequestError) message = err.message;
      else if (err instanceof Error) message = err.message;
      setCreditErrors((prev) => ({ ...prev, [userId]: message }));
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const handlePlanChange = async (userId: number, newPlanId: number) => {
    setUpdateErrors((prev) => ({ ...prev, [userId]: '' }));
    setUpdateSuccess((prev) => ({ ...prev, [userId]: '' }));
    setUpdatingIds((prev) => new Set(prev).add(userId));

    try {
      const updatedUser = await apiClient.updateUserPlan(userId, newPlanId);
      setUsers((prev) =>
        prev.map((u) => (u.id === updatedUser.id ? updatedUser : u))
      );
      setUpdateSuccess((prev) => ({
        ...prev,
        [userId]: `Plano alterado para ${getPlanName(newPlanId)}.`,
      }));
      // Limpar mensagem de sucesso após 3 segundos
      setTimeout(() => {
        setUpdateSuccess((prev) => ({ ...prev, [userId]: '' }));
      }, 3000);
    } catch (err) {
      let message = 'Erro ao atualizar plano.';
      if (err instanceof ApiRequestError) message = err.message;
      else if (err instanceof Error) message = err.message;
      setUpdateErrors((prev) => ({ ...prev, [userId]: message }));
    } finally {
      setUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <span className="text-gray-500 text-sm">Carregando usuários...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Usuários cadastrados</h2>
      </div>

      {users.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          Nenhum usuário cadastrado.
        </div>
      ) : (
        <>
          {/* Tabela desktop */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Perfil</th>
                  <th className="px-4 py-3">Plano</th>
                  <th className="px-4 py-3">Créditos</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-gray-800 max-w-xs truncate">
                      {user.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                      {user.email}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          user.role === 'ADMIN'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {user.role === 'ADMIN' ? 'Admin' : 'Usuário'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {getPlanName(user.plan_id)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      <span className="font-medium text-gray-700">{user.credits ?? 0}</span>
                      <div className="mt-1 flex items-center gap-1">
                        <input
                          type="number"
                          step="1"
                          value={creditInputs[user.id] ?? ''}
                          onChange={(e) => {
                            setCreditInputs((prev) => ({ ...prev, [user.id]: e.target.value }));
                            setCreditErrors((prev) => ({ ...prev, [user.id]: '' }));
                          }}
                          disabled={updatingIds.has(user.id)}
                          placeholder="+/-"
                          aria-label={`Ajustar créditos de ${user.name}`}
                          className="w-20 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                        />
                        <button
                          onClick={() => handleGrantCredits(user.id)}
                          disabled={updatingIds.has(user.id)}
                          className="text-xs px-2 py-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {updatingIds.has(user.id) ? 'Salvando...' : 'Ajustar'}
                        </button>
                      </div>
                      {creditErrors[user.id] && (
                        <span className="text-xs text-red-600">{creditErrors[user.id]}</span>
                      )}
                      {creditSuccess[user.id] && (
                        <span className="text-xs text-green-600">{creditSuccess[user.id]}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-end gap-1">
                        <select
                          value={user.plan_id}
                          onChange={(e) => handlePlanChange(user.id, Number(e.target.value))}
                          disabled={updatingIds.has(user.id)}
                          aria-label={`Alterar plano de ${user.name}`}
                          className="text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {plans.map((plan) => (
                            <option key={plan.id} value={plan.id}>
                              {plan.name}
                            </option>
                          ))}
                        </select>
                        {updatingIds.has(user.id) && (
                          <span className="text-xs text-gray-400">Salvando...</span>
                        )}
                        {updateSuccess[user.id] && (
                          <span className="text-xs text-green-600">{updateSuccess[user.id]}</span>
                        )}
                        {updateErrors[user.id] && (
                          <span className="text-xs text-red-600">{updateErrors[user.id]}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cards mobile */}
          <div className="sm:hidden divide-y divide-gray-100">
            {users.map((user) => (
              <div key={user.id} className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{user.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      user.role === 'ADMIN'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {user.role === 'ADMIN' ? 'Admin' : 'Usuário'}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-gray-500">Plano:</span>
                  <select
                    value={user.plan_id}
                    onChange={(e) => handlePlanChange(user.id, Number(e.target.value))}
                    disabled={updatingIds.has(user.id)}
                    aria-label={`Alterar plano de ${user.name}`}
                    className="flex-1 text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {plans.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-gray-500">Créditos: <strong>{user.credits ?? 0}</strong></span>
                  <input
                    type="number"
                    step="1"
                    value={creditInputs[user.id] ?? ''}
                    onChange={(e) => {
                      setCreditInputs((prev) => ({ ...prev, [user.id]: e.target.value }));
                      setCreditErrors((prev) => ({ ...prev, [user.id]: '' }));
                    }}
                    disabled={updatingIds.has(user.id)}
                    placeholder="+/-"
                    aria-label={`Ajustar créditos de ${user.name}`}
                    className="flex-1 text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <button
                    onClick={() => handleGrantCredits(user.id)}
                    disabled={updatingIds.has(user.id)}
                    className="text-xs px-3 py-2 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {updatingIds.has(user.id) ? 'Salvando...' : 'Ajustar'}
                  </button>
                </div>
                {creditErrors[user.id] && (
                  <p className="mt-1 text-xs text-red-600">{creditErrors[user.id]}</p>
                )}
                {creditSuccess[user.id] && (
                  <p className="mt-1 text-xs text-green-600">{creditSuccess[user.id]}</p>
                )}
                {updatingIds.has(user.id) && (
                  <p className="mt-1 text-xs text-gray-400">Salvando...</p>
                )}
                {updateSuccess[user.id] && (
                  <p className="mt-1 text-xs text-green-600">{updateSuccess[user.id]}</p>
                )}
                {updateErrors[user.id] && (
                  <p className="mt-1 text-xs text-red-600">{updateErrors[user.id]}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

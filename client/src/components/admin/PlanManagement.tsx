import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../services/apiClient';
import { Plan, ApiRequestError } from '../../types';

/**
 * PlanManagement - Configura o multiplicador de créditos dos planos.
 * O multiplicador define o custo efetivo dos downloads avulsos:
 * custo = credit_cost do arquivo x multiplicador do plano.
 * O admin pode alterar quando quiser.
 */
export default function PlanManagement() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [multipliers, setMultipliers] = useState<Record<number, string>>({});
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());
  const [saveErrors, setSaveErrors] = useState<Record<number, string>>({});
  const [saveSuccess, setSaveSuccess] = useState<Record<number, string>>({});

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.listPlans();
      setPlans(data);
      setMultipliers(() => {
        const next: Record<number, string> = {};
        for (const plan of data) {
          next[plan.id] = String(plan.features?.creditMultiplier ?? 1);
        }
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar planos.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const handleSave = async (planId: number) => {
    const raw = multipliers[planId] ?? '';
    const value = parseFloat(raw.replace(',', '.'));
    if (raw.trim() === '' || isNaN(value) || value <= 0) {
      setSaveErrors((prev) => ({ ...prev, [planId]: 'Multiplicador deve ser um número maior que 0.' }));
      return;
    }

    setSaveErrors((prev) => ({ ...prev, [planId]: '' }));
    setSaveSuccess((prev) => ({ ...prev, [planId]: '' }));
    setSavingIds((prev) => new Set(prev).add(planId));

    try {
      const updated = await apiClient.updatePlanMultiplier(planId, value);
      setPlans((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setMultipliers((prev) => ({ ...prev, [planId]: String(updated.features?.creditMultiplier ?? value) }));
      setSaveSuccess((prev) => ({ ...prev, [planId]: 'Multiplicador atualizado.' }));
      setTimeout(() => {
        setSaveSuccess((prev) => ({ ...prev, [planId]: '' }));
      }, 3000);
    } catch (err) {
      let message = 'Erro ao salvar multiplicador.';
      if (err instanceof ApiRequestError) message = err.message;
      else if (err instanceof Error) message = err.message;
      setSaveErrors((prev) => ({ ...prev, [planId]: message }));
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(planId);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <span className="text-gray-500 text-sm">Carregando planos...</span>
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
        <h2 className="text-lg font-semibold text-gray-800">Multiplicador de créditos por plano</h2>
        <p className="mt-1 text-xs text-gray-500">
          O custo efetivo de um download avulso para o usuário é: custo base do arquivo x multiplicador
          do plano dele. Ex.: arquivo de 5 créditos — Free (x2) paga 10, Basic (x1.5) paga 8, Premium (x1) paga 5.
        </p>
      </div>

      {plans.length === 0 ? (
        <p className="px-6 py-8 text-sm text-gray-500 text-center">Nenhum plano cadastrado.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {plans.map((plan) => (
            <div key={plan.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">{plan.name}</p>
                <p className="text-xs text-gray-500">
                  {plan.price === 0
                    ? 'Gratuito'
                    : `R$ ${plan.price.toFixed(2).replace('.', ',')}/mês`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Multiplicador:</span>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={multipliers[plan.id] ?? '1'}
                  onChange={(e) => {
                    setMultipliers((prev) => ({ ...prev, [plan.id]: e.target.value }));
                    setSaveErrors((prev) => ({ ...prev, [plan.id]: '' }));
                  }}
                  disabled={savingIds.has(plan.id)}
                  aria-label={`Multiplicador do plano ${plan.name}`}
                  className="w-24 text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <button
                  onClick={() => handleSave(plan.id)}
                  disabled={savingIds.has(plan.id)}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {savingIds.has(plan.id) ? 'Salvando...' : 'Salvar'}
                </button>
              </div>

              <div className="sm:ml-auto sm:text-right">
                {saveErrors[plan.id] && (
                  <span className="text-xs text-red-600">{saveErrors[plan.id]}</span>
                )}
                {saveSuccess[plan.id] && (
                  <span className="text-xs text-green-600">{saveSuccess[plan.id]}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

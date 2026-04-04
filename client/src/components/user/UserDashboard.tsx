import { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';
import { UserDashboard as UserDashboardData, ApiRequestError } from '../../types';

/**
 * UserDashboard - Exibe histórico de downloads e informações do plano do usuário.
 * Requisitos: 13.1, 13.2, 13.3, 13.4
 */
export default function UserDashboard() {
  const [data, setData] = useState<UserDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      setError('');
      try {
        const dashboard = await apiClient.getUserDashboard();
        setData(dashboard);
      } catch (err) {
        let message = 'Erro ao carregar dashboard.';
        if (err instanceof ApiRequestError) message = err.message;
        else if (err instanceof Error) message = err.message;
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <span className="text-gray-500 text-sm">Carregando dashboard...</span>
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

  if (!data) return null;

  // Req 13.1: ordenar histórico por data descendente
  const sortedHistory = [...data.downloadHistory].sort(
    (a, b) => new Date(b.downloaded_at).getTime() - new Date(a.downloaded_at).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Req 13.2: informações do plano atual */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-5">
          <p className="text-sm text-gray-500">Plano atual</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">{data.plan.name}</p>
          <p className="mt-1 text-sm text-gray-500">
            {data.plan.price === 0
              ? 'Gratuito'
              : `R$ ${data.plan.price.toFixed(2).replace('.', ',')}/mês`}
          </p>
        </div>

        {/* Req 13.3: total de downloads realizados */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-5">
          <p className="text-sm text-gray-500">Total de downloads</p>
          <p className="mt-1 text-2xl font-bold text-gray-800">
            {data.totalDownloads.toLocaleString('pt-BR')}
          </p>
        </div>
      </div>

      {/* Req 13.1 + 13.4: tabela de histórico de downloads */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-800">Histórico de downloads</h2>
        </div>

        {sortedHistory.length === 0 ? (
          <p className="px-6 py-8 text-sm text-gray-500 text-center">
            Nenhum download realizado ainda.
          </p>
        ) : (
          <>
            {/* Tabela desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <th className="px-4 py-3">Arquivo</th>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Hora</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedHistory.map((entry) => {
                    const date = new Date(entry.downloaded_at);
                    return (
                      <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-800 max-w-xs truncate">
                          {entry.filename}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {date.toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Cards mobile */}
            <div className="sm:hidden divide-y divide-gray-100">
              {sortedHistory.map((entry) => {
                const date = new Date(entry.downloaded_at);
                return (
                  <div key={entry.id} className="px-4 py-3">
                    <p className="text-sm font-medium text-gray-800 truncate">{entry.filename}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {date.toLocaleDateString('pt-BR')} às{' '}
                      {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

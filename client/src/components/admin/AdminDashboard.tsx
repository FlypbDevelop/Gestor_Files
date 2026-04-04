import { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';
import { AdminStats, ApiRequestError } from '../../types';

/**
 * AdminDashboard - Displays system statistics for admins.
 * Requirements: 12.1, 12.2, 12.3
 */
export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await apiClient.getAdminStats();
        setStats(data);
      } catch (err) {
        let message = 'Erro ao carregar estatísticas.';
        if (err instanceof ApiRequestError) message = err.message;
        else if (err instanceof Error) message = err.message;
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <span className="text-gray-500 text-sm">Carregando estatísticas...</span>
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

  if (!stats) return null;

  const maxDownloadCount = Math.max(
    1,
    ...stats.mostDownloadedFiles.map((f) => f.download_count)
  );

  const maxUserCount = Math.max(
    1,
    ...stats.usersByPlan.map((p) => p.user_count)
  );

  return (
    <div className="space-y-6">
      {/* Summary cards — Req 12.1 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total de Usuários" value={stats.totalUsers} />
        <StatCard label="Total de Arquivos" value={stats.totalFiles} />
        <StatCard label="Total de Downloads" value={stats.totalDownloads} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most downloaded files — Req 12.2 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-800">Arquivos mais baixados</h2>
          </div>
          {stats.mostDownloadedFiles.length === 0 ? (
            <p className="px-6 py-8 text-sm text-gray-500 text-center">Nenhum download registrado.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Arquivo</th>
                    <th className="px-4 py-3 text-right">Downloads</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stats.mostDownloadedFiles.map((file, index) => (
                    <tr key={file.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm text-gray-400">{index + 1}</td>
                      <td className="px-4 py-3 text-sm text-gray-800 max-w-xs truncate">
                        {file.filename}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-700 text-right">
                        {file.download_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Users by plan distribution — Req 12.3 */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-800">Distribuição por plano</h2>
          </div>
          {stats.usersByPlan.length === 0 ? (
            <p className="px-6 py-8 text-sm text-gray-500 text-center">Nenhum dado de plano disponível.</p>
          ) : (
            <div className="px-6 py-5 space-y-4">
              {stats.usersByPlan.map((plan) => {
                const pct = Math.round((plan.user_count / maxUserCount) * 100);
                return (
                  <div key={plan.plan_name}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700">{plan.plan_name}</span>
                      <span className="text-sm text-gray-500">
                        {plan.user_count} {plan.user_count === 1 ? 'usuário' : 'usuários'}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5">
                      <div
                        className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                        role="progressbar"
                        aria-valuenow={plan.user_count}
                        aria-valuemin={0}
                        aria-valuemax={maxUserCount}
                        aria-label={`${plan.plan_name}: ${plan.user_count} usuários`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bar chart for most downloaded files (visual) */}
      {stats.mostDownloadedFiles.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-800">Downloads por arquivo</h2>
          </div>
          <div className="px-6 py-5 space-y-3">
            {stats.mostDownloadedFiles.map((file) => {
              const pct = Math.round((file.download_count / maxDownloadCount) * 100);
              return (
                <div key={file.id}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm text-gray-700 truncate max-w-xs">{file.filename}</span>
                    <span className="text-sm text-gray-500 ml-2 shrink-0">{file.download_count}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-indigo-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: number;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 py-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-800">{value.toLocaleString('pt-BR')}</p>
    </div>
  );
}

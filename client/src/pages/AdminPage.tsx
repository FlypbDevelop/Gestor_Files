import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import FileUpload from '../components/admin/FileUpload';
import FileManagement from '../components/admin/FileManagement';
import { Plan, File } from '../types';

/**
 * AdminPage - Admin panel with file upload and management.
 * Requirements: 12.1, 12.2, 12.3
 */
export default function AdminPage() {
  const { user, logout, token } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchPlans = async () => {
      setPlansLoading(true);
      setPlansError('');
      try {
        const res = await fetch('/api/plans', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`Erro ao carregar planos (${res.status})`);
        const data: Plan[] = await res.json();
        setPlans(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar planos.';
        setPlansError(message);
      } finally {
        setPlansLoading(false);
      }
    };

    fetchPlans();
  }, [token]);

  const handleUploadComplete = (_file: File) => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <span className="text-xl font-bold text-gray-800">Gestor de Arquivos</span>
            <div className="flex items-center gap-4">
              <span className="hidden sm:block text-sm text-gray-600">{user?.name} (Admin)</span>
              <button
                onClick={logout}
                className="text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-800">Gerenciamento de Arquivos</h1>

        {plansLoading ? (
          <p className="text-sm text-gray-500">Carregando planos...</p>
        ) : (
          <>
            {plansError && (
              <p className="text-sm text-red-600">{plansError}</p>
            )}
            <FileUpload plans={plans} onUploadComplete={handleUploadComplete} />
            <FileManagement plans={plans} refreshKey={refreshKey} />
          </>
        )}
      </main>
    </div>
  );
}

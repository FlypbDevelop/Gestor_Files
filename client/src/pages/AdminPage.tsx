import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/apiClient';
import FileUpload from '../components/admin/FileUpload';
import FileManagement from '../components/admin/FileManagement';
import AdminDashboard from '../components/admin/AdminDashboard';
import UserManagement from '../components/admin/UserManagement';
import PlanManagement from '../components/admin/PlanManagement';
import { Plan, File } from '../types';

type Tab = 'dashboard' | 'arquivos' | 'usuarios' | 'planos';

/**
 * AdminPage - Painel admin com abas: Dashboard, Arquivos e Usuários.
 * Requisitos: 11.1, 11.2, 11.4, 12.1, 12.2, 12.3
 */
export default function AdminPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const fetchPlans = async () => {
      setPlansLoading(true);
      setPlansError('');
      try {
        const data = await apiClient.listPlans();
        setPlans(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao carregar planos.';
        setPlansError(message);
      } finally {
        setPlansLoading(false);
      }
    };

    fetchPlans();
  }, []);

  const handleUploadComplete = (_file: File) => {
    setRefreshKey((prev) => prev + 1);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'arquivos', label: 'Arquivos' },
    { id: 'usuarios', label: 'Usuários' },
    { id: 'planos', label: 'Planos' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <span className="text-xl font-bold text-gray-800">Gestor de Arquivos</span>
            <div className="flex items-center gap-4">
              <span className="hidden sm:block text-sm text-gray-600">{user?.name} (Admin)</span>
              <button
                onClick={() => navigate('/dashboard')}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Dashboard
              </button>
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
        <h1 className="text-2xl font-bold text-gray-800">Painel Administrativo</h1>

        {/* Abas de navegação */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex gap-6" aria-label="Abas do painel admin">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Conteúdo das abas */}
        {activeTab === 'dashboard' && <AdminDashboard />}

        {activeTab === 'arquivos' && (
          <>
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
          </>
        )}

        {activeTab === 'usuarios' && <UserManagement />}

        {activeTab === 'planos' && <PlanManagement />}
      </main>
    </div>
  );
}

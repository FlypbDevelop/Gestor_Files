import { useAuth } from '../contexts/AuthContext';

/**
 * AdminPage - Stub placeholder for Tasks 26/29/31 (admin features).
 * Requirements: 12.1, 12.2, 12.3
 */
export default function AdminPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Adaptive navigation - mobile/desktop (Req 14.4) */}
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Painel Administrativo</h1>
        <p className="text-gray-500">Funcionalidades admin serão implementadas nas Tarefas 26, 29 e 31.</p>
      </main>
    </div>
  );
}

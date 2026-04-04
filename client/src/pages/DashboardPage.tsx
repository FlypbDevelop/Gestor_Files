import { useAuth } from '../contexts/AuthContext';
import UserDashboard from '../components/user/UserDashboard';
import FileList from '../components/user/FileList';

/**
 * DashboardPage - Página principal do usuário com dashboard e lista de arquivos.
 * Requisitos: 13.1, 13.2, 13.3, 13.4, 14.4
 */
export default function DashboardPage() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Navegação adaptativa - mobile/desktop (Req 14.4) */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <span className="text-xl font-bold text-gray-800">Gestor de Arquivos</span>
            <div className="flex items-center gap-4">
              <span className="hidden sm:block text-sm text-gray-600">{user?.name}</span>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Req 13.1, 13.2, 13.3, 13.4: Dashboard do usuário */}
        <section>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Meu Dashboard</h1>
          <UserDashboard />
        </section>

        {/* Lista de arquivos disponíveis */}
        <section>
          <h2 className="text-xl font-bold text-gray-800 mb-4">Arquivos disponíveis</h2>
          <FileList />
        </section>
      </main>
    </div>
  );
}

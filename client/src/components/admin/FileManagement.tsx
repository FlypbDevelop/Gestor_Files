import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../services/apiClient';
import { FileWithDownloadsRemaining, Plan, FilePermissions, ApiRequestError } from '../../types';

interface FileManagementProps {
  plans: Plan[];
  refreshKey?: number;
}

interface EditModalState {
  fileId: number;
  filename: string;
  selectedPlanIds: number[];
  maxDownloads: string;
  saving: boolean;
  error: string;
  validationError: string;
}

/**
 * FileManagement - Admin component for listing, editing permissions, and deleting files.
 * Requirements: 5.1, 5.2
 */
export default function FileManagement({ plans, refreshKey }: FileManagementProps) {
  const [files, setFiles] = useState<FileWithDownloadsRemaining[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteErrors, setDeleteErrors] = useState<Record<number, string>>({});
  const [deletingIds, setDeletingIds] = useState<Set<number>>(new Set());
  const [editModal, setEditModal] = useState<EditModalState | null>(null);

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.listFiles();
      setFiles(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar arquivos.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles, refreshKey]);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getPlanNames = (planIds: number[]): string => {
    if (planIds.length === 0) return '—';
    return planIds
      .map((id) => plans.find((p) => p.id === id)?.name ?? `Plano ${id}`)
      .join(', ');
  };

  // ---- Delete ----

  const handleDelete = async (fileId: number, filename: string) => {
    if (!window.confirm(`Deseja excluir o arquivo "${filename}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    setDeleteErrors((prev) => ({ ...prev, [fileId]: '' }));
    setDeletingIds((prev) => new Set(prev).add(fileId));
    try {
      await apiClient.deleteFile(fileId);
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err) {
      let message = 'Erro ao excluir arquivo.';
      if (err instanceof ApiRequestError) message = err.message;
      else if (err instanceof Error) message = err.message;
      setDeleteErrors((prev) => ({ ...prev, [fileId]: message }));
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(fileId);
        return next;
      });
    }
  };

  // ---- Edit modal ----

  const openEditModal = (file: FileWithDownloadsRemaining) => {
    setEditModal({
      fileId: file.id,
      filename: file.filename,
      selectedPlanIds: [...file.allowed_plan_ids],
      maxDownloads: file.max_downloads_per_user !== null ? String(file.max_downloads_per_user) : '',
      saving: false,
      error: '',
      validationError: '',
    });
  };

  const closeEditModal = () => setEditModal(null);

  const handleModalPlanToggle = (planId: number) => {
    if (!editModal) return;
    setEditModal((prev) => {
      if (!prev) return prev;
      const ids = prev.selectedPlanIds.includes(planId)
        ? prev.selectedPlanIds.filter((id) => id !== planId)
        : [...prev.selectedPlanIds, planId];
      return { ...prev, selectedPlanIds: ids, validationError: '' };
    });
  };

  const handleModalMaxDownloadsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditModal((prev) => prev ? { ...prev, maxDownloads: e.target.value, validationError: '' } : prev);
  };

  const validateModal = (): boolean => {
    if (!editModal) return false;
    if (editModal.selectedPlanIds.length === 0) {
      setEditModal((prev) => prev ? { ...prev, validationError: 'Selecione pelo menos um plano.' } : prev);
      return false;
    }
    if (editModal.maxDownloads !== '') {
      const parsed = parseInt(editModal.maxDownloads, 10);
      if (isNaN(parsed) || parsed <= 0 || String(parsed) !== editModal.maxDownloads.trim()) {
        setEditModal((prev) => prev ? { ...prev, validationError: 'Máximo de downloads deve ser um número inteiro positivo.' } : prev);
        return false;
      }
    }
    return true;
  };

  const handleSavePermissions = async () => {
    if (!editModal || !validateModal()) return;

    const permissions: FilePermissions = {
      allowedPlanIds: editModal.selectedPlanIds,
      maxDownloadsPerUser: editModal.maxDownloads.trim() === '' ? null : parseInt(editModal.maxDownloads, 10),
    };

    setEditModal((prev) => prev ? { ...prev, saving: true, error: '' } : prev);
    try {
      const updated = await apiClient.updateFilePermissions(editModal.fileId, permissions);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === updated.id
            ? { ...f, ...updated }
            : f
        )
      );
      closeEditModal();
    } catch (err) {
      let message = 'Erro ao salvar permissões.';
      if (err instanceof ApiRequestError) message = err.message;
      else if (err instanceof Error) message = err.message;
      setEditModal((prev) => prev ? { ...prev, saving: false, error: message } : prev);
    }
  };

  // ---- Render ----

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <span className="text-gray-500 text-sm">Carregando arquivos...</span>
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
    <>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">Arquivos cadastrados</h2>
        </div>

        {files.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
            Nenhum arquivo cadastrado.
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <th className="px-4 py-3">Arquivo</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Tamanho</th>
                    <th className="px-4 py-3">Planos</th>
                    <th className="px-4 py-3">Máx. downloads</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {files.map((file) => (
                    <tr key={file.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-sm font-medium text-gray-800 max-w-xs truncate">
                        {file.filename}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{file.mime_type}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{formatSize(file.size)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{getPlanNames(file.allowed_plan_ids)}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {file.max_downloads_per_user !== null ? file.max_downloads_per_user : 'Ilimitado'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(file)}
                            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(file.id, file.filename)}
                            disabled={deletingIds.has(file.id)}
                            className="px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {deletingIds.has(file.id) ? 'Excluindo...' : 'Excluir'}
                          </button>
                        </div>
                        {deleteErrors[file.id] && (
                          <p className="mt-1 text-xs text-red-600 text-right">{deleteErrors[file.id]}</p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-gray-100">
              {files.map((file) => (
                <div key={file.id} className="p-4">
                  <p className="text-sm font-medium text-gray-800 truncate mb-1">{file.filename}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
                    <span>{file.mime_type}</span>
                    <span>{formatSize(file.size)}</span>
                    <span>Planos: {getPlanNames(file.allowed_plan_ids)}</span>
                    <span>
                      Máx. downloads:{' '}
                      {file.max_downloads_per_user !== null ? file.max_downloads_per_user : 'Ilimitado'}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditModal(file)}
                      className="flex-1 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(file.id, file.filename)}
                      disabled={deletingIds.has(file.id)}
                      className="flex-1 py-2 text-sm bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {deletingIds.has(file.id) ? 'Excluindo...' : 'Excluir'}
                    </button>
                  </div>
                  {deleteErrors[file.id] && (
                    <p className="mt-1 text-xs text-red-600">{deleteErrors[file.id]}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Edit permissions modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-base font-semibold text-gray-800">
                Editar permissões
              </h3>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{editModal.filename}</p>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Plan checkboxes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Planos com acesso
                </label>
                {plans.length === 0 ? (
                  <p className="text-sm text-gray-400">Nenhum plano disponível.</p>
                ) : (
                  <div className="space-y-2">
                    {plans.map((plan) => (
                      <label key={plan.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editModal.selectedPlanIds.includes(plan.id)}
                          onChange={() => handleModalPlanToggle(plan.id)}
                          disabled={editModal.saving}
                          className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                        />
                        <span className="text-sm text-gray-700">{plan.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Max downloads */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Máximo de downloads por usuário{' '}
                  <span className="text-gray-400 font-normal">(deixe em branco para ilimitado)</span>
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={editModal.maxDownloads}
                  onChange={handleModalMaxDownloadsChange}
                  disabled={editModal.saving}
                  placeholder="Ilimitado"
                  className="w-full sm:w-40 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              </div>

              {/* Validation error */}
              {editModal.validationError && (
                <p className="text-sm text-red-600">{editModal.validationError}</p>
              )}

              {/* API error */}
              {editModal.error && (
                <p className="text-sm text-red-600">{editModal.error}</p>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={closeEditModal}
                disabled={editModal.saving}
                className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePermissions}
                disabled={editModal.saving}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {editModal.saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

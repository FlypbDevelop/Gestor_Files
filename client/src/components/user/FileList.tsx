import { useState, useEffect, useCallback } from 'react';
import apiClient from '../../services/apiClient';
import { FileWithDownloadsRemaining, ApiRequestError } from '../../types';

/**
 * FileList - Lists files available to the current user based on their plan.
 * Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3
 */
export default function FileList() {
  const [files, setFiles] = useState<FileWithDownloadsRemaining[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadErrors, setDownloadErrors] = useState<Record<number, string>>({});
  const [downloading, setDownloading] = useState<Record<number, boolean>>({});

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Req 6.3: ordered by creation date descending (handled by API)
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
  }, [fetchFiles]);

  const handleDownload = async (file: FileWithDownloadsRemaining) => {
    setDownloadErrors((prev) => ({ ...prev, [file.id]: '' }));
    setDownloading((prev) => ({ ...prev, [file.id]: true }));

    try {
      const blob = await apiClient.downloadFile(file.id);

      // Create a temporary Blob URL and trigger browser download
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      // Refresh list so downloads_remaining is updated (Req 6.2)
      await fetchFiles();
    } catch (err) {
      let message = 'Erro ao baixar arquivo.';
      if (err instanceof ApiRequestError) {
        if (err.status === 403) {
          message = 'Acesso negado. Seu plano não permite baixar este arquivo.';
        } else if (err.status === 429) {
          message = 'Limite de downloads atingido para este arquivo.';
        } else {
          message = err.message;
        }
      }
      setDownloadErrors((prev) => ({ ...prev, [file.id]: message }));
    } finally {
      setDownloading((prev) => ({ ...prev, [file.id]: false }));
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDownloadsRemaining = (remaining: number | null): string => {
    if (remaining === null) return 'Ilimitado';
    return String(remaining);
  };

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

  if (files.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        Nenhum arquivo disponível para o seu plano.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Desktop table - hidden on small screens */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="min-w-full bg-white rounded-lg shadow-sm border border-gray-200">
          <thead>
            <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <th className="px-4 py-3">Arquivo</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Tamanho</th>
              <th className="px-4 py-3">Downloads restantes</th>
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
                <td className="px-4 py-3 text-sm text-gray-500">
                  {formatDownloadsRemaining(file.downloads_remaining)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <button
                      onClick={() => handleDownload(file)}
                      disabled={
                        downloading[file.id] ||
                        (file.downloads_remaining !== null && file.downloads_remaining <= 0)
                      }
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {downloading[file.id] ? 'Baixando...' : 'Baixar'}
                    </button>
                    {downloadErrors[file.id] && (
                      <span className="text-xs text-red-600">{downloadErrors[file.id]}</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="sm:hidden space-y-3">
        {files.map((file) => (
          <div
            key={file.id}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
          >
            <p className="text-sm font-medium text-gray-800 truncate mb-1">{file.filename}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-3">
              <span>{file.mime_type}</span>
              <span>{formatSize(file.size)}</span>
              <span>Restantes: {formatDownloadsRemaining(file.downloads_remaining)}</span>
            </div>
            <button
              onClick={() => handleDownload(file)}
              disabled={
                downloading[file.id] ||
                (file.downloads_remaining !== null && file.downloads_remaining <= 0)
              }
              className="w-full py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {downloading[file.id] ? 'Baixando...' : 'Baixar'}
            </button>
            {downloadErrors[file.id] && (
              <p className="mt-1 text-xs text-red-600">{downloadErrors[file.id]}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

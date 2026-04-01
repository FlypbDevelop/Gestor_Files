import { useState, useRef } from 'react';
import apiClient from '../../services/apiClient';
import { Plan, File, ApiRequestError } from '../../types';

interface FileUploadProps {
  plans: Plan[];
  onUploadComplete: (file: File) => void;
}

/**
 * FileUpload - Admin component for uploading files with plan permissions.
 * Requirements: 4.1, 5.1, 5.2
 */
export default function FileUpload({ plans, onUploadComplete }: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<globalThis.File | null>(null);
  const [selectedPlanIds, setSelectedPlanIds] = useState<number[]>([]);
  const [maxDownloads, setMaxDownloads] = useState('');
  const [uploading, setUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [validationError, setValidationError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setSuccessMessage('');
    setErrorMessage('');
    setValidationError('');
  };

  const handlePlanToggle = (planId: number) => {
    setSelectedPlanIds((prev) =>
      prev.includes(planId) ? prev.filter((id) => id !== planId) : [...prev, planId]
    );
    setValidationError('');
  };

  const handleMaxDownloadsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMaxDownloads(e.target.value);
    setValidationError('');
  };

  const validate = (): boolean => {
    if (!selectedFile) {
      setValidationError('Selecione um arquivo para enviar.');
      return false;
    }
    if (selectedPlanIds.length === 0) {
      setValidationError('Selecione pelo menos um plano.');
      return false;
    }
    if (maxDownloads !== '') {
      const parsed = parseInt(maxDownloads, 10);
      if (isNaN(parsed) || parsed <= 0 || String(parsed) !== maxDownloads.trim()) {
        setValidationError('Máximo de downloads deve ser um número inteiro positivo.');
        return false;
      }
    }
    return true;
  };

  const resetForm = () => {
    setSelectedFile(null);
    setSelectedPlanIds([]);
    setMaxDownloads('');
    setValidationError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (!validate()) return;

    const maxDownloadsPerUser =
      maxDownloads.trim() === '' ? null : parseInt(maxDownloads, 10);

    setUploading(true);
    try {
      const uploaded = await apiClient.uploadFile(selectedFile!, {
        allowedPlanIds: selectedPlanIds,
        maxDownloadsPerUser,
      });
      setSuccessMessage(`Arquivo "${uploaded.filename}" enviado com sucesso.`);
      resetForm();
      onUploadComplete(uploaded);
    } catch (err) {
      let message = 'Erro ao enviar arquivo.';
      if (err instanceof ApiRequestError) {
        message = err.message;
      } else if (err instanceof Error) {
        message = err.message;
      }
      setErrorMessage(message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Enviar Arquivo</h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* File input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Arquivo
          </label>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            disabled={uploading}
            className="block w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
          />
          {selectedFile && (
            <p className="mt-1 text-xs text-gray-500">
              {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {/* Plan selection */}
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
                    checked={selectedPlanIds.includes(plan.id)}
                    onChange={() => handlePlanToggle(plan.id)}
                    disabled={uploading}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700">{plan.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Max downloads per user */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Máximo de downloads por usuário{' '}
            <span className="text-gray-400 font-normal">(deixe em branco para ilimitado)</span>
          </label>
          <input
            type="number"
            min="1"
            step="1"
            value={maxDownloads}
            onChange={handleMaxDownloadsChange}
            disabled={uploading}
            placeholder="Ilimitado"
            className="w-full sm:w-40 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        {/* Validation error */}
        {validationError && (
          <p className="text-sm text-red-600">{validationError}</p>
        )}

        {/* Success message */}
        {successMessage && (
          <p className="text-sm text-green-600">{successMessage}</p>
        )}

        {/* Error message */}
        {errorMessage && (
          <p className="text-sm text-red-600">{errorMessage}</p>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={uploading}
          className="w-full sm:w-auto px-6 py-2 text-sm font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {uploading ? 'Enviando...' : 'Enviar arquivo'}
        </button>
      </form>
    </div>
  );
}

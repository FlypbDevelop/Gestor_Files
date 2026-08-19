import { useState, useEffect } from 'react';
import apiClient from '../../services/apiClient';
import type { CreditPackage } from '../../types';

interface CreditStoreProps {
  onCreditsUpdated: (newCredits: number) => void;
}

/**
 * CreditStore - Componente de compra de créditos (Phase 2)
 * Exibe pacotes disponíveis e permite ao usuário comprar
 */
export default function CreditStore({ onCreditsUpdated }: CreditStoreProps) {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadPackages();
  }, []);

  async function loadPackages() {
    try {
      setLoading(true);
      const data = await apiClient.listCreditPackages();
      setPackages(data);
    } catch (err) {
      setError('Erro ao carregar pacotes de créditos');
    } finally {
      setLoading(false);
    }
  }

  async function handlePurchase(pkg: CreditPackage) {
    if (!window.confirm(`Comprar ${pkg.credits} créditos por R$ ${pkg.price.toFixed(2)}?`)) {
      return;
    }

    try {
      setPurchasing(pkg.id);
      setError(null);
      setSuccess(null);

      const result = await apiClient.purchaseCredits(pkg.id);
      setSuccess(`Compra realizada! ${result.message}`);
      onCreditsUpdated(result.user.credits);
    } catch (err) {
      setError('Erro ao processar compra. Tente novamente.');
    } finally {
      setPurchasing(null);
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500">Carregando pacotes...</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Comprar Créditos</h3>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 rounded text-sm">{success}</div>
      )}

      {packages.length === 0 ? (
        <p className="text-sm text-gray-500">Nenhum pacote disponível no momento.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="border border-gray-200 rounded-lg p-4 flex flex-col items-center"
            >
              <div className="text-sm font-medium text-gray-500 mb-1">{pkg.name}</div>
              <div className="text-2xl font-bold text-blue-600">{pkg.credits}</div>
              <div className="text-sm text-gray-500 mb-2">créditos</div>
              <div className="text-lg font-semibold text-gray-800 mb-3">
                R$ {pkg.price.toFixed(2)}
              </div>
              <button
                onClick={() => handlePurchase(pkg)}
                disabled={purchasing === pkg.id}
                className={`w-full py-2 px-4 rounded text-sm font-medium ${
                  purchasing === pkg.id
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {purchasing === pkg.id ? 'Processando...' : 'Comprar'}
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-gray-400 text-center">
        Checkout simulado — em produção, integra com Mercado Pago / Stripe.
      </p>
    </div>
  );
}

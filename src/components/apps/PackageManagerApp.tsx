import React, { useEffect, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';

interface PkgItem {
  name: string;
  version: string;
  sizeKb: number;
  summary: string;
}

export const PackageManagerApp: React.FC = () => {
  const [packages, setPackages] = useState<PkgItem[]>([]);
  const [query, setQuery] = useState('');
  const [auditResult, setAuditResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (q = '') => {
    setLoading(true);
    try {
      const res = await apiFetch<{ packages: PkgItem[] }>(`/api/packages?q=${encodeURIComponent(q)}`);
      setPackages(res.packages);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const checkUpdates = async () => {
    const res = await apiFetch<{ summary: string; checkedAt: string }>('/api/packages/check-updates', {
      method: 'POST',
    });
    setAuditResult(`${res.summary} (${new Date(res.checkedAt).toLocaleTimeString('es-ES')})`);
  };

  return (
    <div className="h-full flex flex-col p-4 gap-4 text-[var(--gtems-text)]">
      <div className="p-3.5 rounded-xl border border-[var(--gtems-border)] bg-[#DDF5EC]/50 dark:bg-[#398F91]/15 text-xs space-y-1">
        <div className="font-semibold">Gestor de Paquetes Debian / APT y Actualizaciones GTEMS OS</div>
        <p className="text-[var(--gtems-text-muted)]">
          Los paquetes listados provienen directamente de <code className="font-mono">dpkg-query</code> en el sistema anfitrión.
          Los archivos <code className="font-mono">.exe</code> de Windows no son nativos en Linux y requieren capas como Wine o máquinas virtuales.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void load(query);
          }}
          className="flex gap-2"
        >
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar paquete Debian instalado..."
            className="px-3 py-1.5 rounded-xl border border-[var(--gtems-border)] bg-white dark:bg-slate-800 text-xs w-64"
          />
          <button type="submit" className="px-3.5 py-1.5 rounded-xl bg-[#398F91] text-white text-xs font-medium">
            Buscar
          </button>
        </form>

        <button
          type="button"
          onClick={() => void checkUpdates()}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-[var(--gtems-border)] text-xs font-medium"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-[#398F91]" />
          <span>Verificar integridad (dpkg --audit)</span>
        </button>
      </div>

      {auditResult && (
        <div className="p-3 rounded-xl border border-[#398F91]/40 bg-[#398F91]/10 text-xs">{auditResult}</div>
      )}

      <div className="flex-1 overflow-y-auto aurora-scroll border border-[var(--gtems-border)] rounded-xl">
        {loading ? (
          <div className="p-4 text-xs text-[var(--gtems-text-muted)] flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Consultando dpkg...
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-white/95 dark:bg-slate-900/95 border-b border-[var(--gtems-border)]">
              <tr>
                <th className="py-2 px-3">Paquete</th>
                <th className="py-2 px-3">Versión</th>
                <th className="py-2 px-3 text-right">Tamaño</th>
                <th className="py-2 px-3">Descripción</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.name} className="border-b border-[var(--gtems-border)]/40">
                  <td className="py-2 px-3 font-mono font-semibold">{pkg.name}</td>
                  <td className="py-2 px-3 font-mono text-[var(--gtems-text-muted)]">{pkg.version}</td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums">{pkg.sizeKb} KB</td>
                  <td className="py-2 px-3 text-[var(--gtems-text-muted)] truncate max-w-xs">{pkg.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

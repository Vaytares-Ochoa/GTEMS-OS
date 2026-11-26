import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, XCircle } from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';

interface ProcessRow {
  pid: number;
  ppid: number;
  user: string;
  cpu: number;
  mem: number;
  elapsed: string;
  command: string;
}

interface ProcessResp {
  processes: ProcessRow[];
  cpuLoad: number[];
  memTotal: number;
  memFree: number;
}

export const TaskManagerApp: React.FC<{ onNotify: (t: string, b: string) => void }> = ({ onNotify }) => {
  const [data, setData] = useState<ProcessResp | null>(null);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch<ProcessResp>('/api/system/processes');
      setData(res);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error leyendo procesos');
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 4000);
    return () => clearInterval(timer);
  }, [load]);

  const killProc = async (pid: number, command: string) => {
    try {
      await apiFetch(`/api/system/processes/${pid}/kill`, { method: 'POST' });
      onNotify('Proceso finalizado', `Se envió SIGTERM a ${command} (PID ${pid}).`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo finalizar el proceso');
    }
  };

  const usedMem = data ? data.memTotal - data.memFree : 0;
  const memPct = data ? Math.round((usedMem / data.memTotal) * 100) : 0;
  const rows = (data?.processes || []).filter(
    (p) => !filter || p.command.toLowerCase().includes(filter.toLowerCase()) || String(p.pid).includes(filter)
  );

  return (
    <div className="h-full flex flex-col p-4 gap-4 text-[var(--gtems-text)]">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3.5 rounded-xl border border-[var(--gtems-border)] bg-white/60 dark:bg-slate-900/40">
          <div className="text-[var(--gtems-text-muted)]">Carga promedio CPU (1m / 5m / 15m)</div>
          <div className="mt-1 font-mono font-semibold text-base tabular-nums">
            {data ? data.cpuLoad.map((n) => n.toFixed(2)).join(' · ') : '—'}
          </div>
        </div>
        <div className="p-3.5 rounded-xl border border-[var(--gtems-border)] bg-white/60 dark:bg-slate-900/40">
          <div className="text-[var(--gtems-text-muted)]">Memoria RAM en uso</div>
          <div className="mt-1 font-mono font-semibold text-base tabular-nums">
            {data ? `${(usedMem / 1024 ** 3).toFixed(2)} / ${(data.memTotal / 1024 ** 3).toFixed(2)} GiB (${memPct}%)` : '—'}
          </div>
        </div>
        <div className="p-3.5 rounded-xl border border-[var(--gtems-border)] bg-white/60 dark:bg-slate-900/40">
          <div className="text-[var(--gtems-text-muted)]">Procesos activos (kernel ps)</div>
          <div className="mt-1 font-mono font-semibold text-base tabular-nums">{data?.processes.length ?? '—'}</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar por nombre o PID..."
          className="px-3 py-1.5 rounded-xl border border-[var(--gtems-border)] bg-white dark:bg-slate-800 text-xs w-64"
        />
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--gtems-border)] text-xs font-medium"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Actualizar</span>
        </button>
      </div>

      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}

      <div className="flex-1 overflow-y-auto aurora-scroll border border-[var(--gtems-border)] rounded-xl">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="sticky top-0 bg-white/95 dark:bg-slate-900/95 border-b border-[var(--gtems-border)]">
            <tr>
              <th className="py-2 px-3">PID</th>
              <th className="py-2 px-3">Proceso</th>
              <th className="py-2 px-3">Usuario</th>
              <th className="py-2 px-3 text-right">CPU %</th>
              <th className="py-2 px-3 text-right">RAM %</th>
              <th className="py-2 px-3 text-right">Tiempo</th>
              <th className="py-2 px-3 text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.pid} className="border-b border-[var(--gtems-border)]/40 hover:bg-[#398F91]/10">
                <td className="py-2 px-3 font-mono tabular-nums">{p.pid}</td>
                <td className="py-2 px-3 font-medium">{p.command}</td>
                <td className="py-2 px-3 text-[var(--gtems-text-muted)]">{p.user}</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums">{p.cpu.toFixed(1)}%</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums">{p.mem.toFixed(1)}%</td>
                <td className="py-2 px-3 text-right font-mono tabular-nums">{p.elapsed}</td>
                <td className="py-2 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => void killProc(p.pid, p.command)}
                    className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 hover:underline"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Finalizar</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

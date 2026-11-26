import React, { useEffect, useRef, useState } from 'react';
import { History, Play, Trash2, X, ShieldAlert, CornerDownLeft } from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';
import { formatTimeInZone, t } from '../../lib/i18n';
import { isDangerousTerminalCommand } from '../../lib/terminalHistoryLogic';
import type { TerminalHistoryEntry } from '../../lib/types';

interface TerminalLine {
  id: string;
  type: 'prompt' | 'stdout' | 'stderr' | 'info';
  text: string;
}

interface TerminalAppProps {
  initialPath?: string;
  language?: string;
  timezone?: string;
  initialHistory?: TerminalHistoryEntry[];
  onHistorySync?: (history: TerminalHistoryEntry[]) => void;
}

function resolveInitialTerminalCwd(vp?: string): string {
  if (!vp || vp === '/') return '.gtems-fs';
  if (vp === '/Sistema' || vp.startsWith('/Sistema/')) {
    const sub = vp.replace(/^\/Sistema\/?/, '');
    return sub ? `GTEMS-OS/${sub}` : 'GTEMS-OS';
  }
  return `.gtems-fs${vp}`;
}

export const TerminalApp: React.FC<TerminalAppProps> = ({
  initialPath,
  language = 'es-HN',
  timezone = 'America/Tegucigalpa',
  initialHistory = [],
  onHistorySync,
}) => {
  const [cwd, setCwd] = useState(() => resolveInitialTerminalCwd(initialPath));
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [persistedHistory, setPersistedHistory] = useState<TerminalHistoryEntry[]>(initialHistory);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [dangerousPending, setDangerousPending] = useState<string | null>(null);
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: 'init-1',
      type: 'info',
      text: 'GTEMS OS 1.0 Aurora — Terminal Bash Real. Ejecuta herramientas Linux o "gtemsctl help".',
    },
  ]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    apiFetch<{ history: TerminalHistoryEntry[] }>('/api/terminal/history')
      .then((res) => {
        setPersistedHistory(res.history || []);
        setHistory((res.history || []).map((h) => h.command));
        onHistorySync?.(res.history || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const runCommand = async (rawCmd: string) => {
    const cmd = rawCmd.trim();
    if (!cmd) return;
    if (cmd === 'clear') {
      setLines([]);
      setInput('');
      return;
    }

    setHistory((prev) => [cmd, ...prev].slice(0, 80));
    setHistoryIdx(-1);
    setLines((prev) => [
      ...prev,
      { id: `p-${Date.now()}`, type: 'prompt', text: `gtems:${cwd}$ ${cmd}` },
    ]);
    setInput('');
    setRunning(true);

    try {
      const res = await apiFetch<{
        stdout: string;
        stderr: string;
        exitCode: number;
        newCwd: string;
        terminalHistory?: TerminalHistoryEntry[];
      }>('/api/terminal/exec', {
        method: 'POST',
        body: JSON.stringify({ command: cmd, cwd }),
      });
      if (res.newCwd) setCwd(res.newCwd);
      if (res.terminalHistory) {
        setPersistedHistory(res.terminalHistory);
        onHistorySync?.(res.terminalHistory);
      }
      const additions: TerminalLine[] = [];
      if (res.stdout) additions.push({ id: `o-${Date.now()}`, type: 'stdout', text: res.stdout });
      if (res.stderr) additions.push({ id: `e-${Date.now()}`, type: 'stderr', text: res.stderr });
      setLines((prev) => [...prev, ...additions]);
    } catch (err) {
      setLines((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, type: 'stderr', text: err instanceof Error ? err.message : 'Error de ejecución' },
      ]);
    } finally {
      setRunning(false);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  };

  const clearPersistedHistory = async () => {
    const res = await apiFetch<{ history: TerminalHistoryEntry[] }>('/api/terminal/history', { method: 'DELETE' });
    setPersistedHistory(res.history || []);
    setConfirmClear(false);
    onHistorySync?.(res.history || []);
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(history.length - 1, historyIdx + 1);
      if (history[next] !== undefined) {
        setHistoryIdx(next);
        setInput(history[next]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = historyIdx - 1;
      if (next < 0) {
        setHistoryIdx(-1);
        setInput('');
      } else if (history[next] !== undefined) {
        setHistoryIdx(next);
        setInput(history[next]);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const parts = input.split(' ');
      const last = parts[parts.length - 1] || '';
      try {
        const res = await apiFetch<{ matches: string[] }>(
          `/api/terminal/complete?prefix=${encodeURIComponent(last)}&cwd=${encodeURIComponent(cwd)}`
        );
        if (res.matches.length === 1) {
          parts[parts.length - 1] = res.matches[0];
          setInput(parts.join(' '));
        } else if (res.matches.length > 1) {
          setLines((prev) => [...prev, { id: `tab-${Date.now()}`, type: 'info', text: res.matches.join('  ') }]);
        }
      } catch {
        // ignore
      }
    }
  };

  const handleSelectRow = (cmd: string) => {
    setInput(cmd);
    inputRef.current?.focus();
  };

  const handleExplicitReRun = (cmd: string) => {
    if (isDangerousTerminalCommand(cmd)) {
      setDangerousPending(cmd);
      return;
    }
    void runCommand(cmd);
  };

  return (
    <div
      className="relative h-full flex flex-col bg-[#0B161E] text-[#E6F7F4] font-mono text-xs overflow-hidden"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Top Bar: gtemsctl + History Drawer Toggle */}
      <div className="px-3 py-2 border-b border-white/10 bg-[#0F242D] flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-[#79D9CE] mr-1">gtemsctl:</span>
          {[
            'gtemsctl system info',
            'gtemsctl network status',
            'gtemsctl storage list',
            'gtemsctl devices list',
            'gtemsctl apps list',
            'gtemsctl logs',
          ].map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={running}
              onClick={(e) => {
                e.stopPropagation();
                void runCommand(preset);
              }}
              className="px-2 py-1 rounded bg-white/10 hover:bg-[#398F91]/50 text-[11px] transition-colors whitespace-nowrap"
            >
              {preset.replace('gtemsctl ', '')}
            </button>
          ))}
        </div>

        <button
          type="button"
          data-testid="terminal-history-toggle"
          onClick={(e) => {
            e.stopPropagation();
            setDrawerOpen((v) => !v);
          }}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
            drawerOpen ? 'bg-[#398F91] text-white' : 'bg-white/10 hover:bg-white/20 text-[#BCEBDD]'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          <span>{t(language, 'terminal.history')}</span>
        </button>
      </div>

      {/* Main Content + Adaptive Sliding History Drawer */}
      <div className="flex-1 min-h-0 flex relative overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Output */}
          <div ref={scrollRef} dir="ltr" className="flex-1 overflow-y-auto aurora-scroll p-4 space-y-1.5 whitespace-pre-wrap break-words text-left">
            {lines.map((line) => (
              <div
                key={line.id}
                className={
                  line.type === 'prompt'
                    ? 'text-[#79D9CE] font-semibold'
                    : line.type === 'stderr'
                    ? 'text-red-400'
                    : line.type === 'info'
                    ? 'text-[#A8D5EF]'
                    : 'text-[#EAF8F5]'
                }
              >
                {line.text}
              </div>
            ))}
          </div>

          {dangerousPending && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="mx-3 mb-2 p-2.5 rounded-xl bg-red-950/90 border border-red-500/40 flex flex-wrap items-center justify-between gap-2 text-[11px]"
            >
              <span className="inline-flex items-center gap-1.5 text-red-200">
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                <span>Comando potencialmente destructivo: <code className="text-white">{dangerousPending}</code></span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDangerousPending(null)}
                  className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20"
                >
                  {t(language, 'common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cmd = dangerousPending;
                    setDangerousPending(null);
                    void runCommand(cmd);
                  }}
                  className="px-2.5 py-1 rounded bg-red-600 text-white font-semibold"
                >
                  {t(language, 'common.confirm')}
                </button>
              </div>
            </div>
          )}

          {/* Input line */}
          <form
            dir="ltr"
            onSubmit={(e) => {
              e.preventDefault();
              void runCommand(input);
            }}
            className="px-4 py-2.5 border-t border-white/10 bg-[#0F242D] flex items-center gap-2"
          >
            <span className="text-[#79D9CE] font-semibold shrink-0">gtems$</span>
            <input
              ref={inputRef}
              type="text"
              aria-label="Comando de terminal Bash"
              value={input}
              disabled={running}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              placeholder={running ? 'Ejecutando...' : 'Escribe un comando Linux o gtemsctl...'}
              className="flex-1 bg-transparent text-[#F5FCFA] focus:outline-none min-w-0"
            />
            <button
              type="submit"
              disabled={running || !input.trim()}
              aria-label="Ejecutar comando"
              className="px-2.5 py-1 rounded bg-[#398F91]/80 hover:bg-[#398F91] text-white text-[11px] disabled:opacity-40 inline-flex items-center gap-1"
            >
              <CornerDownLeft className="w-3 h-3" />
              <span>{t(language, 'terminal.runSelected')}</span>
            </button>
          </form>
        </div>

        {/* Sliding Drawer (Last 20 Persistent Commands, Newest First) */}
        {drawerOpen && (
          <aside
            data-testid="terminal-history-drawer"
            onClick={(e) => e.stopPropagation()}
            className="w-80 max-w-[85%] shrink-0 border-l border-white/15 bg-[#081219] flex flex-col gtems-panel-anim"
          >
            <div className="px-3 py-2.5 border-b border-white/10 flex items-center justify-between gap-2">
              <span className="font-semibold text-[#79D9CE]">{t(language, 'terminal.history')}</span>
              <div className="flex items-center gap-1">
                {persistedHistory.length > 0 && !confirmClear && (
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="p-1 rounded hover:bg-white/10 text-red-400"
                    title={t(language, 'terminal.clearHistory')}
                    aria-label={t(language, 'terminal.clearHistory')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="p-1 rounded hover:bg-white/10 text-slate-400"
                  aria-label={t(language, 'common.close')}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {confirmClear && (
              <div className="p-2.5 bg-red-950/60 border-b border-red-500/30 space-y-2 text-[11px]">
                <p className="text-red-200">{t(language, 'terminal.confirmClear')}</p>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setConfirmClear(false)} className="px-2 py-1 rounded bg-white/10">
                    {t(language, 'common.cancel')}
                  </button>
                  <button type="button" onClick={() => void clearPersistedHistory()} className="px-2 py-1 rounded bg-red-600 text-white font-semibold">
                    {t(language, 'common.confirm')}
                  </button>
                </div>
              </div>
            )}

            <div className="px-3 py-1.5 text-[10px] text-slate-400 border-b border-white/5">
              {t(language, 'terminal.redactedNote')}
            </div>

            <div className="flex-1 overflow-y-auto aurora-scroll p-2 space-y-1.5">
              {persistedHistory.length === 0 ? (
                <div className="p-3 text-slate-400 text-[11px]">{t(language, 'terminal.noHistory')}</div>
              ) : (
                persistedHistory.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-2 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-400">
                      <span>#{idx + 1} · {formatTimeInZone(new Date(item.executedAt), language, timezone)}</span>
                      <span className={item.exitCode === 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {item.exitCode === 0 ? 'OK (0)' : `ERR (${item.exitCode})`}
                      </span>
                    </div>
                    <button
                      type="button"
                      dir="ltr"
                      onClick={() => handleSelectRow(item.command)}
                      className="w-full text-left font-mono text-[11px] text-[#E6F7F4] break-all hover:text-[#79D9CE]"
                      title="Clic para cargar en la entrada"
                    >
                      {item.command}
                    </button>
                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      <span className="text-[10px] text-slate-500 truncate">
                        {item.redacted ? 'Secreto redactado' : item.cwd}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleExplicitReRun(item.command)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#398F91]/40 hover:bg-[#398F91] text-white text-[10px] font-medium shrink-0"
                      >
                        <Play className="w-2.5 h-2.5" />
                        <span>{t(language, 'terminal.runSelected')}</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

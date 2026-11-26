import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Square,
  Save,
  FilePlus,
  FolderOpen,
  Search,
  CheckCircle2,
  AlertTriangle,
  Terminal as TerminalIcon,
  X,
  RefreshCw,
} from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';
import { t } from '../../lib/i18n';
import type { AppId, CodeRuntimeInfo, FileEntry } from '../../lib/types';

interface OpenTab {
  path: string;
  name: string;
  content: string;
  dirty: boolean;
  language: CodeRuntimeInfo['language'];
}

interface CodeStudioAppProps {
  initialPath?: string;
  language?: string;
  onOpenApp?: (appId: AppId, title?: string, payload?: { filePath?: string }) => void;
  onNotify?: (title: string, body: string) => void;
}

function inferLangFromName(name: string): CodeRuntimeInfo['language'] {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'py') return 'python';
  if (ext === 'js' || ext === 'jsx' || ext === 'mjs') return 'javascript';
  if (ext === 'ts' || ext === 'tsx') return 'typescript';
  if (ext === 'cpp' || ext === 'cc' || ext === 'hpp') return 'cpp';
  if (ext === 'c' || ext === 'h') return 'c';
  if (ext === 'java') return 'java';
  if (ext === 'cs') return 'csharp';
  if (ext === 'sql') return 'sql';
  if (ext === 'sh') return 'bash';
  return 'python';
}

const TEMPLATES: Record<CodeRuntimeInfo['language'], { ext: string; code: string }> = {
  python: { ext: 'py', code: 'print("Hola desde GTEMS Code Studio (Python 3)")\n' },
  javascript: { ext: 'js', code: 'console.log("Hola desde GTEMS Code Studio (Node.js)");\n' },
  typescript: { ext: 'ts', code: 'const msg: string = "Hola TypeScript en GTEMS OS";\nconsole.log(msg);\n' },
  cpp: { ext: 'cpp', code: '#include <iostream>\nint main() {\n  std::cout << "Hola C++ en GTEMS OS\\n";\n  return 0;\n}\n' },
  c: { ext: 'c', code: '#include <stdio.h>\nint main(void) {\n  printf("Hola C en GTEMS OS\\n");\n  return 0;\n}\n' },
  sql: { ext: 'sql', code: 'SELECT 1 + 1 AS resultado;\n' },
  bash: { ext: 'sh', code: '#!/usr/bin/env bash\necho "GTEMS Shell"\nuname -srm\n' },
  java: { ext: 'java', code: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hola Java");\n  }\n}\n' },
  csharp: { ext: 'cs', code: 'using System;\nConsole.WriteLine("Hola C#");\n' },
};

export const CodeStudioApp: React.FC<CodeStudioAppProps> = ({
  initialPath,
  language = 'es-HN',
  onOpenApp,
  onNotify,
}) => {
  const [projectDir, setProjectDir] = useState('/Proyectos');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [runtimes, setRuntimes] = useState<CodeRuntimeInfo[]>([]);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [output, setOutput] = useState<{
    stdout: string;
    stderr: string;
    exitCode: number | null;
    durationMs?: number;
    compilerOutput?: string;
  } | null>(null);
  const [autoSave, setAutoSave] = useState(true);
  const [editorFontSize, setEditorFontSize] = useState(13);
  const [showFind, setShowFind] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [newFilePrompt, setNewFilePrompt] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [confirmExternalRun, setConfirmExternalRun] = useState(true);

  const autoSaveTimer = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const activeTab = tabs.find((tb) => tb.path === activePath) || null;

  const loadDirectory = async (dir = projectDir) => {
    try {
      const res = await apiFetch<{ entries: FileEntry[] }>(`/api/fs/list?path=${encodeURIComponent(dir)}`);
      setEntries(res.entries);
    } catch {
      setEntries([]);
    }
  };

  const openFile = async (vp: string) => {
    const existing = tabs.find((tb) => tb.path === vp);
    if (existing) {
      setActivePath(vp);
      return;
    }
    try {
      const res = await apiFetch<{ content: string; path: string }>(`/api/fs/read?path=${encodeURIComponent(vp)}`);
      const name = vp.split('/').pop() || 'archivo';
      const newTab: OpenTab = {
        path: vp,
        name,
        content: res.content,
        dirty: false,
        language: inferLangFromName(name),
      };
      setTabs((prev) => [...prev, newTab]);
      setActivePath(vp);
    } catch (err) {
      onNotify?.('GTEMS Code Studio', err instanceof Error ? err.message : 'No se pudo abrir archivo');
    }
  };

  useEffect(() => {
    void loadDirectory('/Proyectos');
    apiFetch<{ runtimes: CodeRuntimeInfo[] }>('/api/code/runtimes')
      .then((r) => setRuntimes(r.runtimes))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (initialPath) {
      void openFile(initialPath);
    } else if (tabs.length === 0) {
      void openFile('/Proyectos/hola.py');
    }
  }, [initialPath]);

  const saveTab = async (tab: OpenTab) => {
    await apiFetch('/api/fs/file', {
      method: 'PUT',
      body: JSON.stringify({ path: tab.path, content: tab.content }),
    });
    setTabs((prev) => prev.map((item) => (item.path === tab.path ? { ...item, dirty: false } : item)));
  };

  const updateActiveContent = (nextCode: string) => {
    if (!activeTab) return;
    const targetPath = activeTab.path;
    setTabs((prev) => prev.map((tb) => (tb.path === targetPath ? { ...tb, content: nextCode, dirty: true } : tb)));
    if (autoSave) {
      if (autoSaveTimer.current) window.clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = window.setTimeout(() => {
        void saveTab({ ...activeTab, content: nextCode });
      }, 900);
    }
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = e.currentTarget;
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const val = el.value;
      const updated = val.slice(0, start) + '  ' + val.slice(end);
      updateActiveContent(updated);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + 2;
      });
    } else if (e.key === 'Enter') {
      const el = e.currentTarget;
      const start = el.selectionStart;
      const lineStart = el.value.lastIndexOf('\n', start - 1) + 1;
      const currentLine = el.value.slice(lineStart, start);
      const indentMatch = currentLine.match(/^(\s+)/);
      const extraIndent = /[:{]\s*$/.test(currentLine) ? '  ' : '';
      if (indentMatch || extraIndent) {
        e.preventDefault();
        const insert = '\n' + (indentMatch ? indentMatch[1] : '') + extraIndent;
        const updated = el.value.slice(0, start) + insert + el.value.slice(el.selectionEnd);
        updateActiveContent(updated);
        requestAnimationFrame(() => {
          el.selectionStart = el.selectionEnd = start + insert.length;
        });
      }
    }
  };

  const runCode = async () => {
    if (!activeTab) return;
    if (activeTab.dirty) {
      await saveTab(activeTab);
    }
    const id = `run_${Date.now()}`;
    setRunningId(id);
    setOutput(null);
    try {
      const res = await apiFetch<{
        stdout: string;
        stderr: string;
        exitCode: number;
        durationMs: number;
        compilerOutput?: string;
      }>('/api/code/execute', {
        method: 'POST',
        body: JSON.stringify({
          runId: id,
          language: activeTab.language,
          code: activeTab.content,
        }),
      });
      setOutput(res);
    } catch (err) {
      setOutput({
        stdout: '',
        stderr: err instanceof Error ? err.message : 'Error ejecutando proceso',
        exitCode: 1,
      });
    } finally {
      setRunningId(null);
    }
  };

  const stopRun = async () => {
    if (!runningId) return;
    await apiFetch(`/api/code/stop/${encodeURIComponent(runningId)}`, { method: 'POST' });
    setRunningId(null);
  };

  const createNewFile = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newFileName.trim();
    if (!clean) return;
    const lang = inferLangFromName(clean);
    const content = TEMPLATES[lang]?.code || '';
    const res = await apiFetch<{ path: string }>('/api/fs/create', {
      method: 'POST',
      body: JSON.stringify({ parentPath: projectDir, name: clean, isDirectory: false, content }),
    });
    setNewFileName('');
    setNewFilePrompt(false);
    await loadDirectory(projectDir);
    await openFile(res.path);
  };

  const handleReplaceAll = () => {
    if (!activeTab || !findQuery) return;
    updateActiveContent(activeTab.content.split(findQuery).join(replaceText));
  };

  const activeRuntime = activeTab ? runtimes.find((r) => r.language === activeTab.language) : null;
  const lineCount = activeTab ? activeTab.content.split('\n').length : 1;

  return (
    <div className="h-full flex flex-col text-[var(--gtems-text)] text-xs">
      {/* Top IDE Toolbar */}
      <div className="px-3 py-2 border-b border-[var(--gtems-border)] bg-white/60 dark:bg-slate-900/60 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setNewFilePrompt((v) => !v)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--gtems-border)] hover:bg-black/5 font-medium"
          >
            <FilePlus className="w-3.5 h-3.5" />
            <span>{t(language, 'code.newFile')}</span>
          </button>
          <button
            type="button"
            disabled={!activeTab}
            onClick={() => activeTab && void saveTab(activeTab)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--gtems-border)] hover:bg-black/5 font-medium disabled:opacity-40"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{t(language, 'code.save')}</span>
          </button>
          <button
            type="button"
            onClick={() => setShowFind((v) => !v)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--gtems-border)] hover:bg-black/5"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Buscar/Reemplazar</span>
          </button>
          <label className="inline-flex items-center gap-1.5 px-2 cursor-pointer">
            <input type="checkbox" checked={autoSave} onChange={(e) => setAutoSave(e.target.checked)} />
            <span>{t(language, 'code.autoSave')}</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab && (
            <select
              aria-label="Lenguaje de programación"
              value={activeTab.language}
              onChange={(e) => {
                const nextLang = e.target.value as CodeRuntimeInfo['language'];
                setTabs((prev) => prev.map((tb) => (tb.path === activeTab.path ? { ...tb, language: nextLang } : tb)));
              }}
              className="px-2.5 py-1.5 rounded-lg border border-[var(--gtems-border)] bg-white dark:bg-slate-800 font-medium"
            >
              <option value="python">Python 3</option>
              <option value="javascript">JavaScript (Node.js)</option>
              <option value="typescript">TypeScript (tsc/tsx)</option>
              <option value="cpp">C++ (g++)</option>
              <option value="c">C (gcc)</option>
              <option value="sql">SQL (SQLite)</option>
              <option value="bash">Bash</option>
              <option value="java">Java (JDK)</option>
              <option value="csharp">C# (.NET)</option>
            </select>
          )}

          <select
            aria-label="Tamaño de fuente del editor"
            value={editorFontSize}
            onChange={(e) => setEditorFontSize(Number(e.target.value))}
            className="px-2 py-1.5 rounded-lg border border-[var(--gtems-border)] bg-white dark:bg-slate-800"
          >
            <option value={12}>12 px</option>
            <option value={13}>13 px</option>
            <option value={15}>15 px</option>
            <option value={17}>17 px</option>
          </select>

          {runningId ? (
            <button
              type="button"
              onClick={() => void stopRun()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-600 text-white font-semibold"
            >
              <Square className="w-3.5 h-3.5" />
              <span>{t(language, 'code.stop')}</span>
            </button>
          ) : (
            <button
              type="button"
              disabled={!activeTab || !confirmExternalRun}
              onClick={() => void runCode()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--gtems-accent)] text-white font-semibold disabled:opacity-45"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{t(language, 'code.run')}</span>
            </button>
          )}

          {onOpenApp && (
            <button
              type="button"
              onClick={() => onOpenApp('terminal')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--gtems-border)] hover:bg-black/5"
              title="Abrir Terminal integrada del sistema"
            >
              <TerminalIcon className="w-3.5 h-3.5" />
              <span>Terminal</span>
            </button>
          )}
        </div>
      </div>

      {newFilePrompt && (
        <form onSubmit={createNewFile} className="px-3 py-2 border-b border-[var(--gtems-border)] bg-[var(--gtems-surface)] flex items-center gap-2">
          <input
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="nuevo_script.py / main.cpp / query.sql"
            autoFocus
            className="px-3 py-1.5 rounded-lg border border-[var(--gtems-border)] bg-white dark:bg-slate-800 w-72 font-mono"
          />
          <button type="submit" className="px-3 py-1.5 rounded-lg bg-[var(--gtems-accent)] text-white font-semibold">
            Crear en {projectDir}
          </button>
          <button type="button" onClick={() => setNewFilePrompt(false)} className="px-2 py-1.5 rounded-lg border border-[var(--gtems-border)]">
            Cancelar
          </button>
        </form>
      )}

      {showFind && (
        <div className="px-3 py-2 border-b border-[var(--gtems-border)] bg-white/75 dark:bg-slate-900/75 flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            placeholder="Buscar texto..."
            className="px-2.5 py-1 rounded-lg border border-[var(--gtems-border)] bg-white dark:bg-slate-800"
          />
          <input
            type="text"
            value={replaceText}
            onChange={(e) => setReplaceText(e.target.value)}
            placeholder="Reemplazar por..."
            className="px-2.5 py-1 rounded-lg border border-[var(--gtems-border)] bg-white dark:bg-slate-800"
          />
          <button type="button" onClick={handleReplaceAll} className="px-3 py-1 rounded-lg bg-[var(--gtems-accent)] text-white font-medium">
            Reemplazar todo
          </button>
        </div>
      )}

      {/* Main Split: Project Explorer + Editor + Output */}
      <div className="flex-1 min-h-0 flex">
        {/* Left Project Tree */}
        <aside className="w-52 shrink-0 border-r border-[var(--gtems-border)] bg-white/40 dark:bg-slate-900/40 flex flex-col">
          <div className="px-3 py-2 border-b border-[var(--gtems-border)] flex items-center justify-between font-semibold">
            <span className="inline-flex items-center gap-1.5 truncate">
              <FolderOpen className="w-3.5 h-3.5 text-[var(--gtems-accent)]" />
              <span>{projectDir}</span>
            </span>
            <button type="button" onClick={() => void loadDirectory(projectDir)} aria-label="Actualizar archivos">
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto aurora-scroll p-1.5 space-y-0.5">
            {entries.map((e) => (
              <button
                key={e.path}
                type="button"
                onClick={() => {
                  if (e.isDirectory) {
                    setProjectDir(e.path);
                    void loadDirectory(e.path);
                  } else {
                    void openFile(e.path);
                  }
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg truncate font-mono text-[11px] ${
                  activePath === e.path
                    ? 'bg-[var(--gtems-accent)] text-white font-semibold'
                    : 'hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {e.isDirectory ? `/${e.name}` : e.name}
              </button>
            ))}
          </div>

          {/* Detected Runtimes Summary */}
          <div className="p-2.5 border-t border-[var(--gtems-border)] space-y-1 max-h-44 overflow-y-auto aurora-scroll">
            <div className="font-semibold text-[11px] text-[var(--gtems-text-muted)]">{t(language, 'code.runtimes')}</div>
            {runtimes.map((rt) => (
              <div key={rt.language} className="flex items-center justify-between gap-1 text-[10px]">
                <span className="truncate">{rt.label}</span>
                {rt.installed ? (
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                )}
              </div>
            ))}
          </div>
        </aside>

        {/* Center Editor + Bottom Output */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Open File Tabs */}
          <div className="px-2 pt-1.5 border-b border-[var(--gtems-border)] bg-white/40 dark:bg-slate-900/40 flex items-center gap-1 overflow-x-auto">
            {tabs.map((tb) => (
              <div
                key={tb.path}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-t-lg border border-b-0 text-[11px] font-mono ${
                  tb.path === activePath
                    ? 'bg-[#0B161E] text-[#E6F7F4] border-[var(--gtems-border)] font-semibold'
                    : 'bg-transparent border-transparent text-[var(--gtems-text-muted)] hover:bg-black/5'
                }`}
              >
                <button type="button" onClick={() => setActivePath(tb.path)} className="truncate max-w-[140px]">
                  {tb.name}{tb.dirty ? '*' : ''}
                </button>
                <button
                  type="button"
                  aria-label={`Cerrar ${tb.name}`}
                  onClick={() => {
                    const rest = tabs.filter((x) => x.path !== tb.path);
                    setTabs(rest);
                    if (activePath === tb.path) setActivePath(rest[0]?.path || null);
                  }}
                >
                  <X className="w-3 h-3 opacity-70 hover:opacity-100" />
                </button>
              </div>
            ))}
          </div>

          {/* Runtime Honesty Notice if missing compiler */}
          {activeRuntime && !activeRuntime.installed && (
            <div className="px-4 py-2 bg-amber-500/15 border-b border-amber-500/30 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <span>
                <strong>{activeRuntime.label}:</strong> {activeRuntime.note}
              </span>
              {onOpenApp && (
                <button
                  type="button"
                  onClick={() => onOpenApp('package-manager')}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-semibold"
                >
                  Abrir Gestor APT ({activeRuntime.aptPackage})
                </button>
              )}
            </div>
          )}

          {/* Code Editor with Line Numbers */}
          <div className="flex-1 min-h-0 flex bg-[#0B161E] text-[#EAF8F5] overflow-hidden">
            <div
              aria-hidden="true"
              style={{ fontSize: `${editorFontSize}px`, lineHeight: '1.55' }}
              className="py-3 px-2.5 text-right select-none font-mono text-slate-500 bg-[#081016] border-r border-white/10 overflow-hidden"
            >
              {Array.from({ length: lineCount }, (_, idx) => (
                <div key={idx}>{idx + 1}</div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              aria-label="Editor de código GTEMS Code Studio"
              value={activeTab?.content || ''}
              onChange={(e) => updateActiveContent(e.target.value)}
              onKeyDown={handleEditorKeyDown}
              spellCheck={false}
              style={{ fontSize: `${editorFontSize}px`, lineHeight: '1.55' }}
              className="flex-1 h-full p-3 bg-transparent font-mono text-[#EAF8F5] resize-none focus:outline-none overflow-auto aurora-scroll"
            />
          </div>

          {/* Output Console */}
          <div className="h-44 shrink-0 border-t border-[var(--gtems-border)] bg-[#081016] text-[#DDF5EC] flex flex-col">
            <div className="px-3 py-1.5 border-b border-white/10 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-[#79D9CE]">{t(language, 'code.output')}</span>
                {activeRuntime && (
                  <span className="text-slate-400 font-mono">
                    {activeRuntime.toolName} · {activeRuntime.version || t(language, 'code.notInstalled')}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-1.5 text-slate-300">
                  <input
                    type="checkbox"
                    checked={confirmExternalRun}
                    onChange={(e) => setConfirmExternalRun(e.target.checked)}
                  />
                  <span>Autorizar ejecución aislada</span>
                </label>
                {output && (
                  <span className={`font-mono ${output.exitCode === 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    Exit {output.exitCode} {output.durationMs !== undefined ? `· ${output.durationMs} ms` : ''}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto aurora-scroll p-3 font-mono text-[11px] whitespace-pre-wrap break-words space-y-1">
              {runningId ? (
                <div className="text-[#79D9CE]">Compilando / ejecutando en proceso aislado...</div>
              ) : output ? (
                <>
                  {output.compilerOutput && <div className="text-sky-300">[Compilador] {output.compilerOutput}</div>}
                  {output.stdout && <div>{output.stdout}</div>}
                  {output.stderr && <div className="text-red-400">{output.stderr}</div>}
                  {!output.stdout && !output.stderr && (
                    <div className="text-slate-400">(Proceso finalizado sin salida estándar)</div>
                  )}
                </>
              ) : (
                <div className="text-slate-400">
                  Pulsa «{t(language, 'code.run')}» para ejecutar realmente el código mediante el compilador/intérprete del sistema.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

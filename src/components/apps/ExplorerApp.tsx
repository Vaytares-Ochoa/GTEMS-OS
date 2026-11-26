import React, { useCallback, useEffect, useState } from 'react';
import {
  Folder,
  FileText,
  Trash2,
  FolderPlus,
  FilePlus,
  RefreshCw,
  ArrowUp,
  RotateCcw,
  Archive,
  Image as ImageIcon,
  Music,
  Film,
  Code,
  ShieldAlert,
} from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';
import type { AppId, FileEntry } from '../../lib/types';
import { computeNextSelection } from '../../lib/contextMenuLogic';
import type { ContextMenuItem } from '../ContextMenu';

interface ExplorerAppProps {
  initialPath?: string;
  onOpenApp: (appId: AppId, title: string, payload?: { filePath?: string; initialUrl?: string }) => void;
  onOpenContextMenu: (x: number, y: number, items: ContextMenuItem[]) => void;
  onNotify: (title: string, body: string) => void;
}

const SIDEBAR_PLACES = [
  { label: 'Inicio', path: '/Inicio' },
  { label: 'Escritorio', path: '/Escritorio' },
  { label: 'Documentos', path: '/Documentos' },
  { label: 'Descargas', path: '/Descargas' },
  { label: 'Imágenes', path: '/Imágenes' },
  { label: 'Música', path: '/Música' },
  { label: 'Vídeos', path: '/Vídeos' },
  { label: 'Papelera', path: '/Papelera' },
  { label: 'Sistema GTEMS OS', path: '/Sistema' },
];

export const ExplorerApp: React.FC<ExplorerAppProps> = ({
  initialPath = '/Documentos',
  onOpenApp,
  onOpenContextMenu,
  onNotify,
}) => {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [readOnly, setReadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<{ mode: 'copy' | 'cut'; paths: string[] } | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'size' | 'date'>('name');
  const [creating, setCreating] = useState<'folder' | 'file' | null>(null);
  const [newName, setNewName] = useState('');
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmPermanent, setConfirmPermanent] = useState<string[] | null>(null);
  const [propertiesEntry, setPropertiesEntry] = useState<FileEntry | null>(null);

  const loadDir = useCallback(async (targetPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ entries: FileEntry[]; readOnly: boolean; currentPath: string }>(
        `/api/fs/list?path=${encodeURIComponent(targetPath)}`
      );
      setEntries(res.entries);
      setReadOnly(res.readOnly);
      setCurrentPath(res.currentPath);
      setSelected([]);
      setAnchor(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando directorio');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDir(currentPath);
  }, [currentPath, loadDir]);

  const sortedEntries = [...entries].sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    if (sortBy === 'size') return b.size - a.size;
    if (sortBy === 'date') return b.mtime.localeCompare(a.mtime);
    return a.name.localeCompare(b.name, 'es');
  });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        const activeTag = (document.activeElement?.tagName || '').toLowerCase();
        if (activeTag !== 'input' && activeTag !== 'textarea') {
          e.preventDefault();
          setSelected(sortedEntries.map((item) => item.path));
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sortedEntries]);

  const openEntry = (entry: FileEntry, forceApp?: AppId) => {
    if (entry.isDirectory) {
      setCurrentPath(entry.path);
      return;
    }
    const appTarget = forceApp || entry.appId;
    if (appTarget === 'incompatible-exe') {
      onNotify(
        'Ejecutable Windows (.exe)',
        `${entry.name} requiere Wine o una máquina virtual compatible; Linux no ejecuta archivos .exe nativamente.`
      );
      return;
    }
    if (appTarget === 'archive') {
      if (entry.extension === 'zip') {
        void handleExtract(entry.path);
      } else {
        onNotify('Archivo comprimido', `Usa la terminal (tar/7z/unzip) para gestionar ${entry.name}.`);
      }
      return;
    }
    if (appTarget === 'unsupported') {
      onOpenApp('text-editor', `Vista — ${entry.name}`, { filePath: entry.path });
      return;
    }
    onOpenApp(appTarget, entry.name, { filePath: entry.path });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !creating) return;
    try {
      await apiFetch('/api/fs/create', {
        method: 'POST',
        body: JSON.stringify({
          parentPath: currentPath,
          name: newName.trim(),
          isDirectory: creating === 'folder',
          content: creating === 'file' ? '' : undefined,
        }),
      });
      setCreating(null);
      setNewName('');
      await loadDir(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear');
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingPath || !renameValue.trim()) return;
    try {
      await apiFetch('/api/fs/rename', {
        method: 'POST',
        body: JSON.stringify({ path: renamingPath, newName: renameValue.trim() }),
      });
      setRenamingPath(null);
      setRenameValue('');
      await loadDir(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al renombrar');
    }
  };

  const handleTrash = async (paths: string[]) => {
    try {
      await apiFetch('/api/fs/trash', {
        method: 'POST',
        body: JSON.stringify({ paths }),
      });
      onNotify('Movido a la Papelera', `${paths.length} elemento(s) enviados a /Papelera.`);
      await loadDir(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al mover a la papelera');
    }
  };

  const handleRestore = async (paths: string[]) => {
    try {
      await apiFetch('/api/fs/restore', {
        method: 'POST',
        body: JSON.stringify({ paths }),
      });
      onNotify('Restaurado', `${paths.length} elemento(s) restaurados a su ubicación original.`);
      await loadDir(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al restaurar');
    }
  };

  const handlePermanentDelete = async (paths: string[]) => {
    try {
      await apiFetch('/api/fs/delete-permanent', {
        method: 'POST',
        body: JSON.stringify({ paths }),
      });
      setConfirmPermanent(null);
      await loadDir(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar definitivamente');
    }
  };

  const handleEmptyTrash = async () => {
    try {
      await apiFetch('/api/fs/empty-trash', { method: 'POST' });
      setConfirmPermanent(null);
      await loadDir(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al vaciar papelera');
    }
  };

  const handlePaste = async () => {
    if (!clipboard || clipboard.paths.length === 0) return;
    try {
      await apiFetch('/api/fs/transfer', {
        method: 'POST',
        body: JSON.stringify({ paths: clipboard.paths, destDir: currentPath, mode: clipboard.mode }),
      });
      if (clipboard.mode === 'cut') setClipboard(null);
      await loadDir(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al pegar');
    }
  };

  const handleSendTo = async (paths: string[], destDir: string) => {
    try {
      await apiFetch('/api/fs/transfer', {
        method: 'POST',
        body: JSON.stringify({ paths, destDir, mode: 'copy' }),
      });
      onNotify('Copiado correctamente', `${paths.length} elemento(s) enviados a ${destDir}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar elementos');
    }
  };

  const handleCompress = async (paths: string[]) => {
    try {
      const archiveName = `archivo_${Date.now()}.zip`;
      await apiFetch('/api/fs/compress', {
        method: 'POST',
        body: JSON.stringify({ paths, archiveName, parentPath: currentPath }),
      });
      onNotify('Comprimido', `Creado ${archiveName} en ${currentPath}.`);
      await loadDir(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al comprimir');
    }
  };

  const handleExtract = async (zipPath: string) => {
    try {
      await apiFetch('/api/fs/extract', {
        method: 'POST',
        body: JSON.stringify({ zipPath, destDir: currentPath }),
      });
      onNotify('Extraído', `Contenido extraído en ${currentPath}.`);
      await loadDir(currentPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al extraer');
    }
  };

  const renderEntryIcon = (entry: FileEntry) => {
    if (entry.isDirectory) return <Folder className="w-5 h-5 text-[#398F91] shrink-0" />;
    if (entry.appId === 'image-editor') return <ImageIcon className="w-5 h-5 text-sky-600 shrink-0" />;
    if (entry.appId === 'music-player') return <Music className="w-5 h-5 text-teal-600 shrink-0" />;
    if (entry.appId === 'video-player') return <Film className="w-5 h-5 text-indigo-600 shrink-0" />;
    if (entry.appId === 'archive') return <Archive className="w-5 h-5 text-amber-600 shrink-0" />;
    if (['js', 'ts', 'tsx', 'html', 'css', 'json', 'sh', 'py'].includes(entry.extension)) {
      return <Code className="w-5 h-5 text-cyan-700 shrink-0" />;
    }
    if (entry.appId === 'incompatible-exe') return <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />;
    return <FileText className="w-5 h-5 text-[var(--gtems-text-muted)] shrink-0" />;
  };

  const openItemContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    e.stopPropagation();
    const targetPaths = selected.includes(entry.path) ? selected : [entry.path];
    if (!selected.includes(entry.path)) setSelected([entry.path]);

    const inTrash = currentPath.startsWith('/Papelera');
    const items: ContextMenuItem[] = inTrash
      ? [
          { id: 'restore', label: 'Restaurar', onClick: () => void handleRestore(targetPaths) },
          {
            id: 'del-perm',
            label: 'Eliminar definitivamente',
            danger: true,
            onClick: () => setConfirmPermanent(targetPaths),
          },
          { id: 'props', label: 'Propiedades', dividerBefore: true, onClick: () => setPropertiesEntry(entry) },
        ]
      : [
          { id: 'open', label: 'Abrir', onClick: () => openEntry(entry) },
          ...(entry.isDirectory
            ? [
                {
                  id: 'open-term',
                  label: 'Abrir en terminal',
                  onClick: () => onOpenApp('terminal', `Terminal — ${entry.name}`, { filePath: entry.path }),
                },
              ]
            : [
                {
                  id: 'open-with',
                  label: 'Abrir con',
                  submenu: [
                    { id: 'ow-text', label: 'Editor de Texto', onClick: () => openEntry(entry, 'text-editor') },
                    { id: 'ow-img', label: 'Editor de Imágenes', onClick: () => openEntry(entry, 'image-editor') },
                    { id: 'ow-browser', label: 'Navegador Web', onClick: () => openEntry(entry, 'browser') },
                  ],
                },
              ]),
          {
            id: 'send-to',
            label: 'Enviar a',
            submenu: [
              { id: 'st-desk', label: 'Escritorio', onClick: () => void handleSendTo(targetPaths, '/Escritorio') },
              { id: 'st-docs', label: 'Documentos', onClick: () => void handleSendTo(targetPaths, '/Documentos') },
              { id: 'st-dl', label: 'Descargas', onClick: () => void handleSendTo(targetPaths, '/Descargas') },
            ],
          },
          { id: 'copy', label: 'Copiar', dividerBefore: true, onClick: () => setClipboard({ mode: 'copy', paths: targetPaths }) },
          { id: 'cut', label: 'Cortar', disabled: readOnly, onClick: () => setClipboard({ mode: 'cut', paths: targetPaths }) },
          {
            id: 'rename',
            label: 'Cambiar nombre',
            disabled: readOnly || targetPaths.length !== 1,
            onClick: () => {
              setRenamingPath(entry.path);
              setRenameValue(entry.name);
            },
          },
          {
            id: 'compress',
            label: 'Comprimir (.zip)',
            disabled: readOnly,
            onClick: () => void handleCompress(targetPaths),
          },
          ...(entry.extension === 'zip'
            ? [{ id: 'extract', label: 'Extraer aquí', disabled: readOnly, onClick: () => void handleExtract(entry.path) }]
            : []),
          {
            id: 'trash',
            label: 'Eliminar (Papelera)',
            danger: true,
            disabled: readOnly,
            dividerBefore: true,
            onClick: () => void handleTrash(targetPaths),
          },
          { id: 'props', label: 'Propiedades', dividerBefore: true, onClick: () => setPropertiesEntry(entry) },
        ];

    onOpenContextMenu(e.clientX, e.clientY, items);
  };

  const openBackgroundContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onOpenContextMenu(e.clientX, e.clientY, [
      { id: 'refresh', label: 'Actualizar', onClick: () => void loadDir(currentPath) },
      {
        id: 'new',
        label: 'Nuevo',
        disabled: readOnly || currentPath === '/Papelera',
        submenu: [
          { id: 'new-folder', label: 'Carpeta', onClick: () => { setCreating('folder'); setNewName(''); } },
          { id: 'new-txt', label: 'Archivo de texto (.txt)', onClick: () => { setCreating('file'); setNewName('nuevo.txt'); } },
          { id: 'new-html', label: 'Documento HTML (.html)', onClick: () => { setCreating('file'); setNewName('pagina.html'); } },
        ],
      },
      {
        id: 'paste',
        label: 'Pegar',
        disabled: readOnly || !clipboard,
        onClick: () => void handlePaste(),
      },
      {
        id: 'sort',
        label: 'Ordenar por',
        dividerBefore: true,
        submenu: [
          { id: 's-name', label: 'Nombre', onClick: () => setSortBy('name') },
          { id: 's-size', label: 'Tamaño', onClick: () => setSortBy('size') },
          { id: 's-date', label: 'Fecha de modificación', onClick: () => setSortBy('date') },
        ],
      },
    ]);
  };

  const goParent = () => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    setCurrentPath(parts.length === 0 ? '/' : '/' + parts.join('/'));
  };

  return (
    <div className="h-full flex text-[var(--gtems-text)]">
      {/* Left Navigation Sidebar */}
      <aside className="w-52 shrink-0 border-r border-[var(--gtems-border)] p-3 overflow-y-auto aurora-scroll bg-white/40 dark:bg-slate-900/35">
        <div className="text-[11px] font-semibold text-[var(--gtems-text-muted)] px-2.5 mb-2">
          Ubicaciones
        </div>
        <nav className="space-y-0.5">
          {SIDEBAR_PLACES.map((place) => (
            <button
              key={place.path}
              type="button"
              onClick={() => setCurrentPath(place.path)}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium text-left transition-colors ${
                currentPath === place.path
                  ? 'bg-[#398F91] text-white'
                  : 'hover:bg-[#398F91]/12 text-[var(--gtems-text)]'
              }`}
            >
              {place.path === '/Papelera' ? <Trash2 className="w-4 h-4 shrink-0" /> : <Folder className="w-4 h-4 shrink-0" />}
              <span className="truncate">{place.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Explorer Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar */}
        <div className="px-4 py-2.5 border-b border-[var(--gtems-border)] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              aria-label="Subir un nivel"
              onClick={goParent}
              className="p-1.5 rounded-lg border border-[var(--gtems-border)] hover:bg-black/5"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <div className="px-3 py-1.5 rounded-lg bg-white/70 dark:bg-slate-800/70 border border-[var(--gtems-border)] font-mono text-xs truncate">
              {currentPath}
            </div>
            {readOnly && (
              <span className="text-[11px] text-[var(--gtems-text-muted)] whitespace-nowrap">Solo lectura</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {currentPath === '/Papelera' ? (
              <>
                {selected.length > 0 && (
                  <button
                    type="button"
                    onClick={() => void handleRestore(selected)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#398F91] text-white text-xs font-medium whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restaurar</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setConfirmPermanent(entries.map((e) => e.path))}
                  disabled={entries.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-400/50 text-red-600 dark:text-red-400 text-xs font-medium disabled:opacity-40 whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Vaciar papelera</span>
                </button>
              </>
            ) : (
              !readOnly && (
                <>
                  <button
                    type="button"
                    onClick={() => { setCreating('folder'); setNewName(''); }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--gtems-border)] hover:bg-[#398F91]/10 text-xs font-medium whitespace-nowrap"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    <span>Nueva carpeta</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCreating('file'); setNewName('documento.txt'); }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--gtems-border)] hover:bg-[#398F91]/10 text-xs font-medium whitespace-nowrap"
                  >
                    <FilePlus className="w-3.5 h-3.5" />
                    <span>Nuevo archivo</span>
                  </button>
                  {selected.length > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleTrash(selected)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-400/40 text-red-600 dark:text-red-400 text-xs font-medium whitespace-nowrap"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar ({selected.length})</span>
                    </button>
                  )}
                </>
              )
            )}
            <button
              type="button"
              aria-label="Actualizar directorio"
              onClick={() => void loadDir(currentPath)}
              className="p-1.5 rounded-lg border border-[var(--gtems-border)] hover:bg-black/5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Inline Creation or Rename Form */}
        {creating && (
          <form onSubmit={handleCreate} className="px-4 py-2 border-b border-[var(--gtems-border)] bg-[#DDF5EC]/50 dark:bg-[#398F91]/15 flex items-center gap-2">
            <span className="text-xs font-medium">{creating === 'folder' ? 'Nombre de carpeta:' : 'Nombre de archivo:'}</span>
            <input
              type="text"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-[var(--gtems-border)] bg-white dark:bg-slate-800 text-xs"
            />
            <button type="submit" className="px-3 py-1 rounded-lg bg-[#398F91] text-white text-xs font-medium">Crear</button>
            <button type="button" onClick={() => setCreating(null)} className="px-2 py-1 text-xs">Cancelar</button>
          </form>
        )}

        {renamingPath && (
          <form onSubmit={handleRename} className="px-4 py-2 border-b border-[var(--gtems-border)] bg-[#CDEBFA]/50 dark:bg-slate-800 flex items-center gap-2">
            <span className="text-xs font-medium">Nuevo nombre:</span>
            <input
              type="text"
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-[var(--gtems-border)] bg-white dark:bg-slate-900 text-xs"
            />
            <button type="submit" className="px-3 py-1 rounded-lg bg-[#398F91] text-white text-xs font-medium">Guardar</button>
            <button type="button" onClick={() => setRenamingPath(null)} className="px-2 py-1 text-xs">Cancelar</button>
          </form>
        )}

        {error && (
          <div role="alert" className="px-4 py-2 text-xs text-red-600 bg-red-500/10 border-b border-red-500/20">
            {error}
          </div>
        )}

        {/* File Table */}
        <div
          className="flex-1 overflow-y-auto aurora-scroll p-3"
          onContextMenu={openBackgroundContextMenu}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelected([]);
          }}
        >
          {loading ? (
            <div className="p-6 text-xs text-[var(--gtems-text-muted)]">Leyendo sistema de archivos...</div>
          ) : sortedEntries.length === 0 ? (
            <div className="p-10 text-center text-xs text-[var(--gtems-text-muted)]">
              Esta carpeta está vacía. Haz clic derecho para crear elementos.
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--gtems-border)] text-[var(--gtems-text-muted)]">
                  <th className="py-2 px-2.5 font-medium">Nombre</th>
                  <th className="py-2 px-2.5 font-medium">Tipo</th>
                  <th className="py-2 px-2.5 font-medium text-right">Tamaño</th>
                  <th className="py-2 px-2.5 font-medium text-right">
                    {currentPath === '/Papelera' ? 'Eliminado' : 'Modificado'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((entry) => {
                  const isSel = selected.includes(entry.path);
                  return (
                    <tr
                      key={entry.path}
                      onClick={(e) => {
                        const res = computeNextSelection(
                          sortedEntries.map((x) => x.path),
                          selected,
                          entry.path,
                          anchor,
                          { ctrlKey: e.ctrlKey || e.metaKey, shiftKey: e.shiftKey }
                        );
                        setSelected(res.selected);
                        setAnchor(res.nextAnchor);
                      }}
                      onDoubleClick={() => openEntry(entry)}
                      onContextMenu={(e) => openItemContextMenu(e, entry)}
                      className={`cursor-pointer border-b border-[var(--gtems-border)]/40 transition-colors ${
                        isSel ? 'bg-[#79D9CE]/30 dark:bg-[#398F91]/35' : 'hover:bg-[#398F91]/10'
                      }`}
                    >
                      <td className="py-2 px-2.5 flex items-center gap-2.5 font-medium">
                        {renderEntryIcon(entry)}
                        <span className="truncate">{entry.name}</span>
                      </td>
                      <td className="py-2 px-2.5 text-[var(--gtems-text-muted)]">
                        {entry.isDirectory ? 'Carpeta' : entry.mimeType}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[var(--gtems-text-muted)]">
                        {entry.isDirectory ? '—' : `${(entry.size / 1024).toFixed(1)} KB`}
                      </td>
                      <td className="py-2 px-2.5 text-right font-mono tabular-nums text-[var(--gtems-text-muted)]">
                        {new Date(entry.trashInfo?.deletedAt || entry.mtime).toLocaleString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Permanent Delete Confirmation Modal */}
      {confirmPermanent && (
        <div className="fixed inset-0 z-[10001] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl aurora-glass p-5 shadow-2xl space-y-4">
            <h3 className="font-display font-bold text-base">Confirmar eliminación definitiva</h3>
            <p className="text-xs text-[var(--gtems-text-muted)]">
              Esta acción eliminará permanentemente {confirmPermanent.length} elemento(s) y no se puede deshacer.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmPermanent(null)}
                className="px-3.5 py-2 rounded-xl border border-[var(--gtems-border)] text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() =>
                  currentPath === '/Papelera' && confirmPermanent.length === entries.length
                    ? void handleEmptyTrash()
                    : void handlePermanentDelete(confirmPermanent)
                }
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-semibold"
              >
                Eliminar definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Properties Modal */}
      {propertiesEntry && (
        <div className="fixed inset-0 z-[10001] bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl aurora-glass p-5 shadow-2xl space-y-3 text-xs">
            <h3 className="font-display font-bold text-base">Propiedades</h3>
            <div><strong>Nombre:</strong> {propertiesEntry.name}</div>
            <div><strong>Ruta:</strong> <span className="font-mono">{propertiesEntry.path}</span></div>
            <div><strong>MIME:</strong> <span className="font-mono">{propertiesEntry.mimeType}</span></div>
            <div><strong>Tamaño:</strong> <span className="font-mono">{propertiesEntry.size} bytes</span></div>
            {propertiesEntry.trashInfo && (
              <div><strong>Ruta original:</strong> <span className="font-mono">{propertiesEntry.trashInfo.originalPath}</span></div>
            )}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setPropertiesEntry(null)}
                className="px-4 py-2 rounded-xl bg-[#398F91] text-white font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

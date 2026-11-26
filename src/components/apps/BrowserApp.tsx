import React, { useEffect, useState } from 'react';
import {
  RotateCw,
  Home,
  Star,
  Download,
  Plus,
  X,
  ExternalLink,
  Search,
  ShieldCheck,
  History,
  Globe,
  Pause,
  Play,
  Trash2,
  FolderOpen,
  FileCheck,
} from 'lucide-react';
import { apiFetch } from '../../lib/apiClient';
import { resolveFileExtension } from '../../lib/gtemsIdentity';
import { t } from '../../lib/i18n';
import type {
  AppId,
  BrowserBookmark,
  BrowserHistoryEntry,
  BrowserRegistryItem,
  DownloadItem,
} from '../../lib/types';

interface InspectResult {
  finalUrl: string;
  status: number;
  statusText: string;
  contentType: string;
  title: string;
  latencyMs: number;
  snippet: string;
  history: BrowserHistoryEntry[];
}

interface BrowserTab {
  id: string;
  title: string;
  url: string;
  result: InspectResult | null;
  error: string | null;
  loading: boolean;
}

interface BrowserAppProps {
  initialUrl?: string;
  language?: string;
  bookmarks: BrowserBookmark[];
  history: BrowserHistoryEntry[];
  downloads: DownloadItem[];
  onBookmarksChange: (b: BrowserBookmark[]) => void;
  onHistoryChange: (h: BrowserHistoryEntry[]) => void;
  onDownloadsChange: (d: DownloadItem[]) => void;
  onOpenApp?: (appId: AppId, title?: string, payload?: { filePath?: string }) => void;
  onNotify: (title: string, body: string) => void;
}

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const BrowserApp: React.FC<BrowserAppProps> = ({
  initialUrl = 'https://www.google.com',
  language = 'es-HN',
  bookmarks,
  history,
  downloads,
  onBookmarksChange,
  onHistoryChange,
  onDownloadsChange,
  onOpenApp,
  onNotify,
}) => {
  const [browsers, setBrowsers] = useState<BrowserRegistryItem[]>([]);
  const [defaultBrowser, setDefaultBrowser] = useState<BrowserRegistryItem['id']>('gtems-browser');
  const [tabs, setTabs] = useState<BrowserTab[]>([
    { id: 'tab-1', title: 'Nueva pestaña', url: initialUrl, result: null, error: null, loading: false },
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-1');
  const [addressInput, setAddressInput] = useState(initialUrl);
  const [panel, setPanel] = useState<'web' | 'bookmarks' | 'history' | 'downloads' | 'browsers'>('web');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [safetyConfirmFile, setSafetyConfirmFile] = useState<DownloadItem | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const loadBrowsers = () => {
    apiFetch<{ defaultBrowser: BrowserRegistryItem['id']; browsers: BrowserRegistryItem[] }>('/api/browsers')
      .then((res) => {
        setBrowsers(res.browsers);
        setDefaultBrowser(res.defaultBrowser);
      })
      .catch(() => {});
  };

  useEffect(() => {
    loadBrowsers();
  }, []);

  useEffect(() => {
    if (initialUrl && initialUrl !== 'https://www.google.com') {
      void navigate(initialUrl);
    }
  }, [initialUrl]);

  // Poll live streaming download progress whenever any item is downloading
  useEffect(() => {
    const hasActive = downloads.some((d) => d.status === 'downloading');
    if (!hasActive) return;
    const timer = window.setInterval(() => {
      apiFetch<{ downloads: DownloadItem[] }>('/api/downloads')
        .then((res) => onDownloadsChange(res.downloads))
        .catch(() => {});
    }, 500);
    return () => window.clearInterval(timer);
  }, [downloads, onDownloadsChange]);

  const navigate = async (rawInput: string) => {
    let target = rawInput.trim();
    if (!target) return;
    if (!/^https?:\/\//i.test(target)) {
      if (target.includes('.') && !target.includes(' ')) {
        target = `https://${target}`;
      } else {
        target = `https://www.google.com/search?q=${encodeURIComponent(target)}`;
      }
    }
    setAddressInput(target);
    setPanel('web');
    setTabs((prev) =>
      prev.map((tb) => (tb.id === activeTab.id ? { ...tb, url: target, loading: true, error: null } : tb))
    );

    try {
      const res = await apiFetch<InspectResult>('/api/browser/inspect-url', {
        method: 'POST',
        body: JSON.stringify({ url: target }),
      });
      onHistoryChange(res.history);
      setTabs((prev) =>
        prev.map((tb) =>
          tb.id === activeTab.id ? { ...tb, url: res.finalUrl, title: res.title, result: res, loading: false } : tb
        )
      );
    } catch (err) {
      setTabs((prev) =>
        prev.map((tb) =>
          tb.id === activeTab.id
            ? { ...tb, loading: false, error: err instanceof Error ? err.message : 'Error de conexión' }
            : tb
        )
      );
    }
  };

  const addBookmark = async () => {
    const res = await apiFetch<{ bookmarks: BrowserBookmark[] }>('/api/browser/bookmarks', {
      method: 'POST',
      body: JSON.stringify({ title: activeTab.title || activeTab.url, url: activeTab.url }),
    });
    onBookmarksChange(res.bookmarks);
    onNotify('Favorito guardado', activeTab.url);
  };

  const startRealDownload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!downloadUrl.trim()) return;
    setDownloading(true);
    try {
      const res = await apiFetch<{ downloads: DownloadItem[] }>('/api/downloads/start', {
        method: 'POST',
        body: JSON.stringify({ url: downloadUrl.trim() }),
      });
      onDownloadsChange(res.downloads);
      setDownloadUrl('');
    } catch (err) {
      onNotify('Error de descarga', err instanceof Error ? err.message : 'No se pudo descargar');
    } finally {
      setDownloading(false);
    }
  };

  const controlDownload = async (id: string, action: 'pause' | 'resume' | 'cancel' | 'delete') => {
    try {
      if (action === 'delete') {
        const res = await apiFetch<{ downloads: DownloadItem[] }>(`/api/downloads/${id}?deleteFile=1`, {
          method: 'DELETE',
        });
        onDownloadsChange(res.downloads);
      } else {
        const res = await apiFetch<{ downloads: DownloadItem[] }>(`/api/downloads/${id}/${action}`, {
          method: 'POST',
        });
        onDownloadsChange(res.downloads);
      }
    } catch (err) {
      onNotify('Descargas', err instanceof Error ? err.message : 'Operación no disponible');
    }
  };

  const openDownloadedFile = (d: DownloadItem, skipSafety = false) => {
    const reg = resolveFileExtension(d.filename);
    if (!skipSafety && (reg.appId === 'incompatible-exe' || reg.appId === 'package-manager' || reg.appId === 'unsupported')) {
      setSafetyConfirmFile(d);
      return;
    }
    if (!onOpenApp) return;
    if (reg.appId === 'archive' || reg.appId === 'incompatible-exe' || reg.appId === 'unsupported') {
      onOpenApp('explorer', 'Descargas', { filePath: '/Descargas' });
    } else {
      onOpenApp(reg.appId, d.filename, { filePath: d.savePath });
    }
  };

  const setAsDefaultBrowser = async (browserId: BrowserRegistryItem['id']) => {
    try {
      const res = await apiFetch<{ defaultBrowser: BrowserRegistryItem['id']; browsers: BrowserRegistryItem[] }>(
        '/api/browsers/default',
        {
          method: 'POST',
          body: JSON.stringify({ browserId }),
        }
      );
      setDefaultBrowser(res.defaultBrowser);
      setBrowsers(res.browsers);
      onNotify('Navegador predeterminado', `Establecido: ${res.defaultBrowser}`);
    } catch (err) {
      onNotify('Navegador', err instanceof Error ? err.message : 'No compatible o no instalado');
    }
  };

  const openInHostBrowser = (url: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.click();
  };

  const activeBrowserInfo = browsers.find((b) => b.id === defaultBrowser);

  return (
    <div className="h-full flex flex-col text-[var(--gtems-text)]">
      {/* Tabs Strip */}
      <div className="px-2 pt-2 bg-white/50 dark:bg-slate-900/60 border-b border-[var(--gtems-border)] flex items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-t-xl text-xs max-w-[180px] border border-b-0 ${
              tab.id === activeTab.id
                ? 'bg-white dark:bg-[#0D1E26] border-[var(--gtems-border)] font-semibold'
                : 'bg-transparent border-transparent text-[var(--gtems-text-muted)] hover:bg-white/40'
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setActiveTabId(tab.id);
                setAddressInput(tab.url);
              }}
              className="truncate text-left flex-1"
            >
              {tab.title}
            </button>
            {tabs.length > 1 && (
              <button
                type="button"
                aria-label={`Cerrar pestaña ${tab.title}`}
                onClick={() => {
                  const rest = tabs.filter((x) => x.id !== tab.id);
                  setTabs(rest);
                  if (tab.id === activeTab.id) setActiveTabId(rest[0].id);
                }}
                className="opacity-60 hover:opacity-100"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          aria-label="Nueva pestaña"
          onClick={() => {
            const id = `tab-${Date.now()}`;
            setTabs((prev) => [...prev, { id, title: 'Nueva pestaña', url: 'https://www.google.com', result: null, error: null, loading: false }]);
            setActiveTabId(id);
            setAddressInput('https://www.google.com');
          }}
          className="p-1.5 rounded-lg hover:bg-black/5"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Navigation Toolbar */}
      <div className="px-3 py-2 border-b border-[var(--gtems-border)] flex flex-wrap items-center gap-1.5 bg-white/80 dark:bg-slate-900/50">
        <button type="button" aria-label="Inicio" onClick={() => void navigate('https://www.google.com')} className="p-1.5 rounded-lg hover:bg-black/5">
          <Home className="w-4 h-4" />
        </button>
        <button type="button" aria-label="Actualizar" onClick={() => void navigate(activeTab.url)} className="p-1.5 rounded-lg hover:bg-black/5">
          <RotateCw className={`w-4 h-4 ${activeTab.loading ? 'animate-spin' : ''}`} />
        </button>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void navigate(addressInput);
          }}
          className="flex-1 min-w-[200px] flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--gtems-border)] bg-white dark:bg-slate-800"
        >
          <Search className="w-3.5 h-3.5 text-[var(--gtems-text-muted)]" />
          <input
            type="text"
            aria-label="Barra de direcciones o búsqueda de Google"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            placeholder="Introduce URL HTTPS o busca en Google..."
            className="flex-1 bg-transparent text-xs focus:outline-none min-w-0"
          />
        </form>

        <button type="button" aria-label="Guardar favorito" onClick={addBookmark} className="p-1.5 rounded-lg hover:bg-black/5">
          <Star className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setPanel((p) => (p === 'browsers' ? 'web' : 'browsers'))}
          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
            panel === 'browsers' ? 'bg-[var(--gtems-accent)] text-white' : 'hover:bg-black/5'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Navegadores</span>
        </button>
        <button
          type="button"
          onClick={() => setPanel((p) => (p === 'bookmarks' ? 'web' : 'bookmarks'))}
          className="px-2.5 py-1.5 rounded-lg text-xs font-medium hover:bg-black/5 whitespace-nowrap"
        >
          {t(language, 'browser.bookmarks')}
        </button>
        <button
          type="button"
          onClick={() => setPanel((p) => (p === 'history' ? 'web' : 'history'))}
          className="p-1.5 rounded-lg hover:bg-black/5"
          aria-label={t(language, 'browser.history')}
        >
          <History className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => setPanel((p) => (p === 'downloads' ? 'web' : 'downloads'))}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[var(--gtems-accent)]/15 text-xs font-medium whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{t(language, 'browser.downloads')} ({downloads.length})</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto aurora-scroll p-5 space-y-5">
        {/* Default Browser Honesty Banner */}
        <div className="p-3.5 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5 max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-[var(--gtems-accent)]" />
              <span>
                {t(language, 'browser.defaultBrowser')}: {activeBrowserInfo?.name || 'GTEMS Browser'}
              </span>
            </div>
            <p className="text-[11px] text-[var(--gtems-text-muted)]">
              {activeBrowserInfo?.statusNote || 'Consulta HTTP/HTTPS real desde GTEMS OS o abre la página en tu navegador anfitrión.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openInHostBrowser(activeTab.url)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--gtems-accent)] text-white text-xs font-semibold whitespace-nowrap"
          >
            <span>Abrir enlace externo</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>

        {panel === 'browsers' && (
          <div className="space-y-3">
            <h3 className="font-display font-bold text-sm">Administrador real de navegadores Linux</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {browsers.map((b) => (
                <div key={b.id} className="p-4 rounded-xl border border-[var(--gtems-border)] bg-white/50 dark:bg-slate-900/40 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm">{b.name}</span>
                    <span className="font-mono text-[11px] text-[var(--gtems-text-muted)]">
                      {!b.supportedOnLinux
                        ? 'Incompatible con Linux'
                        : b.installed
                        ? b.isDefault
                          ? 'Predeterminado'
                          : 'Instalado'
                        : 'No instalado'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--gtems-text-muted)] leading-relaxed">{b.statusNote}</p>
                  {b.version && <div className="font-mono text-[10px] text-[var(--gtems-text-muted)]">{b.version}</div>}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {b.installed && !b.isDefault && (
                      <button
                        type="button"
                        onClick={() => void setAsDefaultBrowser(b.id)}
                        className="px-3 py-1 rounded-lg bg-[var(--gtems-accent)] text-white text-[11px] font-medium"
                      >
                        Establecer predeterminado
                      </button>
                    )}
                    {b.installed && (
                      <button
                        type="button"
                        onClick={() => {
                          if (b.id === 'gtems-browser') setPanel('web');
                          else openInHostBrowser(activeTab.url);
                        }}
                        className="px-3 py-1 rounded-lg border border-[var(--gtems-border)] text-[11px]"
                      >
                        Abrir
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {panel === 'bookmarks' && (
          <div className="space-y-2">
            <h3 className="font-display font-bold text-sm">Favoritos guardados</h3>
            {bookmarks.map((bm) => (
              <div key={bm.id} className="flex items-center justify-between p-3 rounded-xl border border-[var(--gtems-border)]">
                <div>
                  <div className="text-xs font-semibold">{bm.title}</div>
                  <div className="text-[11px] font-mono text-[var(--gtems-text-muted)]">{bm.url}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => void navigate(bm.url)} className="px-3 py-1 rounded-lg bg-[var(--gtems-accent)] text-white text-xs">
                    Consultar
                  </button>
                  <button type="button" onClick={() => openInHostBrowser(bm.url)} className="px-3 py-1 rounded-lg border border-[var(--gtems-border)] text-xs">
                    Externo
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {panel === 'history' && (
          <div className="space-y-2">
            <h3 className="font-display font-bold text-sm">Historial reciente</h3>
            {history.length === 0 ? (
              <p className="text-xs text-[var(--gtems-text-muted)]">Sin consultas registradas aún.</p>
            ) : (
              history.map((h) => (
                <div key={h.id} className="flex items-center justify-between p-3 rounded-xl border border-[var(--gtems-border)] text-xs">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{h.title}</div>
                    <div className="font-mono text-[11px] text-[var(--gtems-text-muted)] truncate">{h.url}</div>
                  </div>
                  <button type="button" onClick={() => void navigate(h.url)} className="px-3 py-1 rounded-lg border border-[var(--gtems-border)] shrink-0">
                    Abrir
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {panel === 'downloads' && (
          <div className="space-y-4">
            <h3 className="font-display font-bold text-sm">Gestor real de descargas (almacena físicamente en /Descargas)</h3>
            <form onSubmit={startRealDownload} className="flex gap-2">
              <input
                type="url"
                value={downloadUrl}
                onChange={(e) => setDownloadUrl(e.target.value)}
                placeholder="https://www.rfc-editor.org/rfc/rfc9110.txt"
                className="flex-1 px-3 py-2 rounded-xl border border-[var(--gtems-border)] bg-white dark:bg-slate-800 text-xs"
              />
              <button
                type="submit"
                disabled={downloading}
                className="px-4 py-2 rounded-xl bg-[var(--gtems-accent)] text-white text-xs font-semibold whitespace-nowrap"
              >
                {downloading ? 'Conectando...' : 'Descargar archivo'}
              </button>
            </form>

            {safetyConfirmFile && (
              <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/15 text-xs space-y-2">
                <div className="font-semibold">Verificación de seguridad: {safetyConfirmFile.filename}</div>
                <p className="text-[var(--gtems-text-muted)]">
                  Este tipo de archivo puede requerir confirmación o herramientas externas. Nunca se ejecuta automáticamente.
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSafetyConfirmFile(null)} className="px-3 py-1 rounded-lg border border-[var(--gtems-border)]">
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const f = safetyConfirmFile;
                      setSafetyConfirmFile(null);
                      openDownloadedFile(f, true);
                    }}
                    className="px-3 py-1 rounded-lg bg-amber-600 text-white font-semibold"
                  >
                    Abrir en Explorador / Gestor
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2.5">
              {downloads.map((d) => {
                const pct = d.totalBytes > 0 ? Math.min(100, Math.round((d.receivedBytes / d.totalBytes) * 100)) : d.status === 'completed' ? 100 : 0;
                return (
                  <div
                    key={d.id}
                    onDoubleClick={() => d.status === 'completed' && openDownloadedFile(d)}
                    className="p-3.5 rounded-xl border border-[var(--gtems-border)] bg-white/50 dark:bg-slate-900/40 text-xs space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold">{d.filename}</span>
                      <span className="font-mono text-[11px] tabular-nums">
                        {formatBytes(d.receivedBytes)}
                        {d.totalBytes > 0 ? ` / ${formatBytes(d.totalBytes)} (${pct}%)` : ''} · {d.status}
                        {d.speedBps > 0 && d.status === 'downloading' ? ` · ${formatBytes(d.speedBps)}/s` : ''}
                        {d.etaSeconds ? ` · ETA ${d.etaSeconds}s` : ''}
                      </span>
                    </div>

                    <div className="w-full h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                      <div className="h-full bg-[var(--gtems-accent)] transition-all" style={{ width: `${pct}%` }} />
                    </div>

                    <div className="font-mono text-[11px] text-[var(--gtems-text-muted)] truncate">
                      {d.savePath} {d.sha256 ? `· SHA256: ${d.sha256.slice(0, 16)}...` : ''} {d.error ? `· ${d.error}` : ''}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {d.status === 'downloading' && (
                        <button type="button" onClick={() => void controlDownload(d.id, 'pause')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--gtems-border)]">
                          <Pause className="w-3 h-3" /> {t(language, 'browser.pause')}
                        </button>
                      )}
                      {d.status === 'paused' && (
                        <button type="button" onClick={() => void controlDownload(d.id, 'resume')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--gtems-border)]">
                          <Play className="w-3 h-3" /> {t(language, 'browser.resume')} {d.supportsRange ? '(Range)' : '(Reinicia)'}
                        </button>
                      )}
                      {(d.status === 'downloading' || d.status === 'paused') && (
                        <button type="button" onClick={() => void controlDownload(d.id, 'cancel')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--gtems-border)]">
                          <X className="w-3 h-3" /> {t(language, 'browser.cancel')}
                        </button>
                      )}
                      {d.status === 'completed' && (
                        <>
                          <button type="button" onClick={() => openDownloadedFile(d)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--gtems-accent)] text-white font-medium">
                            <FileCheck className="w-3 h-3" /> {t(language, 'common.open')}
                          </button>
                          {onOpenApp && (
                            <button type="button" onClick={() => onOpenApp('explorer', 'Descargas', { filePath: '/Descargas' })} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--gtems-border)]">
                              <FolderOpen className="w-3 h-3" /> {t(language, 'browser.showInFolder')}
                            </button>
                          )}
                        </>
                      )}
                      <button type="button" onClick={() => void controlDownload(d.id, 'delete')} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-red-600 hover:bg-red-500/10">
                        <Trash2 className="w-3 h-3" /> {t(language, 'browser.delete')}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {panel === 'web' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Google', url: 'https://www.google.com' },
                { label: 'YouTube', url: 'https://www.youtube.com' },
                { label: 'Reddit', url: 'https://www.reddit.com' },
                { label: 'Debian', url: 'https://www.debian.org' },
              ].map((site) => (
                <button
                  key={site.url}
                  type="button"
                  onClick={() => void navigate(site.url)}
                  className="px-3 py-1.5 rounded-lg border border-[var(--gtems-border)] hover:bg-[var(--gtems-accent)]/10 text-xs font-medium"
                >
                  {site.label}
                </button>
              ))}
            </div>

            {activeTab.error && (
              <div role="alert" className="p-4 rounded-xl border border-red-400/40 bg-red-500/10 text-xs text-red-600 dark:text-red-400">
                {activeTab.error}
              </div>
            )}

            {activeTab.result ? (
              <div className="rounded-2xl border border-[var(--gtems-border)] p-4 space-y-3 bg-white/60 dark:bg-slate-900/50">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-semibold">{activeTab.result.title}</span>
                  <span className="font-mono text-[11px] text-[var(--gtems-text-muted)] tabular-nums">
                    HTTP {activeTab.result.status} · {activeTab.result.latencyMs} ms · {activeTab.result.contentType}
                  </span>
                </div>
                <div className="text-[11px] font-mono text-[var(--gtems-text-muted)] break-all">
                  URL final: {activeTab.result.finalUrl}
                </div>
                <pre className="p-3 rounded-xl bg-slate-950 text-[#DDF5EC] text-[11px] font-mono overflow-x-auto max-h-72 overflow-y-auto">
                  {activeTab.result.snippet || 'Respuesta binaria o sin cuerpo HTML legible.'}
                </pre>
              </div>
            ) : (
              <p className="text-xs text-[var(--gtems-text-muted)]">
                Introduce una dirección URL o consulta de búsqueda arriba para realizar peticiones HTTPS reales o abrirla en el navegador externo predeterminado.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

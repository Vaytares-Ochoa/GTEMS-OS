import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  User as UserIcon,
  Wifi,
  ShieldCheck,
  RotateCcw,
  Power,
  Download,
  AlertTriangle,
  Upload,
  Check,
  Globe,
  Clock,
  Lock,
  Sparkles,
  MousePointer,
  HardDriveDownload,
  Copy,
  RefreshCw,
  Moon,
  X,
} from 'lucide-react';
import {
  APP_CATALOG,
  AURORA_PALETTE,
  GTEMS_IDENTITY,
  SETTINGS_CATEGORIES,
  WALLPAPER_PRESETS,
} from '../../lib/gtemsIdentity';
import {
  ANIMATION_PRESETS,
  CURSOR_STYLES,
  THEME_PRESETS,
} from '../../lib/themes';
import {
  formatRegionalSample,
  formatTimeInZone,
  getIanaTimezoneCatalog,
  resolveLanguageOption,
  SUPPORTED_LANGUAGES,
  t,
} from '../../lib/i18n';
import { apiFetch, getAuthToken } from '../../lib/apiClient';
import type {
  AnimationLevel,
  AppId,
  BrowserRegistryItem,
  CursorStyleId,
  DesktopPersonalization,
  SystemStateSummary,
  ThemePresetId,
  UserProfile,
  WallpaperFitMode,
} from '../../lib/types';
import { GtemsAppIcon, GtemsLogo } from '../icons/GtemsIcons';

interface HardwareSpecs {
  hostname: string;
  processor: { vendor: string; model: string; architecture: string; cores: number; frequencyMhz: number | null };
  memory: { totalBytes: number; usedBytes: number; freeBytes: number };
  gpu: string;
  storage: Array<{ filesystem: string; type: string; sizeBytes: number; usedBytes: number; availBytes: number; usePercent: string; mount: string }>;
  batteryPresent?: boolean;
  systemType: { arch: string; kernelVersion: string; hostPlatform: string; uptimeSeconds: number };
}

interface NetworkStatus {
  interfaces: Array<{ name: string; isWireless: boolean; isLoopback: boolean; addresses: Array<{ address: string; family: string }> }>;
  wifiHardwarePresent: boolean;
  wifiStatusMessage: string;
  dnsServers: string[];
  gateway: string;
}

interface DeviceItem {
  name: string;
  manufacturer: string;
  type: string;
  status: string;
  port: string;
  details: string;
}

interface DebianPkg {
  name: string;
  version: string;
  arch: string;
  summary: string;
}

interface RecoveryInfo {
  recoveryMediaValid: boolean;
  installerScriptExists: boolean;
  grubCfgExists: boolean;
  installerScriptPath: string;
}

interface IsoReleaseMetadata {
  available: boolean;
  status: 'available' | 'unavailable' | 'corrupted';
  name: string;
  filename: string | null;
  version: string;
  architecture: string;
  sizeBytes: number;
  sizeFormatted: string;
  buildDate: string | null;
  publishDate: string | null;
  bootCompatibility: string;
  sha256: string | null;
  checksumVerified: boolean;
  channel: string;
  downloadUrl: string | null;
  reason: string;
  missingToolchain: string[];
}

type IsoUiStatus =
  | 'checking'
  | 'unavailable'
  | 'ready'
  | 'preparing'
  | 'downloading'
  | 'completed'
  | 'cancelled'
  | 'error';

interface SettingsAppProps {
  initialCategory?: string;
  currentUser: UserProfile;
  systemState: SystemStateSummary;
  openAppIds?: AppId[];
  onOpenApp?: (appId: AppId, title?: string, payload?: { filePath?: string; initialCategory?: string }) => void;
  onUpdateSettings: (patch: Omit<Partial<SystemStateSummary>, 'personalization'> & { personalization?: Partial<DesktopPersonalization> }) => Promise<void>;
  onUsersRefresh: () => Promise<void>;
  onPowerAction?: (action: 'shutdown' | 'reboot' | 'reinstall') => void;
  onNotify: (title: string, body: string) => void;
}

export const SettingsApp: React.FC<SettingsAppProps> = ({
  initialCategory = 'inicio',
  currentUser,
  systemState,
  openAppIds = [],
  onOpenApp,
  onUpdateSettings,
  onUsersRefresh,
  onPowerAction,
  onNotify,
}) => {
  const [category, setCategory] = useState(initialCategory);
  const [searchQuery, setSearchQuery] = useState('');
  const [hardware, setHardware] = useState<HardwareSpecs | null>(null);
  const [network, setNetwork] = useState<NetworkStatus | null>(null);
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [browsers, setBrowsers] = useState<BrowserRegistryItem[]>([]);
  const [packages, setPackages] = useState<DebianPkg[]>([]);
  const [recoveryInfo, setRecoveryInfo] = useState<RecoveryInfo | null>(null);

  const [diagHost, setDiagHost] = useState('deb.debian.org');
  const [diagResult, setDiagResult] = useState<{ dnsResolved: string[]; pingOutput: string } | null>(null);

  // Personalization state
  const [wallpaperTarget, setWallpaperTarget] = useState<'desktop' | 'lock'>('desktop');
  const [wallpaperUrlInput, setWallpaperUrlInput] = useState('');
  const [uploadingWp, setUploadingWp] = useState(false);

  // Language & Timezone filters
  const [langSearch, setLangSearch] = useState('');
  const [tzSearch, setTzSearch] = useState('');
  const [tzContinent, setTzContinent] = useState('ALL');

  // Apps manager state
  const [appsTab, setAppsTab] = useState<'all' | 'preinstalled' | 'apt' | 'running' | 'browsers'>('all');
  const [selectedAppInspect, setSelectedAppInspect] = useState<AppId | null>(null);
  const [aptFilter, setAptFilter] = useState('');

  // Accounts state
  const [newUsername, setNewUsername] = useState('');
  const [newDisplay, setNewDisplay] = useState('');
  const [newPass, setNewPass] = useState('');
  const [currPass, setCurrPass] = useState('');
  const [nextPass, setNextPass] = useState('');
  const [accountMsg, setAccountMsg] = useState<string | null>(null);

  // Recovery & Reinstall state
  const [confirmAction, setConfirmAction] = useState<'reset-settings' | 'suspend' | 'reboot' | 'shutdown' | 'reinstall' | null>(null);
  const [reinstallText, setReinstallText] = useState('');
  const [recoveryMsg, setRecoveryMsg] = useState<string | null>(null);

  // ISO Download Center state
  const [isoMeta, setIsoMeta] = useState<IsoReleaseMetadata | null>(null);
  const [isoStatus, setIsoStatus] = useState<IsoUiStatus>('checking');
  const [isoProgress, setIsoProgress] = useState<{ received: number; total: number }>({ received: 0, total: 0 });
  const [isoError, setIsoError] = useState<string | null>(null);
  const isoAbortRef = React.useRef<AbortController | null>(null);

  const checkIsoAvailability = async () => {
    setIsoStatus('checking');
    setIsoError(null);
    try {
      const resp = await fetch('/api/system/iso/latest');
      const data = (await resp.json()) as IsoReleaseMetadata;
      setIsoMeta(data);
      setIsoStatus(data.available ? 'ready' : 'unavailable');
    } catch (err) {
      setIsoStatus('error');
      setIsoError(err instanceof Error ? err.message : 'No se pudo consultar la disponibilidad de la imagen ISO.');
    }
  };

  useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory]);

  useEffect(() => {
    apiFetch<HardwareSpecs>('/api/system/hardware').then(setHardware).catch(() => {});
    apiFetch<NetworkStatus>('/api/network/status').then(setNetwork).catch(() => {});
    apiFetch<{ devices: DeviceItem[] }>('/api/devices').then((d) => setDevices(d.devices || [])).catch(() => {});
    apiFetch<{ browsers: BrowserRegistryItem[] }>('/api/browsers').then((b) => setBrowsers(b.browsers || [])).catch(() => {});
    apiFetch<RecoveryInfo>('/api/system/recovery-info').then(setRecoveryInfo).catch(() => {});
    void checkIsoAvailability();
  }, []);

  useEffect(() => {
    if (category === 'aplicaciones' && appsTab === 'apt' && packages.length === 0) {
      apiFetch<{ packages: DebianPkg[] }>('/api/packages').then((r) => setPackages(r.packages || [])).catch(() => {});
    }
  }, [category, appsTab, packages.length]);

  const lang = systemState.language || 'es-HN';
  const activeLangOpt = resolveLanguageOption(lang);
  const p = systemState.personalization;

  const tzCatalog = useMemo(() => getIanaTimezoneCatalog(), []);
  const continents = useMemo(() => ['ALL', ...Array.from(new Set(tzCatalog.map((z) => z.continent)))], [tzCatalog]);

  const filteredLanguages = useMemo(() => {
    const q = langSearch.trim().toLowerCase();
    if (!q) return SUPPORTED_LANGUAGES;
    return SUPPORTED_LANGUAGES.filter(
      (l) =>
        l.nativeName.toLowerCase().includes(q) ||
        l.englishName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    );
  }, [langSearch]);

  const filteredTimezones = useMemo(() => {
    const q = tzSearch.trim().toLowerCase();
    return tzCatalog
      .filter((z) => (tzContinent === 'ALL' ? true : z.continent === tzContinent))
      .filter((z) => !q || z.id.toLowerCase().includes(q) || z.city.toLowerCase().includes(q) || z.offsetLabel.toLowerCase().includes(q))
      .slice(0, 120);
  }, [tzCatalog, tzContinent, tzSearch]);

  const regionalSample = useMemo(
    () => formatRegionalSample(lang, systemState.timezone),
    [lang, systemState.timezone]
  );

  const searchMatches = searchQuery.trim()
    ? SETTINGS_CATEGORIES.filter(
        (c) =>
          c.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t(lang, c.i18nKey, c.label).toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.keywords.some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  const runDiag = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch<{ dnsResolved: string[]; pingOutput: string }>('/api/network/diagnose', {
        method: 'POST',
        body: JSON.stringify({ host: diagHost }),
      });
      setDiagResult(res);
    } catch (err) {
      onNotify('Diagnóstico de red', err instanceof Error ? err.message : 'Error ejecutando diagnóstico');
    }
  };

  const handleWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) {
      onNotify('Fondo de pantalla', 'La imagen supera el límite recomendado de 6 MiB.');
      return;
    }
    setUploadingWp(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await apiFetch<{ ok: boolean; virtualPath: string; wallpaperUrl: string }>(
          '/api/personalization/upload-wallpaper',
          {
            method: 'POST',
            body: JSON.stringify({ filename: file.name, base64: String(reader.result || '') }),
          }
        );
        if (wallpaperTarget === 'desktop') {
          await onUpdateSettings({ personalization: { wallpaper: res.wallpaperUrl } });
        } else {
          await onUpdateSettings({ personalization: { lockWallpaper: res.wallpaperUrl } });
        }
        onNotify('Fondo actualizado', `Imagen guardada en ${res.virtualPath}`);
      } catch (err) {
        onNotify('Error al subir fondo', err instanceof Error ? err.message : 'Error');
      } finally {
        setUploadingWp(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const applyWallpaperUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = wallpaperUrlInput.trim();
    if (!/^https?:\/\//i.test(u) && !u.startsWith('/')) {
      onNotify('URL inválida', 'Introduce una URL HTTP/HTTPS válida o una ruta local.');
      return;
    }
    if (wallpaperTarget === 'desktop') {
      await onUpdateSettings({ personalization: { wallpaper: u } });
    } else {
      await onUpdateSettings({ personalization: { lockWallpaper: u } });
    }
    setWallpaperUrlInput('');
  };

  const applyZeylaPreset = async (themeId: ThemePresetId) => {
    if (themeId === 'custom') {
      await onUpdateSettings({
        personalization: {
          themeId: 'custom',
          theme: p.customTheme?.isDark ? 'dark' : 'light',
        },
      });
      return;
    }
    const def = THEME_PRESETS[themeId];
    await onUpdateSettings({
      personalization: {
        themeId,
        theme: def.isDark ? 'dark' : 'light',
        accentColor: def.accent,
        cursorColor: def.accent,
      },
    });
  };

  const toggleStartupApp = async (appId: AppId) => {
    const exists = systemState.startupApps.includes(appId);
    const next = exists ? systemState.startupApps.filter((a) => a !== appId) : [...systemState.startupApps, appId];
    await onUpdateSettings({ startupApps: next });
  };

  const setDefaultBrowser = async (browserId: BrowserRegistryItem['id']) => {
    try {
      const res = await apiFetch<{ ok: boolean; defaultBrowser: BrowserRegistryItem['id']; browsers: BrowserRegistryItem[] }>(
        '/api/browsers/default',
        { method: 'POST', body: JSON.stringify({ browserId }) }
      );
      setBrowsers(res.browsers);
      await onUsersRefresh();
      onNotify('Navegador predeterminado', `Se estableció ${browserId} como predeterminado.`);
    } catch (err) {
      onNotify('Navegador no disponible', err instanceof Error ? err.message : 'Error');
    }
  };

  const downloadBackup = async () => {
    try {
      const token = getAuthToken();
      const resp = await fetch('/api/system/backup', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) throw new Error('No se pudo exportar la copia de seguridad.');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gtems-os-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onNotify('Copia de seguridad exportada', 'Archivo JSON de configuración guardado.');
    } catch (err) {
      onNotify('Error de respaldo', err instanceof Error ? err.message : 'Error');
    }
  };

  const startIsoDownload = async () => {
    if (!isoMeta?.available || !isoMeta.downloadUrl) {
      setIsoStatus('unavailable');
      return;
    }
    const ctrl = new AbortController();
    isoAbortRef.current = ctrl;
    setIsoStatus('preparing');
    setIsoError(null);
    setIsoProgress({ received: 0, total: isoMeta.sizeBytes || 0 });

    try {
      const resp = await fetch(isoMeta.downloadUrl, { signal: ctrl.signal });
      if (!resp.ok) {
        let msg = `Error HTTP ${resp.status}`;
        try {
          const errJson = (await resp.json()) as { error?: string };
          if (errJson.error) msg = errJson.error;
        } catch {
          // ignore non-json error body
        }
        throw new Error(msg);
      }

      const contentLength = Number(resp.headers.get('content-length') || isoMeta.sizeBytes || 0);
      setIsoProgress({ received: 0, total: contentLength });
      setIsoStatus('downloading');

      const reader = resp.body?.getReader();
      const chunks: BlobPart[] = [];
      let received = 0;

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            received += value.byteLength;
            setIsoProgress({ received, total: contentLength });
          }
        }
      } else {
        const buf = await resp.arrayBuffer();
        chunks.push(buf);
        received = buf.byteLength;
        setIsoProgress({ received, total: buf.byteLength });
      }

      const blob = new Blob(chunks, { type: 'application/x-iso9660-image' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = isoMeta.filename || 'GTEMS-OS.iso';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setIsoStatus('completed');
      onNotify('Descarga de ISO completada', `${isoMeta.filename || 'GTEMS-OS.iso'} descargada correctamente.`);
    } catch (err) {
      if (ctrl.signal.aborted) {
        setIsoStatus('cancelled');
      } else {
        setIsoStatus('error');
        setIsoError(err instanceof Error ? err.message : 'Error descargando la imagen ISO.');
      }
    } finally {
      isoAbortRef.current = null;
    }
  };

  const cancelIsoDownload = () => {
    isoAbortRef.current?.abort();
  };

  const executeRecoveryPower = async () => {
    if (!confirmAction) return;
    setRecoveryMsg(null);
    try {
      await apiFetch('/api/system/power', {
        method: 'POST',
        body: JSON.stringify({
          action: confirmAction,
          confirmReset: confirmAction === 'reinstall' ? reinstallText : undefined,
        }),
      });
      if (confirmAction === 'reset-settings') {
        await onUsersRefresh();
        setConfirmAction(null);
        setRecoveryMsg('Preferencias visuales y de idioma restablecidas a los valores de fábrica.');
        return;
      }
      if (confirmAction === 'suspend') {
        setConfirmAction(null);
        setRecoveryMsg(
          'Sesión suspendida en el entorno web. En hardware físico con systemd se invoca systemctl suspend; el estado fue guardado de forma segura.'
        );
        onNotify('Suspensión del sistema', 'Estado guardado; sesión lista para bloquear o reanudar.');
        return;
      }
      const act = confirmAction;
      setConfirmAction(null);
      onPowerAction?.(act);
    } catch (err) {
      setRecoveryMsg(err instanceof Error ? err.message : 'No se pudo completar la operación.');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountMsg(null);
    try {
      await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({ username: newUsername, displayName: newDisplay, password: newPass }),
      });
      setNewUsername('');
      setNewDisplay('');
      setNewPass('');
      setAccountMsg('Usuario creado con contraseña cifrada mediante scrypt.');
      await onUsersRefresh();
    } catch (err) {
      setAccountMsg(err instanceof Error ? err.message : 'Error creando usuario');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAccountMsg(null);
    try {
      await apiFetch('/api/users/change-password', {
        method: 'POST',
        body: JSON.stringify({ userId: currentUser.id, currentPassword: currPass, newPassword: nextPass }),
      });
      setCurrPass('');
      setNextPass('');
      setAccountMsg('Contraseña actualizada correctamente.');
    } catch (err) {
      setAccountMsg(err instanceof Error ? err.message : 'Error cambiando contraseña');
    }
  };

  const bluetoothDevices = devices.filter((d) => d.type.toLowerCase().includes('bluetooth') || d.name.toLowerCase().includes('bluetooth'));
  const allAppIds = Object.keys(APP_CATALOG) as AppId[];

  return (
    <div className="h-full flex text-[var(--gtems-text)]">
      {/* Left Sidebar */}
      <aside className="w-60 shrink-0 border-r border-[var(--gtems-border)] p-4 flex flex-col gap-4 bg-[var(--gtems-surface)] overflow-y-auto aurora-scroll">
        {/* User Profile Header */}
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="w-10 h-10 rounded-full bg-[var(--gtems-accent)] text-white flex items-center justify-center shrink-0">
            <UserIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{currentUser.displayName}</div>
            <div className="text-xs text-[var(--gtems-text-muted)] truncate">@{currentUser.username} · {currentUser.role}</div>
          </div>
        </div>

        {/* Top Search */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gtems-text-muted)]" />
          <input
            type="search"
            aria-label="Buscar en Configuración"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t(lang, 'settings.searchPlaceholder', 'Buscar ajuste...')}
            className="w-full pl-8 pr-3 py-2 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)] text-xs focus:outline-none focus:ring-2 focus:ring-[var(--gtems-accent)]"
          />
          {searchMatches.length > 0 && (
            <div className="mt-1 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)] shadow-lg p-1 space-y-0.5">
              {searchMatches.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setCategory(m.id);
                    setSearchQuery('');
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs hover:bg-[var(--gtems-accent)]/15"
                >
                  <strong>{t(lang, m.i18nKey, m.label)}</strong>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Exact 10 Categories */}
        <nav aria-label="Categorías de Configuración" className="space-y-0.5">
          {SETTINGS_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategory(cat.id)}
              className={`w-full text-left px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                category === cat.id
                  ? 'bg-[var(--gtems-accent)] text-white font-semibold'
                  : 'hover:bg-[var(--gtems-accent)]/12 text-[var(--gtems-text)]'
              }`}
            >
              {t(lang, cat.i18nKey, cat.label)}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto aurora-scroll p-6 space-y-6">
        {category === 'inicio' && (
          <div className="space-y-5 max-w-3xl">
            <h2 className="font-display text-2xl font-bold">{t(lang, 'settings.inicio', 'Inicio')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] space-y-1.5">
                <div className="text-xs text-[var(--gtems-text-muted)]">Dispositivo anfitrión</div>
                <div className="font-semibold text-sm">{hardware?.hostname || 'Consultando...'}</div>
                <div className="text-xs text-[var(--gtems-text-muted)]">
                  {GTEMS_IDENTITY.name} {GTEMS_IDENTITY.version} · Tema {p.themeId.toUpperCase()}
                </div>
              </div>
              <div className="p-4 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] space-y-1.5">
                <div className="text-xs text-[var(--gtems-text-muted)]">Red, Idioma y Zona horaria</div>
                <div className="font-semibold text-sm flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-[var(--gtems-accent)]" />
                  <span>{network?.interfaces.filter((i) => !i.isLoopback).map((i) => i.name).join(', ') || 'Conectado'}</span>
                </div>
                <div className="text-xs text-[var(--gtems-text-muted)]">
                  {activeLangOpt.nativeName} · {systemState.timezone}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              {['personalizacion', 'aplicaciones', 'hora', 'sistema', 'red', 'acerca'].map((target) => {
                const def = SETTINGS_CATEGORIES.find((c) => c.id === target)!;
                return (
                  <button
                    key={target}
                    type="button"
                    onClick={() => setCategory(target)}
                    className="p-4 rounded-xl border border-[var(--gtems-border)] hover:bg-[var(--gtems-accent)]/12 text-left font-semibold transition-colors"
                  >
                    {t(lang, def.i18nKey, def.label)}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {category === 'sistema' && (
          <div className="space-y-5 max-w-2xl text-xs">
            <h2 className="font-display text-2xl font-bold">{t(lang, 'settings.sistema', 'Sistema')}</h2>

            <div className="p-4 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] space-y-4">
              <div>
                <div className="flex justify-between items-center font-medium mb-1">
                  <span>Volumen maestro del sistema</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void onUpdateSettings({ muted: !systemState.muted })}
                      className={`px-2 py-0.5 rounded border text-[11px] ${
                        systemState.muted ? 'bg-red-500/15 border-red-500/40 text-red-600 dark:text-red-400' : 'border-[var(--gtems-border)]'
                      }`}
                    >
                      {systemState.muted ? 'Silenciado' : 'Silenciar'}
                    </button>
                    <span className="font-mono">{systemState.muted ? '0%' : `${systemState.volume}%`}</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={systemState.volume}
                  onChange={(e) => void onUpdateSettings({ volume: Number(e.target.value), muted: false })}
                  className="w-full accent-[var(--gtems-accent)]"
                />
              </div>

              <div>
                <label className="flex justify-between font-medium mb-1">
                  <span>Brillo de pantalla</span>
                  <span className="font-mono">{systemState.brightness}%</span>
                </label>
                <input
                  type="range"
                  min={35}
                  max={100}
                  value={systemState.brightness}
                  onChange={(e) => void onUpdateSettings({ brightness: Number(e.target.value) })}
                  className="w-full accent-[var(--gtems-accent)]"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Modo de energía</label>
                <select
                  value={systemState.powerMode}
                  onChange={(e) => void onUpdateSettings({ powerMode: e.target.value as 'balanced' | 'performance' | 'saver' })}
                  className="px-3 py-2 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)]"
                >
                  <option value="balanced">Equilibrado</option>
                  <option value="performance">Alto rendimiento</option>
                  <option value="saver">Ahorro de energía</option>
                </select>
              </div>
            </div>

            {hardware && (
              <div className="p-4 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] space-y-2">
                <div className="font-semibold text-sm">Almacenamiento real del equipo</div>
                {hardware.storage.map((s) => (
                  <div key={s.mount} className="flex justify-between py-1 border-b border-[var(--gtems-border)]/40 font-mono">
                    <span>{s.mount} ({s.type})</span>
                    <span className="tabular-nums">
                      {(s.usedBytes / 1024 ** 3).toFixed(2)} / {(s.sizeBytes / 1024 ** 3).toFixed(2)} GiB ({s.usePercent})
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Download Official GTEMS OS .iso Section */}
            <div
              data-testid="iso-download-section"
              className="p-5 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] space-y-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-[var(--gtems-accent)]/15 text-[var(--gtems-accent)] flex items-center justify-center shrink-0">
                    <HardDriveDownload className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base">Descargar GTEMS OS</h3>
                    <p className="text-[var(--gtems-text-muted)] mt-0.5">
                      Imagen oficial arrancable (.iso híbrida BIOS Legacy + UEFI) para instalación física, USB o máquina virtual.
                    </p>
                  </div>
                </div>
                <span
                  data-testid="iso-status-badge"
                  className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold ${
                    isoStatus === 'completed' || isoStatus === 'ready'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : isoStatus === 'downloading' || isoStatus === 'preparing' || isoStatus === 'checking'
                      ? 'bg-[var(--gtems-accent)]/15 text-[var(--gtems-accent)]'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  {isoStatus === 'checking'
                    ? 'Comprobando disponibilidad'
                    : isoStatus === 'preparing'
                    ? 'Preparando descarga'
                    : isoStatus === 'downloading'
                    ? 'Descargando'
                    : isoStatus === 'completed'
                    ? 'Completada'
                    : isoStatus === 'cancelled'
                    ? 'Cancelada'
                    : isoStatus === 'error'
                    ? 'Error'
                    : isoStatus === 'ready'
                    ? 'Disponible'
                    : 'Versión no disponible'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 p-3.5 rounded-xl border border-[var(--gtems-border)]/70 bg-[var(--gtems-surface-solid)]/45">
                <div><strong>Nombre:</strong> <span className="font-mono">{isoMeta?.filename || 'GTEMS-OS.iso'}</span></div>
                <div><strong>Versión:</strong> {isoMeta?.version || GTEMS_IDENTITY.version}</div>
                <div><strong>Arquitectura:</strong> {isoMeta?.architecture || 'amd64 (x86_64)'}</div>
                <div><strong>Tamaño:</strong> {isoMeta?.available ? isoMeta.sizeFormatted : 'No publicada'}</div>
                <div><strong>Compilación:</strong> {isoMeta?.buildDate ? new Date(isoMeta.buildDate).toLocaleString(lang) : 'Sin compilar'}</div>
                <div><strong>Publicación:</strong> {isoMeta?.publishDate ? new Date(isoMeta.publishDate).toLocaleString(lang) : 'Sin publicar'}</div>
                <div className="sm:col-span-2">
                  <strong>Compatibilidad de arranque:</strong> {isoMeta?.bootCompatibility || 'BIOS Legacy + UEFI (Híbrido El Torito / GRUB2)'}
                </div>
                <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                  <strong>SHA-256:</strong>
                  <span className="font-mono break-all text-[11px] text-[var(--gtems-text-muted)]">
                    {isoMeta?.sha256 || 'Disponible tras compilar y publicar una imagen .iso real'}
                  </span>
                  {isoMeta?.sha256 && (
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard?.writeText(isoMeta.sha256 || '');
                        onNotify('SHA-256 copiado', 'Huella criptográfica copiada al portapapeles.');
                      }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-[var(--gtems-border)] text-[11px]"
                    >
                      <Copy className="w-3 h-3" /> Copiar
                    </button>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <strong>Verificación:</strong>{' '}
                  {isoMeta?.available
                    ? isoMeta.checksumVerified
                      ? 'Verificada contra archivo .sha256 / manifiesto'
                      : 'Calculada desde archivo publicado'
                    : 'Pendiente (no hay artefacto .iso publicado)'}
                </div>
              </div>

              {isoMeta && !isoMeta.available && (
                <div className="p-3 rounded-xl border border-amber-500/35 bg-amber-500/10 text-[var(--gtems-text)] space-y-1">
                  <div className="font-semibold">Versión no disponible para descarga directa en este servidor</div>
                  <p className="text-[var(--gtems-text-muted)]">{isoMeta.reason}</p>
                  {isoMeta.missingToolchain.length > 0 && (
                    <p className="font-mono text-[11px] text-[var(--gtems-text-muted)]">
                      Herramientas Linux ausentes en este contenedor: {isoMeta.missingToolchain.join(', ')}
                    </p>
                  )}
                </div>
              )}

              {(isoStatus === 'downloading' || isoStatus === 'preparing') && (
                <div className="space-y-1.5">
                  <div className="flex justify-between font-mono text-[11px]">
                    <span>
                      {(isoProgress.received / 1024 ** 2).toFixed(1)} MiB
                      {isoProgress.total > 0 ? ` / ${(isoProgress.total / 1024 ** 2).toFixed(1)} MiB` : ''}
                    </span>
                    {isoProgress.total > 0 && (
                      <span>{Math.min(100, Math.round((isoProgress.received / isoProgress.total) * 100))}%</span>
                    )}
                  </div>
                  <div className="h-2 rounded-full bg-[var(--gtems-border)] overflow-hidden">
                    <div
                      className="h-full bg-[var(--gtems-accent)] transition-all"
                      style={{
                        width:
                          isoProgress.total > 0
                            ? `${Math.min(100, Math.round((isoProgress.received / isoProgress.total) * 100))}%`
                            : '35%',
                      }}
                    />
                  </div>
                </div>
              )}

              {isoError && (
                <div role="alert" className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300">
                  {isoError}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  data-testid="btn-download-iso"
                  disabled={!isoMeta?.available || isoStatus === 'preparing' || isoStatus === 'downloading'}
                  onClick={() => void startIsoDownload()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--gtems-accent)] text-white font-semibold disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  <Download className="w-4 h-4" />
                  <span>Descargar imagen .iso del sistema</span>
                </button>

                {(isoStatus === 'preparing' || isoStatus === 'downloading') && (
                  <button
                    type="button"
                    onClick={cancelIsoDownload}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/40 text-red-600 dark:text-red-400 font-medium"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Cancelar</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void checkIsoAvailability()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--gtems-border)] hover:bg-[var(--gtems-accent)]/12 font-medium"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Comprobar disponibilidad</span>
                </button>
              </div>
            </div>

            {/* Relocated Recovery & Reinstall Section */}
            <div
              data-testid="recovery-section"
              className="p-5 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] space-y-4"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-display font-bold text-base">
                    {t(lang, 'settings.recovery', 'Recuperación y reinstalación')}
                  </h3>
                  <p className="text-[var(--gtems-text-muted)] mt-0.5">
                    Suspende, reinicia, apaga, exporta una copia de seguridad o reinstala GTEMS OS desde cero.
                  </p>
                </div>
                {recoveryInfo && (
                  <span className="text-[11px] font-mono text-[var(--gtems-text-muted)]">
                    Medio: {recoveryInfo.recoveryMediaValid ? 'Verificado' : 'Parcial'}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void downloadBackup()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--gtems-border)] hover:bg-[var(--gtems-accent)]/12 font-medium"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descargar respaldo JSON</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction('reset-settings')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--gtems-border)] hover:bg-[var(--gtems-accent)]/12 font-medium"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restablecer preferencias</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction('suspend')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--gtems-border)] hover:bg-[var(--gtems-accent)]/12 font-medium"
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Suspender equipo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction('reboot')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--gtems-border)] hover:bg-[var(--gtems-accent)]/12 font-medium"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reiniciar sistema</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction('shutdown')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10 font-medium"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>Apagar equipo</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAction('reinstall')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{t(lang, 'settings.reinstallBtn', 'Reinstalar GTEMS OS')}</span>
                </button>
              </div>

              {confirmAction && (
                <div className="p-4 rounded-xl border border-amber-500/40 bg-amber-500/10 space-y-3">
                  <div className="font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      {confirmAction === 'reset-settings'
                        ? 'Restablecer configuración visual, tema e idioma'
                        : confirmAction === 'suspend'
                        ? 'Confirmar suspensión de sesión GTEMS OS'
                        : confirmAction === 'reboot'
                        ? 'Confirmar reinicio de GTEMS OS'
                        : confirmAction === 'shutdown'
                        ? 'Confirmar apagado de GTEMS OS'
                        : 'Confirmar reinstalación completa de GTEMS OS'}
                    </span>
                  </div>
                  <p className="text-[var(--gtems-text-muted)]">
                    {confirmAction === 'reinstall'
                      ? 'ADVERTENCIA: Se borrarán las cuentas de usuario locales y preferencias guardadas, volviendo al instalador oficial GTEMS OS. Escribe exactamente REINSTALAR GTEMS OS para confirmar.'
                      : 'Confirma para aplicar esta acción del sistema de forma segura.'}
                  </p>
                  {confirmAction === 'reinstall' && (
                    <input
                      type="text"
                      value={reinstallText}
                      onChange={(e) => setReinstallText(e.target.value)}
                      placeholder="REINSTALAR GTEMS OS"
                      className="w-full px-3 py-2 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)] font-mono"
                    />
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmAction(null);
                        setReinstallText('');
                      }}
                      className="px-3 py-1.5 rounded-lg border border-[var(--gtems-border)]"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={() => void executeRecoveryPower()}
                      className="px-4 py-1.5 rounded-lg bg-red-600 text-white font-semibold"
                    >
                      Confirmar acción
                    </button>
                  </div>
                </div>
              )}

              {recoveryMsg && <div className="p-3 rounded-xl bg-[var(--gtems-accent)]/15 font-medium">{recoveryMsg}</div>}
            </div>
          </div>
        )}

        {category === 'bluetooth' && (
          <div className="space-y-4 max-w-2xl text-xs">
            <h2 className="font-display text-2xl font-bold">{t(lang, 'settings.bluetooth', 'Bluetooth y dispositivos')}</h2>
            <p className="text-[var(--gtems-text-muted)]">
              Lectura real del kernel Linux (/sys/class y lsusb). No se simulan dispositivos Bluetooth inexistentes.
            </p>
            <div className="p-4 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] space-y-2">
              <div>
                <strong>Adaptador Bluetooth:</strong>{' '}
                {bluetoothDevices.length > 0
                  ? bluetoothDevices.map((b) => `${b.name} (${b.status})`).join(', ')
                  : 'No se detectó radio Bluetooth física en este entorno Linux.'}
              </div>
              <div className="pt-2 border-t border-[var(--gtems-border)]/50 space-y-1.5">
                <div className="font-semibold">Dispositivos detectados ({devices.length})</div>
                {devices.map((d, idx) => (
                  <div key={`${d.name}-${idx}`} className="flex justify-between py-1 border-b border-[var(--gtems-border)]/30">
                    <span>{d.name} · <span className="text-[var(--gtems-text-muted)]">{d.type}</span></span>
                    <span className="font-mono text-[11px]">{d.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {category === 'red' && (
          <div className="space-y-5 max-w-2xl text-xs">
            <h2 className="font-display text-2xl font-bold">{t(lang, 'settings.red', 'Red e Internet')}</h2>
            <div className="p-4 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] space-y-2">
              <div className="font-semibold">Estado Wi-Fi e Interfaces</div>
              <p className="text-[var(--gtems-text-muted)]">{network?.wifiStatusMessage}</p>
              <div className="font-mono pt-2 space-y-1">
                <div>Puerta de enlace: {network?.gateway || 'Información no disponible'}</div>
                <div>Servidores DNS: {network?.dnsServers.join(', ') || 'Información no disponible'}</div>
              </div>
            </div>

            <form onSubmit={runDiag} className="p-4 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] space-y-3">
              <div className="font-semibold">Diagnóstico real de DNS y conectividad</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={diagHost}
                  onChange={(e) => setDiagHost(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)] font-mono"
                />
                <button type="submit" className="px-4 py-2 rounded-xl bg-[var(--gtems-accent)] text-white font-semibold">
                  Probar
                </button>
              </div>
              {diagResult && (
                <div className="p-3 rounded-xl bg-slate-950 text-[#DDF5EC] font-mono space-y-1">
                  <div>DNS resuelto: {diagResult.dnsResolved.join(', ') || 'Sin registros A'}</div>
                  <div className="whitespace-pre-wrap">{diagResult.pingOutput}</div>
                </div>
              )}
            </form>
          </div>
        )}

        {category === 'personalizacion' && (
          <div className="space-y-5 max-w-3xl text-xs">
            <h2 className="font-display text-2xl font-bold">{t(lang, 'settings.personalizacion', 'Personalización ZEYLA & Aurora')}</h2>

            {/* ZEYLA Themes */}
            <div className="p-4 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] space-y-4">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[var(--gtems-accent)]" />
                  <span>Temas visuales GTEMS & ZEYLA</span>
                </div>
                {p.themeId === 'zeyla-aurora' && (
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => void onUpdateSettings({ personalization: { theme: 'light' } })}
                      className={`px-2.5 py-1 rounded-lg border ${p.theme === 'light' ? 'bg-[var(--gtems-accent)] text-white border-transparent' : 'border-[var(--gtems-border)]'}`}
                    >
                      Claro
                    </button>
                    <button
                      type="button"
                      onClick={() => void onUpdateSettings({ personalization: { theme: 'dark' } })}
                      className={`px-2.5 py-1 rounded-lg border ${p.theme === 'dark' ? 'bg-[var(--gtems-accent)] text-white border-transparent' : 'border-[var(--gtems-border)]'}`}
                    >
                      Oscuro
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {(Object.keys(THEME_PRESETS) as Array<Exclude<ThemePresetId, 'custom'>>).map((tid) => {
                  const tp = THEME_PRESETS[tid];
                  const active = p.themeId === tid;
                  return (
                    <button
                      key={tid}
                      type="button"
                      data-testid={`theme-card-${tid}`}
                      onClick={() => void applyZeylaPreset(tid)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        active
                          ? 'border-[var(--gtems-accent)] ring-2 ring-[var(--gtems-accent)]/35 bg-[var(--gtems-accent)]/10'
                          : 'border-[var(--gtems-border)] hover:bg-[var(--gtems-accent)]/8'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-display font-bold text-xs">{tp.name}</span>
                        <div className="flex gap-1">
                          {tp.swatch.map((hex) => (
                            <span key={hex} style={{ backgroundColor: hex }} className="w-3.5 h-3.5 rounded-full border border-black/15" />
                          ))}
                        </div>
                      </div>
                      <p className="text-[11px] text-[var(--gtems-text-muted)] line-clamp-2">{tp.subtitle}</p>
                    </button>
                  );
                })}

                <button
                  type="button"
                  data-testid="theme-card-custom"
                  onClick={() => void applyZeylaPreset('custom')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    p.themeId === 'custom'
                      ? 'border-[var(--gtems-accent)] ring-2 ring-[var(--gtems-accent)]/35 bg-[var(--gtems-accent)]/10'
                      : 'border-[var(--gtems-border)] hover:bg-[var(--gtems-accent)]/8'
                  }`}
                >
                  <div className="font-display font-bold text-xs mb-1">PERSONALIZADO</div>
                  <p className="text-[11px] text-[var(--gtems-text-muted)]">Colores, bordes, superficie y modo manuales</p>
                </button>
              </div>

              {p.themeId === 'custom' && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-[var(--gtems-border)]">
                  {(
                    [
                      ['bg', 'Fondo'],
                      ['surface', 'Superficie'],
                      ['text', 'Texto'],
                      ['accent', 'Acento'],
                    ] as const
                  ).map(([field, label]) => (
                    <label key={field} className="space-y-1">
                      <span className="block text-[11px] font-medium">{label}</span>
                      <input
                        type="color"
                        value={p.customTheme?.[field] || '#398F91'}
                        onChange={(e) =>
                          void onUpdateSettings({
                            personalization: {
                              customTheme: {
                                ...p.customTheme,
                                [field]: e.target.value,
                              },
                            },
                          })
                        }
                        className="w-full h-8 rounded cursor-pointer"
                      />
                    </label>
                  ))}
                  <label className="flex items-center gap-2 pt-4">
                    <input
                      type="checkbox"
                      checked={Boolean(p.customTheme?.isDark)}
                      onChange={(e) =>
                        void onUpdateSettings({
                          personalization: {
                            theme: e.target.checked ? 'dark' : 'light',
                            customTheme: { ...p.customTheme, isDark: e.target.checked },
                          },
                        })
                      }
                    />
                    <span>Base oscura</span>
                  </label>
                </div>
              )}

              <div>
                <div className="mb-1.5 font-medium">Color de acento rápido</div>
                <div className="flex flex-wrap gap-2">
                  {AURORA_PALETTE.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      title={c.name}
                      onClick={() => void onUpdateSettings({ personalization: { accentColor: c.hex } })}
                      style={{ backgroundColor: c.hex }}
                      className={`w-6 h-6 rounded-full border-2 ${p.accentColor === c.hex ? 'border-slate-900 dark:border-white scale-110' : 'border-black/15'}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Wallpapers & Fit modes */}
            <div className="p-4 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-sm">Fondos de pantalla</div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setWallpaperTarget('desktop')}
                    className={`px-3 py-1 rounded-lg border font-medium ${wallpaperTarget === 'desktop' ? 'bg-[var(--gtems-accent)] text-white border-transparent' : 'border-[var(--gtems-border)]'}`}
                  >
                    Escritorio
                  </button>
                  <button
                    type="button"
                    onClick={() => setWallpaperTarget('lock')}
                    className={`px-3 py-1 rounded-lg border font-medium ${wallpaperTarget === 'lock' ? 'bg-[var(--gtems-accent)] text-white border-transparent' : 'border-[var(--gtems-border)]'}`}
                  >
                    Pantalla de bloqueo
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {WALLPAPER_PRESETS.map((w) => {
                  const isCurrent = (wallpaperTarget === 'desktop' ? p.wallpaper : p.lockWallpaper) === w.url;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() =>
                        void onUpdateSettings({
                          personalization: wallpaperTarget === 'desktop' ? { wallpaper: w.url } : { lockWallpaper: w.url },
                        })
                      }
                      className={`rounded-xl overflow-hidden border-2 text-left ${isCurrent ? 'border-[var(--gtems-accent)]' : 'border-transparent'}`}
                    >
                      <img src={w.url} alt={w.name} className="w-full h-20 object-cover" />
                      <div className="p-1.5 text-[11px] font-medium truncate">{w.name}</div>
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <label className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-dashed border-[var(--gtems-accent)]/60 cursor-pointer hover:bg-[var(--gtems-accent)]/10 font-medium">
                  <Upload className="w-4 h-4" />
                  <span>{uploadingWp ? 'Subiendo...' : 'Subir imagen local'}</span>
                  <input type="file" accept="image/*" onChange={handleWallpaperUpload} className="hidden" />
                </label>

                <form onSubmit={applyWallpaperUrl} className="sm:col-span-2 flex gap-2">
                  <input
                    type="url"
                    value={wallpaperUrlInput}
                    onChange={(e) => setWallpaperUrlInput(e.target.value)}
                    placeholder="https://... (URL de imagen)"
                    className="flex-1 px-3 py-1.5 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)]"
                  />
                  <button type="submit" className="px-3 py-1.5 rounded-xl bg-[var(--gtems-accent)] text-white font-semibold">
                    Aplicar URL
                  </button>
                </form>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <span className="font-medium">Ajuste de imagen:</span>
                <select
                  value={wallpaperTarget === 'desktop' ? p.wallpaperFit : p.lockWallpaperFit}
                  onChange={(e) => {
                    const fit = e.target.value as WallpaperFitMode;
                    void onUpdateSettings({
                      personalization: wallpaperTarget === 'desktop' ? { wallpaperFit: fit } : { lockWallpaperFit: fit },
                    });
                  }}
                  className="px-3 py-1.5 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)]"
                >
                  <option value="cover">Cubrir (Cover)</option>
                  <option value="contain">Ajustar (Contain)</option>
                  <option value="fill">Estirar (Fill)</option>
                  <option value="center">Centrado</option>
                </select>
              </div>
            </div>

            {/* Animations & Cursors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] space-y-3">
                <div className="font-semibold text-sm">Animaciones del sistema</div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={p.animations}
                    onChange={(e) => void onUpdateSettings({ personalization: { animations: e.target.checked } })}
                  />
                  <span>Activar transiciones y animaciones</span>
                </label>
                <div>
                  <label className="block mb-1 font-medium">Nivel de animación</label>
                  <select
                    value={p.animationLevel}
                    onChange={(e) => void onUpdateSettings({ personalization: { animationLevel: e.target.value as AnimationLevel } })}
                    className="w-full px-3 py-1.5 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)]"
                  >
                    {ANIMATION_PRESETS.map((a) => (
                      <option key={a.id} value={a.id}>{a.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 font-medium">Velocidad ({p.animationSpeed}x)</label>
                  <select
                    value={p.animationSpeed}
                    onChange={(e) => void onUpdateSettings({ personalization: { animationSpeed: Number(e.target.value) } })}
                    className="w-full px-3 py-1.5 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)]"
                  >
                    <option value={0.5}>0.5x (Lenta)</option>
                    <option value={1}>1.0x (Estándar)</option>
                    <option value={1.5}>1.5x (Rápida)</option>
                  </select>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] space-y-3">
                <div className="font-semibold text-sm flex items-center gap-2">
                  <MousePointer className="w-4 h-4 text-[var(--gtems-accent)]" />
                  <span>Puntero / Cursor</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {CURSOR_STYLES.map((cs) => (
                    <button
                      key={cs.id}
                      type="button"
                      onClick={() => void onUpdateSettings({ personalization: { cursorStyle: cs.id as CursorStyleId } })}
                      className={`px-2.5 py-1.5 rounded-lg border text-left ${
                        p.cursorStyle === cs.id
                          ? 'bg-[var(--gtems-accent)] text-white border-transparent font-semibold'
                          : 'border-[var(--gtems-border)] hover:bg-[var(--gtems-accent)]/10'
                      }`}
                    >
                      {cs.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block mb-1 font-medium">Tamaño</label>
                    <select
                      value={p.cursorSize}
                      onChange={(e) => void onUpdateSettings({ personalization: { cursorSize: e.target.value as 'small' | 'normal' | 'large' } })}
                      className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)]"
                    >
                      <option value="small">Pequeño</option>
                      <option value="normal">Normal</option>
                      <option value="large">Grande</option>
                    </select>
                  </div>
                  <div>
                    <label className="block mb-1 font-medium">Color</label>
                    <input
                      type="color"
                      value={p.cursorColor || p.accentColor}
                      onChange={(e) => void onUpdateSettings({ personalization: { cursorColor: e.target.value } })}
                      className="w-full h-8 rounded cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sizing, Transparency & Taskbar */}
            <div className="p-4 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] space-y-4">
              <div className="font-semibold text-sm">Tamaños, densidad y barra de tareas</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block mb-1 font-medium">Letra</label>
                  <select
                    value={p.fontSize}
                    onChange={(e) => void onUpdateSettings({ personalization: { fontSize: e.target.value as 'small' | 'normal' | 'large' } })}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)]"
                  >
                    <option value="small">Pequeña</option>
                    <option value="normal">Normal</option>
                    <option value="large">Grande</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 font-medium">Iconos</label>
                  <select
                    value={p.iconSize}
                    onChange={(e) => void onUpdateSettings({ personalization: { iconSize: e.target.value as 'small' | 'normal' | 'large' } })}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)]"
                  >
                    <option value="small">Pequeños</option>
                    <option value="normal">Normales</option>
                    <option value="large">Grandes</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 font-medium">Escala UI</label>
                  <select
                    value={p.uiScale}
                    onChange={(e) => void onUpdateSettings({ personalization: { uiScale: Number(e.target.value) } })}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)]"
                  >
                    <option value={0.9}>90%</option>
                    <option value={1}>100%</option>
                    <option value={1.1}>110%</option>
                    <option value={1.15}>115%</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 font-medium">Esquinas</label>
                  <select
                    value={p.borderRadius}
                    onChange={(e) => void onUpdateSettings({ personalization: { borderRadius: e.target.value as 'sharp' | 'normal' | 'rounded' } })}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)]"
                  >
                    <option value="sharp">Rectas</option>
                    <option value="normal">Suaves</option>
                    <option value="rounded">Muy redondeadas</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 font-medium">Posición de barra de tareas</label>
                  <select
                    value={p.taskbarPosition}
                    onChange={(e) => void onUpdateSettings({ personalization: { taskbarPosition: e.target.value as 'left' | 'bottom' | 'top' } })}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)]"
                  >
                    <option value="left">Lateral izquierda (Estándar GTEMS)</option>
                    <option value="bottom">Inferior</option>
                    <option value="top">Superior</option>
                  </select>
                </div>
                <div>
                  <label className="block mb-1 font-medium">Ancho de barra lateral</label>
                  <select
                    value={p.taskbarWidthMode}
                    onChange={(e) => void onUpdateSettings({ personalization: { taskbarWidthMode: e.target.value as 'compact' | 'normal' | 'expanded' } })}
                    className="w-full px-2.5 py-1.5 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)]"
                  >
                    <option value="compact">Compacta</option>
                    <option value="normal">Normal (iconos)</option>
                    <option value="expanded">Expandida (con etiquetas)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={p.transparency}
                    onChange={(e) => void onUpdateSettings({ personalization: { transparency: e.target.checked } })}
                  />
                  <span>Transparencia vidrio esmerilado ({p.transparencyLevel}%)</span>
                </label>
                <input
                  type="range"
                  min={45}
                  max={96}
                  value={p.transparencyLevel}
                  onChange={(e) => void onUpdateSettings({ personalization: { transparencyLevel: Number(e.target.value) } })}
                  className="w-full accent-[var(--gtems-accent)]"
                />
              </div>
            </div>
          </div>
        )}

        {category === 'aplicaciones' && (
          <div className="space-y-4 max-w-3xl text-xs">
            <h2 className="font-display text-2xl font-bold">{t(lang, 'settings.aplicaciones', 'Aplicaciones y Navegadores')}</h2>

            <div className="flex flex-wrap gap-1.5 border-b border-[var(--gtems-border)] pb-3">
              {(
                [
                  ['all', `Esenciales y Sistema (${allAppIds.filter((id) => APP_CATALOG[id].essential).length})`],
                  ['preinstalled', `Preinstaladas (${allAppIds.length})`],
                  ['running', `En ejecución (${openAppIds.length})`],
                  ['apt', 'Paquetes APT'],
                  ['browsers', 'Navegadores'],
                ] as const
              ).map(([tabId, label]) => (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => setAppsTab(tabId)}
                  className={`px-3 py-1.5 rounded-xl font-medium ${
                    appsTab === tabId ? 'bg-[var(--gtems-accent)] text-white' : 'border border-[var(--gtems-border)] hover:bg-[var(--gtems-accent)]/10'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {(appsTab === 'all' || appsTab === 'preinstalled' || appsTab === 'running') && (
              <div className="space-y-2">
                {allAppIds
                  .filter((id) => {
                    if (appsTab === 'all') return APP_CATALOG[id].essential;
                    if (appsTab === 'running') return openAppIds.includes(id);
                    return APP_CATALOG[id].preinstalled;
                  })
                  .map((id) => {
                    const entry = APP_CATALOG[id];
                    const isStartup = systemState.startupApps.includes(id);
                    const isRunning = openAppIds.includes(id);
                    const inspected = selectedAppInspect === id;
                    return (
                      <div key={id} className="p-3.5 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <GtemsAppIcon appId={id} className="w-8 h-8 shrink-0" />
                            <div className="min-w-0">
                              <div className="font-semibold text-sm flex items-center gap-2">
                                <span>{entry.name}</span>
                                {entry.essential && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[var(--gtems-accent)]">
                                    <Lock className="w-3 h-3" /> Protegida
                                  </span>
                                )}
                                {isRunning && <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">· Activa</span>}
                              </div>
                              <div className="text-[var(--gtems-text-muted)]">
                                {entry.category} · {entry.estimatedStorageMb} MiB · {entry.description}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => onOpenApp?.(id)}
                              className="px-2.5 py-1.5 rounded-lg bg-[var(--gtems-accent)] text-white font-medium"
                            >
                              Abrir
                            </button>
                            <button
                              type="button"
                              onClick={() => void toggleStartupApp(id)}
                              className={`px-2.5 py-1.5 rounded-lg border font-medium ${
                                isStartup ? 'border-[var(--gtems-accent)] text-[var(--gtems-accent)]' : 'border-[var(--gtems-border)]'
                              }`}
                            >
                              {isStartup ? 'Inicio: Activado' : 'Inicio: Manual'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedAppInspect(inspected ? null : id)}
                              className="px-2.5 py-1.5 rounded-lg border border-[var(--gtems-border)]"
                            >
                              {inspected ? 'Ocultar detalles' : 'Permisos'}
                            </button>
                            <button
                              type="button"
                              disabled={entry.essential}
                              title={entry.essentialReason || 'Aplicación esencial del sistema'}
                              onClick={() => onNotify(entry.name, 'Aplicación preinstalada marcada para uso bajo demanda.')}
                              className="px-2.5 py-1.5 rounded-lg border border-[var(--gtems-border)] disabled:opacity-45 disabled:cursor-not-allowed"
                            >
                              {entry.essential ? 'Protegida' : 'Restablecer'}
                            </button>
                          </div>
                        </div>

                        {inspected && (
                          <div className="pt-2 border-t border-[var(--gtems-border)]/50 text-[11px] space-y-1 text-[var(--gtems-text-muted)]">
                            <div><strong>Permisos declarados:</strong> {entry.permissions.join(' · ')}</div>
                            {entry.essentialReason && <div><strong>Protección del sistema:</strong> {entry.essentialReason}</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                {appsTab === 'running' && openAppIds.length === 0 && (
                  <p className="text-[var(--gtems-text-muted)]">No hay otras ventanas de aplicación abiertas en este momento.</p>
                )}
              </div>
            )}

            {appsTab === 'apt' && (
              <div className="space-y-3">
                <input
                  type="search"
                  value={aptFilter}
                  onChange={(e) => setAptFilter(e.target.value)}
                  placeholder="Filtrar paquetes Debian instalados..."
                  className="w-full px-3 py-2 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)]"
                />
                <div className="max-h-80 overflow-y-auto aurora-scroll space-y-1.5">
                  {packages
                    .filter((pkg) => !aptFilter.trim() || pkg.name.toLowerCase().includes(aptFilter.toLowerCase()))
                    .slice(0, 60)
                    .map((pkg) => (
                      <div key={pkg.name} className="p-2.5 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] flex justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-mono font-semibold truncate">{pkg.name}</div>
                          <div className="text-[11px] text-[var(--gtems-text-muted)] truncate">{pkg.summary}</div>
                        </div>
                        <span className="font-mono text-[11px] shrink-0">{pkg.version}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {appsTab === 'browsers' && (
              <div className="space-y-2.5">
                {browsers.map((b) => (
                  <div key={b.id} className="p-3.5 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5 max-w-lg">
                      <div className="font-semibold text-sm flex items-center gap-2">
                        <Globe className="w-4 h-4 text-[var(--gtems-accent)]" />
                        <span>{b.name}</span>
                        {b.isDefault && <span className="text-[11px] font-mono text-[var(--gtems-accent)]">· Predeterminado</span>}
                      </div>
                      <p className="text-[var(--gtems-text-muted)]">{b.statusNote}</p>
                      {b.executablePath && (
                        <div className="font-mono text-[11px] text-[var(--gtems-text-muted)]">
                          Binario: {b.executablePath} {b.version ? `(${b.version})` : ''}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={!b.installed || !b.supportedOnLinux || b.isDefault}
                      onClick={() => void setDefaultBrowser(b.id)}
                      className="px-3 py-1.5 rounded-xl bg-[var(--gtems-accent)] text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {b.isDefault ? 'Activo' : b.installed ? 'Establecer predeterminado' : 'No disponible'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {category === 'cuentas' && (
          <div className="space-y-5 max-w-2xl text-xs">
            <h2 className="font-display text-2xl font-bold">{t(lang, 'settings.cuentas', 'Cuentas y Seguridad')}</h2>
            {accountMsg && <div className="p-3 rounded-xl bg-[var(--gtems-accent)]/15 font-medium">{accountMsg}</div>}

            <div className="p-4 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] space-y-2">
              <div className="font-semibold text-sm">Usuarios registrados (almacenados con hash scrypt)</div>
              {systemState.users.length === 0 ? (
                <p className="text-[var(--gtems-text-muted)]">Sesión Live temporal. Instala el sistema para cuentas persistentes.</p>
              ) : (
                systemState.users.map((u) => (
                  <div key={u.id} className="flex justify-between py-1.5 border-b border-[var(--gtems-border)]/40">
                    <span><strong>{u.displayName}</strong> (@{u.username})</span>
                    <span className="font-mono">{u.role}</span>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleChangePassword} className="p-4 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] space-y-3">
              <div className="font-semibold text-sm">Cambiar contraseña</div>
              <input type="password" placeholder="Contraseña actual" value={currPass} onChange={(e) => setCurrPass(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)]" />
              <input type="password" placeholder="Nueva contraseña (mínimo 4 caracteres)" value={nextPass} onChange={(e) => setNextPass(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)]" />
              <button type="submit" className="px-4 py-2 rounded-xl bg-[var(--gtems-accent)] text-white font-semibold">Actualizar contraseña</button>
            </form>

            {currentUser.role === 'admin' && (
              <form onSubmit={handleCreateUser} className="p-4 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] space-y-3">
                <div className="font-semibold text-sm">Crear nuevo usuario</div>
                <input type="text" placeholder="Nombre de usuario" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)]" />
                <input type="text" placeholder="Nombre visible" value={newDisplay} onChange={(e) => setNewDisplay(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)]" />
                <input type="password" placeholder="Contraseña inicial" value={newPass} onChange={(e) => setNewPass(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)]" />
                <button type="submit" className="px-4 py-2 rounded-xl bg-[var(--gtems-accent)] text-white font-semibold">Crear cuenta</button>
              </form>
            )}
          </div>
        )}

        {category === 'hora' && (
          <div className="space-y-5 max-w-3xl text-xs">
            <h2 className="font-display text-2xl font-bold">{t(lang, 'settings.hora', 'Hora e idioma')}</h2>

            {/* Regional Preview */}
            <div className="p-4 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="text-[var(--gtems-text-muted)]">Idioma y dirección</div>
                <div className="font-semibold mt-0.5">{activeLangOpt.nativeName}</div>
                <div className="text-[11px] font-mono text-[var(--gtems-accent)]">
                  {activeLangOpt.rtl ? 'RTL (Derecha a izquierda)' : 'LTR'} · {activeLangOpt.coverage === 'complete' ? 'Traducción completa' : 'Traducción base + respaldo'}
                </div>
              </div>
              <div>
                <div className="text-[var(--gtems-text-muted)]">Hora activa ({systemState.timezone})</div>
                <div className="font-mono font-bold text-lg mt-0.5 tabular-nums">
                  {formatTimeInZone(new Date(), lang, systemState.timezone)}
                </div>
                <div className="text-[11px] text-[var(--gtems-text-muted)]">{regionalSample.dateTimeSample}</div>
              </div>
              <div>
                <div className="text-[var(--gtems-text-muted)]">Formato numérico / moneda</div>
                <div className="font-mono font-semibold mt-0.5">{regionalSample.numberSample}</div>
                <div className="font-mono text-[11px] text-[var(--gtems-text-muted)]">{regionalSample.currencySample}</div>
              </div>
            </div>

            {/* 34 Languages Picker */}
            <div className="p-4 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-sm flex items-center gap-2">
                  <Globe className="w-4 h-4 text-[var(--gtems-accent)]" />
                  <span>Idioma del sistema ({SUPPORTED_LANGUAGES.length} variantes / 33 idiomas)</span>
                </div>
                <input
                  type="search"
                  value={langSearch}
                  onChange={(e) => setLangSearch(e.target.value)}
                  placeholder="Filtrar idioma (español, english, 日本語, العربية...)"
                  className="px-3 py-1.5 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)] w-64"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto aurora-scroll pr-1">
                {filteredLanguages.map((opt) => {
                  const selected = activeLangOpt.code === opt.code;
                  return (
                    <button
                      key={opt.code}
                      type="button"
                      data-testid={`lang-opt-${opt.code}`}
                      onClick={() => void onUpdateSettings({ language: opt.code })}
                      className={`p-2.5 rounded-xl border text-left transition-colors flex items-center justify-between gap-2 ${
                        selected
                          ? 'bg-[var(--gtems-accent)] text-white border-transparent'
                          : 'border-[var(--gtems-border)] hover:bg-[var(--gtems-accent)]/12'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{opt.nativeName}</div>
                        <div className={`text-[10px] truncate ${selected ? 'text-white/80' : 'text-[var(--gtems-text-muted)]'}`}>
                          {opt.englishName} · {opt.rtl ? 'RTL' : 'LTR'}
                        </div>
                      </div>
                      {selected && <Check className="w-4 h-4 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Complete IANA Timezone Catalog */}
            <div className="p-4 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[var(--gtems-accent)]" />
                  <span>Zonas horarias IANA ({tzCatalog.length} zonas oficiales)</span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(systemState.autoTimezone)}
                    onChange={(e) => {
                      const auto = e.target.checked;
                      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || systemState.timezone;
                      void onUpdateSettings({
                        autoTimezone: auto,
                        timezone: auto ? detected : systemState.timezone,
                      });
                    }}
                  />
                  <span>Detectar automáticamente</span>
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  value={tzContinent}
                  onChange={(e) => setTzContinent(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)]"
                >
                  {continents.map((c) => (
                    <option key={c} value={c}>{c === 'ALL' ? 'Todos los continentes' : c}</option>
                  ))}
                </select>
                <input
                  type="search"
                  value={tzSearch}
                  onChange={(e) => setTzSearch(e.target.value)}
                  placeholder="Buscar ciudad, país o UTC (Tokyo, Madrid, Tegucigalpa...)"
                  className="flex-1 min-w-[200px] px-3 py-1.5 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)]"
                />
              </div>

              <div className="max-h-56 overflow-y-auto aurora-scroll space-y-1 pr-1">
                {filteredTimezones.map((z) => {
                  const selected = systemState.timezone === z.id;
                  return (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() => void onUpdateSettings({ timezone: z.id, autoTimezone: false })}
                      className={`w-full px-3 py-2 rounded-xl border flex items-center justify-between text-left ${
                        selected
                          ? 'bg-[var(--gtems-accent)] text-white border-transparent font-semibold'
                          : 'border-[var(--gtems-border)] hover:bg-[var(--gtems-accent)]/12'
                      }`}
                    >
                      <span className="truncate">{z.id}</span>
                      <span className={`font-mono text-[11px] shrink-0 ${selected ? 'text-white' : 'text-[var(--gtems-text-muted)]'}`}>
                        {z.offsetLabel} · {formatTimeInZone(new Date(), lang, z.id)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {category === 'juegos' && (
          <div className="space-y-4 max-w-2xl text-xs">
            <h2 className="font-display text-2xl font-bold">{t(lang, 'settings.juegos', 'Juegos')}</h2>
            <p className="text-[var(--gtems-text-muted)]">
              Compatibilidad con mandos de juego estándar vía <code className="font-mono">navigator.getGamepads()</code> y
              planificador Linux <code className="font-mono">CONFIG_PREEMPT</code>.
            </p>
            <div className="p-4 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)]">
              Mandos conectados actualmente:{' '}
              {typeof navigator !== 'undefined' && navigator.getGamepads
                ? navigator.getGamepads().filter(Boolean).length
                : 0}
            </div>
          </div>
        )}

        {category === 'acerca' && (
          <div className="space-y-6 max-w-3xl text-xs">
            <div className="flex items-center gap-4">
              <GtemsLogo className="w-14 h-14 shrink-0" />
              <div>
                <h2 className="font-display text-2xl font-bold">{GTEMS_IDENTITY.name}</h2>
                <p className="text-sm text-[var(--gtems-text-muted)]">{GTEMS_IDENTITY.slogan}</p>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] space-y-1.5">
              <div className="font-display font-bold text-sm">Descripción oficial del sistema</div>
              <p className="text-xs leading-relaxed text-[var(--gtems-text)]">{GTEMS_IDENTITY.officialDescription}</p>
            </div>

            <div className="p-5 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] space-y-2">
              <div className="font-display font-bold text-sm mb-2">Especificaciones reales del dispositivo</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6">
                <div><strong>Nombre del dispositivo:</strong> {hardware?.hostname || 'Información no disponible'}</div>
                <div><strong>Procesador:</strong> {hardware ? `${hardware.processor.model} (${hardware.processor.cores} núcleos${hardware.processor.frequencyMhz ? `, ${hardware.processor.frequencyMhz} MHz` : ''})` : 'Información no disponible'}</div>
                <div><strong>RAM instalada:</strong> {hardware ? `${(hardware.memory.totalBytes / 1024 ** 3).toFixed(2)} GiB (Disponible: ${(hardware.memory.freeBytes / 1024 ** 3).toFixed(2)} GiB)` : 'Información no disponible'}</div>
                <div><strong>Tarjeta gráfica:</strong> {hardware?.gpu || 'Información no disponible'}</div>
                <div>
                  <strong>Almacenamiento:</strong>{' '}
                  {hardware?.storage?.[0]
                    ? `${(hardware.storage[0].sizeBytes / 1024 ** 3).toFixed(1)} GiB (${(hardware.storage[0].availBytes / 1024 ** 3).toFixed(1)} GiB libres en ${hardware.storage[0].mount})`
                    : 'Información no disponible'}
                </div>
                <div><strong>Identificador de dispositivo:</strong> <span className="font-mono">{systemState.deviceId}</span></div>
                <div><strong>Id. del producto:</strong> <span className="font-mono">{systemState.productId}</span></div>
                <div><strong>Tipo de sistema:</strong> {hardware ? `${hardware.systemType.arch} · ${hardware.systemType.kernelVersion}` : 'Información no disponible'}</div>
                <div><strong>Plataforma anfitriona:</strong> {hardware?.systemType.hostPlatform || 'Información no disponible'}</div>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] space-y-2">
              <div className="font-display font-bold text-sm mb-2">Especificaciones de GTEMS OS</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6">
                <div><strong>Edición:</strong> {GTEMS_IDENTITY.name} {GTEMS_IDENTITY.version}</div>
                <div><strong>Compilación:</strong> <span className="font-mono">{GTEMS_IDENTITY.build}</span></div>
                <div><strong>Fecha de instalación:</strong> {systemState.installDate ? new Date(systemState.installDate).toLocaleString(lang) : 'Sesión Live (sin instalar)'}</div>
                <div><strong>Seguridad:</strong> <span className="inline-flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-[var(--gtems-accent)]" /> Hashing scrypt · Tokens HMAC</span></div>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface)] space-y-2">
              <div className="font-display font-bold text-sm mb-2">Desarrolladores oficiales</div>
              <ol className="list-decimal list-inside space-y-1.5 font-medium">
                {GTEMS_IDENTITY.developers.map((dev) => (
                  <li key={dev}>{dev}</li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

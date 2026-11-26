import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Battery,
  BatteryCharging,
  Bell,
  Bluetooth,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Globe,
  Lock,
  LogOut,
  Moon,
  MoreHorizontal,
  Power,
  RotateCcw,
  Search,
  Settings,
  Trash2,
  Usb,
  Volume2,
  VolumeX,
  Wifi,
  X,
} from 'lucide-react';
import { APP_CATALOG } from '../lib/gtemsIdentity';
import { computeLeftSidebarWidth, computeTaskbarLayout } from '../lib/taskbarLayout';
import { applyThemeAndPreferencesToDom } from '../lib/themes';
import {
  applyLanguageToDom,
  formatDateInZone,
  formatLongDateInZone,
  formatTimeInZone,
  t,
} from '../lib/i18n';
import { apiFetch } from '../lib/apiClient';
import type {
  AppId,
  DesktopPersonalization,
  SearchHistoryItem,
  SearchResultItem,
  SystemNotification,
  SystemStateSummary,
  UserProfile,
  WallpaperFitMode,
  WindowInstance,
} from '../lib/types';
import { ContextMenu, type ContextMenuItem, type ContextMenuState } from './ContextMenu';
import { GtemsAppIcon, GtemsLogo } from './icons/GtemsIcons';
import { WindowFrame } from './WindowFrame';
import { ExplorerApp } from './apps/ExplorerApp';
import { TerminalApp } from './apps/TerminalApp';
import { BrowserApp } from './apps/BrowserApp';
import { SettingsApp } from './apps/SettingsApp';
import { TaskManagerApp } from './apps/TaskManagerApp';
import { DeviceManagerApp } from './apps/DeviceManagerApp';
import { ImageEditorApp } from './apps/ImageEditorApp';
import { TextEditorApp } from './apps/TextEditorApp';
import { MediaPlayerApp } from './apps/MediaPlayerApp';
import { PackageManagerApp } from './apps/PackageManagerApp';
import { ArchitectureApp } from './apps/ArchitectureApp';
import { CodeStudioApp } from './apps/CodeStudioApp';

interface DesktopShellProps {
  currentUser: UserProfile;
  systemState: SystemStateSummary;
  onSystemStateChange: (next: SystemStateSummary) => void;
  onLock: () => void;
  onLogout: () => void;
  onPowerOff: () => void;
  onReboot: () => void;
  onReinstall: () => void;
}

const DESKTOP_SHORTCUTS: Array<{ id: AppId; labelKey: string; defaultLabel: string; payload?: { filePath?: string } }> = [
  { id: 'explorer', labelKey: 'app.explorer', defaultLabel: 'GTEMS Explorer' },
  { id: 'browser', labelKey: 'app.browser', defaultLabel: 'Navegador Web' },
  { id: 'terminal', labelKey: 'app.terminal', defaultLabel: 'Terminal' },
  { id: 'code-studio', labelKey: 'app.codeStudio', defaultLabel: 'GTEMS Code Studio' },
  { id: 'settings', labelKey: 'app.settings', defaultLabel: 'Configuración' },
  { id: 'task-manager', labelKey: 'app.taskManager', defaultLabel: 'Adm. de tareas' },
  { id: 'device-manager', labelKey: 'app.deviceManager', defaultLabel: 'Dispositivos' },
  { id: 'package-manager', labelKey: 'app.packageManager', defaultLabel: 'Paquetes APT' },
  { id: 'architecture', labelKey: 'app.architecture', defaultLabel: 'Arquitectura OS' },
];

function wallpaperFitClass(fit?: WallpaperFitMode): string {
  if (fit === 'contain') return 'object-contain bg-slate-950';
  if (fit === 'fill') return 'object-fill';
  if (fit === 'center') return 'object-none';
  return 'object-cover';
}

export const DesktopShell: React.FC<DesktopShellProps> = ({
  currentUser,
  systemState,
  onSystemStateChange,
  onLock,
  onLogout,
  onPowerOff,
  onReboot,
  onReinstall,
}) => {
  const [windows, setWindows] = useState<WindowInstance[]>([]);
  const [topZ, setTopZ] = useState(20);
  const [focusedWindowId, setFocusedWindowId] = useState<string | null>(null);
  const [selectedShortcut, setSelectedShortcut] = useState<AppId | null>(null);
  const [desktopSort, setDesktopSort] = useState<'default' | 'name'>('default');

  const [startOpen, setStartOpen] = useState(false);
  const [startSearch, setStartSearch] = useState('');
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [globalCategory, setGlobalCategory] = useState<'all' | 'apps' | 'files' | 'settings' | 'devices' | 'processes'>('all');
  const [globalResults, setGlobalResults] = useState<SearchResultItem[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>(systemState.searchHistory || []);
  const [searchingGlobal, setSearchingGlobal] = useState(false);
  const [selectedSearchIdx, setSelectedSearchIdx] = useState(0);

  const [controlOpen, setControlOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [trayPopover, setTrayPopover] = useState<'network' | 'bluetooth' | null>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const [now, setNow] = useState(new Date());
  const [calendarMonthOffset, setCalendarMonthOffset] = useState(0);
  const [viewport, setViewport] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth : 1440,
    h: typeof window !== 'undefined' ? window.innerHeight : 900,
  });

  const [batteryInfo, setBatteryInfo] = useState<{ level: number; charging: boolean } | null>(null);
  const [hostBatteryPresent, setHostBatteryPresent] = useState(false);
  const [networkInfo, setNetworkInfo] = useState<{ wifiStatusMessage: string; gateway: string; interfaces: Array<{ name: string; isLoopback: boolean }> } | null>(null);
  const [btStatus, setBtStatus] = useState<string>('Consultando adaptador Bluetooth...');

  const [powerModal, setPowerModal] = useState<'shutdown' | 'reboot' | null>(null);
  const [powerError, setPowerError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  const startupRanRef = useRef(false);
  const lang = systemState.language || 'es-HN';
  const tz = systemState.timezone || 'America/Tegucigalpa';
  const p = systemState.personalization;

  useEffect(() => {
    applyThemeAndPreferencesToDom(p);
  }, [p]);

  useEffect(() => {
    applyLanguageToDom(lang);
  }, [lang]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => {
      clearInterval(timer);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  // Global keyboard shortcut Ctrl+K / Meta+K for Global Search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setGlobalSearchOpen((v) => !v);
        setStartOpen(false);
        setControlOpen(false);
        setCalendarOpen(false);
        setTrayPopover(null);
      }
      if (e.key === 'Escape') {
        setGlobalSearchOpen(false);
        setStartOpen(false);
        setControlOpen(false);
        setCalendarOpen(false);
        setTrayPopover(null);
        setOverflowOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Real battery, network, and Bluetooth probes
  useEffect(() => {
    const nav = navigator as Navigator & {
      getBattery?: () => Promise<{ level: number; charging: boolean; addEventListener?: (e: string, fn: () => void) => void }>;
    };
    if (typeof nav.getBattery === 'function') {
      nav
        .getBattery()
        .then((bat) => {
          setBatteryInfo({ level: Math.round(bat.level * 100), charging: bat.charging });
        })
        .catch(() => setBatteryInfo(null));
    }

    apiFetch<{ batteryPresent?: boolean }>('/api/system/hardware')
      .then((hw) => setHostBatteryPresent(Boolean(hw.batteryPresent)))
      .catch(() => {});

    apiFetch<{ wifiStatusMessage: string; gateway: string; interfaces: Array<{ name: string; isLoopback: boolean }> }>('/api/network/status')
      .then(setNetworkInfo)
      .catch(() => {});

    apiFetch<{ devices: Array<{ name: string; type: string; status: string }> }>('/api/devices')
      .then((d) => {
        const bt = (d.devices || []).find((dev) => dev.type.toLowerCase().includes('bluetooth') || dev.name.toLowerCase().includes('bluetooth'));
        setBtStatus(bt ? `${bt.name} (${bt.status})` : 'Sin radio Bluetooth física detectada en el kernel Linux.');
      })
      .catch(() => setBtStatus('Sin información de Bluetooth disponible.'));
  }, []);

  // Debounced Global Search query
  useEffect(() => {
    if (!globalSearchOpen) return;
    const handle = setTimeout(async () => {
      setSearchingGlobal(true);
      try {
        const res = await apiFetch<{ results: SearchResultItem[]; history: SearchHistoryItem[] }>(
          `/api/search?q=${encodeURIComponent(globalQuery)}&category=${encodeURIComponent(globalCategory)}`
        );
        setGlobalResults(res.results || []);
        setSearchHistory(res.history || []);
        setSelectedSearchIdx(0);
      } catch {
        // ignore
      } finally {
        setSearchingGlobal(false);
      }
    }, 140);
    return () => clearTimeout(handle);
  }, [globalQuery, globalCategory, globalSearchOpen]);

  const closeAllOverlays = () => {
    setStartOpen(false);
    setControlOpen(false);
    setCalendarOpen(false);
    setTrayPopover(null);
    setOverflowOpen(false);
    setGlobalSearchOpen(false);
  };

  const pushNotification = useCallback(
    (title: string, body: string, category: SystemNotification['category'] = 'system') => {
      const notif: SystemNotification = {
        id: `notif-${Date.now()}`,
        title,
        body,
        category,
        timestamp: new Date().toISOString(),
        read: false,
      };
      onSystemStateChange({
        ...systemState,
        notifications: [notif, ...systemState.notifications].slice(0, 30),
      });
      if (!systemState.doNotDisturb) {
        setToast({ title, body });
        setTimeout(() => setToast(null), 4000);
      }
    },
    [onSystemStateChange, systemState]
  );

  const taskbarPosition = p.taskbarPosition || 'left';
  const isLeftTaskbar = taskbarPosition === 'left';
  const leftSidebarWidth = isLeftTaskbar
    ? computeLeftSidebarWidth(p.taskbarWidthMode || 'normal', p.iconSize || 'normal', viewport.w)
    : 0;
  const topOffsetPx = taskbarPosition === 'top' ? 52 : 0;
  const bottomOffsetPx = taskbarPosition === 'bottom' ? 52 : 0;

  const openApp = useCallback(
    (
      appId: AppId,
      customTitle?: string,
      payload?: { filePath?: string; initialCategory?: string; initialUrl?: string }
    ) => {
      closeAllOverlays();

      const meta = APP_CATALOG[appId];
      const localizedName = t(lang, meta.i18nKey, meta.name);
      const existing = windows.find(
        (w) => w.appId === appId && !payload?.filePath && !payload?.initialCategory && !payload?.initialUrl
      );
      if (existing) {
        const nextZ = topZ + 1;
        setTopZ(nextZ);
        setFocusedWindowId(existing.id);
        setWindows((prev) =>
          prev.map((w) => (w.id === existing.id ? { ...w, minimized: false, zIndex: nextZ } : w))
        );
        return;
      }

      const nextZ = topZ + 1;
      setTopZ(nextZ);
      const offset = (windows.length % 6) * 26;
      const winId = `win-${appId}-${Date.now()}`;
      const availW = Math.max(340, viewport.w - leftSidebarWidth - 24);
      const availH = Math.max(260, viewport.h - topOffsetPx - bottomOffsetPx - 24);

      const newWin: WindowInstance = {
        id: winId,
        appId,
        title: customTitle ? `${localizedName} — ${customTitle}` : localizedName,
        x: leftSidebarWidth + Math.min(28 + offset, Math.max(8, availW - meta.defaultWidth)),
        y: topOffsetPx + Math.min(24 + offset, Math.max(8, availH - meta.defaultHeight)),
        width: Math.min(meta.defaultWidth, availW),
        height: Math.min(meta.defaultHeight, availH),
        minimized: false,
        maximized: false,
        zIndex: nextZ,
        payload,
      };
      setWindows((prev) => [...prev, newWin]);
      setFocusedWindowId(winId);
    },
    [windows, topZ, lang, viewport.w, viewport.h, leftSidebarWidth, topOffsetPx, bottomOffsetPx]
  );

  // Launch user-configured startup apps once on initial desktop entry
  useEffect(() => {
    if (startupRanRef.current) return;
    startupRanRef.current = true;
    if (Array.isArray(systemState.startupApps) && systemState.startupApps.length > 0) {
      systemState.startupApps.forEach((appId) => {
        if (APP_CATALOG[appId]) openApp(appId);
      });
    }
  }, [systemState.startupApps, openApp]);

  const updateSettings = async (
    patch: Omit<Partial<SystemStateSummary>, 'personalization'> & { personalization?: Partial<DesktopPersonalization> }
  ) => {
    const res = await apiFetch<{ ok: boolean; state: SystemStateSummary }>('/api/system/settings', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    onSystemStateChange(res.state);
  };

  const refreshSystemState = async () => {
    const latest = await apiFetch<SystemStateSummary>('/api/system/state');
    onSystemStateChange(latest);
  };

  const openContextMenu = (x: number, y: number, items: ContextMenuItem[]) => {
    setContextMenu({ x, y, items });
  };

  const executePowerAction = async () => {
    if (!powerModal) return;
    setPowerError(null);
    try {
      await apiFetch('/api/system/power', {
        method: 'POST',
        body: JSON.stringify({ action: powerModal }),
      });
      setWindows([]);
      const action = powerModal;
      setPowerModal(null);
      if (action === 'shutdown') onPowerOff();
      if (action === 'reboot') onReboot();
    } catch (err) {
      setPowerError(err instanceof Error ? err.message : 'Error ejecutando operación de energía');
    }
  };

  const executeSearchResult = async (item: SearchResultItem) => {
    if (globalQuery.trim()) {
      apiFetch(`/api/search?q=${encodeURIComponent(globalQuery.trim())}&saveHistory=1`).catch(() => {});
    }
    if (item.actionType === 'open-setting' && item.settingCategory) {
      openApp('settings', item.title, { initialCategory: item.settingCategory });
    } else if (item.actionType === 'open-file' && item.filePath) {
      openApp(item.appId || 'explorer', item.title, { filePath: item.filePath });
    } else if (item.actionType === 'open-web' && item.url) {
      openApp('browser', item.title, { initialUrl: item.url });
    } else if (item.appId) {
      openApp(item.appId);
    }
  };

  const triggerWebSearch = (queryText: string) => {
    const q = queryText.trim();
    if (!q) return;
    const isDirectUrl = /^https?:\/\//i.test(q) || (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(q) && !q.includes(' '));
    const url = isDirectUrl ? (q.startsWith('http') ? q : `https://${q}`) : `https://www.google.com/search?q=${encodeURIComponent(q)}`;
    apiFetch(`/api/search?q=${encodeURIComponent(q)}&saveHistory=1`).catch(() => {});
    openApp('browser', q, { initialUrl: url });
  };

  const taskbarAppIds: AppId[] = Array.from(
    new Set([...systemState.pinnedApps, ...windows.map((w) => w.appId)])
  );
  const taskbarLayout = computeTaskbarLayout({
    viewportWidth: viewport.w,
    viewportHeight: viewport.h,
    position: taskbarPosition,
    uiScale: p.uiScale,
    iconSize: p.iconSize,
    fontSize: p.fontSize,
    items: taskbarAppIds,
  });

  const timeStr = formatTimeInZone(now, lang, tz);
  const dateStr = formatDateInZone(now, lang, tz);

  const filteredApps = (Object.keys(APP_CATALOG) as AppId[]).filter((id) => {
    const entry = APP_CATALOG[id];
    const localized = t(lang, entry.i18nKey, entry.name);
    const q = startSearch.toLowerCase();
    return localized.toLowerCase().includes(q) || entry.name.toLowerCase().includes(q) || entry.description.toLowerCase().includes(q);
  });

  const iconBoxSize =
    p.iconSize === 'large' ? 'w-11 h-11' : p.iconSize === 'small' ? 'w-8 h-8' : 'w-9 h-9';

  // Calendar Month Grid
  const calendarGrid = useMemo(() => {
    const base = new Date(now.getFullYear(), now.getMonth() + calendarMonthOffset, 1);
    const year = base.getFullYear();
    const month = base.getMonth();
    const firstWeekday = (base.getDay() + 6) % 7; // Mon=0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number | null; isToday: boolean }> = [];
    for (let i = 0; i < firstWeekday; i++) cells.push({ day: null, isToday: false });
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday =
        calendarMonthOffset === 0 && d === now.getDate() && month === now.getMonth() && year === now.getFullYear();
      cells.push({ day: d, isToday });
    }
    const label = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric' }).format(base);
    return { label, cells };
  }, [now, calendarMonthOffset, lang]);

  const popoverLeftAnchor = isLeftTaskbar ? leftSidebarWidth + 12 : 12;
  const isSidebarExpanded = isLeftTaskbar && p.taskbarWidthMode === 'expanded' && viewport.w >= 760;

  return (
    <div
      data-testid="gtems-desktop"
      onClick={() => {
        closeAllOverlays();
        setSelectedShortcut(null);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        openContextMenu(e.clientX, e.clientY, [
          {
            id: 'desk-view',
            label: 'Ver',
            submenu: [
              {
                id: 'dv-small',
                label: `Iconos pequeños${p.iconSize === 'small' ? ' ✓' : ''}`,
                onClick: () => void updateSettings({ personalization: { iconSize: 'small' } }),
              },
              {
                id: 'dv-normal',
                label: `Iconos normales${p.iconSize === 'normal' ? ' ✓' : ''}`,
                onClick: () => void updateSettings({ personalization: { iconSize: 'normal' } }),
              },
              {
                id: 'dv-large',
                label: `Iconos grandes${p.iconSize === 'large' ? ' ✓' : ''}`,
                onClick: () => void updateSettings({ personalization: { iconSize: 'large' } }),
              },
            ],
          },
          {
            id: 'desk-sort',
            label: 'Ordenar por',
            submenu: [
              { id: 'ds-def', label: `Predeterminado${desktopSort === 'default' ? ' ✓' : ''}`, onClick: () => setDesktopSort('default') },
              { id: 'ds-name', label: `Nombre${desktopSort === 'name' ? ' ✓' : ''}`, onClick: () => setDesktopSort('name') },
            ],
          },
          { id: 'desk-refresh', label: 'Actualizar', onClick: () => void refreshSystemState() },
          { id: 'desk-search', label: 'Buscador global (Ctrl+K)', onClick: () => setGlobalSearchOpen(true) },
          {
            id: 'desk-new',
            label: 'Nuevo / Abrir',
            submenu: [
              { id: 'dn-exp', label: 'Carpeta Escritorio', onClick: () => openApp('explorer', 'Escritorio', { filePath: '/Escritorio' }) },
              { id: 'dn-code', label: 'GTEMS Code Studio', onClick: () => openApp('code-studio') },
              { id: 'dn-term', label: 'Abrir terminal', onClick: () => openApp('terminal') },
            ],
          },
          { id: 'desk-pers', label: 'Personalizar ZEYLA / Aurora', dividerBefore: true, onClick: () => openApp('settings', 'Personalización', { initialCategory: 'personalizacion' }) },
          { id: 'desk-iso', label: 'Descargar imagen .iso', onClick: () => openApp('settings', 'Sistema', { initialCategory: 'sistema' }) },
          { id: 'desk-sys', label: 'Información del sistema', onClick: () => openApp('settings', 'Acerca de', { initialCategory: 'acerca' }) },
        ]);
      }}
      style={{ filter: `brightness(${systemState.brightness}%)` }}
      className="relative w-full h-full overflow-hidden select-none"
    >
      {/* Wallpaper */}
      <img
        src={p.wallpaper}
        alt="Fondo de escritorio GTEMS OS"
        referrerPolicy="no-referrer"
        className={`absolute inset-0 w-full h-full ${wallpaperFitClass(p.wallpaperFit)}`}
      />

      {/* Desktop Shortcuts Grid — padded cleanly away from the left vertical taskbar */}
      <div
        style={{
          paddingLeft: isLeftTaskbar ? leftSidebarWidth + 16 : 16,
          paddingTop: taskbarPosition === 'top' ? 62 : 16,
          paddingBottom: taskbarPosition === 'bottom' ? 62 : 16,
        }}
        className="relative z-10 grid grid-flow-col grid-rows-6 gap-2.5 w-fit max-h-full"
      >
        {(desktopSort === 'name'
          ? [...DESKTOP_SHORTCUTS].sort((a, b) =>
              t(lang, a.labelKey, a.defaultLabel).localeCompare(t(lang, b.labelKey, b.defaultLabel), lang)
            )
          : DESKTOP_SHORTCUTS
        ).map((sc) => {
          const label = t(lang, sc.labelKey, sc.defaultLabel);
          return (
            <button
              key={sc.id}
              type="button"
              aria-label={`Acceso directo ${label}`}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedShortcut(sc.id);
              }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                openApp(sc.id, undefined, sc.payload);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openContextMenu(e.clientX, e.clientY, [
                  { id: 'sc-open', label: 'Abrir', onClick: () => openApp(sc.id, undefined, sc.payload) },
                  { id: 'sc-props', label: 'Propiedades', onClick: () => openApp('settings', 'Aplicaciones', { initialCategory: 'aplicaciones' }) },
                ]);
              }}
              className={`w-24 p-2 rounded-xl flex flex-col items-center gap-1.5 text-center transition-colors ${
                selectedShortcut === sc.id
                  ? 'bg-[var(--gtems-accent)]/35 ring-1 ring-[var(--gtems-accent)]/70'
                  : 'hover:bg-white/25 dark:hover:bg-slate-900/40'
              }`}
            >
              <GtemsAppIcon appId={sc.id} className={iconBoxSize} />
              <span className="text-[11px] font-semibold text-slate-900 dark:text-white drop-shadow-[0_1px_2px_rgba(255,255,255,0.85)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] leading-tight line-clamp-2">
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Open Windows */}
      {windows.map((win) => (
        <WindowFrame
          key={win.id}
          win={win}
          isFocused={focusedWindowId === win.id}
          transparency={p.transparency}
          leftOffsetPx={leftSidebarWidth}
          topOffsetPx={topOffsetPx}
          bottomOffsetPx={bottomOffsetPx}
          onFocus={() => {
            const nextZ = topZ + 1;
            setTopZ(nextZ);
            setFocusedWindowId(win.id);
            setWindows((prev) => prev.map((w) => (w.id === win.id ? { ...w, zIndex: nextZ } : w)));
          }}
          onClose={() => setWindows((prev) => prev.filter((w) => w.id !== win.id))}
          onMinimize={() => setWindows((prev) => prev.map((w) => (w.id === win.id ? { ...w, minimized: true } : w)))}
          onToggleMaximize={() =>
            setWindows((prev) => prev.map((w) => (w.id === win.id ? { ...w, maximized: !w.maximized } : w)))
          }
          onMove={(x, y) => setWindows((prev) => prev.map((w) => (w.id === win.id ? { ...w, x, y } : w)))}
          onResize={(width, height) =>
            setWindows((prev) => prev.map((w) => (w.id === win.id ? { ...w, width, height } : w)))
          }
          onContextMenu={(e) => {
            openContextMenu(e.clientX, e.clientY, [
              { id: 'w-min', label: 'Minimizar', onClick: () => setWindows((prev) => prev.map((w) => (w.id === win.id ? { ...w, minimized: true } : w))) },
              { id: 'w-max', label: win.maximized ? 'Restaurar' : 'Maximizar', onClick: () => setWindows((prev) => prev.map((w) => (w.id === win.id ? { ...w, maximized: !w.maximized } : w))) },
              { id: 'w-close', label: 'Cerrar ventana', danger: true, dividerBefore: true, onClick: () => setWindows((prev) => prev.filter((w) => w.id !== win.id)) },
            ]);
          }}
        >
          {win.appId === 'explorer' && (
            <ExplorerApp
              initialPath={win.payload?.filePath || '/Documentos'}
              onOpenApp={openApp}
              onOpenContextMenu={openContextMenu}
              onNotify={(title, body) => pushNotification(title, body, 'app')}
            />
          )}
          {win.appId === 'terminal' && (
            <TerminalApp
              initialPath={win.payload?.filePath}
              language={lang}
              timezone={tz}
              initialHistory={systemState.terminalHistory}
              onHistorySync={(terminalHistory) => onSystemStateChange({ ...systemState, terminalHistory })}
            />
          )}
          {win.appId === 'code-studio' && (
            <CodeStudioApp
              initialPath={win.payload?.filePath}
              language={lang}
              onOpenApp={openApp}
              onNotify={(title, body) => pushNotification(title, body, 'app')}
            />
          )}
          {win.appId === 'browser' && (
            <BrowserApp
              initialUrl={win.payload?.initialUrl}
              language={lang}
              bookmarks={systemState.bookmarks}
              history={systemState.history}
              downloads={systemState.downloads}
              onBookmarksChange={(bookmarks) => onSystemStateChange({ ...systemState, bookmarks })}
              onHistoryChange={(history) => onSystemStateChange({ ...systemState, history })}
              onDownloadsChange={(downloads) => onSystemStateChange({ ...systemState, downloads })}
              onOpenApp={openApp}
              onNotify={(title, body) => pushNotification(title, body, 'download')}
            />
          )}
          {win.appId === 'settings' && (
            <SettingsApp
              initialCategory={win.payload?.initialCategory || 'inicio'}
              currentUser={currentUser}
              systemState={systemState}
              openAppIds={Array.from(new Set(windows.map((w) => w.appId)))}
              onOpenApp={openApp}
              onUpdateSettings={updateSettings}
              onUsersRefresh={refreshSystemState}
              onPowerAction={(action) => {
                setWindows([]);
                if (action === 'shutdown') onPowerOff();
                if (action === 'reboot') onReboot();
                if (action === 'reinstall') onReinstall();
              }}
              onNotify={(title, body) => pushNotification(title, body, 'system')}
            />
          )}
          {win.appId === 'task-manager' && <TaskManagerApp onNotify={(title, body) => pushNotification(title, body, 'system')} />}
          {win.appId === 'device-manager' && <DeviceManagerApp />}
          {win.appId === 'image-editor' && (
            <ImageEditorApp initialPath={win.payload?.filePath} onNotify={(title, body) => pushNotification(title, body, 'app')} />
          )}
          {win.appId === 'text-editor' && (
            <TextEditorApp initialPath={win.payload?.filePath} onNotify={(title, body) => pushNotification(title, body, 'app')} />
          )}
          {win.appId === 'music-player' && <MediaPlayerApp mode="audio" initialPath={win.payload?.filePath} />}
          {win.appId === 'video-player' && <MediaPlayerApp mode="video" initialPath={win.payload?.filePath} />}
          {win.appId === 'package-manager' && <PackageManagerApp />}
          {win.appId === 'architecture' && <ArchitectureApp />}
        </WindowFrame>
      ))}

      {/* Global Search Palette Overlay */}
      {globalSearchOpen && (
        <div
          data-testid="global-search"
          onClick={(e) => e.stopPropagation()}
          style={{ left: popoverLeftAnchor }}
          className="fixed top-6 z-[9200] w-[min(640px,calc(100vw-96px))] max-h-[82vh] rounded-3xl aurora-glass shadow-2xl flex flex-col overflow-hidden text-[var(--gtems-text)]"
        >
          <div className="p-4 border-b border-[var(--gtems-border)] flex items-center gap-3 bg-[var(--gtems-surface-solid)]/60">
            <Search className="w-4 h-4 text-[var(--gtems-accent)] shrink-0" />
            <input
              type="search"
              autoFocus
              aria-label={t(lang, 'search.placeholder', 'Buscar en GTEMS OS o en Internet...')}
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setSelectedSearchIdx((i) => Math.min(globalResults.length - 1, i + 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setSelectedSearchIdx((i) => Math.max(0, i - 1));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (globalResults[selectedSearchIdx]) {
                    void executeSearchResult(globalResults[selectedSearchIdx]);
                  } else if (globalQuery.trim()) {
                    triggerWebSearch(globalQuery);
                  }
                }
              }}
              placeholder={t(lang, 'search.placeholder', 'Buscar apps, archivos, contenido, ajustes, dispositivos o web...')}
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
            <button
              type="button"
              aria-label="Cerrar búsqueda"
              onClick={() => setGlobalSearchOpen(false)}
              className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 py-2 border-b border-[var(--gtems-border)] flex flex-wrap gap-1.5 text-[11px]">
            {(
              [
                ['all', 'Todo'],
                ['apps', 'Aplicaciones'],
                ['files', 'Archivos y contenido'],
                ['settings', 'Ajustes'],
                ['devices', 'Dispositivos'],
                ['processes', 'Procesos'],
              ] as const
            ).map(([catId, label]) => (
              <button
                key={catId}
                type="button"
                onClick={() => setGlobalCategory(catId)}
                className={`px-2.5 py-1 rounded-lg font-medium ${
                  globalCategory === catId
                    ? 'bg-[var(--gtems-accent)] text-white'
                    : 'border border-[var(--gtems-border)] hover:bg-[var(--gtems-accent)]/12'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto aurora-scroll p-3 space-y-2 text-xs">
            {!globalQuery.trim() && searchHistory.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="font-semibold text-[var(--gtems-text-muted)]">Historial reciente</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await apiFetch('/api/search/history', { method: 'DELETE' });
                      setSearchHistory([]);
                    }}
                    className="inline-flex items-center gap-1 text-[11px] text-red-600 dark:text-red-400 hover:underline"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Limpiar</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {searchHistory.slice(0, 12).map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => setGlobalQuery(h.query)}
                      className="px-2.5 py-1 rounded-lg border border-[var(--gtems-border)] hover:bg-[var(--gtems-accent)]/12"
                    >
                      {h.query}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {searchingGlobal && (
              <div className="p-3 text-center text-[var(--gtems-text-muted)]">Buscando en el sistema...</div>
            )}

            {globalResults.map((res, idx) => (
              <button
                key={res.id}
                type="button"
                data-testid={`search-result-${res.id}`}
                onClick={() => void executeSearchResult(res)}
                className={`w-full p-2.5 rounded-xl border flex items-center justify-between gap-3 text-left transition-colors ${
                  idx === selectedSearchIdx
                    ? 'border-[var(--gtems-accent)] bg-[var(--gtems-accent)]/15'
                    : 'border-[var(--gtems-border)] hover:bg-[var(--gtems-accent)]/10'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">{res.title}</div>
                  <div className="text-[11px] text-[var(--gtems-text-muted)] truncate">{res.subtitle}</div>
                </div>
                <span className="text-[10px] font-mono text-[var(--gtems-accent)] shrink-0">
                  {res.matchReason || res.category}
                </span>
              </button>
            ))}

            {globalQuery.trim() && (
              <button
                type="button"
                data-testid="search-web-fallback"
                onClick={() => triggerWebSearch(globalQuery)}
                className="w-full p-2.5 rounded-xl border border-[var(--gtems-accent)]/40 bg-[var(--gtems-accent)]/10 hover:bg-[var(--gtems-accent)]/20 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Globe className="w-4 h-4 text-[var(--gtems-accent)] shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold truncate">
                      Buscar en Internet / Navegador Web: «{globalQuery.trim()}»
                    </div>
                    <div className="text-[11px] text-[var(--gtems-text-muted)]">
                      Abre Navegador Web con consulta HTTPS real en Google o URL directa
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono shrink-0">Web</span>
              </button>
            )}

            {globalQuery.trim() && !searchingGlobal && globalResults.length === 0 && (
              <div className="p-2 text-center text-[var(--gtems-text-muted)]">
                Sin coincidencias locales para «{globalQuery}».
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          className={`fixed right-4 z-[9000] w-80 rounded-2xl aurora-glass shadow-xl p-3.5 text-xs ${
            taskbarPosition === 'top' ? 'top-16' : 'bottom-6'
          }`}
        >
          <div className="font-semibold text-[var(--gtems-accent)]">{toast.title}</div>
          <div className="mt-0.5 text-[var(--gtems-text)]">{toast.body}</div>
        </div>
      )}

      {/* Start Menu (NO Reinstall button here — moved strictly to Settings -> Sistema -> Recuperación y reinstalación) */}
      {startOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          data-testid="start-menu"
          style={{ left: popoverLeftAnchor }}
          className={`fixed z-[8500] w-[min(540px,calc(100vw-96px))] rounded-3xl aurora-glass shadow-2xl p-5 flex flex-col gap-4 text-[var(--gtems-text)] ${
            taskbarPosition === 'top' ? 'top-14' : 'bottom-4'
          }`}
        >
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)]/80">
            <Search className="w-4 h-4 text-[var(--gtems-text-muted)]" />
            <input
              type="search"
              aria-label="Buscar aplicaciones"
              value={startSearch}
              onChange={(e) => setStartSearch(e.target.value)}
              placeholder={t(lang, 'start.searchApps', 'Filtrar aplicaciones instaladas...')}
              autoFocus
              className="flex-1 bg-transparent text-xs focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                setStartOpen(false);
                setGlobalSearchOpen(true);
              }}
              className="text-[11px] font-medium text-[var(--gtems-accent)] hover:underline whitespace-nowrap"
            >
              Buscador global
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-60 overflow-y-auto aurora-scroll">
            {filteredApps.map((appId) => (
              <button
                key={appId}
                type="button"
                onClick={() => openApp(appId)}
                className="p-2.5 rounded-xl hover:bg-[var(--gtems-accent)]/15 flex flex-col items-center gap-1.5 text-center transition-colors"
              >
                <GtemsAppIcon appId={appId} className="w-8 h-8" />
                <span className="text-[11px] font-medium leading-tight">
                  {t(lang, APP_CATALOG[appId].i18nKey, APP_CATALOG[appId].name)}
                </span>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[var(--gtems-border)] text-xs">
            <div>
              <div className="text-[11px] font-semibold text-[var(--gtems-text-muted)] mb-1">Carpetas</div>
              <div className="flex flex-wrap gap-1.5">
                {['/Inicio', '/Documentos', '/Descargas', '/Proyectos', '/Papelera'].map((folder) => (
                  <button
                    key={folder}
                    type="button"
                    onClick={() => openApp('explorer', folder.slice(1), { filePath: folder })}
                    className="px-2 py-1 rounded-lg border border-[var(--gtems-border)] hover:bg-[var(--gtems-accent)]/15"
                  >
                    {folder.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold text-[var(--gtems-text-muted)] mb-1">Recientes</div>
              <div className="space-y-1">
                {systemState.recentFiles.slice(0, 2).map((rf) => (
                  <button
                    key={rf}
                    type="button"
                    onClick={() => openApp('text-editor', rf.split('/').pop(), { filePath: rf })}
                    className="block w-full text-left truncate hover:underline text-[11px]"
                  >
                    {rf}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Start Menu Footer (Clean — NO Reinstalar button) */}
          <div className="pt-3 border-t border-[var(--gtems-border)] flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="font-semibold truncate">
              {currentUser.displayName} <span className="text-[var(--gtems-text-muted)] font-normal">(@{currentUser.username})</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => openApp('settings')}
                className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Configuración"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onLock}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>{t(lang, 'power.lock', 'Bloquear')}</span>
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t(lang, 'power.logout', 'Cerrar sesión')}</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await apiFetch('/api/system/power', {
                      method: 'POST',
                      body: JSON.stringify({ action: 'suspend' }),
                    });
                  } catch {
                    // ignore
                  }
                  onLock();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Suspender</span>
              </button>
              <button
                type="button"
                onClick={() => setPowerModal('reboot')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t(lang, 'power.reboot', 'Reiniciar')}</span>
              </button>
              <button
                type="button"
                onClick={() => setPowerModal('shutdown')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-600/90 text-white"
              >
                <Power className="w-3.5 h-3.5" />
                <span>{t(lang, 'power.shutdown', 'Apagar')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Network & Bluetooth Quick Popover */}
      {trayPopover && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={isLeftTaskbar ? { left: popoverLeftAnchor, bottom: 16 } : { right: 12, bottom: taskbarPosition === 'bottom' ? 56 : undefined, top: taskbarPosition === 'top' ? 56 : undefined }}
          className="fixed z-[8500] w-80 rounded-2xl aurora-glass shadow-2xl p-4 space-y-3 text-xs text-[var(--gtems-text)]"
        >
          <div className="flex items-center justify-between">
            <span className="font-display font-bold text-sm">
              {trayPopover === 'network' ? 'Red e Internet (Linux)' : 'Bluetooth y periféricos'}
            </span>
            <button type="button" onClick={() => setTrayPopover(null)} className="p-1 rounded-lg hover:bg-black/10">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {trayPopover === 'network' ? (
            <div className="space-y-2">
              <p className="text-[var(--gtems-text-muted)]">{networkInfo?.wifiStatusMessage || 'Consultando interfaces...'}</p>
              <div className="font-mono text-[11px]">
                Interfaces activas: {networkInfo?.interfaces.filter((i) => !i.isLoopback).map((i) => i.name).join(', ') || 'lo'}
              </div>
              <button
                type="button"
                onClick={() => openApp('settings', 'Red e Internet', { initialCategory: 'red' })}
                className="w-full py-2 rounded-xl bg-[var(--gtems-accent)] text-white font-semibold"
              >
                Abrir configuración de red
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[var(--gtems-text-muted)]">{btStatus}</p>
              <button
                type="button"
                onClick={() => openApp('settings', 'Bluetooth y dispositivos', { initialCategory: 'bluetooth' })}
                className="w-full py-2 rounded-xl bg-[var(--gtems-accent)] text-white font-semibold"
              >
                Gestionar Bluetooth y dispositivos
              </button>
            </div>
          )}
        </div>
      )}

      {/* Notification & Quick Control Center */}
      {controlOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          data-testid="control-center"
          style={isLeftTaskbar ? { left: popoverLeftAnchor, bottom: 16 } : { right: 12, bottom: taskbarPosition === 'bottom' ? 56 : undefined, top: taskbarPosition === 'top' ? 56 : undefined }}
          className="fixed z-[8500] w-80 rounded-3xl aurora-glass shadow-2xl p-4 space-y-4 text-xs text-[var(--gtems-text)]"
        >
          <div className="font-display font-bold text-sm">Centro de control y notificaciones</div>

          <div className="space-y-3 p-3 rounded-2xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)]/50">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span>Volumen</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void updateSettings({ muted: !systemState.muted })}
                    className="text-[11px] text-[var(--gtems-accent)] hover:underline"
                  >
                    {systemState.muted ? 'Reactivar' : 'Silenciar'}
                  </button>
                  <span className="font-mono">{systemState.muted ? '0%' : `${systemState.volume}%`}</span>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={systemState.volume}
                onChange={(e) => void updateSettings({ volume: Number(e.target.value), muted: false })}
                className="w-full accent-[var(--gtems-accent)]"
              />
            </div>
            <div>
              <label className="flex justify-between mb-1"><span>Brillo</span><span className="font-mono">{systemState.brightness}%</span></label>
              <input
                type="range"
                min={35}
                max={100}
                value={systemState.brightness}
                onChange={(e) => void updateSettings({ brightness: Number(e.target.value) })}
                className="w-full accent-[var(--gtems-accent)]"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => void updateSettings({ doNotDisturb: !systemState.doNotDisturb })}
                className={`flex-1 py-1.5 rounded-xl border font-medium ${
                  systemState.doNotDisturb ? 'bg-[var(--gtems-accent)] text-white border-transparent' : 'border-[var(--gtems-border)]'
                }`}
              >
                No molestar: {systemState.doNotDisturb ? 'Sí' : 'No'}
              </button>
              <button
                type="button"
                onClick={() => openApp('settings', 'Sistema', { initialCategory: 'sistema' })}
                className="px-3 py-1.5 rounded-xl border border-[var(--gtems-border)]"
              >
                Ajustes
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-52 overflow-y-auto aurora-scroll">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Notificaciones ({systemState.notifications.length})</span>
            </div>
            {systemState.notifications.slice(0, 6).map((n) => (
              <div key={n.id} className="p-2.5 rounded-xl border border-[var(--gtems-border)] bg-[var(--gtems-surface-solid)]/40">
                <div className="font-semibold text-[11px]">{n.title}</div>
                <div className="text-[11px] text-[var(--gtems-text-muted)]">{n.body}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calendar Popover */}
      {calendarOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={isLeftTaskbar ? { left: popoverLeftAnchor, bottom: 16 } : { right: 12, bottom: taskbarPosition === 'bottom' ? 56 : undefined, top: taskbarPosition === 'top' ? 56 : undefined }}
          className="fixed z-[8500] w-80 rounded-2xl aurora-glass shadow-2xl p-4 text-xs text-[var(--gtems-text)] space-y-3"
        >
          <div>
            <div className="font-mono text-2xl font-semibold tabular-nums">{timeStr}</div>
            <div className="text-xs capitalize text-[var(--gtems-text-muted)] mt-0.5">
              {formatLongDateInZone(now, lang, tz)}
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--gtems-border)]">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold capitalize">{calendarGrid.label}</span>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label="Mes anterior"
                  onClick={() => setCalendarMonthOffset((m) => m - 1)}
                  className="p-1 rounded-lg hover:bg-[var(--gtems-accent)]/15"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  aria-label="Mes siguiente"
                  onClick={() => setCalendarMonthOffset((m) => m + 1)}
                  className="p-1 rounded-lg hover:bg-[var(--gtems-accent)]/15"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[var(--gtems-text-muted)] mb-1">
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
              {calendarGrid.cells.map((cell, idx) => (
                <div
                  key={idx}
                  className={`py-1 rounded-lg tabular-nums ${
                    cell.isToday
                      ? 'bg-[var(--gtems-accent)] text-white font-bold'
                      : cell.day
                      ? 'hover:bg-[var(--gtems-accent)]/12'
                      : ''
                  }`}
                >
                  {cell.day || ''}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-[var(--gtems-border)] flex items-center justify-between text-[11px] text-[var(--gtems-text-muted)]">
            <span className="font-mono truncate">{tz}</span>
            <button
              type="button"
              onClick={() => openApp('settings', 'Hora e idioma', { initialCategory: 'hora' })}
              className="text-[var(--gtems-accent)] font-semibold hover:underline shrink-0"
            >
              Cambiar
            </button>
          </div>
        </div>
      )}

      {/* Permanent Left Vertical Taskbar (Default) or Top/Bottom Fallback */}
      {isLeftTaskbar ? (
        <aside
          data-testid="gtems-taskbar"
          aria-label="Barra lateral de tareas GTEMS OS"
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openContextMenu(e.clientX, e.clientY, [
              { id: 'tb-search', label: 'Buscador global (Ctrl+K)', onClick: () => setGlobalSearchOpen(true) },
              { id: 'tb-taskmgr', label: 'Administrador de tareas', onClick: () => openApp('task-manager') },
              { id: 'tb-settings', label: 'Configurar barra lateral', onClick: () => openApp('settings', 'Personalización', { initialCategory: 'personalizacion' }) },
            ]);
          }}
          style={{ width: leftSidebarWidth }}
          className="fixed top-0 bottom-0 left-0 z-[8000] border-r border-[var(--gtems-border)] aurora-glass py-2.5 px-1.5 flex flex-col justify-between items-center gap-2 text-[var(--gtems-text)]"
        >
          {/* Top: Start + Search */}
          <div className="w-full flex flex-col items-center gap-1.5 shrink-0">
            <button
              type="button"
              aria-label="Menú Inicio GTEMS OS"
              title="Inicio GTEMS OS"
              onClick={() => {
                setStartOpen((v) => !v);
                setControlOpen(false);
                setCalendarOpen(false);
                setTrayPopover(null);
                setGlobalSearchOpen(false);
              }}
              className={`h-10 rounded-xl bg-[var(--gtems-accent)]/18 hover:bg-[var(--gtems-accent)]/28 flex items-center gap-2 font-display font-semibold text-xs transition-colors ${
                isSidebarExpanded ? 'w-full px-2.5 justify-start' : 'w-11 justify-center'
              }`}
            >
              <GtemsLogo className="w-6 h-6 shrink-0" />
              {isSidebarExpanded && <span className="truncate">{t(lang, 'taskbar.start', 'Inicio')}</span>}
            </button>

            <button
              type="button"
              aria-label="Buscar en GTEMS OS"
              title="Buscar (Ctrl+K)"
              onClick={() => {
                setGlobalSearchOpen((v) => !v);
                setStartOpen(false);
                setControlOpen(false);
                setCalendarOpen(false);
                setTrayPopover(null);
              }}
              className={`h-9 rounded-xl border border-[var(--gtems-border)] hover:bg-[var(--gtems-accent)]/15 flex items-center gap-2 text-xs transition-colors ${
                isSidebarExpanded ? 'w-full px-2.5 justify-start' : 'w-11 justify-center'
              }`}
            >
              <Search className="w-4 h-4 shrink-0 text-[var(--gtems-accent)]" />
              {isSidebarExpanded && <span className="truncate text-[var(--gtems-text-muted)]">Buscar...</span>}
            </button>
          </div>

          {/* Middle: Pinned & Open Apps */}
          <div className="w-full flex-1 min-h-0 flex flex-col items-center gap-1 overflow-hidden py-1">
            {taskbarLayout.visibleItems.map((appId) => {
              const win = windows.find((w) => w.appId === appId);
              const isOpen = Boolean(win);
              const isFocused = Boolean(win && focusedWindowId === win.id && !win.minimized);
              const appName = t(lang, APP_CATALOG[appId].i18nKey, APP_CATALOG[appId].name);
              return (
                <button
                  key={appId}
                  type="button"
                  title={appName}
                  aria-label={appName}
                  onClick={() => {
                    if (!win) {
                      openApp(appId);
                    } else if (win.minimized) {
                      const nextZ = topZ + 1;
                      setTopZ(nextZ);
                      setFocusedWindowId(win.id);
                      setWindows((prev) => prev.map((w) => (w.id === win.id ? { ...w, minimized: false, zIndex: nextZ } : w)));
                    } else if (focusedWindowId === win.id) {
                      setWindows((prev) => prev.map((w) => (w.id === win.id ? { ...w, minimized: true } : w)));
                    } else {
                      const nextZ = topZ + 1;
                      setTopZ(nextZ);
                      setFocusedWindowId(win.id);
                      setWindows((prev) => prev.map((w) => (w.id === win.id ? { ...w, zIndex: nextZ } : w)));
                    }
                  }}
                  className={`relative h-10 rounded-xl flex items-center gap-2 text-xs font-medium transition-colors shrink-0 ${
                    isSidebarExpanded ? 'w-full px-2.5 justify-start' : 'w-11 justify-center'
                  } ${
                    isFocused
                      ? 'bg-[var(--gtems-accent)]/25'
                      : isOpen
                      ? 'bg-white/40 dark:bg-slate-800/60'
                      : 'hover:bg-white/35 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <GtemsAppIcon appId={appId} className="w-5 h-5 shrink-0" />
                  {isSidebarExpanded && <span className="truncate">{appName}</span>}
                  {isOpen && (
                    <span
                      aria-hidden="true"
                      className={`absolute left-0.5 top-1/2 -translate-y-1/2 w-1 rounded-full ${
                        isFocused ? 'h-5 bg-[var(--gtems-accent)]' : 'h-2.5 bg-[var(--gtems-accent-2)]'
                      }`}
                    />
                  )}
                </button>
              );
            })}

            {taskbarLayout.overflowItems.length > 0 && (
              <div className="relative w-full flex justify-center">
                <button
                  type="button"
                  aria-label="Más aplicaciones"
                  onClick={() => setOverflowOpen((v) => !v)}
                  className="h-9 w-11 rounded-xl hover:bg-[var(--gtems-accent)]/15 flex items-center justify-center"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {overflowOpen && (
                  <div
                    style={{ left: leftSidebarWidth + 6 }}
                    className="fixed bottom-40 w-52 rounded-2xl aurora-glass shadow-xl p-1.5 space-y-0.5 z-[8600]"
                  >
                    {taskbarLayout.overflowItems.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => openApp(id)}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-[var(--gtems-accent)]/15 text-xs text-left"
                      >
                        <GtemsAppIcon appId={id} className="w-4 h-4 shrink-0" />
                        <span className="truncate">{t(lang, APP_CATALOG[id].i18nKey, APP_CATALOG[id].name)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom: Vertical System Tray */}
          <div className="w-full flex flex-col items-center gap-1 pt-2 border-t border-[var(--gtems-border)] shrink-0">
            <div className={`grid gap-1 ${isSidebarExpanded ? 'grid-cols-3 w-full px-1' : 'grid-cols-2'}`}>
              <button
                type="button"
                aria-label="Red e Internet"
                title="Red e Internet"
                onClick={() => {
                  setTrayPopover((v) => (v === 'network' ? null : 'network'));
                  setControlOpen(false);
                  setCalendarOpen(false);
                  setStartOpen(false);
                }}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex justify-center"
              >
                <Wifi className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Bluetooth"
                title="Bluetooth"
                onClick={() => {
                  setTrayPopover((v) => (v === 'bluetooth' ? null : 'bluetooth'));
                  setControlOpen(false);
                  setCalendarOpen(false);
                  setStartOpen(false);
                }}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex justify-center"
              >
                <Bluetooth className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-label="Volumen y controles rápidos"
                title={systemState.muted ? 'Silenciado' : `Volumen ${systemState.volume}%`}
                onClick={() => {
                  setControlOpen((v) => !v);
                  setCalendarOpen(false);
                  setStartOpen(false);
                  setTrayPopover(null);
                }}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex justify-center"
              >
                {systemState.muted || systemState.volume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5 text-red-500" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                aria-label="Notificaciones"
                title={`Notificaciones (${systemState.notifications.length})`}
                onClick={() => {
                  setControlOpen((v) => !v);
                  setCalendarOpen(false);
                  setStartOpen(false);
                  setTrayPopover(null);
                }}
                className="relative p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex justify-center"
              >
                <Bell className="w-3.5 h-3.5" />
                {systemState.notifications.some((n) => !n.read) && (
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--gtems-accent)]" />
                )}
              </button>
              <button
                type="button"
                aria-label="Dispositivos conectados"
                title="Administrador de dispositivos"
                onClick={() => openApp('device-manager')}
                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 flex justify-center"
              >
                <Usb className="w-3.5 h-3.5" />
              </button>
              {(batteryInfo || hostBatteryPresent) && (
                <div
                  title={
                    batteryInfo
                      ? `Batería: ${batteryInfo.level}%${batteryInfo.charging ? ' (cargando)' : ''}`
                      : 'Batería del sistema detectada'
                  }
                  className={`${isSidebarExpanded ? 'col-span-1' : 'col-span-2'} py-1 px-1 rounded-lg flex items-center justify-center gap-1 text-[10px] font-mono`}
                >
                  {batteryInfo?.charging ? <BatteryCharging className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> : <Battery className="w-3.5 h-3.5 shrink-0" />}
                  {batteryInfo && <span>{batteryInfo.level}%</span>}
                </div>
              )}
            </div>

            <button
              type="button"
              aria-label="Reloj y calendario"
              onClick={() => {
                setCalendarOpen((v) => !v);
                setControlOpen(false);
                setStartOpen(false);
                setTrayPopover(null);
              }}
              className="w-full px-1 py-1.5 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 flex flex-col items-center text-center leading-tight"
            >
              <div className="font-mono text-xs font-semibold tabular-nums">{timeStr}</div>
              <div className="font-mono text-[9px] text-[var(--gtems-text-muted)] tabular-nums truncate max-w-full">
                {dateStr}
              </div>
            </button>
          </div>
        </aside>
      ) : (
        /* Top / Bottom fallback bar if user selects horizontal layout */
        <footer
          data-testid="gtems-taskbar"
          onClick={(e) => e.stopPropagation()}
          className={`fixed left-0 right-0 h-12 z-[8000] px-3 flex items-center justify-between gap-3 aurora-glass text-[var(--gtems-text)] ${
            taskbarPosition === 'top' ? 'top-0 border-b' : 'bottom-0 border-t'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <button
              type="button"
              aria-label="Menú Inicio GTEMS OS"
              onClick={() => {
                setStartOpen((v) => !v);
                setControlOpen(false);
                setCalendarOpen(false);
              }}
              className="h-9 px-3 rounded-xl bg-[var(--gtems-accent)]/15 hover:bg-[var(--gtems-accent)]/25 flex items-center gap-2 shrink-0 font-display font-semibold text-xs"
            >
              <GtemsLogo className="w-5 h-5" />
              <span>{t(lang, 'taskbar.start', 'Inicio')}</span>
            </button>
            <button
              type="button"
              aria-label="Buscar en GTEMS OS"
              onClick={() => setGlobalSearchOpen((v) => !v)}
              className="h-9 px-2.5 rounded-xl border border-[var(--gtems-border)] flex items-center gap-1.5 text-xs shrink-0"
            >
              <Search className="w-3.5 h-3.5 text-[var(--gtems-accent)]" />
              <span className="hidden sm:inline">Buscar</span>
            </button>
            <div className="flex items-center gap-1 min-w-0">
              {taskbarLayout.visibleItems.map((appId) => {
                const win = windows.find((w) => w.appId === appId);
                const isOpen = Boolean(win);
                const isFocused = Boolean(win && focusedWindowId === win.id && !win.minimized);
                return (
                  <button
                    key={appId}
                    type="button"
                    onClick={() => (win ? setWindows((prev) => prev.map((w) => (w.id === win.id ? { ...w, minimized: !w.minimized } : w))) : openApp(appId))}
                    className={`h-9 px-2.5 rounded-xl flex items-center gap-2 text-xs shrink-0 ${
                      isFocused ? 'bg-[var(--gtems-accent)]/25' : isOpen ? 'bg-white/40 dark:bg-slate-800/60' : 'hover:bg-white/30'
                    }`}
                  >
                    <GtemsAppIcon appId={appId} className="w-5 h-5 shrink-0" />
                    {!taskbarLayout.compactLabels && (
                      <span className="truncate max-w-[96px]">{t(lang, APP_CATALOG[appId].i18nKey, APP_CATALOG[appId].name)}</span>
                    )}
                  </button>
                );
              })}
              {taskbarLayout.overflowItems.length > 0 && (
                <button type="button" onClick={() => setOverflowOpen((v) => !v)} className="h-9 px-2 rounded-xl">
                  <ChevronUp className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button type="button" onClick={() => setTrayPopover('network')} className="p-1.5 rounded-lg"><Wifi className="w-4 h-4" /></button>
            <button type="button" onClick={() => setControlOpen((v) => !v)} className="p-1.5 rounded-lg"><Volume2 className="w-4 h-4" /></button>
            <button type="button" onClick={() => setCalendarOpen((v) => !v)} className="px-2 py-1 rounded-xl flex items-center gap-2 text-right">
              <CalendarIcon className="w-3.5 h-3.5 hidden sm:block" />
              <div className="leading-tight font-mono text-xs tabular-nums">
                <div>{timeStr}</div>
                <div className="text-[10px] text-[var(--gtems-text-muted)]">{dateStr}</div>
              </div>
            </button>
          </div>
        </footer>
      )}

      {/* Centralized Context Menu */}
      <ContextMenu menu={contextMenu} leftOffsetPx={leftSidebarWidth} onClose={() => setContextMenu(null)} />

      {/* Power Confirmation Modal (Reboot / Shutdown) */}
      {powerModal && (
        <div className="fixed inset-0 z-[10002] bg-black/50 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
          <div className="w-full max-w-md rounded-2xl aurora-glass shadow-2xl p-6 space-y-4 text-xs text-[var(--gtems-text)]">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              <h3 className="font-display font-bold text-base">
                {powerModal === 'shutdown' ? 'Confirmar apagado de GTEMS OS' : 'Confirmar reinicio del sistema'}
              </h3>
            </div>
            <p className="text-[var(--gtems-text-muted)] leading-relaxed">
              {powerModal === 'shutdown'
                ? 'Se cerrarán las aplicaciones de forma ordenada, se guardará el estado persistente y se apagará la sesión.'
                : 'Se reiniciará el sistema conservando usuarios, archivos y preferencias, volviendo a la pantalla de bloqueo.'}
            </p>
            {powerError && <p role="alert" className="text-red-600 font-medium">{powerError}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPowerModal(null);
                  setPowerError(null);
                }}
                className="px-4 py-2 rounded-xl border border-[var(--gtems-border)] font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void executePowerAction()}
                className={`px-4 py-2 rounded-xl text-white font-semibold ${
                  powerModal === 'shutdown' ? 'bg-red-600' : 'bg-[var(--gtems-accent)]'
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

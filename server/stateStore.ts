import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import type {
  AppId,
  BrowserBookmark,
  BrowserHistoryEntry,
  BrowserRegistryItem,
  DesktopPersonalization,
  DownloadItem,
  SearchHistoryItem,
  SystemNotification,
  TerminalHistoryEntry,
  UserProfile,
} from '../src/lib/types';
import { DEFAULT_PERSONALIZATION } from '../src/lib/gtemsIdentity';

export interface StoredUser extends UserProfile {
  passwordHash: string;
  salt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'SEC';
  action: string;
  detail: string;
}

export interface PersistedSystemState {
  installed: boolean;
  installDate: string | null;
  productId: string;
  deviceId: string;
  users: StoredUser[];
  personalization: DesktopPersonalization;
  pinnedApps: AppId[];
  startupApps: AppId[];
  recentFiles: string[];
  notifications: SystemNotification[];
  bookmarks: BrowserBookmark[];
  history: BrowserHistoryEntry[];
  downloads: DownloadItem[];
  terminalHistory: TerminalHistoryEntry[];
  searchHistory: SearchHistoryItem[];
  defaultBrowser: BrowserRegistryItem['id'];
  language: string;
  timezone: string;
  autoTimezone: boolean;
  region: string;
  keyboardLayout: string;
  doNotDisturb: boolean;
  volume: number;
  muted: boolean;
  brightness: number;
  powerMode: 'balanced' | 'performance' | 'saver';
  auditLogs: AuditLogEntry[];
}

export const DATA_DIR = path.resolve(process.cwd(), '.gtems-data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const SESSION_SECRET = process.env.GTEMS_SESSION_SECRET || crypto.randomBytes(32).toString('hex');

function computeStableDeviceId(): string {
  const machineIdPaths = ['/etc/machine-id', '/var/lib/dbus/machine-id'];
  for (const p of machineIdPaths) {
    if (fs.existsSync(p)) {
      const raw = fs.readFileSync(p, 'utf8').trim();
      if (raw) {
        return raw.slice(0, 8).toUpperCase() + '-' + raw.slice(8, 16).toUpperCase();
      }
    }
  }
  const hash = crypto.createHash('sha256').update(os.hostname() + os.arch()).digest('hex').toUpperCase();
  return `${hash.slice(0, 8)}-${hash.slice(8, 16)}`;
}

export function hashPassword(password: string, existingSalt?: string): { hash: string; salt: string } {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash: derived, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function createSessionToken(user: UserProfile): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: user.id,
      username: user.username,
      role: user.role,
      exp: Date.now() + 1000 * 60 * 60 * 12,
    })
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string): { sub: string; username: string; role: 'admin' | 'standard' } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return { sub: parsed.sub, username: parsed.username, role: parsed.role };
  } catch {
    return null;
  }
}

export function buildDefaultState(): PersistedSystemState {
  return {
    installed: false,
    installDate: null,
    productId: `GTEMS-AURORA-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    deviceId: computeStableDeviceId(),
    users: [],
    personalization: { ...DEFAULT_PERSONALIZATION },
    pinnedApps: ['explorer', 'browser', 'terminal', 'code-studio', 'settings', 'task-manager'],
    startupApps: [],
    recentFiles: ['/Documentos/Bienvenida_GTEMS_OS.md', '/Proyectos/hola.py', '/Documentos/Ejemplo.html'],
    notifications: [
      {
        id: 'notif-welcome',
        title: 'GTEMS OS 1.0 Aurora',
        body: 'Sistema operativo modular inicializado sobre kernel Linux.',
        category: 'system',
        timestamp: new Date().toISOString(),
        read: false,
      },
    ],
    bookmarks: [
      { id: 'bm-1', title: 'Google', url: 'https://www.google.com', createdAt: new Date().toISOString() },
      { id: 'bm-2', title: 'Debian Linux', url: 'https://www.debian.org', createdAt: new Date().toISOString() },
      { id: 'bm-3', title: 'Kernel.org', url: 'https://www.kernel.org', createdAt: new Date().toISOString() },
    ],
    history: [],
    downloads: [],
    terminalHistory: [],
    searchHistory: [],
    defaultBrowser: 'gtems-browser',
    language: 'es-HN',
    timezone: 'America/Tegucigalpa',
    autoTimezone: false,
    region: 'Honduras',
    keyboardLayout: 'es-LATAM',
    doNotDisturb: false,
    volume: 72,
    muted: false,
    brightness: 95,
    powerMode: 'balanced',
    auditLogs: [
      {
        id: 'log-boot',
        timestamp: new Date().toISOString(),
        level: 'INFO',
        action: 'SYSTEM_BOOT',
        detail: 'Servicios base de GTEMS OS iniciados correctamente.',
      },
    ],
  };
}

export function loadState(): PersistedSystemState {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(STATE_FILE)) {
    const initial = buildDefaultState();
    saveState(initial);
    return initial;
  }
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw) as PersistedSystemState;
    const def = buildDefaultState();
    const isLegacyPreZeyla = !parsed.personalization || !parsed.personalization.themeId;

    const mergedPinned = Array.isArray(parsed.pinnedApps) ? [...parsed.pinnedApps] : [...def.pinnedApps];
    if (isLegacyPreZeyla && !mergedPinned.includes('code-studio')) {
      const idx = mergedPinned.indexOf('terminal');
      mergedPinned.splice(idx >= 0 ? idx + 1 : mergedPinned.length, 0, 'code-studio');
    }

    const mergedPersonalization: DesktopPersonalization = {
      ...DEFAULT_PERSONALIZATION,
      ...(parsed.personalization || {}),
      customTheme: {
        ...DEFAULT_PERSONALIZATION.customTheme,
        ...(parsed.personalization?.customTheme || {}),
      },
    };

    if (isLegacyPreZeyla) {
      mergedPersonalization.themeId = 'zeyla-aurora';
      mergedPersonalization.taskbarPosition = 'left';
      if ((mergedPersonalization.cursorStyle as string) === 'aurora') {
        mergedPersonalization.cursorStyle = 'modern';
      }
    }

    return {
      ...def,
      ...parsed,
      personalization: mergedPersonalization,
      pinnedApps: mergedPinned,
      startupApps: Array.isArray(parsed.startupApps) ? parsed.startupApps : def.startupApps,
      terminalHistory: Array.isArray(parsed.terminalHistory) ? parsed.terminalHistory.slice(0, 20) : [],
      searchHistory: Array.isArray(parsed.searchHistory) ? parsed.searchHistory.slice(0, 30) : [],
    };
  } catch {
    const fallback = buildDefaultState();
    saveState(fallback);
    return fallback;
  }
}

export function saveState(state: PersistedSystemState): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

export function appendAuditLog(state: PersistedSystemState, level: 'INFO' | 'WARN' | 'SEC', action: string, detail: string): void {
  state.auditLogs.push({
    id: `log-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    timestamp: new Date().toISOString(),
    level,
    action,
    detail,
  });
  if (state.auditLogs.length > 200) {
    state.auditLogs = state.auditLogs.slice(-200);
  }
}

export function sanitizePublicUsers(users: StoredUser[]): UserProfile[] {
  return users.map(({ passwordHash: _ph, salt: _s, ...pub }) => pub);
}

export function buildPublicStateSummary(state: PersistedSystemState) {
  return {
    installed: state.installed,
    installDate: state.installDate,
    productId: state.productId,
    deviceId: state.deviceId,
    users: sanitizePublicUsers(state.users),
    personalization: state.personalization,
    pinnedApps: state.pinnedApps,
    startupApps: state.startupApps,
    recentFiles: state.recentFiles,
    notifications: state.notifications,
    bookmarks: state.bookmarks,
    history: state.history,
    downloads: state.downloads,
    terminalHistory: state.terminalHistory,
    searchHistory: state.searchHistory,
    defaultBrowser: state.defaultBrowser,
    language: state.language,
    timezone: state.timezone,
    autoTimezone: state.autoTimezone,
    region: state.region,
    keyboardLayout: state.keyboardLayout,
    doNotDisturb: state.doNotDisturb,
    volume: state.volume,
    muted: state.muted,
    brightness: state.brightness,
    powerMode: state.powerMode,
  };
}

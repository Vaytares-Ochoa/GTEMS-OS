export type AppId =
  | 'explorer'
  | 'terminal'
  | 'browser'
  | 'settings'
  | 'task-manager'
  | 'device-manager'
  | 'image-editor'
  | 'text-editor'
  | 'music-player'
  | 'video-player'
  | 'package-manager'
  | 'code-studio'
  | 'architecture';

export type ThemePresetId =
  | 'zeyla-aurora'
  | 'zeyla-neon'
  | 'zeyla-pastel'
  | 'zeyla-dream'
  | 'zeyla-midnight'
  | 'zeyla-crystal'
  | 'custom';

export type AnimationLevel = 'none' | 'soft' | 'normal' | 'fluid' | 'full';

export type CursorStyleId =
  | 'classic'
  | 'minimal'
  | 'modern'
  | 'circular'
  | 'luminous'
  | 'neon'
  | 'custom';

export type WallpaperFitMode = 'cover' | 'contain' | 'fill' | 'center';

export interface CustomThemeConfig {
  bg: string;
  surface: string;
  text: string;
  accent: string;
  border: string;
  isDark: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'standard';
  avatarUrl?: string;
  createdAt: string;
}

export interface DesktopPersonalization {
  theme: 'light' | 'dark';
  themeId: ThemePresetId;
  customTheme: CustomThemeConfig;
  wallpaper: string;
  wallpaperFit: WallpaperFitMode;
  lockWallpaper: string;
  lockWallpaperFit: WallpaperFitMode;
  accentColor: string;
  fontSize: 'small' | 'normal' | 'large';
  iconSize: 'small' | 'normal' | 'large';
  uiScale: number; // 0.9 | 1 | 1.1 | 1.15
  transparency: boolean;
  transparencyLevel: number; // 40 - 96
  animations: boolean;
  animationLevel: AnimationLevel;
  animationSpeed: number; // 0.5 | 1 | 1.5
  systemSounds: boolean;
  cursorStyle: CursorStyleId;
  cursorSize: 'small' | 'normal' | 'large';
  cursorColor: string;
  customCursorSvg?: string;
  taskbarPosition: 'left' | 'bottom' | 'top';
  taskbarWidthMode: 'compact' | 'normal' | 'expanded';
  borderRadius: 'sharp' | 'normal' | 'rounded';
  spacingDensity: 'compact' | 'comfortable' | 'relaxed';
  menuDensity: 'comfortable' | 'compact';
}

export interface SystemNotification {
  id: string;
  title: string;
  body: string;
  category: 'system' | 'download' | 'device' | 'security' | 'update' | 'app';
  timestamp: string;
  read: boolean;
}

export interface WindowInstance {
  id: string;
  appId: AppId;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  minimized: boolean;
  maximized: boolean;
  zIndex: number;
  payload?: {
    filePath?: string;
    initialCategory?: string;
    initialUrl?: string;
    initialQuery?: string;
  };
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  mtime: string;
  extension: string;
  mimeType: string;
  appId: AppId | 'archive' | 'incompatible-exe' | 'unsupported';
  trashInfo?: {
    originalPath: string;
    deletedAt: string;
    size: number;
  };
}

export interface DownloadItem {
  id: string;
  url: string;
  filename: string;
  savePath: string;
  status: 'downloading' | 'paused' | 'completed' | 'error' | 'cancelled';
  totalBytes: number;
  receivedBytes: number;
  speedBps: number;
  etaSeconds?: number | null;
  supportsRange?: boolean;
  sourceBrowser?: string;
  sha256?: string;
  error?: string;
  startedAt: string;
}

export interface BrowserBookmark {
  id: string;
  title: string;
  url: string;
  createdAt: string;
}

export interface BrowserHistoryEntry {
  id: string;
  title: string;
  url: string;
  visitedAt: string;
}

export interface TerminalHistoryEntry {
  id: string;
  command: string;
  executedAt: string;
  exitCode: number;
  cwd: string;
  redacted?: boolean;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  type: 'system' | 'web';
  timestamp: string;
}

export interface SearchResultItem {
  id: string;
  category:
    | 'app-installed'
    | 'app-available'
    | 'file'
    | 'folder'
    | 'document'
    | 'image'
    | 'video'
    | 'music'
    | 'download'
    | 'setting'
    | 'device'
    | 'process'
    | 'tool'
    | 'web';
  title: string;
  subtitle: string;
  matchReason?: string;
  actionType: 'open-app' | 'open-file' | 'open-setting' | 'open-web' | 'focus-process';
  appId?: AppId;
  filePath?: string;
  settingCategory?: string;
  url?: string;
  score: number;
}

export interface BrowserRegistryItem {
  id: 'gtems-browser' | 'chrome' | 'firefox' | 'edge' | 'opera' | 'safari';
  name: string;
  installed: boolean;
  supportedOnLinux: boolean;
  executablePath: string | null;
  version: string | null;
  profilesSupported: boolean;
  statusNote: string;
  isDefault: boolean;
}

export interface CodeRuntimeInfo {
  language: 'python' | 'javascript' | 'typescript' | 'cpp' | 'c' | 'java' | 'csharp' | 'sql' | 'bash';
  label: string;
  toolName: string;
  installed: boolean;
  binaryPath: string | null;
  version: string | null;
  aptPackage: string;
  note: string;
}

export interface SystemStateSummary {
  installed: boolean;
  installDate: string | null;
  productId: string;
  deviceId: string;
  users: UserProfile[];
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
}

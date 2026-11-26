import type { AppId, DesktopPersonalization } from './types';

export const GTEMS_IDENTITY = {
  name: 'GTEMS OS',
  slogan: 'Diseñado por cinco mentes, construido para el futuro.',
  officialDescription:
    'GTEMS OS es un sistema operativo basado en Linux, diseñado para ofrecer un entorno de escritorio moderno, personalizable y funcional. Integra herramientas de productividad, navegación, programación, administración de archivos y dispositivos, conectividad y configuración del sistema en una plataforma preparada para evolucionar.',
  version: '1.0 Aurora',
  build: '2026.11.25-x86_64-LTS',
  codename: 'Aurora',
  developers: [
    'GLENDA SAMAHI ARDON ZELAYA',
    'TATIANA VAYTARES OCHOA AGUILAR',
    'CARLOS ROBERTO SUAZO',
    'EDER JOSUE CABRERA RAMOS',
    'MAYLON ASAEL SÁNCHEZ SOSA',
  ] as const,
} as const;

export const AURORA_PALETTE = [
  { name: 'Aurora White', hex: '#F5FCFA' },
  { name: 'Mint Frost', hex: '#DDF5EC' },
  { name: 'Soft Mint', hex: '#BCEBDD' },
  { name: 'Aurora Turquoise', hex: '#79D9CE' },
  { name: 'Ice Blue', hex: '#CDEBFA' },
  { name: 'Sky Blue', hex: '#A8D5EF' },
  { name: 'Deep Teal', hex: '#398F91' },
  { name: 'Aurora Blue', hex: '#75B8DD' },
  { name: 'Neon Cyan', hex: '#00D4FF' },
  { name: 'Neon Fuchsia', hex: '#FF2E93' },
  { name: 'Dream Violet', hex: '#7C3AED' },
  { name: 'Pastel Rose', hex: '#D96CA8' },
] as const;

export const WALLPAPER_PRESETS = [
  {
    id: 'aurora-day',
    name: 'Aurora Luminosa',
    url: '/src/assets/images/gtems_aurora_wallpaper_1795655915565.jpg',
  },
  {
    id: 'aurora-glass',
    name: 'Cristal Menta',
    url: '/src/assets/images/gtems_aurora_lockscreen_1795655916431.jpg',
  },
  {
    id: 'aurora-night',
    name: 'Aurora Boreal Nocturna',
    url: '/src/assets/images/gtems_aurora_night_1795655917663.jpg',
  },
] as const;

export const DEFAULT_PERSONALIZATION: DesktopPersonalization = {
  theme: 'light',
  themeId: 'zeyla-aurora',
  customTheme: {
    bg: '#F5FCFA',
    surface: '#FFFFFF',
    text: '#0F272B',
    accent: '#398F91',
    border: 'rgba(57, 143, 145, 0.22)',
    isDark: false,
  },
  wallpaper: WALLPAPER_PRESETS[0].url,
  wallpaperFit: 'cover',
  lockWallpaper: WALLPAPER_PRESETS[1].url,
  lockWallpaperFit: 'cover',
  accentColor: '#398F91',
  fontSize: 'normal',
  iconSize: 'normal',
  uiScale: 1,
  transparency: true,
  transparencyLevel: 82,
  animations: true,
  animationLevel: 'normal',
  animationSpeed: 1,
  systemSounds: true,
  cursorStyle: 'modern',
  cursorSize: 'normal',
  cursorColor: '#398F91',
  taskbarPosition: 'left',
  taskbarWidthMode: 'normal',
  borderRadius: 'normal',
  spacingDensity: 'comfortable',
  menuDensity: 'comfortable',
};

export interface SettingsCategoryDef {
  id: string;
  label: string;
  i18nKey: string;
  keywords: string[];
}

export const SETTINGS_CATEGORIES: SettingsCategoryDef[] = [
  { id: 'inicio', label: 'Inicio', i18nKey: 'settings.inicio', keywords: ['inicio', 'resumen', 'estado', 'rápido'] },
  { id: 'sistema', label: 'Sistema', i18nKey: 'settings.sistema', keywords: ['pantalla', 'sonido', 'volumen', 'brillo', 'energía', 'batería', 'almacenamiento', 'notificaciones', 'actualizaciones', 'ram', 'procesador', 'recuperación', 'reinstalar', 'restablecer', 'iso', 'descargar', 'imagen', 'sha256'] },
  { id: 'bluetooth', label: 'Bluetooth y dispositivos', i18nKey: 'settings.bluetooth', keywords: ['bluetooth', 'usb', 'ratón', 'teclado', 'cámara', 'impresora', 'audio', 'auriculares', 'dispositivos'] },
  { id: 'red', label: 'Red e Internet', i18nKey: 'settings.red', keywords: ['wifi', 'wi-fi', 'ethernet', 'red', 'internet', 'dns', 'ip', 'diagnóstico'] },
  { id: 'personalizacion', label: 'Personalización', i18nKey: 'settings.personalizacion', keywords: ['fondo', 'fondo de pantalla', 'bloqueo', 'tema', 'zeyla', 'neon', 'pastel', 'aurora', 'dream', 'midnight', 'crystal', 'colores', 'letra', 'iconos', 'escala', 'barra de tareas', 'transparencia', 'cursor', 'animaciones'] },
  { id: 'aplicaciones', label: 'Aplicaciones', i18nKey: 'settings.aplicaciones', keywords: ['aplicaciones', 'paquetes', 'predeterminadas', 'chrome', 'firefox', 'edge', 'opera', 'navegador', 'desinstalar', 'inicio'] },
  { id: 'cuentas', label: 'Cuentas', i18nKey: 'settings.cuentas', keywords: ['cuentas', 'usuario', 'contraseña', 'perfil', 'seguridad', 'sesión', 'permisos'] },
  { id: 'hora', label: 'Hora e idioma', i18nKey: 'settings.hora', keywords: ['hora', 'fecha', 'zona horaria', 'iana', 'idioma', 'región', 'teclado', 'rtl'] },
  { id: 'juegos', label: 'Juegos', i18nKey: 'settings.juegos', keywords: ['juegos', 'mandos', 'rendimiento', 'fps'] },
  { id: 'acerca', label: 'Acerca de', i18nKey: 'settings.acerca', keywords: ['acerca', 'hardware', 'procesador', 'ram', 'tarjeta gráfica', 'desarrolladores', 'versión', 'identificador'] },
];

export interface AppCatalogEntry {
  id: AppId;
  name: string;
  i18nKey: string;
  description: string;
  defaultWidth: number;
  defaultHeight: number;
  pinnedByDefault: boolean;
  essential: boolean;
  essentialReason?: string;
  preinstalled: boolean;
  category: 'Sistema' | 'Productividad' | 'Desarrollo' | 'Multimedia' | 'Internet';
  permissions: string[];
  estimatedStorageMb: number;
}

export const APP_CATALOG: Record<AppId, AppCatalogEntry> = {
  explorer: {
    id: 'explorer',
    name: 'GTEMS Explorer',
    i18nKey: 'app.explorer',
    description: 'Explorador de archivos y unidades',
    defaultWidth: 940,
    defaultHeight: 580,
    pinnedByDefault: true,
    essential: true,
    essentialReason: 'Componente esencial para navegar, copiar y administrar el sistema de archivos .gtems-fs y /Sistema.',
    preinstalled: true,
    category: 'Sistema',
    permissions: ['Lectura/escritura .gtems-fs', 'Lectura /Sistema', 'Compresión ZIP'],
    estimatedStorageMb: 18,
  },
  browser: {
    id: 'browser',
    name: 'Navegador Web',
    i18nKey: 'app.browser',
    description: 'Navegador web multi-motor y gestor de descargas',
    defaultWidth: 980,
    defaultHeight: 620,
    pinnedByDefault: true,
    essential: false,
    preinstalled: true,
    category: 'Internet',
    permissions: ['Red HTTP/HTTPS', 'Almacenamiento en /Descargas', 'Historial y marcadores'],
    estimatedStorageMb: 42,
  },
  terminal: {
    id: 'terminal',
    name: 'Terminal',
    i18nKey: 'app.terminal',
    description: 'Consola Bash real y gtemsctl',
    defaultWidth: 860,
    defaultHeight: 540,
    pinnedByDefault: true,
    essential: true,
    essentialReason: 'Consola del sistema indispensable para administración, diagnóstico y recuperación mediante Bash y gtemsctl.',
    preinstalled: true,
    category: 'Sistema',
    permissions: ['Ejecución /bin/bash', 'Acceso a gtemsctl', 'Historial persistente cifrado'],
    estimatedStorageMb: 12,
  },
  'code-studio': {
    id: 'code-studio',
    name: 'GTEMS Code Studio',
    i18nKey: 'app.codeStudio',
    description: 'IDE real con ejecución de Python, JS/TS, C/C++, SQL y más',
    defaultWidth: 1020,
    defaultHeight: 640,
    pinnedByDefault: true,
    essential: false,
    preinstalled: true,
    category: 'Desarrollo',
    permissions: ['Lectura/escritura /Proyectos', 'Ejecución aislada de compiladores/intérpretes'],
    estimatedStorageMb: 34,
  },
  settings: {
    id: 'settings',
    name: 'Configuración',
    i18nKey: 'app.settings',
    description: 'Ajustes del sistema, personalización, red, idioma y recuperación',
    defaultWidth: 980,
    defaultHeight: 640,
    pinnedByDefault: true,
    essential: true,
    essentialReason: 'Panel central de configuración, seguridad, cuentas y recuperación del sistema operativo.',
    preinstalled: true,
    category: 'Sistema',
    permissions: ['Preferencias persistentes', 'Cuentas y contraseñas', 'Energía y recuperación'],
    estimatedStorageMb: 16,
  },
  'task-manager': {
    id: 'task-manager',
    name: 'Administrador de tareas',
    i18nKey: 'app.taskManager',
    description: 'Procesos reales, CPU y memoria',
    defaultWidth: 820,
    defaultHeight: 540,
    pinnedByDefault: true,
    essential: true,
    essentialReason: 'Monitor de procesos y supervisor necesario para finalizar tareas bloqueadas y vigilar memoria.',
    preinstalled: true,
    category: 'Sistema',
    permissions: ['Lectura /proc y ps', 'Señales SIGTERM a procesos de usuario'],
    estimatedStorageMb: 9,
  },
  'device-manager': {
    id: 'device-manager',
    name: 'Administrador de dispositivos',
    i18nKey: 'app.deviceManager',
    description: 'Hardware, USB, audio, red y almacenamiento',
    defaultWidth: 780,
    defaultHeight: 520,
    pinnedByDefault: false,
    essential: true,
    essentialReason: 'Inspector de controladores sysfs/udev y dispositivos de hardware reales.',
    preinstalled: true,
    category: 'Sistema',
    permissions: ['Lectura /sys y lsblk'],
    estimatedStorageMb: 8,
  },
  'image-editor': {
    id: 'image-editor',
    name: 'Visor y Editor de Imágenes',
    i18nKey: 'app.imageEditor',
    description: 'Visualización y edición real de imágenes',
    defaultWidth: 860,
    defaultHeight: 580,
    pinnedByDefault: false,
    essential: false,
    preinstalled: true,
    category: 'Multimedia',
    permissions: ['Lectura/escritura de imágenes en .gtems-fs'],
    estimatedStorageMb: 14,
  },
  'text-editor': {
    id: 'text-editor',
    name: 'Editor de Texto',
    i18nKey: 'app.textEditor',
    description: 'Edición de texto, notas y Markdown',
    defaultWidth: 780,
    defaultHeight: 520,
    pinnedByDefault: false,
    essential: false,
    preinstalled: true,
    category: 'Productividad',
    permissions: ['Lectura/escritura de documentos de texto'],
    estimatedStorageMb: 10,
  },
  'music-player': {
    id: 'music-player',
    name: 'Reproductor de Música',
    i18nKey: 'app.musicPlayer',
    description: 'Reproducción de audio y listas',
    defaultWidth: 640,
    defaultHeight: 460,
    pinnedByDefault: false,
    essential: false,
    preinstalled: true,
    category: 'Multimedia',
    permissions: ['Salida de audio', 'Lectura /Música'],
    estimatedStorageMb: 11,
  },
  'video-player': {
    id: 'video-player',
    name: 'Reproductor de Vídeo',
    i18nKey: 'app.videoPlayer',
    description: 'Reproducción de vídeo compatible',
    defaultWidth: 800,
    defaultHeight: 520,
    pinnedByDefault: false,
    essential: false,
    preinstalled: true,
    category: 'Multimedia',
    permissions: ['Reproducción multimedia', 'Lectura /Vídeos'],
    estimatedStorageMb: 13,
  },
  'package-manager': {
    id: 'package-manager',
    name: 'Gestor de Aplicaciones y Actualizaciones',
    i18nKey: 'app.packageManager',
    description: 'Paquetes Debian/APT y actualizaciones GTEMS',
    defaultWidth: 860,
    defaultHeight: 560,
    pinnedByDefault: false,
    essential: true,
    essentialReason: 'Mantiene la integridad de paquetes Debian/dpkg y dependencias de compiladores.',
    preinstalled: true,
    category: 'Sistema',
    permissions: ['Consulta dpkg-query', 'Auditoría APT'],
    estimatedStorageMb: 15,
  },
  architecture: {
    id: 'architecture',
    name: 'Arquitectura GTEMS OS',
    i18nKey: 'app.architecture',
    description: 'Kernel, arranque, instalador y documentación',
    defaultWidth: 880,
    defaultHeight: 580,
    pinnedByDefault: false,
    essential: false,
    preinstalled: true,
    category: 'Sistema',
    permissions: ['Lectura /Sistema'],
    estimatedStorageMb: 7,
  },
};

export interface MimeRegistration {
  mimeType: string;
  appId: AppId | 'archive' | 'incompatible-exe' | 'unsupported';
  category: string;
  note?: string;
}

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tif', 'tiff', 'ico', 'heic', 'avif', 'raw'];
const AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus', 'mid', 'midi'];
const VIDEO_EXTS = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'webm', 'mpeg', 'mpg', 'm4v', '3gp', 'ts'];
const ARCHIVE_EXTS = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'zst', 'tgz', 'iso'];
const PKG_EXTS = ['deb', 'rpm', 'appimage', 'flatpak', 'snap'];
const CODE_STUDIO_EXTS = ['py', 'js', 'jsx', 'ts', 'tsx', 'c', 'cpp', 'h', 'java', 'cs', 'sql', 'sh', 'go', 'rs', 'php'];
const TEXT_EXTS = [
  'txt', 'rtf', 'md', 'csv', 'css', 'json', 'xml', 'yaml', 'yml',
  'bat', 'ps1', 'log', 'ics', 'vcf', 'pem', 'crt', 'key', 'cer', 'config', 'conf', 'rules', 'service', 'cfg',
];
const HTML_EXTS = ['html', 'htm'];
const DOC_EXTS = ['doc', 'docx', 'odt', 'pdf', 'xls', 'xlsx', 'ods', 'ppt', 'pptx', 'odp', 'epub'];
const EXE_EXTS = ['exe', 'msi', 'dll'];
const BIN_EXTS = ['so', 'bin', 'elf', 'app', 'jar', 'class', 'wasm'];
const DESIGN_FONT_EXTS = ['ttf', 'otf', 'woff', 'woff2', 'psd', 'ai', 'eps', 'xcf', 'blend', 'obj', 'stl', 'fbx'];
const DATA_EXTS = ['db', 'sqlite', 'sqlite3', 'bak', 'dat', 'torrent', 'p12', 'pfx'];

export function resolveFileExtension(filename: string): MimeRegistration {
  const dotIdx = filename.lastIndexOf('.');
  const ext = dotIdx >= 0 ? filename.slice(dotIdx + 1).toLowerCase() : '';

  if (HTML_EXTS.includes(ext)) {
    return { mimeType: 'text/html', appId: 'browser', category: 'Web / HTML' };
  }
  if (IMAGE_EXTS.includes(ext)) {
    return { mimeType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, appId: 'image-editor', category: 'Imagen' };
  }
  if (AUDIO_EXTS.includes(ext)) {
    return { mimeType: `audio/${ext}`, appId: 'music-player', category: 'Audio' };
  }
  if (VIDEO_EXTS.includes(ext)) {
    return { mimeType: `video/${ext}`, appId: 'video-player', category: 'Vídeo' };
  }
  if (ARCHIVE_EXTS.includes(ext)) {
    return { mimeType: `application/x-${ext}`, appId: 'archive', category: 'Comprimido' };
  }
  if (PKG_EXTS.includes(ext)) {
    return {
      mimeType: `application/x-${ext}`,
      appId: 'package-manager',
      category: 'Paquete',
      note: ext === 'deb' ? 'Paquete nativo Debian/GTEMS OS' : 'Formato externo: requiere herramienta oficial correspondiente',
    };
  }
  if (CODE_STUDIO_EXTS.includes(ext)) {
    return { mimeType: 'text/plain', appId: 'code-studio', category: 'Código fuente' };
  }
  if (TEXT_EXTS.includes(ext) || !ext) {
    return { mimeType: 'text/plain', appId: 'text-editor', category: 'Texto / Configuración' };
  }
  if (DOC_EXTS.includes(ext)) {
    return {
      mimeType: `application/${ext}`,
      appId: 'text-editor',
      category: 'Documento',
      note: ext === 'pdf' ? 'Requiere visor PDF compatible o navegador' : 'Documento ofimático',
    };
  }
  if (EXE_EXTS.includes(ext)) {
    return {
      mimeType: 'application/x-msdownload',
      appId: 'incompatible-exe',
      category: 'Ejecutable Windows',
      note: 'No es compatible de forma nativa en Linux. Requiere Wine o máquina virtual.',
    };
  }
  if (BIN_EXTS.includes(ext) || DESIGN_FONT_EXTS.includes(ext) || DATA_EXTS.includes(ext)) {
    return {
      mimeType: 'application/octet-stream',
      appId: 'unsupported',
      category: 'Binario / Datos / Diseño',
      note: 'Requiere aplicación especializada instalada en el sistema.',
    };
  }
  return { mimeType: 'application/octet-stream', appId: 'text-editor', category: 'Archivo' };
}

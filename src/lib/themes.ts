import type {
  AnimationLevel,
  CursorStyleId,
  DesktopPersonalization,
  ThemePresetId,
} from './types';

export interface ThemePresetDefinition {
  id: ThemePresetId;
  name: string;
  subtitle: string;
  isDark: boolean;
  bg: string;
  surface: string;
  surfaceSolid: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accent2: string;
  glow: string;
  swatch: [string, string, string];
}

export const THEME_PRESETS: Record<Exclude<ThemePresetId, 'custom'>, ThemePresetDefinition> = {
  'zeyla-aurora': {
    id: 'zeyla-aurora',
    name: 'ZEYLA AURORA',
    subtitle: 'Menta, turquesa, azul suave y cristal esmerilado',
    isDark: false,
    bg: '#F5FCFA',
    surface: 'rgba(245, 252, 250, 0.78)',
    surfaceSolid: '#FFFFFF',
    border: 'rgba(57, 143, 145, 0.22)',
    text: '#0F272B',
    textMuted: '#4A6B70',
    accent: '#398F91',
    accent2: '#79D9CE',
    glow: '0 8px 28px rgba(57, 143, 145, 0.16)',
    swatch: ['#79D9CE', '#398F91', '#CDEBFA'],
  },
  'zeyla-neon': {
    id: 'zeyla-neon',
    name: 'ZEYLA NEON',
    subtitle: 'Azul eléctrico, fucsia, violeta y bordes luminosos',
    isDark: true,
    bg: '#060814',
    surface: 'rgba(13, 16, 36, 0.84)',
    surfaceSolid: '#0D1024',
    border: 'rgba(0, 212, 255, 0.42)',
    text: '#F0F9FF',
    textMuted: '#A5B4FC',
    accent: '#00D4FF',
    accent2: '#FF2E93',
    glow: '0 0 22px rgba(0, 212, 255, 0.34), 0 0 12px rgba(255, 46, 147, 0.22)',
    swatch: ['#00D4FF', '#FF2E93', '#9D4EDD'],
  },
  'zeyla-pastel': {
    id: 'zeyla-pastel',
    name: 'ZEYLA PASTEL',
    subtitle: 'Rosa suave, lila, celeste y verde claro delicado',
    isDark: false,
    bg: '#FFF8FB',
    surface: 'rgba(255, 246, 252, 0.82)',
    surfaceSolid: '#FFFFFF',
    border: 'rgba(216, 132, 184, 0.28)',
    text: '#38253E',
    textMuted: '#785B80',
    accent: '#D96CA8',
    accent2: '#A78BFA',
    glow: '0 8px 24px rgba(217, 108, 168, 0.14)',
    swatch: ['#F7B2D9', '#D8C7FF', '#BAE6FD'],
  },
  'zeyla-dream': {
    id: 'zeyla-dream',
    name: 'ZEYLA DREAM',
    subtitle: 'Lavanda suave, rosa, azul creativo y brisa ligera',
    isDark: false,
    bg: '#F7F5FF',
    surface: 'rgba(246, 242, 255, 0.80)',
    surfaceSolid: '#FCFaff',
    border: 'rgba(139, 92, 246, 0.22)',
    text: '#231942',
    textMuted: '#5E548E',
    accent: '#7C3AED',
    accent2: '#FB7185',
    glow: '0 8px 28px rgba(124, 58, 237, 0.15)',
    swatch: ['#C4B5FD', '#FDA4AF', '#93C5FD'],
  },
  'zeyla-midnight': {
    id: 'zeyla-midnight',
    name: 'ZEYLA MIDNIGHT',
    subtitle: 'Fondos oscuros, azul profundo, violeta e iluminación ambiental',
    isDark: true,
    bg: '#050914',
    surface: 'rgba(11, 18, 38, 0.86)',
    surfaceSolid: '#0B1226',
    border: 'rgba(99, 102, 241, 0.28)',
    text: '#EEF2FF',
    textMuted: '#94A3B8',
    accent: '#6366F1',
    accent2: '#38BDF8',
    glow: '0 10px 30px rgba(79, 70, 229, 0.28)',
    swatch: ['#0F172A', '#3B82F6', '#7C3AED'],
  },
  'zeyla-crystal': {
    id: 'zeyla-crystal',
    name: 'ZEYLA CRYSTAL',
    subtitle: 'Blanco perlado, cristal, lila y reflejos brillantes',
    isDark: false,
    bg: '#F8FAFC',
    surface: 'rgba(255, 255, 255, 0.72)',
    surfaceSolid: '#FFFFFF',
    border: 'rgba(148, 163, 184, 0.34)',
    text: '#0F172A',
    textMuted: '#475569',
    accent: '#8B5CF6',
    accent2: '#E2E8F0',
    glow: '0 8px 32px rgba(139, 92, 246, 0.14), inset 0 1px 0 rgba(255,255,255,0.9)',
    swatch: ['#FFFFFF', '#DDD6FE', '#CBD5E1'],
  },
};

export const ANIMATION_PRESETS: Array<{ id: AnimationLevel; label: string; durationMs: number }> = [
  { id: 'none', label: 'Sin animaciones', durationMs: 0 },
  { id: 'soft', label: 'Suaves', durationMs: 120 },
  { id: 'normal', label: 'Normales', durationMs: 180 },
  { id: 'fluid', label: 'Fluidas', durationMs: 260 },
  { id: 'full', label: 'Completas', durationMs: 360 },
];

export const CURSOR_STYLES: Array<{ id: CursorStyleId; label: string; description: string }> = [
  { id: 'classic', label: 'Clásico', description: 'Flecha de sistema limpia' },
  { id: 'minimal', label: 'Minimalista', description: 'Puntero geométrico estilizado' },
  { id: 'modern', label: 'Moderno', description: 'Puntero angular GTEMS Aurora' },
  { id: 'circular', label: 'Circular', description: 'Anillo preciso con punto central' },
  { id: 'luminous', label: 'Luminoso', description: 'Halo suave de alto contraste' },
  { id: 'neon', label: 'Neón', description: 'Contorno brillante cibernético' },
  { id: 'custom', label: 'Personalizado', description: 'Color y SVG personalizable' },
];

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(245, 252, 250, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function buildCursorSvgDataUri(
  style: CursorStyleId,
  size: 'small' | 'normal' | 'large',
  color: string,
  state: 'default' | 'pointer' | 'text' | 'wait' = 'default',
  customSvg?: string
): string {
  const px = size === 'large' ? 32 : size === 'small' ? 20 : 26;
  const fill = color || '#398F91';
  const stroke = style === 'neon' ? '#FF2E93' : '#FFFFFF';

  if (style === 'custom' && customSvg && customSvg.includes('<svg') && !customSvg.includes('<script')) {
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(customSvg)}") 4 4, auto`;
  }

  let body = '';
  if (state === 'text') {
    body = `<path d="M${px / 2} 3V${px - 3}M${px / 2 - 4} 3H${px / 2 + 4}M${px / 2 - 4} ${px - 3}H${px / 2 + 4}" stroke="${fill}" stroke-width="2.2" stroke-linecap="round"/>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${px}' height='${px}' viewBox='0 0 ${px} ${px}'>${body}</svg>`)}") ${Math.round(px / 2)} ${Math.round(px / 2)}, text`;
  }

  if (state === 'wait') {
    body = `<circle cx="${px / 2}" cy="${px / 2}" r="${px / 3}" fill="none" stroke="${fill}" stroke-width="2.5" stroke-dasharray="14 6"/>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${px}' height='${px}' viewBox='0 0 ${px} ${px}'>${body}</svg>`)}") ${Math.round(px / 2)} ${Math.round(px / 2)}, wait`;
  }

  if (style === 'circular') {
    body = `<circle cx="13" cy="13" r="8" fill="${fill}" fill-opacity="0.22" stroke="${fill}" stroke-width="2"/><circle cx="13" cy="13" r="2.2" fill="${fill}"/>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 26 26">${body}</svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") ${Math.round(px / 2)} ${Math.round(px / 2)}, ${state === 'pointer' ? 'pointer' : 'auto'}`;
  }

  if (style === 'luminous' || style === 'neon') {
    const glowColor = style === 'neon' ? '#FF2E93' : fill;
    body = `<path d="M4 3L20 12L12.5 14.5L10 22L4 3Z" fill="${fill}" stroke="${glowColor}" stroke-width="2" stroke-linejoin="round"/>`;
  } else if (style === 'minimal') {
    body = `<path d="M4 3L19 10L11.5 12.5L9 20L4 3Z" fill="${fill}" stroke="#FFFFFF" stroke-width="1.4" stroke-linejoin="round"/>`;
  } else if (style === 'modern') {
    body = `<path d="M3 2L20 11L12.5 13.5L16.5 21L13.5 22.5L9.5 15L4 19.5V2Z" fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round"/>`;
  } else {
    // classic
    body = `<path d="M4 2L17 15H11.5L14.5 21.5L12 22.5L9 16L4 20V2Z" fill="#111827" stroke="#FFFFFF" stroke-width="1.5" stroke-linejoin="round"/>`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 26 26">${body}</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}") 3 2, ${state === 'pointer' ? 'pointer' : 'auto'}`;
}

export function applyThemeAndPreferencesToDom(p: DesktopPersonalization): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  const preset = p.themeId && p.themeId !== 'custom' ? THEME_PRESETS[p.themeId] : null;
  const isDark =
    p.themeId === 'custom'
      ? Boolean(p.customTheme?.isDark)
      : preset
      ? preset.isDark
      : p.theme === 'dark';

  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  const alpha = Math.max(0.45, Math.min(0.98, (p.transparency ? (p.transparencyLevel ?? 80) : 98) / 100));

  if (p.themeId === 'custom' && p.customTheme) {
    root.style.setProperty('--gtems-bg', p.customTheme.bg);
    root.style.setProperty('--gtems-surface', hexToRgba(p.customTheme.surface, alpha));
    root.style.setProperty('--gtems-surface-solid', p.customTheme.surface);
    root.style.setProperty('--gtems-border', p.customTheme.border);
    root.style.setProperty('--gtems-text', p.customTheme.text);
    root.style.setProperty('--gtems-text-muted', isDark ? '#94A3B8' : '#475569');
    root.style.setProperty('--gtems-accent', p.customTheme.accent || p.accentColor);
    root.style.setProperty('--gtems-accent-2', p.accentColor);
    root.style.setProperty('--gtems-glow', `0 8px 24px ${hexToRgba(p.customTheme.accent || '#398F91', 0.25)}`);
  } else if (preset) {
    // Allow dark/light override when user explicitly toggled Aurora Claro / Oscuro on aurora preset
    const overrideDarkAurora = p.themeId === 'zeyla-aurora' && p.theme === 'dark';
    root.style.setProperty('--gtems-bg', overrideDarkAurora ? '#0B161E' : preset.bg);
    root.style.setProperty(
      '--gtems-surface',
      overrideDarkAurora ? `rgba(15, 34, 42, ${alpha})` : preset.surface
    );
    root.style.setProperty('--gtems-surface-solid', overrideDarkAurora ? '#11242D' : preset.surfaceSolid);
    root.style.setProperty('--gtems-border', overrideDarkAurora ? 'rgba(121, 217, 206, 0.22)' : preset.border);
    root.style.setProperty('--gtems-text', overrideDarkAurora ? '#ECF9F7' : preset.text);
    root.style.setProperty('--gtems-text-muted', overrideDarkAurora ? '#9AC4C2' : preset.textMuted);
    root.style.setProperty('--gtems-accent', p.accentColor || preset.accent);
    root.style.setProperty('--gtems-accent-2', preset.accent2);
    root.style.setProperty('--gtems-glow', preset.glow);
  }

  const fontPx = p.fontSize === 'large' ? '17px' : p.fontSize === 'small' ? '14px' : '15px';
  root.style.fontSize = fontPx;

  const radiusPx = p.borderRadius === 'sharp' ? '6px' : p.borderRadius === 'rounded' ? '22px' : '14px';
  root.style.setProperty('--gtems-radius', radiusPx);

  const animDef = ANIMATION_PRESETS.find((a) => a.id === p.animationLevel) || ANIMATION_PRESETS[2];
  const animMs = !p.animations || p.animationLevel === 'none' ? 0 : Math.round(animDef.durationMs / Math.max(0.4, p.animationSpeed || 1));
  root.style.setProperty('--gtems-anim-ms', `${animMs}ms`);
  root.dataset.animLevel = p.animations ? p.animationLevel : 'none';
  root.dataset.themeId = p.themeId || 'zeyla-aurora';

  // Apply real custom SVG cursor variables across interactive states
  const curStyle = p.cursorStyle || 'modern';
  const curSize = p.cursorSize || 'normal';
  const curColor = p.cursorColor || p.accentColor || '#398F91';
  root.style.setProperty('--gtems-cursor-default', buildCursorSvgDataUri(curStyle, curSize, curColor, 'default', p.customCursorSvg));
  root.style.setProperty('--gtems-cursor-pointer', buildCursorSvgDataUri(curStyle, curSize, curColor, 'pointer', p.customCursorSvg));
  root.style.setProperty('--gtems-cursor-text', buildCursorSvgDataUri(curStyle, curSize, curColor, 'text', p.customCursorSvg));
  root.style.setProperty('--gtems-cursor-wait', buildCursorSvgDataUri(curStyle, curSize, curColor, 'wait', p.customCursorSvg));
}

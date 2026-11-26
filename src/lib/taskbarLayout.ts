import type { AppId } from './types';

export interface TaskbarLayoutInput {
  viewportWidth: number;
  viewportHeight?: number;
  position?: 'left' | 'top' | 'bottom';
  uiScale: number;
  iconSize: 'small' | 'normal' | 'large';
  fontSize: 'small' | 'normal' | 'large';
  items: AppId[];
}

export interface TaskbarLayoutResult {
  visibleItems: AppId[];
  overflowItems: AppId[];
  compactLabels: boolean;
  trayWidthReserved: number;
  sidebarWidthPx: number;
}

export function computeLeftSidebarWidth(
  mode: 'compact' | 'normal' | 'expanded',
  iconSize: 'small' | 'normal' | 'large',
  viewportWidth: number
): number {
  if (viewportWidth < 760 || mode === 'compact') {
    return iconSize === 'large' ? 72 : 68;
  }
  if (mode === 'expanded') {
    return iconSize === 'large' ? 216 : 196;
  }
  return iconSize === 'large' ? 80 : 72;
}

export function computeTaskbarLayout(input: TaskbarLayoutInput): TaskbarLayoutResult {
  const position = input.position || 'left';
  const effectiveWidth = input.viewportWidth / Math.max(0.85, input.uiScale);
  const effectiveHeight = (input.viewportHeight || 900) / Math.max(0.85, input.uiScale);

  const iconBase = input.iconSize === 'large' ? 46 : input.iconSize === 'small' ? 36 : 40;
  const fontFactor = input.fontSize === 'large' ? 1.15 : input.fontSize === 'small' ? 0.9 : 1;

  if (position === 'left') {
    // Vertical sidebar: reserve top header (Start + Search) ~104px and bottom system tray ~210px
    const headerReserved = 108;
    const trayReserved = effectiveHeight < 680 ? 184 : 220;
    const overflowBtnHeight = 42;
    const slotHeight = Math.round((iconBase + 10) * Math.max(1, fontFactor * 0.95));
    const availableForApps = Math.max(48, effectiveHeight - headerReserved - trayReserved - 24);
    const maxWithoutOverflow = Math.max(1, Math.floor(availableForApps / slotHeight));

    const sidebarWidthPx = computeLeftSidebarWidth('normal', input.iconSize, input.viewportWidth);

    if (input.items.length <= maxWithoutOverflow) {
      return {
        visibleItems: input.items,
        overflowItems: [],
        compactLabels: true,
        trayWidthReserved: trayReserved,
        sidebarWidthPx,
      };
    }

    const maxWithOverflow = Math.max(1, Math.floor((availableForApps - overflowBtnHeight) / slotHeight));
    return {
      visibleItems: input.items.slice(0, maxWithOverflow),
      overflowItems: input.items.slice(maxWithOverflow),
      compactLabels: true,
      trayWidthReserved: trayReserved,
      sidebarWidthPx,
    };
  }

  // Horizontal fallback (top / bottom if user manually switches)
  const startBtnWidth = 112;
  const trayWidthReserved = effectiveWidth < 680 ? 220 : 300;
  const overflowBtnWidth = 44;
  const compactLabels = effectiveWidth < 1080 || input.uiScale > 1.05 || input.fontSize === 'large';

  const slotWidth = compactLabels ? iconBase + 10 : Math.round((iconBase + 92) * fontFactor);
  const availableForApps = Math.max(80, effectiveWidth - startBtnWidth - trayWidthReserved - 32);

  const maxWithoutOverflow = Math.floor(availableForApps / slotWidth);
  if (input.items.length <= maxWithoutOverflow) {
    return {
      visibleItems: input.items,
      overflowItems: [],
      compactLabels,
      trayWidthReserved,
      sidebarWidthPx: 0,
    };
  }

  const maxWithOverflow = Math.max(1, Math.floor((availableForApps - overflowBtnWidth) / slotWidth));
  return {
    visibleItems: input.items.slice(0, maxWithOverflow),
    overflowItems: input.items.slice(maxWithOverflow),
    compactLabels,
    trayWidthReserved,
    sidebarWidthPx: 0,
  };
}

import React, { useRef } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import type { WindowInstance } from '../lib/types';
import { GtemsAppIcon } from './icons/GtemsIcons';

interface WindowFrameProps {
  win: WindowInstance;
  isFocused: boolean;
  transparency: boolean;
  leftOffsetPx?: number;
  topOffsetPx?: number;
  bottomOffsetPx?: number;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onToggleMaximize: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}

export const WindowFrame: React.FC<WindowFrameProps> = ({
  win,
  isFocused,
  transparency,
  leftOffsetPx = 0,
  topOffsetPx = 0,
  bottomOffsetPx = 0,
  onFocus,
  onClose,
  onMinimize,
  onToggleMaximize,
  onMove,
  onResize,
  onContextMenu,
  children,
}) => {
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);

  if (win.minimized) return null;

  const startDrag = (e: React.MouseEvent) => {
    if (win.maximized || (e.target as HTMLElement).closest('button')) return;
    onFocus();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: win.x,
      origY: win.y,
    };

    const handleMove = (mv: MouseEvent) => {
      if (!dragRef.current) return;
      const nx = Math.max(
        leftOffsetPx,
        Math.min(window.innerWidth - 160, dragRef.current.origX + (mv.clientX - dragRef.current.startX))
      );
      const ny = Math.max(
        topOffsetPx,
        Math.min(window.innerHeight - bottomOffsetPx - 44, dragRef.current.origY + (mv.clientY - dragRef.current.startY))
      );
      onMove(nx, ny);
    };

    const handleUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const startResize = (e: React.MouseEvent) => {
    if (win.maximized) return;
    e.stopPropagation();
    onFocus();
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origW: win.width,
      origH: win.height,
    };

    const handleMove = (mv: MouseEvent) => {
      if (!resizeRef.current) return;
      const nw = Math.max(
        340,
        Math.min(window.innerWidth - win.x, resizeRef.current.origW + (mv.clientX - resizeRef.current.startX))
      );
      const nh = Math.max(
        260,
        Math.min(
          window.innerHeight - win.y - bottomOffsetPx,
          resizeRef.current.origH + (mv.clientY - resizeRef.current.startY)
        )
      );
      onResize(nw, nh);
    };

    const handleUp = () => {
      resizeRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const clampedX = Math.max(leftOffsetPx, Math.min(win.x, Math.max(leftOffsetPx, (typeof window !== 'undefined' ? window.innerWidth : 1440) - 220)));
  const clampedY = Math.max(topOffsetPx, win.y);

  const frameStyle: React.CSSProperties = win.maximized
    ? {
        left: leftOffsetPx,
        top: topOffsetPx,
        width: `calc(100% - ${leftOffsetPx}px)`,
        height: `calc(100% - ${topOffsetPx + bottomOffsetPx}px)`,
        zIndex: win.zIndex,
        borderRadius: '0px',
      }
    : {
        left: clampedX,
        top: clampedY,
        width: Math.min(win.width, Math.max(320, (typeof window !== 'undefined' ? window.innerWidth : 1440) - clampedX - 8)),
        height: Math.min(win.height, Math.max(240, (typeof window !== 'undefined' ? window.innerHeight : 900) - clampedY - bottomOffsetPx - 8)),
        zIndex: win.zIndex,
        borderRadius: 'var(--gtems-radius, 14px)',
      };

  return (
    <section
      aria-label={win.title}
      style={{
        ...frameStyle,
        boxShadow: isFocused ? 'var(--gtems-glow)' : undefined,
        transition: `box-shadow var(--gtems-anim-ms, 180ms) ease`,
      }}
      onMouseDown={onFocus}
      className={`fixed flex flex-col overflow-hidden ${
        transparency ? 'aurora-glass' : 'bg-[var(--gtems-surface-solid)] border border-[var(--gtems-border)]'
      } ${isFocused ? 'shadow-2xl ring-1 ring-[var(--gtems-accent)]/45' : 'shadow-lg opacity-95'}`}
    >
      {/* Title Bar */}
      <div
        onMouseDown={startDrag}
        onDoubleClick={onToggleMaximize}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(e);
        }}
        className="h-10 shrink-0 px-3 flex items-center justify-between border-b border-[var(--gtems-border)] bg-[var(--gtems-surface)] select-none cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <GtemsAppIcon appId={win.appId} className="w-5 h-5 shrink-0" />
          <span className="text-xs font-semibold truncate text-[var(--gtems-text)]">{win.title}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            aria-label={`Minimizar ${win.title}`}
            onClick={onMinimize}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--gtems-text-muted)] hover:bg-[var(--gtems-accent)]/15 hover:text-[var(--gtems-text)] transition-colors"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            aria-label={win.maximized ? `Restaurar ${win.title}` : `Maximizar ${win.title}`}
            onClick={onToggleMaximize}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--gtems-text-muted)] hover:bg-[var(--gtems-accent)]/15 hover:text-[var(--gtems-text)] transition-colors"
          >
            {win.maximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
          </button>
          <button
            type="button"
            aria-label={`Cerrar ${win.title}`}
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--gtems-text-muted)] hover:bg-red-500 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden bg-[var(--gtems-surface-solid)]/90">
        {children}
      </div>

      {/* Resize Handle */}
      {!win.maximized && (
        <div
          onMouseDown={startResize}
          aria-hidden="true"
          className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
        />
      )}
    </section>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { clampContextMenuPosition } from '../lib/contextMenuLogic';

export interface ContextMenuItem {
  id: string;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  dividerBefore?: boolean;
  onClick?: () => void;
  submenu?: ContextMenuItem[];
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

interface ContextMenuProps {
  menu: ContextMenuState | null;
  leftOffsetPx?: number;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ menu, leftOffsetPx = 0, onClose }) => {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [hoveredSub, setHoveredSub] = useState<string | null>(null);

  useEffect(() => {
    setHoveredSub(null);
  }, [menu]);

  useEffect(() => {
    if (!menu) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKey);
    };
  }, [menu, onClose]);

  if (!menu) return null;

  const estimatedHeight = Math.min(460, menu.items.length * 36 + 16);
  const rawPos = clampContextMenuPosition(
    menu.x,
    menu.y,
    228,
    estimatedHeight,
    typeof window !== 'undefined' ? window.innerWidth : 1440,
    typeof window !== 'undefined' ? window.innerHeight : 900
  );
  const pos = {
    ...rawPos,
    x: Math.max(leftOffsetPx + 8, rawPos.x),
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Menú contextual"
      style={{ left: pos.x, top: pos.y }}
      className="fixed z-[9999] w-[228px] rounded-xl aurora-glass shadow-xl py-1.5 text-sm select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.items.map((item) => (
        <React.Fragment key={item.id}>
          {item.dividerBefore && <div className="my-1 border-t border-[var(--gtems-border)]" />}
          <div
            className="relative"
            onMouseEnter={() => setHoveredSub(item.submenu ? item.id : null)}
          >
            <button
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                if (item.submenu) {
                  setHoveredSub((prev) => (prev === item.id ? null : item.id));
                  return;
                }
                item.onClick?.();
                onClose();
              }}
              className={`w-full flex items-center justify-between px-3 py-1.5 text-left transition-colors ${
                item.disabled
                  ? 'opacity-40 cursor-not-allowed'
                  : item.danger
                  ? 'text-red-600 dark:text-red-400 hover:bg-red-500/10'
                  : 'text-[var(--gtems-text)] hover:bg-[#398F91]/15'
              }`}
            >
              <span className="truncate">{item.label}</span>
              {item.submenu && <ChevronRight className="w-3.5 h-3.5 opacity-60 shrink-0" />}
            </button>

            {item.submenu && hoveredSub === item.id && (
              <div
                role="menu"
                className={`absolute top-0 w-48 rounded-xl aurora-glass shadow-xl py-1.5 z-[10000] ${
                  pos.openSubmenuLeft ? 'right-full mr-1' : 'left-full ml-1'
                }`}
              >
                {item.submenu.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    role="menuitem"
                    disabled={sub.disabled}
                    onClick={() => {
                      sub.onClick?.();
                      onClose();
                    }}
                    className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                      sub.disabled
                        ? 'opacity-40 cursor-not-allowed'
                        : 'text-[var(--gtems-text)] hover:bg-[#398F91]/15'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};

export interface MenuPosition {
  x: number;
  y: number;
  openSubmenuLeft: boolean;
}

export function clampContextMenuPosition(
  cursorX: number,
  cursorY: number,
  menuWidth: number,
  menuHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  padding = 8
): MenuPosition {
  const maxX = Math.max(padding, viewportWidth - menuWidth - padding);
  const maxY = Math.max(padding, viewportHeight - menuHeight - padding);
  const x = Math.min(Math.max(padding, cursorX), maxX);
  const y = Math.min(Math.max(padding, cursorY), maxY);
  const openSubmenuLeft = x + menuWidth + 190 > viewportWidth - padding;
  return { x, y, openSubmenuLeft };
}

export function computeNextSelection(
  orderedPaths: string[],
  currentSelection: string[],
  targetPath: string,
  anchorPath: string | null,
  modifiers: { ctrlKey: boolean; shiftKey: boolean }
): { selected: string[]; nextAnchor: string } {
  if (modifiers.shiftKey && anchorPath) {
    const startIdx = orderedPaths.indexOf(anchorPath);
    const endIdx = orderedPaths.indexOf(targetPath);
    if (startIdx !== -1 && endIdx !== -1) {
      const low = Math.min(startIdx, endIdx);
      const high = Math.max(startIdx, endIdx);
      const range = orderedPaths.slice(low, high + 1);
      if (modifiers.ctrlKey) {
        const merged = new Set([...currentSelection, ...range]);
        return { selected: Array.from(merged), nextAnchor: anchorPath };
      }
      return { selected: range, nextAnchor: anchorPath };
    }
  }

  if (modifiers.ctrlKey) {
    const exists = currentSelection.includes(targetPath);
    const selected = exists
      ? currentSelection.filter((p) => p !== targetPath)
      : [...currentSelection, targetPath];
    return { selected, nextAnchor: targetPath };
  }

  return { selected: [targetPath], nextAnchor: targetPath };
}

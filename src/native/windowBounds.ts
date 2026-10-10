export type WindowBounds = { x: number; y: number; width: number; height: number };
export type WindowDisplay = { id: number; workArea: WindowBounds };

/** Untrusted persisted geometry must never reach BrowserWindow unchecked. */
export function isWindowBounds(value: unknown): value is WindowBounds {
  if (!value || typeof value !== "object") return false;
  const bounds = value as WindowBounds;
  return [bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite) &&
    bounds.width > 0 && bounds.height > 0;
}

/** Restore onto an extant display; a removed display falls back by overlap, then primary. */
export function restoreWindowBounds(
  state: unknown,
  displays: readonly WindowDisplay[],
  primary: WindowDisplay,
  minimum: { width: number; height: number },
): { normalBounds: WindowBounds; displayId: number } {
  const saved = (state && typeof state === "object" ? state : {}) as { normalBounds?: unknown; displayId?: unknown };
  const bounds = isWindowBounds(saved.normalBounds) ? saved.normalBounds : undefined;
  let display = displays.find(item => item.id === saved.displayId);
  if (!display && bounds) {
    let largest = 0;
    for (const candidate of displays) {
      const area = candidate.workArea;
      const overlap = Math.max(0, Math.min(bounds.x + bounds.width, area.x + area.width) - Math.max(bounds.x, area.x)) *
        Math.max(0, Math.min(bounds.y + bounds.height, area.y + area.height) - Math.max(bounds.y, area.y));
      if (overlap > largest) { largest = overlap; display = candidate; }
    }
  }
  display ??= primary;
  const area = display.workArea;
  // On a display smaller than the minimum, fit the restore rectangle; the OS
  // retains its platform minimum. No geometry can meet both constraints there.
  const width = Math.min(area.width, Math.max(minimum.width, Math.round(bounds?.width ?? 1280)));
  const height = Math.min(area.height, Math.max(minimum.height, Math.round(bounds?.height ?? 720)));
  const x = Math.round(bounds?.x ?? area.x + (area.width - width) / 2);
  const y = Math.round(bounds?.y ?? area.y + (area.height - height) / 2);
  return { displayId: display.id, normalBounds: {
    x: Math.max(area.x, Math.min(x, area.x + area.width - width)),
    y: Math.max(area.y, Math.min(y, area.y + area.height - height)), width, height,
  } };
}

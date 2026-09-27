/**
 * Pure context-menu policy for the main window.
 *
 * Electron replaces Chromium's default context menu as soon as a
 * `context-menu` listener is registered, so every item the user expects
 * (Cut/Copy/Paste/Select All, link and image copy, spelling fixes) must be
 * built explicitly. This module decides *what* to show from the event params;
 * `window.ts` turns the plan into real `MenuItem`s and wires the actions.
 *
 * Nothing here navigates, opens URLs, or exposes devtools.
 */
import type { MenuItemConstructorOptions } from "electron";

/** Subset of Electron.ContextMenuParams this policy depends on. */
export interface ContextMenuPolicyParams {
  x: number;
  y: number;
  isEditable: boolean;
  selectionText: string;
  linkURL: string;
  srcURL: string;
  mediaType: string;
  misspelledWord: string;
  dictionarySuggestions: string[];
  editFlags: {
    canUndo: boolean;
    canRedo: boolean;
    canCut: boolean;
    canCopy: boolean;
    canPaste: boolean;
    canSelectAll: boolean;
  };
}

export type ContextMenuRole =
  | "undo"
  | "redo"
  | "cut"
  | "copy"
  | "paste"
  | "pasteAndMatchStyle"
  | "selectAll";

export type ContextMenuAction =
  | { kind: "replaceMisspelling"; suggestion: string }
  | { kind: "addToDictionary"; word: string }
  | { kind: "copyLink"; url: string }
  | { kind: "copyImage"; x: number; y: number }
  | { kind: "toggleSpellcheck" };

export type ContextMenuEntry =
  | { type: "separator" }
  | { type: "role"; role: ContextMenuRole; label: string; enabled: boolean }
  | { type: "action"; label: string; action: ContextMenuAction };

const SEPARATOR: ContextMenuEntry = { type: "separator" };

/** Only http(s) links may be copied; javascript:, file:, data: etc. are ignored. */
export function isCopyableLink(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/** Joins non-empty groups with single separators (no leading/trailing/double). */
function joinGroups(groups: ContextMenuEntry[][]): ContextMenuEntry[] {
  const out: ContextMenuEntry[] = [];
  for (const group of groups) {
    if (group.length === 0) continue;
    if (out.length > 0) out.push(SEPARATOR);
    out.push(...group);
  }
  return out;
}

export function buildContextMenuPlan(
  params: ContextMenuPolicyParams,
): ContextMenuEntry[] {
  const flags = params.editFlags;
  const hasSelection = params.selectionText.trim().length > 0;

  // 1. Spelling (existing behaviour, always first).
  const spelling: ContextMenuEntry[] = [];
  if (params.isEditable && params.misspelledWord) {
    for (const suggestion of params.dictionarySuggestions) {
      spelling.push({
        type: "action",
        label: suggestion,
        action: { kind: "replaceMisspelling", suggestion },
      });
    }
    spelling.push({
      type: "action",
      label: "Add to dictionary",
      action: { kind: "addToDictionary", word: params.misspelledWord },
    });
  }

  // 2. Editing.
  const history: ContextMenuEntry[] = [];
  const clipboard: ContextMenuEntry[] = [];
  const selectAll: ContextMenuEntry[] = [];
  if (params.isEditable) {
    history.push(
      { type: "role", role: "undo", label: "Undo", enabled: flags.canUndo },
      { type: "role", role: "redo", label: "Redo", enabled: flags.canRedo },
    );
    clipboard.push(
      { type: "role", role: "cut", label: "Cut", enabled: flags.canCut },
      { type: "role", role: "copy", label: "Copy", enabled: flags.canCopy },
      { type: "role", role: "paste", label: "Paste", enabled: flags.canPaste },
      {
        type: "role",
        role: "pasteAndMatchStyle",
        label: "Paste as plain text",
        enabled: flags.canPaste,
      },
    );
    selectAll.push({
      type: "role",
      role: "selectAll",
      label: "Select All",
      enabled: flags.canSelectAll,
    });
  } else if (hasSelection) {
    // Read-only text selection (e.g. a chat message).
    clipboard.push({
      type: "role",
      role: "copy",
      label: "Copy",
      enabled: flags.canCopy,
    });
  }

  // 3. Links and images.
  const media: ContextMenuEntry[] = [];
  if (isCopyableLink(params.linkURL)) {
    media.push({
      type: "action",
      label: "Copy Link",
      action: { kind: "copyLink", url: params.linkURL },
    });
  }
  if (params.mediaType === "image" && params.srcURL) {
    media.push({
      type: "action",
      label: "Copy Image",
      action: { kind: "copyImage", x: params.x, y: params.y },
    });
  }

  // 4. Spellcheck toggle, only where spellcheck is meaningful.
  const settings: ContextMenuEntry[] = params.isEditable
    ? [
        {
          type: "action",
          label: "Toggle spellcheck",
          action: { kind: "toggleSpellcheck" },
        },
      ]
    : [];

  return joinGroups([spelling, history, clipboard, selectAll, media, settings]);
}

/**
 * Converts the plan into an Electron menu template. Roles are used for
 * clipboard/edit items so they act on the focused frame; custom actions are
 * delegated to `run`, which the caller wires to webContents/clipboard/config.
 */
export function buildContextMenuTemplate(
  params: ContextMenuPolicyParams,
  run: (action: ContextMenuAction) => void,
): MenuItemConstructorOptions[] {
  return buildContextMenuPlan(params).map(
    (entry): MenuItemConstructorOptions => {
      switch (entry.type) {
        case "separator":
          return { type: "separator" };
        case "role":
          return {
            role: entry.role,
            label: entry.label,
            enabled: entry.enabled,
          };
        case "action":
          return { label: entry.label, click: () => run(entry.action) };
      }
    },
  );
}

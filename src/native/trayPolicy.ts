import type { MenuItemConstructorOptions } from "electron";

/** Platform policy: templates are macOS-only; colour art is never a template. */
export function trayIconPolicy(platform: NodeJS.Platform) {
  return platform === "darwin"
    ? { asset: "template" as const, size: 16, template: true, scaleFactors: [1, 2] }
    : { asset: "colour" as const, size: 32, template: false, scaleFactors: [1] };
}

export function trayMenuTemplate(
  version: string,
  actions: { show: () => void; about: () => void; quit: () => void },
): MenuItemConstructorOptions[] {
  return [
    { label: "Show Mutiny", click: actions.show },
    // The current web baseline has no protocol-url settings listener. Keep the
    // requested entry visible, but do not pretend a no-op is an implemented action.
    // See proof/T27/CONTRACT_DELTA_PROPOSAL.md for the exact scope blocker.
    { label: "Settings", enabled: false },
    { label: `About (${version})`, click: actions.about },
    { type: "separator" },
    { label: "Quit", click: actions.quit },
  ];
}

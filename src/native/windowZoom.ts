/** Only the platform accelerator on key-down owns these three zoom actions. */
export function windowZoomAction(
  platform: NodeJS.Platform,
  input: Pick<Electron.Input, "type" | "key" | "control" | "meta" | "alt" | "shift">,
): "in" | "out" | "reset" | undefined {
  if (input.type !== "keyDown" || input.alt) return;
  if (platform === "darwin" ? !input.meta || input.control : !input.control || input.meta) return;
  if (input.key === "=" || (input.key === "+" && input.shift)) return "in";
  if (input.shift) return;
  if (input.key === "-") return "out";
  if (input.key === "0") return "reset";
}

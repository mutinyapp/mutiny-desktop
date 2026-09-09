const booleanKeys = new Set([
  "firstLaunch", "customFrame", "minimiseToTray", "startMinimisedToTray",
  "spellchecker", "hardwareAcceleration", "discordRpc",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

export function isConfigUpdate(value: unknown): value is Partial<DesktopConfig> {
  if (!isRecord(value)) return false;
  return Reflect.ownKeys(value).every((key) => {
    if (typeof key !== "string") return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) return false;
    const item = descriptor.value;
    if (booleanKeys.has(key)) return typeof item === "boolean";
    if (key !== "windowState" || !isRecord(item)) return false;
    const keys = Reflect.ownKeys(item);
    const state = Object.getOwnPropertyDescriptor(item, "isMaximised");
    return keys.length === 1 && keys[0] === "isMaximised" &&
      !!state && "value" in state && typeof state.value === "boolean";
  });
}

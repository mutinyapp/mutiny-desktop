export type OfflineErrorClass = "offline" | "dns" | "tls" | "server";

export function shouldShowOffline(code: number, mainFrame: boolean): boolean {
  return mainFrame === true && code < 0 && code !== -3;
}

export function offlineErrorClass(code: number): OfflineErrorClass {
  if ([-21, -106, -109].includes(code)) return "offline";
  if ([-105, -137, -801, -802, -803, -804, -805, -806].includes(code)) return "dns";
  if ((code <= -200 && code >= -299) || [-107, -110, -112, -113, -117, -122].includes(code)) return "tls";
  return "server";
}

export function retryDelay(attempt: number): number {
  return [5000, 15000, 30000, 60000][Math.min(Math.max(0, attempt), 3)];
}

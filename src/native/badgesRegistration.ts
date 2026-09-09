type IpcLike = {
  on(
    channel: string,
    listener: (_event: Electron.IpcMainEvent, count: number) => void,
  ): unknown;
};

const registered = new WeakSet<object>();

export function registerBadgeHandler(
  ipc: IpcLike,
  setBadge: (count: number) => Promise<void> | void,
  authorize: (event: Electron.IpcMainEvent) => boolean = () => false,
): void {
  if (registered.has(ipc as object)) return;
  registered.add(ipc as object);
  ipc.on("setBadgeCount", (_event, count) => {
    if (authorize(_event)) void setBadge(count);
  });
}

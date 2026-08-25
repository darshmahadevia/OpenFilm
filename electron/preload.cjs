// eslint-disable-next-line @typescript-eslint/no-require-imports, no-undef
const { contextBridge, ipcRenderer } = require('electron');

const channels = {
  check: 'openfilm:updates:check',
  download: 'openfilm:updates:download',
  getState: 'openfilm:updates:get-state',
  launch: 'openfilm:updates:launch',
  state: 'openfilm:updates:state',
};

contextBridge.exposeInMainWorld('openFilmUpdates', {
  check: () => ipcRenderer.invoke(channels.check),
  download: () => ipcRenderer.invoke(channels.download),
  getState: () => ipcRenderer.invoke(channels.getState),
  launch: () => ipcRenderer.invoke(channels.launch),
  subscribe(callback) {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on(channels.state, listener);
    return () => ipcRenderer.removeListener(channels.state, listener);
  },
});

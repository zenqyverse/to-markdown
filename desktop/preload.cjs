const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktop', {
  open: () => ipcRenderer.invoke('document:open'),
  save: (text, saveAs, name) => ipcRenderer.invoke('document:save', { text, saveAs, name }),
  release: () => ipcRenderer.invoke('document:release'),
  adopt: (token, accept) => ipcRenderer.invoke('document:adopt', token, accept),
  ready: () => ipcRenderer.invoke('document:ready'),
  onFile: callback => ipcRenderer.on('document:file', (_event, data) => callback(data)),
  onUpdateSafety: callback => ipcRenderer.on('update:safety', (_event, token) => ipcRenderer.send('update:safety-result', token, callback() === true)),
});

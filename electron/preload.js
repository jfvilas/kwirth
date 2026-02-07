const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('kwirth', {
  validateDns: (hostname) => ipcRenderer.invoke('validate-dns',  hostname),
  kubeApiAvailable: (url) => ipcRenderer.invoke('kube-api-available', url)
})
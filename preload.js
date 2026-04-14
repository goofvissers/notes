const { contextBridge, ipcRenderer } = require("electron");

const api = {
  platform: "windows-desktop",
  notesStorage: {
    load: () => ipcRenderer.invoke("notes:load"),
    save: (notes) => ipcRenderer.invoke("notes:save", notes),
  },
};

contextBridge.exposeInMainWorld("goofNotesApp", api);
contextBridge.exposeInMainWorld("lumenApp", api);

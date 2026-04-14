const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("lumenApp", {
  platform: "windows-desktop",
});

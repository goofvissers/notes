const { app, BrowserWindow, ipcMain, shell } = require("electron");
const fs = require("fs/promises");
const path = require("path");

const DATA_DIRECTORY = "data";
const NOTES_FILE = "notes-db.json";
const SETTINGS_FILE = "ui-settings.json";
const ATTACHMENTS_DIRECTORY = "attachments";

function getStoragePaths() {
  const userDataPath = app.getPath("userData");
  const dataDir = path.join(userDataPath, DATA_DIRECTORY);

  return {
    userDataPath,
    dataDir,
    notesFilePath: path.join(dataDir, NOTES_FILE),
    settingsFilePath: path.join(dataDir, SETTINGS_FILE),
    attachmentsDir: path.join(dataDir, ATTACHMENTS_DIRECTORY),
  };
}

async function ensureStorage() {
  const paths = getStoragePaths();
  await fs.mkdir(paths.attachmentsDir, { recursive: true });
  return paths;
}

async function loadPersistedNotes() {
  const paths = await ensureStorage();

  try {
    const raw = await fs.readFile(paths.notesFilePath, "utf8");
    const parsed = JSON.parse(raw);

    return {
      schemaVersion: parsed.schemaVersion ?? 1,
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      storage: {
        ...paths,
      },
    };
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Failed to read notes database:", error);
    }

    return {
      schemaVersion: 1,
      notes: [],
      storage: {
        ...paths,
      },
    };
  }
}

async function savePersistedNotes(notes) {
  const paths = await ensureStorage();
  const payload = {
    schemaVersion: 1,
    notes,
    media: {
      attachmentsDir: ATTACHMENTS_DIRECTORY,
    },
  };
  const tempPath = `${paths.notesFilePath}.tmp`;

  await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), "utf8");
  await fs.rename(tempPath, paths.notesFilePath);

  return {
    ok: true,
    storage: {
      ...paths,
    },
  };
}

async function loadUiSettings() {
  const paths = await ensureStorage();

  try {
    const raw = await fs.readFile(paths.settingsFilePath, "utf8");
    const parsed = JSON.parse(raw);

    return {
      paneWidth: Number.isFinite(parsed?.paneWidth) ? parsed.paneWidth : null,
    };
  } catch (error) {
    if (error.code !== "ENOENT") {
      console.error("Failed to read UI settings:", error);
    }

    return {
      paneWidth: null,
    };
  }
}

async function saveUiSettings(settings = {}) {
  const paths = await ensureStorage();
  const existing = await loadUiSettings();
  const payload = {
    ...existing,
    ...settings,
  };
  const tempPath = `${paths.settingsFilePath}.tmp`;

  await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), "utf8");
  await fs.rename(tempPath, paths.settingsFilePath);

  return {
    ok: true,
    settings: payload,
  };
}

async function openDataFolder() {
  const paths = await ensureStorage();
  const result = await shell.openPath(paths.dataDir);

  return {
    ok: result === "",
    path: paths.dataDir,
    error: result || null,
  };
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: "#e7eef8",
    autoHideMenuBar: true,
    title: "Goof Notes",
    icon: path.join(__dirname, "assets", "goof-notes.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

app.whenReady().then(() => {
  ipcMain.handle("notes:load", async () => loadPersistedNotes());
  ipcMain.handle("notes:save", async (_event, notes) => savePersistedNotes(notes));
  ipcMain.handle("notes:openDataFolder", async () => openDataFolder());
  ipcMain.handle("settings:load", async () => loadUiSettings());
  ipcMain.handle("settings:save", async (_event, settings) => saveUiSettings(settings));

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

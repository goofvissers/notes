# Goof Notes

A modern Apple-inspired notes app for Windows, now wrapped as a real Electron desktop application.

## Features

- Premium glassmorphism desktop UI
- Note header and body editing
- Per-note tag creation and removal
- Search across note titles, content, and tags
- Automatic local persistence with `localStorage`

## Development

1. Install dependencies:
   `npm install`
2. Start the Windows desktop app:
   `npm start`

## Build a Windows installer

Run:

`npm run package`

This uses `electron-builder` to create an NSIS installer.

## Project structure

- `main.js`: Electron main process and native window setup
- `preload.js`: Safe bridge for future desktop APIs
- `index.html`, `styles.css`, `app.js`: App UI and note logic

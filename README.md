# Log Analyzer

A production-ready Electron desktop app for streaming JSON log analysis with React, Vite, and TypeScript.

## Highlights

- Streams large log files (25MB+), zip entries, and optional rar archives without loading full files into memory
- Parses JSON per line with safe fallback for invalid lines
- Virtualized table that stays smooth with 30k+ rows
- Dynamic columns, per-column filters, global search, and sorting
- Preview modal with syntax highlighting and navigation
- Export filtered results to JSON or CSV

## Project Structure

- src/main: Electron main process, file streaming, zip/rar handling
- src/preload: Secure IPC bridge
- src/renderer: React UI with virtualization and controls

## Setup

Install dependencies:

```bash
npm install
```

Start in development:

```bash
npm run dev
```

Package for Windows:

```bash
npm run build:win
```

## Notes

- RAR extraction uses a best-effort library approach. If extraction fails, the app reports the error and continues.
- For best performance, keep large files on fast local storage.

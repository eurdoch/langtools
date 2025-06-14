# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LangPub is an Electron application built with React, TypeScript, and Vite. It's a desktop application that leverages web technologies for the UI layer while using Electron for native desktop capabilities.

## Architecture

The application follows a standard Electron architecture:

- **Main Process** (`electron/main.ts`): The entry point for the Electron application that creates the application window and manages application lifecycle.
- **Preload Script** (`electron/preload.ts`): Provides a secure bridge between Electron's main process and the renderer process through contextBridge.
- **Renderer Process** (`src/`): The React application that runs in the browser environment within Electron.

### Key Components

- **App Component** (`src/App.tsx`): The root React component for the application.
- **IPC Communication**: Communication between the main and renderer processes is handled through Electron's IPC (Inter-Process Communication) system, exposed securely via the preload script.

## Commands

### Development

```bash
# Install dependencies
yarn

# Start development server with hot reload
yarn dev

# Lint the codebase
yarn lint

# Build the application for production
yarn build
```

### Building

The application is configured to build for multiple platforms:
- macOS: DMG installer
- Windows: NSIS installer
- Linux: AppImage

To build the application:
```bash
yarn build
```

This will:
1. Run TypeScript type checking
2. Build the Vite application
3. Use electron-builder to package the application

The built application will be placed in the `release/{version}` directory.

## Important Configuration Files

- `vite.config.ts`: Configuration for Vite and Electron plugins
- `electron-builder.json5`: Configuration for Electron application packaging
- `tsconfig.json`: TypeScript configuration for the React application
- `tsconfig.node.json`: TypeScript configuration for Node.js files
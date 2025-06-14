import { app, BrowserWindow, dialog, ipcMain, protocol, net } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

// Import createRequire was removed as it's not used
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Path for storing app state
const STATE_FILE_PATH = path.join(app.getPath('userData'), 'app-state.json')

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
    show: false, // Don't show the window until it's ready
  })

  // Maximize the window
  win.maximize()
  
  // Show window when ready
  win.once('ready-to-show', () => {
    win?.show()
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  // Register file protocol for secure local file access
  protocol.registerFileProtocol('file', (request, callback) => {
    const filePath = decodeURI(request.url.slice('file://'.length))
    try {
      return callback(filePath)
    } catch (error) {
      console.error('Error registering file protocol:', error)
    }
  })

  createWindow()
  
  // Handle open file dialog
  ipcMain.handle('open-file-dialog', async () => {
    if (!win) return { canceled: true }
    
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [
        { name: 'EPUB Files', extensions: ['epub'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    })
    
    return result
  })
  
  // Handle reading a file directly
  ipcMain.handle('read-file', async (_, filePath) => {
    try {
      const data = await fs.promises.readFile(filePath)
      return { success: true, data: data.toString('base64') }
    } catch (error) {
      console.error('Error reading file:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })
  
  // API proxy to avoid CORS issues
  ipcMain.handle('api-proxy', async (_, { endpoint, method, data }) => {
    try {
      const apiBaseUrl = process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3004' 
        : 'https://langpub.directto.link'
      
      console.log(`Proxying API request to: ${apiBaseUrl}${endpoint}`)
      
      // Use Electron's net module to make the request
      const request = net.request({
        method: method || 'POST',
        url: `${apiBaseUrl}${endpoint}`
      })
      
      // Set headers
      request.setHeader('Content-Type', 'application/json')
      
      // Special handling for the speech endpoint which returns binary data
      const isBinaryResponse = endpoint === '/speech'
      
      // Create a promise to handle the response asynchronously
      const responsePromise = new Promise((resolve, reject) => {
        const chunks: Buffer[] = []
        
        request.on('response', (response) => {
          response.on('data', (chunk) => {
            if (isBinaryResponse) {
              chunks.push(Buffer.from(chunk))
            } else {
              // For non-binary responses, accumulate as Buffer objects
              chunks.push(chunk)
            }
          })
          
          response.on('end', () => {
            if (isBinaryResponse) {
              // For binary data (audio), concatenate the buffers and convert to base64
              const buffer = Buffer.concat(chunks)
              resolve({
                status: response.statusCode,
                data: buffer.toString('base64'),
                contentType: response.headers['content-type'] || 'audio/mpeg'
              })
            } else {
              // For JSON responses, parse as usual
              try {
                const responseData = Buffer.concat(chunks).toString()
                const parsedData = JSON.parse(responseData)
                resolve({
                  status: response.statusCode,
                  data: parsedData
                })
              } catch (error) {
                // If parsing fails, return as text
                resolve({
                  status: response.statusCode,
                  data: Buffer.concat(chunks).toString()
                })
              }
            }
          })
          
          response.on('error', (error: Error) => {
            reject(error)
          })
        })
        
        request.on('error', (error: Error) => {
          reject(error)
        })
      })
      
      // Write request body if there's data
      if (data) {
        request.write(JSON.stringify(data))
      }
      
      // End the request
      request.end()
      
      // Wait for the response
      return await responsePromise
    } catch (error) {
      console.error('API proxy error:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        status: 500,
        error: errorMessage || 'Internal Server Error'
      }
    }
  })
  
  // Save application state to disk
  ipcMain.handle('save-app-state', async (_, state) => {
    try {
      await fs.promises.writeFile(STATE_FILE_PATH, JSON.stringify(state, null, 2))
      return { success: true }
    } catch (error) {
      console.error('Error saving app state:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })
  
  // Load application state from disk
  ipcMain.handle('load-app-state', async () => {
    try {
      // Check if the state file exists
      if (!fs.existsSync(STATE_FILE_PATH)) {
        return { success: true, data: null }
      }
      
      const data = await fs.promises.readFile(STATE_FILE_PATH, 'utf-8')
      return { success: true, data: JSON.parse(data) }
    } catch (error) {
      console.error('Error loading app state:', error)
      const errorMessage = error instanceof Error ? error.message : String(error)
      return { success: false, error: errorMessage }
    }
  })
})

import { app, BrowserWindow, shell } from 'electron'
import * as path from 'path'
import { registerIpcHandlers } from './ipc-handlers'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'Sprint Dashboard',
  })

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isExternal = url.startsWith('http:') || url.startsWith('https:')
    const isDevServer = url.startsWith('http://localhost:5173')
    if (isExternal && (!isDevServer || app.isPackaged)) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  // Set database path to userData directory
  const userDataPath = app.getPath('userData')
  process.env.DATABASE_PATH = path.join(userDataPath, 'sprint-dashboard.db')
  console.log('Database path:', process.env.DATABASE_PATH)

  registerIpcHandlers()

  if (app.isPackaged) {
    // Load local built frontend
    const indexPath = path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html')
    mainWindow.loadFile(indexPath)
  } else {
    // Load Vite dev server
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(async () => {
  try {
    createWindow()
  } catch (err) {
    console.error('Initialization error:', err)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

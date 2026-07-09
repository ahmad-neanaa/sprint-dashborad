const { app, BrowserWindow } = require('electron')
const path = require('path')
const http = require('http')

let mainWindow
let backendServer

async function startBackend() {
  const next = require('next')
  
  // Resolve paths
  const appPath = app.getAppPath()
  const backendDir = app.isPackaged
    ? path.join(appPath.replace('app.asar', 'app.asar.unpacked'), 'backend')
    : path.join(__dirname, 'backend')
  
  // Set database path to userData directory
  const userDataPath = app.getPath('userData')
  process.env.DATABASE_PATH = path.join(userDataPath, 'sprint-dashboard.db')
  
  console.log('App path:', appPath)
  console.log('Backend directory:', backendDir)
  console.log('Database path:', process.env.DATABASE_PATH)

  // Change working directory to backendDir so paths to migrations, etc. resolve correctly
  process.chdir(backendDir)

  const nextApp = next({ dev: false, dir: backendDir })
  const handle = nextApp.getRequestHandler()

  await nextApp.prepare()

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      handle(req, res)
    })
    
    server.listen(3001, '127.0.0.1', () => {
      console.log('Next.js API server running on http://127.0.0.1:3001')
      resolve(server)
    })

    server.on('error', (err) => {
      reject(err)
    })
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Bypasses CORS checks from file:// to localhost:3001
    },
    title: 'Sprint Dashboard',
  })

  if (app.isPackaged) {
    // Load local built frontend
    const indexPath = path.join(__dirname, 'frontend', 'dist', 'index.html')
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
    // Only boot the programmatically managed Next.js server in packaged production mode
    // In dev mode, we start Next.js and Vite servers concurrently via npm script
    if (app.isPackaged) {
      backendServer = await startBackend()
    }
    createWindow()
  } catch (err) {
    console.error('Initialization error:', err)
    app.quit()
  }
})

app.on('window-all-closed', () => {
  if (backendServer) {
    backendServer.close(() => {
      console.log('Backend server stopped.')
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })
  } else {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  }
})

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
})

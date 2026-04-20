const { app, BrowserWindow } = require("electron");
const path = require("path");
const { fork } = require("child_process");

let mainWindow;
let nextProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
  });

  mainWindow.loadURL("http://localhost:3000");
}

app.whenReady().then(() => {
  const isDev = !app.isPackaged;
  
  if (isDev) {
    createWindow();
  } else {
    // In production, start the Next.js standalone server
    const serverPath = path.join(__dirname, ".next", "standalone", "server.js");
    
    nextProcess = fork(serverPath, [], {
      cwd: path.join(__dirname, ".next", "standalone"),
      env: {
        ...process.env,
        PORT: 3000,
        NODE_ENV: "production",
      },
    });

    // Wait a brief moment for the Next.js server to start
    setTimeout(() => {
      createWindow();
    }, 3000);
  }

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (nextProcess) {
    nextProcess.kill();
  }
});

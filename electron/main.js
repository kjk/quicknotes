const {
  app,
  BrowserWindow,
  Menu,
  Tray
} = require('electron');
const windowStateKeeper = require('electron-window-state');
const { isDev, isMac, isWin } = require('./utils');
const AppMenu = require('./appmenu');
const Path = require('path');
const os = require('os');
const AutoUpdate = require('./auto-update');
const Positioner = require('electron-positioner');


// TODO: properly handle multiple window by keeping windows in an array
let mainWindow;

const showDev = process.argv.includes('-dev');
const localServer = process.argv.includes('-local');

let startURL = 'https://quicknotes.io/dskstart';
if (localServer) {
  startURL = 'http://localhost:5111/dskstart';
}

function resPath(path) {
  return Path.join(__dirname, path);
}

function resFilePath(path) {
  return "file://" + resPath(path);
}

const menubarIconPath = resPath('menubar-icon.png');

function reloadWindow() {
  BrowserWindow.getFocusedWindow().reload();
}

function toggleFullScreen() {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
}

function toggleDevTools() {
  BrowserWindow.getFocusedWindow().toggleDevTools();
}

// tray code based on https://github.com/maxogden/menubar
let tray;
let trayWindow;
let trayWindowCachedBounds;
let trayPositioner;

function showTrayWindow(trayPos) {

  traySetHighlightMode('always')

  if (trayPos && trayPos.x !== 0) {
    // Cache the bounds
    trayWindowCachedBounds = trayPos
  } else if (trayWindowCachedBounds) {
    // Cached value will be used if showWindow is called without bounds data
    trayPos = trayWindowCachedBounds
  } else if (tray.getBounds) {
    // Get the current tray bounds
    trayPos = tray.getBounds()
  }

  let noBoundsPosition = isWin() ? 'trayBottomCenter' : 'trayCenter';
  if (!trayPos) {
    noBoundsPosition = isWin() ? 'bottomRight' : 'topRight';
  }

  const position = trayPositioner.calculate(noBoundsPosition, trayPos)
  const x = position.x
  const y = position.y
  console.log('showTrayWindow(): trayPos: ', trayPos, 'position:', position);
  trayWindow.setPosition(x, y)
  trayWindow.show()
}

function hideTrayWindow() {
  console.log('hideTrayWindow');
  traySetHighlightMode('never');
  if (!trayWindow) {
    return;
  }
  trayWindow.hide();
}

function toggleTrayWindow(e, bounds) {
  if (!trayWindow) {
    console.log('openTrayWindow: creating a window');
    const opts = {
      show: false,
      frame: false,
      width: 400,
      height: 400,
    }
    trayWindow = new BrowserWindow(opts);
    trayPositioner = new Positioner(trayWindow);
    trayWindow.on('blur', () => {
      console.log('trayWindow: blur');
      hideTrayWindow()
    });
    trayWindow.setVisibleOnAllWorkspaces(true)
    trayWindow.loadURL(resFilePath('menubar.html'));
  }

  if (e.altKey || e.shiftKey || e.ctrlKey || e.metaKey) {
    console.log('openTrayWindow: calling hide because meta key');
    return hideTrayWindow();
  }
  if (trayWindow && trayWindow.isVisible()) {
    console.log('openTrayWindow: calling hide because isVisible');
    return hideTrayWindow();
  }
  showTrayWindow(bounds)
}

function traySetHighlightMode(mode) {
  try {
    tray.setHighlightMode(mode);
  } catch (e) { }
}

function createTray() {
  if (tray) {
    return;
  }
  tray = new Tray(menubarIconPath);
  tray.on('click', toggleTrayWindow);
  tray.on('right-click', toggleTrayWindow);
  tray.on('double-click', toggleTrayWindow);
  tray.setToolTip('this is tray');
}

function createMainMenu() {
  if (isMac()) {
    const menu = AppMenu.mac;
    menu.on('application:quit', app.quit);
    menu.on('window:reload', reloadWindow);
    menu.on('window:toggle-full-screen', toggleFullScreen);
    menu.on('window:toggle-dev-tools', toggleDevTools);
    menu.makeDefault();
  }
}

function createWindow() {
  const mainWindowState = windowStateKeeper({
    defaultWidth: 1024,
    defaultHeight: 800,
  });
  mainWindow = new BrowserWindow({
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    webPreferences: {
      allowDisplayingInsecureContent: true,
      preload: resPath('preload.js'),
      nodeIntegration: true,
    },
  });

  mainWindowState.manage(mainWindow);
  createMainMenu();
  createTray();
  app.setName('QuickNotes');
  mainWindow.loadURL(startURL);
  AutoUpdate.init(mainWindow);

  if (showDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('application:quit', () => {
    console.log('application:quit');
    app.quit()
  });

  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    if (trayWindow) {
      trayWindow.close();
      trayWindow = null;
    }
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
  createWindow();
});

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (isDev() || !isMac()) {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});



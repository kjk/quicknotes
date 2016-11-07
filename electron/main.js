'use strict';

const { app, BrowserWindow, Menu } = require('electron');
const windowStateKeeper = require('electron-window-state');

// TODO: login page specific to the app
const startURL = 'https://quicknotes.io/';

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

// https://github.com/sindresorhus/electron-is-dev
const isDev = process.defaultApp || /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || /[\\/]electron[\\/]/.test(process.execPath);

const iconPath = __dirname + '/icon.png';

if (isDev) {
    console.log('iconPath: ', iconPath);
}

function isMac() { return process.platform == 'darwin' }

function createMainMenu() {
  if (process.platform == 'darwin') { // To enable shortcuts on OSX

    var template = [{
          label: "Harmony",
          submenu: [
              { label: "Undo", accelerator: "CmdOrCtrl+Z", selector: "undo:" },
              { label: "Redo", accelerator: "Shift+CmdOrCtrl+Z", selector: "redo:" },
              { type: "separator" },
              { label: "Cut", accelerator: "CmdOrCtrl+X", selector: "cut:" },
              { label: "Copy", accelerator: "CmdOrCtrl+C", selector: "copy:" },
              { label: "Paste", accelerator: "CmdOrCtrl+V", selector: "paste:" },
              { label: "Select All", accelerator: "CmdOrCtrl+A", selector: "selectAll:" },
              { type: "separator" },
              { label: "Quit", accelerator: "Command+Q", click: function() { app.quit(); }}
          ]}
      ];

      Menu.setApplicationMenu(Menu.buildFromTemplate(template));
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
        icon: iconPath,
        webPreferences: {
            allowDisplayingInsecureContent: true,
        },
    });

    mainWindowState.manage(mainWindow);
    createMainMenu();
    app.setName('QuickNotes');

    mainWindow.loadURL(startURL);

    mainWindow.on('closed', () => {
        // Dereference the window object, usually you would store windows
        // in an array if your app supports multi windows, this is the time
        // when you should delete the corresponding element.
        mainWindow = null;
    });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (isDev || !isMac()) {
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

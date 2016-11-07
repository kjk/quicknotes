const { app, BrowserWindow, Menu } = require('electron');
const windowStateKeeper = require('electron-window-state');
const { isDev, isMac } = require('./utils');
const menu = require('./menu');

// TODO: login page specific to the app
const startURL = 'https://quicknotes.io/';

let mainWindow;

const iconPath = __dirname + '/icon.png';

if (isDev()) {
    console.log('iconPath: ', iconPath);
}

function createMainMenu() {
    if (isMac()) {
        const macMenu = menu.mac;
        macMenu.on('application:quit', app.quit);
        macMenu.makeDefault();
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

    mainWindow.on('application:quit', () => {
      console.log('application:quit');
      app.quit()
    });

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

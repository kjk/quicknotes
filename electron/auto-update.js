const { app, autoUpdater, ipcMain } = require('electron');
const os = require('os');

// TODO: the main window must listen for quicknotes:update-ready,
// ask user if he wants to update, if yes send quicknotes:install-update
// to main process

ipcMain.on('quicknotes:install-update', autoUpdater.quitAndInstall);

//const updateCheckDelayInMs = 2 * 60 * 1000;
const updateCheckDelayInMs = 3 * 1000;

function init(mainWindow) {
  console.log('auto-update.js:init() called, mainWindow', mainWindow);

  autoUpdater.on('error', (err) => {
    console.log('autoUpdater: error happened', err);
  });
  autoUpdater.on('checking-for-update', () => {
    console.log('Checking for update started');
  });
  autoUpdater.on('update-available', () => {
    console.log('Update available');
  });
  autoUpdater.on('update-not-available', () => {
    console.log('Update not available');
  })
  autoUpdater.on('update-downloaded', () => {
    console.log('Update downloaded');
    mainWindow.webContents.send('quicknotes:update-ready');
  });

  setTimeout(() => {
    console.log('starting update check');

    let platform = os.platform();
    if (platform === 'win32') {
      platform = 'windows';
    }

    // should use process.arch? i.e. for 64-bit os running 32-bit version,
    // should we bump it to 64-bit or leave as 32-bit?
    const arch = os.arch();
    if (arch == 'x64') {
      platform += "-64";
    }
    // web claims different values, so including both
    if (arch == 'x86' || arch == 'ia32') {
      platform += "-32";
    }

    const version = app.getVersion();
    const autoUpdateURL = `http://kjktools.org/update-check/quicknotes/${platform}/${version}`;
    console.log('update url:', autoUpdateURL);
    autoUpdater.setFeedURL(autoUpdateURL);

    autoUpdater.checkForUpdates();
  }, updateCheckDelayInMs);

}

module.exports = {
  init: init,
}

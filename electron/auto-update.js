const { app, autoUpdater, dialog, ipcMain } = require('electron');
const os = require('os');

const updateCheckDelayInMs = 2 * 60 * 1000;

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

    var index = dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Restart', 'Later'],
      title: "QuickNotes",
      message: 'New version of QuickNotes is available',
      detail: 'Please restart the application to apply the updates.',
    });

    if (index === 1) {
      return;
    }

    autoUpdater.quitAndInstall();
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

const { app, autoUpdater, ipcMain } = require('electron');

// TODO: the main window must listen for quicknotes:update-ready,
// ask user if he wants to update, if yes send quicknotes:install-update
// to main process

let platform = os.platform();
if (platform === 'win32') {
  platform = 'windows';
}

// should use process.arch? i.e. for 64-bit os running 32-bit version,
// should we bump it to 64-bit or leave as 32-bit?
const arch = os.arch();
if (arch == 'x64') {
  platform += "_64";
}
// web claims different values, so including both
if (arch == 'x86' || arch == 'ia32') {
  platform += "_32";
}

let autoUpdateURL = `http://kjktools.org/update-check/quicknotes/${platform}/${version}`

ipcMain.on('quicknotes:install-update', autoUpdater.quitAndInstall);

const updateCheckDelayInMs = 2 * 60 * 1000;
setTimeout(autoUpdater.checkForUpdates, updateCheckDelayInMs);

export function init(mainWindow) {
	function updateDownloaded() {
	  mainWindow.webContents.send('quicknotes:update-ready');
	}
	autoUpdater.on('update-downloaded' updateDownloaded);
}
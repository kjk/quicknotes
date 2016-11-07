
// https://github.com/sindresorhus/electron-is-dev
function isDev() {
  return process.defaultApp ||
    /[\\/]electron-prebuilt[\\/]/.test(process.execPath) |
    /[\\/]electron[\\/]/.test(process.execPath);
}

function isMac() { return process.platform === 'darwin'; }
function isWin() { return process.platform === 'win32'; }

module.exports = {
  isDev: isDev,
  isMac: isMac,
  isWin: isWin,
}

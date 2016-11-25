console.log('electron:', global.electron);

function isElectron() {
  return typeof global.electron === 'object';
}

function isInternal(el) {
  return el.dataset && el.dataset.internal === 'yes';
}

function isExternalLink(el) {
  return el.target === '_blank' && !isInternal(el);
}

function isInExternalLink(el) {
  el = el.parentNode;
  while (el && el !== document.body) {
    if (el.tagName === 'A') {
      if (isExternalLink(el)) {
        return true;
      }
      return false;
    }
    el = el.parentNode;
  }
  return false;
}

function onClick(el) {
  if (isExternalLink(el.target) || isInExternalLink(el.target)) {
    el.preventDefault();
    global.electron.shell.openExternal(el.target.href);
  }
};

function initElectron() {
  if (isElectron()) {
    document.body.addEventListener('click', onClick, false);
  }
}

module.exports = {
  initElectron: initElectron,
}

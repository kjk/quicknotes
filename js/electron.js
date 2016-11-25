console.log('electron:', global.electron);

function isElectron() {
  return typeof global.electron === 'object';
}

function isExternalLink(el) {
  // TODO: a better way to recognize a link I should open in native
  // browser
  return el.tagName === 'A' && el.target === '_blank' && el.title != 'View note';
}

function isInExternalLink(el) {
  let parent = el.parentNode;
  while (parent && parent !== document.body) {
    if (isExternalLink(parent)) {
      return true;
    }
    // TODO: stop at first a
    parent = parent.parentNode;
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

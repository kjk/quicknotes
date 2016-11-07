const { isDev } = require('./utils');
const { app, Menu } = require('electron');
const { EventEmitter } = require('events');

const mac = [
  {
    label: 'QuickNotes',
    submenu: [
      { label: 'About QuickNotes', selector: 'orderFrontStandardAboutPanel:' },
      { type: 'separator' },
      { label: 'Hide QuickNotes', accelerator: 'Command+H', selector: 'hide:' },
      { label: 'Hide Others', accelerator: 'Command+Shift+H', selector: 'hideOtherApplications:' },
      { label: 'Show All', selector: 'unhideAllApplications:' },
      { type: 'separator' },
      { label: 'Quit', accelerator: 'Command+Q', command: 'application:quit' },
    ]
  },

  {
    label: 'Edit',
    submenu: [
      { label: 'Undo', accelerator: 'Command+Z', selector: 'undo:' },
      { label: 'Redo', accelerator: 'Shift+Command+Z', selector: 'redo:' },
      { type: 'separator' },
      { label: 'Cut', accelerator: 'Command+X', selector: 'cut:' },
      { label: 'Copy', accelerator: 'Command+C', selector: 'copy:' },
      { label: 'Paste', accelerator: 'Command+V', selector: 'paste:' },
      { label: 'Select All', accelerator: 'Command+A', selector: 'selectAll:' },
    ]
  },

  {
    label: 'Window',
    submenu: [
      { label: 'Minimize', accelerator: 'Command+M', selector: 'performMiniaturize:' },
      { label: 'Zoom', accelerator: 'Alt+Command+Ctrl+M', selector: 'zoom:' },
      { type: 'separator' },
      { label: 'Close', accelerator: 'Command+W', selector: 'performClose:' },
    ]
  },
];

function wireUpCommands(appMenu, submenu) {
  submenu.forEach((item) => {
    if (item.command) {
      const existingOnClick = item.click;

      item.click = () => {
        appMenu.emit(item.command, item);

        if (existingOnClick) {
          existingOnClick();
        }
      };
    }

    if (item.submenu) {
      wireUpCommands(appMenu, item.submenu);
    }
  });
}

class AppMenu extends EventEmitter {
  constructor(template) {
    super();
    wireUpCommands(this, template);
    this.menu = Menu.buildFromTemplate(template);
  }

  makeDefault() {
    Menu.setApplicationMenu(this.menu);
  }
}

module.exports = {
  mac: new AppMenu(mac),
}

/* jshint -W097,-W117 */
'use strict';

var actions = require('./actions.js');

var allThemes = [
  "light",
   "dark"
];


var allLayouts = [
  "default",
  "grid",
  "barebones"
];

/*
TODO:
 - when this is shown, the rest should be inactive i.e. make it modal
*/

var Settings = React.createClass({
  getInitialState: function() {
    return {
      theme: "light",
      layout: "default"
    };
  },

  handleThemeChanged: function(e) {
    console.log("handleThemeChanged");
  },

  handleLayoutChanged: function(e) {
    console.log("handleLayoutChanged");
  },

  renderThemesSelect: function(themes, selected) {
    var options = themes.map(function(theme) {
      return <option key={theme}>{theme}</option>;
    });
    return (
      <select value={selected} onChange={this.handleThemeChanged}>{options}</select>
    );
  },

  renderLayoutsSelect: function(layouts, selected) {
    var options = layouts.map(function(layout) {
      return <option key={layout}>{layout}</option>;
    });
    return (
      <select value={selected} onChange={this.handleLayoutChanged}>{options}</select>
    );
  },

  handleOk: function(e) {
    e.preventDefault();
    actions.notifyHideSettings();
  },

  handleCancel: function(e) {
    e.preventDefault();
    actions.notifyHideSettings();
  },

  render: function() {
    var layouts = this.renderLayoutsSelect(allLayouts, this.state.layout);
    var themes = this.renderThemesSelect(allThemes, this.state.theme);
    return (
      <div id="settings">
        <div className="settings-div">
          Layout: {layouts}
        </div>
        <div className="settings-div">
          Theme: {themes}
        </div>
        <div className="settings-buttons">
          <button onClick={this.handleOk}>Ok</button>
          <button onClick={this.handleCancel}>Cancel</button>
        </div>
      </div>
    );
  }
});

module.exports = Settings;

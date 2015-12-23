/* jshint -W097,-W117 */
'use strict';

var React = require('react');
var ReactDOM = require('react-dom');

var action = require('./action.js');

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
    var theme = e.target.value;
    console.log("handleThemeChanged: ", theme);
    this.setState({
      theme: theme
    });
    $("body").removeClass();
    $("body").addClass("theme-" + theme);
  },

  handleLayoutChanged: function(e) {
    var layout = e.target.value;
    console.log("handleLayoutChanged: ", layout);
    this.setState({
      layout: layout
    });
    $("body").attr("data-spacing", layout);
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
    action.hideSettings();
  },

  handleCancel: function(e) {
    e.preventDefault();
    action.hideSettings();
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

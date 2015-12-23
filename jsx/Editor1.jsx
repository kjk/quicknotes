/* jshint -W097,-W117 */
'use strict';

var React = require('react');
var ReactDOM = require('react-dom');

var Overlay = require('./Overlay.jsx');

var Editor = React.createClass({

  getInitialState: function() {
    var dy = window.innerHeight;
    var middle = dy / 2;
    return {
      top: middle + "px"
    };
  },

  render: function() {
    var style1 = {
      top: this.state.top
    };

    return (
      <div style={style1} id="editor-wrapper">
      </div>
    );
  },

  render2: function() {
    return (
      <div id="editor-wrapper">
        <div id="editor-title-and-tags">
          <input id="editor-title" type="text" size="128" placeholder="title"/>
          <input id="editor-tags" type="text" size="128" placeholder="tags"/>
        </div>

        <div id="editor-content">
          content
        </div>

        <div id="editor-actions">
          <button className="btn btn-primary">Save</button>
          <button className="btn btn-primary">Cancel</button>
          <span>Format:</span>
          <select value="text">
            <option>text</option>
            <option>markdown</option>
          </select>
          <span>Type:</span>
          <select value="text">
            <option>private</option>
            <option>public</option>
          </select>
        </div>
      </div>
    );
  }

});

var AppEditor = React.createClass({
  render: function() {
    return (
      <div>
        <Overlay></Overlay>
        <Editor></Editor>
      </div>
    );
  }
});

function appEditorStart() {
  ReactDOM.render(
    <AppEditor/>,
    document.getElementById('main')
  );
}

window.appEditorStart = appEditorStart;

module.exports = Editor;

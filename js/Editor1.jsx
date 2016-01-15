import React, { Component, PropTypes } from 'react';
import ReactDOM from 'react-dom';
import { Overlay } from './Overlay.jsx';

export default class Editor extends Component {
  constructor(props, context) {
    super(props, context);
    const dy = window.innerHeight;
    const middle = dy / 2;

    this.state = {
      top: middle + 'px'
    };
  }

  render2() {
    return (
      <div id="editor-wrapper">
        <div id="editor-title-and-tags">
          <input id="editor-title"
            type="text"
            size="128"
            placeholder="title" />
          <input id="editor-tags"
            type="text"
            size="128"
            placeholder="tags" />
        </div>
        <div id="editor-content">
          content
        </div>
        <div id="editor-actions">
          <button className="btn btn-primary">
            Save
          </button>
          <button className="btn btn-primary">
            Cancel
          </button>
          <span>Format:</span>
          <select value="text">
            <option>
              text
            </option>
            <option>
              markdown
            </option>
          </select>
          <span>Type:</span>
          <select value="text">
            <option>
              private
            </option>
            <option>
              public
            </option>
          </select>
        </div>
      </div>
      );
  }

  render() {
    const style1 = {
      top: this.state.top
    };

    return <div style={ style1 } id="editor-wrapper"></div>;
  }

}

class AppEditor extends React.Component {
  render() {
    return (
      <Overlay>
        <Editor />
      </Overlay>
      );
  }
}

function appEditorStart() {
  ReactDOM.render(
    <AppEditor/>,
    document.getElementById('main')
  );
}

window.appEditorStart = appEditorStart;

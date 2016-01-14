import React from 'react';
import ReactDOM from 'react-dom';
import CodeMirror from 'codemirror';

// https://github.com/facebook/react/blob/master/docs/_js/live_editor.js
// A slightly different implementation:
// https://github.com/ForbesLindesay/react-code-mirror/blob/master/index.js
// https://github.com/joelburget/react-live-editor/blob/master/code-mirror-editor.jsx
const IS_MOBILE = (
navigator.userAgent.match(/Android/i) ||
  navigator.userAgent.match(/webOS/i) ||
  navigator.userAgent.match(/iPhone/i) ||
  navigator.userAgent.match(/iPad/i) ||
  navigator.userAgent.match(/iPod/i) ||
  navigator.userAgent.match(/BlackBerry/i) ||
  navigator.userAgent.match(/Windows Phone/i)
);

export default class CodeMirrorEditor extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.handleChange = this.handleChange.bind(this);
  }

  componentDidMount() {
    if (IS_MOBILE) return;

    const opts = {
      mode: this.props.mode,
      lineNumbers: this.props.lineNumbers,
      lineWrapping: true,
      smartIndent: false, // javascript mode does bad things with jsx indents
      matchBrackets: true,
      theme: 'solarized-light',
      readOnly: this.props.readOnly
    };
    this.editor = CodeMirror.fromTextArea(this.editorNode, opts);
    this.editor.on('change', this.handleChange);
  }

  componentDidUpdate() {
    if (this.props.readOnly) {
      this.editor.setValue(this.props.codeText);
    }
  }

  handleChange() {
    if (!this.props.readOnly && this.props.onChange) {
      this.props.onChange(this.editor.getValue());
    }
  }

  render() {
    if (IS_MOBILE) {
      return (
        <pre className={ this.props.className } style={ {  overflow: 'scroll'} }>{ this.props.codeText }</pre>
        );
    } else {
      const setEditor = el => this.editorNode = el;
      return (
        <div className={ this.props.className }>
          <textarea ref={ setEditor } defaultValue={ this.props.codeText } />
        </div>
        );
    }
  }
}

CodeMirrorEditor.defaultProps = {
  lineNumbers: false
};

CodeMirrorEditor.propTypes = {
  lineNumbers: React.PropTypes.bool,
  onChange: React.PropTypes.func,
  mode: React.PropTypes.string,
  readOnly: React.PropTypes.bool,
  codeText: React.PropTypes.string,
  className: React.PropTypes.string
};

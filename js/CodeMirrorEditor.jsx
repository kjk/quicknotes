import React, { Component, PropTypes } from 'react';
import CodeMirror from 'codemirror';

// adapted from:
// https://github.com/facebook/react/blob/master/docs/_js/live_editor.js#L16

// also used as an example:
// https://github.com/facebook/react/blob/master/src/browser/ui/dom/components/ReactDOMInput.js

const isMobile = typeof navigator === 'undefined' || (
  navigator.userAgent.match(/Android/i)
  || navigator.userAgent.match(/webOS/i)
  || navigator.userAgent.match(/iPhone/i)
  || navigator.userAgent.match(/iPad/i)
  || navigator.userAgent.match(/iPod/i)
  || navigator.userAgent.match(/BlackBerry/i)
  || navigator.userAgent.match(/Windows Phone/i)
);

export default class CodeMirrorEditor extends Component {

  constructor(props, context) {
    super(props, context);

    this.handleChange = this.handleChange.bind(this);

    this.state = {
      isControlled: this.props.value != null
    };
  }

  componentDidMount() {
    const isTextArea = this.props.forceTextArea || isMobile;
    if (isTextArea) {
      return;
    }
    this.editor = CodeMirror.fromTextArea(this.editorNode, this.props);
    this.editor.on('change', this.handleChange);
    this.props.onEditorCreated && this.props.onEditorCreated(this.editor);
  }

  componentDidUpdate() {
    if (!this.editor || !this.props.value) {
      return;
    }
    if (this.editor.getValue() !== this.props.value) {
      this.editor.setValue(this.props.value);
    }
  }

  handleChange() {
    if (!this.editor) {
      return;
    }
    var value = this.editor.getValue();
    if (value === this.props.value) {
      return;
    }

    this.props.onChange && this.props.onChange({
      target: {
        value: value
      }
    });

    if (this.editor.getValue() !== this.props.value) {
      if (this.state.isControlled) {
        this.editor.setValue(this.props.value);
      } else {
        this.props.value = value;
      }
    }
  }

  render() {
    const setEditorNode = n => this.editorNode = n;
    const editor = React.createElement('textarea', {
      ref: setEditorNode,
      value: this.props.value,
      readOnly: this.props.readOnly,
      defaultValue: this.props.defaultValue,
      onChange: this.props.onChange,
      style: this.props.textAreaStyle,
      className: this.props.textAreaClassName || this.props.textAreaClass
    });

    return React.createElement('div', {
      style: this.props.style,
      className: this.props.className
    }, editor);
  }
}

CodeMirrorEditor.propTypes = {
  value: PropTypes.string,
  defaultValue: PropTypes.string,
  style: PropTypes.object,
  className: PropTypes.string,
  onChange: PropTypes.func,
  onEditorCreated: PropTypes.func,
  forceTextArea: PropTypes.bool,
  readOnly: PropTypes.bool,
  textAreaStyle: PropTypes.object,
  textAreaClassName: PropTypes.string,
  textAreaClass: PropTypes.string
};

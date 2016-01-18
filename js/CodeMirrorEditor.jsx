import React, { Component, PropTypes } from 'react';
import ReactDOM from 'react-dom';
import CodeMirror from 'codemirror';

// some references
// https://github.com/facebook/react/blob/master/docs/_js/live_editor.js
// https://github.com/Live4Code/react-codemirror/blob/master/codemirror/app/components/CodeMirror.jsx
//https://github.com/yuyu1911/wangzhe_learning/blob/master/src/javascripts/react-codemirror.jsx
// https://github.com/JedWatson/react-codemirror/blob/master/src/Codemirror.js
// https://github.com/JedWatson/react-md-editor
// https://github.com/ForbesLindesay/react-code-mirror/blob/master/standalone.js

export default class CodeMirrorEditor extends Component {

  constructor(props, context) {
    super(props, context);

    this.handleChange = this.handleChange.bind(this);
  }

  componentDidMount() {
    const node = ReactDOM.findDOMNode(this.refs.editorNode);
    this.cm = CodeMirror.fromTextArea(node, this.props);
    this.cm.on('change', this.handleChange);
    this.props.onEditorCreated && this.props.onEditorCreated(this.cm);
  }

  shouldComponentUpdate(nextProps) {
    return false;
  }

  componentDidUpdate() {
    if (this.cm && this.props.readOnly) {
      this.cm.setValue(this.props.value);
    }
  }

  componentWillUnmount() {
    this.cm.off('change', this.handleChange);
  }

  handleChange() {
    if (!this.props.readOnly && this.props.onChange) {
      this.props.onChange(this.cm);
    }
  }

  render() {
    console.log('CodeMirrorEditor.render');
    const editor = (
    <textarea ref="editorNode"
      defaultValue={ this.props.defaultValue }
      style={ this.props.textAreaStyle }
      className={ this.props.textAreaClassNames } />
    );

    return (
      <div style={ this.props.style } className={ this.props.className }>
        { editor }
      </div>
      );
  }
}

CodeMirrorEditor.propTypes = {
  defaultValue: PropTypes.string,
  style: PropTypes.object,
  className: PropTypes.string,
  onChange: PropTypes.func,
  onEditorCreated: PropTypes.func,
  readOnly: PropTypes.bool,
  textAreaStyle: PropTypes.object,
  textAreaClassName: PropTypes.string,
};

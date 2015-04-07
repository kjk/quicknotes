// https://github.com/facebook/react/blob/master/docs/_js/live_editor.js
// A slightly different implementation:
// https://github.com/ForbesLindesay/react-code-mirror/blob/master/index.js
// https://github.com/joelburget/react-live-editor/blob/master/code-mirror-editor.jsx
var IS_MOBILE = (
  navigator.userAgent.match(/Android/i) ||
    navigator.userAgent.match(/webOS/i) ||
    navigator.userAgent.match(/iPhone/i) ||
    navigator.userAgent.match(/iPad/i) ||
    navigator.userAgent.match(/iPod/i) ||
    navigator.userAgent.match(/BlackBerry/i) ||
    navigator.userAgent.match(/Windows Phone/i)
);

var CodeMirrorEditor = React.createClass({
  propTypes: {
    lineNumbers: React.PropTypes.bool,
    onChange: React.PropTypes.func
  },

  getDefaultProps: function() {
    return {
      lineNumbers: false
    };
  },

  componentDidMount: function() {
    if (IS_MOBILE) return;

    this.editor = CodeMirror.fromTextArea(React.findDOMNode(this.refs.editor), {
      mode: this.props.mode,
      lineNumbers: this.props.lineNumbers,
      lineWrapping: true,
      smartIndent: false,  // javascript mode does bad things with jsx indents
      matchBrackets: true,
      theme: 'solarized-light',
      readOnly: this.props.readOnly
    });
    this.editor.on('change', this.handleChange);
  },

  componentDidUpdate: function() {
    if (this.props.readOnly) {
      this.editor.setValue(this.props.codeText);
    }
  },

  handleChange: function() {
    if (!this.props.readOnly) {
      this.props.onChange && this.props.onChange(this.editor.getValue());
    }
  },

  render: function() {
    var editor;

    if (IS_MOBILE) {
      return (
        <pre className={this.props.className} style={{overflow: 'scroll'}}>{this.props.codeText}</pre>
      );
    } else {
      return (
        <div className={this.props.className}>
          <textarea
            ref="editor"
            className="full-composer-text-area"
            defaultValue={this.props.codeText} />
        </div>
      );
    }
  }
});

module.exports = CodeMirrorEditor;

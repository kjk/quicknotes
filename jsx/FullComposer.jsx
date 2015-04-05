/* jshint -W097,-W117 */
'use strict';

var FullComposer = React.createClass({
  render: function() {
    if (!this.props.isShown) {
      return (
        <div id="full-composer-wrapper" className="collapsed">
        </div>
      );
    }

    return (
      <div id="full-composer-wrapper">
        <div id="full-composer-top">
          <textarea id="full-composer-textarea"/>
          <div id="full-composer-preview"></div>
        </div>
        <div id="full-composer-bottom">
          <button>Save</button>
          <button>Cancel</button>
        </div>
      </div>
      );
  }
});

module.exports = FullComposer;

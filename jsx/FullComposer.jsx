/* jshint -W097 */
'use strict';

var FullComposer = React.createClass({
  render: function() {
    if (!this.props.isShown) {
      return (
        <div id="full-composer" className="collapsed">
        </div>
      )
    }

    return (
      <div id="full-composer">
        <div className="inner">
          <textarea
            id="full-composer-textarea"
          />
        </div>
      </div>
      );
  }
});

module.exports = FullComposer;

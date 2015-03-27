/* jshint -W097 */
'use strict';

var TagCount = React.createClass({

  click: function(e) {
    e.preventDefault();
    this.props.onTagSelected(this.props.tagName);
  },

  render: function() {
    var cls = "tag";
    if (this.props.isSelected) {
      cls = "tagSelected";
    }
    return (
      <div className={cls} onClick={this.click}>
        <span className="tagName">{this.props.displayName}</span>&nbsp;
        <span className="tagCount">{this.props.count}</span>
      </div>
    );
  }
});

module.exports = TagCount;

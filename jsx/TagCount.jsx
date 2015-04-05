/* jshint -W097,-W117 */
'use strict';

var TagCount = React.createClass({

  click: function(e) {
    e.preventDefault();
    this.props.onTagSelected(this.props.tagName);
  },

  render: function() {
    var cls = "tag";
    if (this.props.isSelected) {
      cls = "tag selected";
    }
    return (
      <div className={cls} onClick={this.click}>
        <span className="tag-name">{this.props.displayName}</span>
        <span className="tag-count">{this.props.count}</span>
      </div>
    );
  }
});

module.exports = TagCount;

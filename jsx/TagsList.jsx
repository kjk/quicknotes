/* jshint -W097 */
'use strict';

var TagCount = require('./TagCount.jsx');
var utils = require('./utils.js');

var TagsList = React.createClass({
  render: function() {
    var sectionName = this.props.sectionName;
    var tagNames = this.props.tagNames;
    var tags = this.props.tags;
    var selectedTag=this.props.selectedTag;
    var onTagSelected=this.props.onTagSelected;

    var tagEls = tagNames.map(function (tagName) {
      var count = tags[tagName];
      var displayName = utils.tagNameToDisplayName(tagName);
      var isSelected = (tagName == selectedTag);
      return (
        <TagCount
          onTagSelected={onTagSelected}
          isSelected={isSelected}
          displayName={displayName}
          tagName={tagName}
          count={count}
          key={tagName}
        />
      );
    });

    return (
      <div className="tagsList">
        {tagEls}
      </div>
    );
  }
});

module.exports = TagsList;

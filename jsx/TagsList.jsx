import React from 'react';
import TagCount from './TagCount.jsx';
import u from './utils.js';

export default class TagsList extends React.Component {
  render() {
    var sectionName = this.props.sectionName;
    var tagNames = this.props.tagNames;
    var tags = this.props.tags;
    var selectedTag=this.props.selectedTag;
    var onTagSelected=this.props.onTagSelected;

    var tagEls = tagNames.map(function (tagName) {
      var count = tags[tagName];
      var displayName = u.tagNameToDisplayName(tagName);
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
      <div className="tags-list">
        {tagEls}
      </div>
    );
  }
}

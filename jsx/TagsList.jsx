import React from 'react';
import TagCount from './TagCount.jsx';
import * as u from'./utils.js';

export default class TagsList extends React.Component {
  render() {
    //var sectionName = this.props.sectionName;
    const tagNames = this.props.tagNames;
    const tags = this.props.tags;
    const selectedTag=this.props.selectedTag;
    const onTagSelected=this.props.onTagSelected;

    const tagEls = tagNames.map(function (tagName) {
      const count = tags[tagName];
      const displayName = u.tagNameToDisplayName(tagName);
      const isSelected = (tagName == selectedTag);
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

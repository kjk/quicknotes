import React, { Component } from 'react';
import TagCount from './TagCount';
import * as u from './utils';
import { TagToCount } from './Note';

function isTagSelected(selectedTags: string[], tag: string) {
  return selectedTags.indexOf(tag) != -1;
}

interface Props {
  tagNames: string[];
  tags: TagToCount;
  selectedTags: string[];
  sectionName: string;
}

export default class TagsList extends Component<Props, any> {
  render() {
    //console.log("TagsList render");
    //var sectionName = this.props.sectionName;
    const tagNames = this.props.tagNames;
    const tags = this.props.tags;
    const selectedTags = this.props.selectedTags;

    const tagEls = tagNames.map(tagName => {
      const count = tags[tagName];
      const displayName = u.tagNameToDisplayName(tagName);
      const isSelected = isTagSelected(selectedTags, tagName);
      return (
        <TagCount
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

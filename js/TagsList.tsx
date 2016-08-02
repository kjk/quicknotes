/// <reference path="../typings/index.d.ts" />

import React, { Component, PropTypes } from 'react';
import TagCount from './TagCount';
import * as u from './utils';

function isTagSelected(selectedTags, tag) {
  return selectedTags.indexOf(tag) != -1;
}

/*
TagsList.propTypes = {
  tagNames: PropTypes.arrayOf(PropTypes.string),
  tags: PropTypes.object, // TODO: more specific
  selectedTags: PropTypes.array
};
*/

interface Props {
  tagNames: string[];
  tags: any;
  selectedTags: any;
  sectionName: any;
}

export default class TagsList extends Component<Props, {}> {

  render() {
    //console.log("TagsList render");
    //var sectionName = this.props.sectionName;
    const tagNames = this.props.tagNames;
    const tags = this.props.tags;
    const selectedTags = this.props.selectedTags;

    const tagEls = tagNames.map((tagName) => {
      const count = tags[tagName];
      const displayName = u.tagNameToDisplayName(tagName);
      const isSelected = isTagSelected(selectedTags, tagName);
      return (
        <TagCount isSelected={ isSelected }
          displayName={ displayName }
          tagName={ tagName }
          count={ count }
          key={ tagName } />
      );
    });

    return (
      <div className='tags-list'>
        { tagEls }
      </div>
    );
  }
}

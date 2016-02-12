'use strict';

import React, { Component, PropTypes } from 'react';
import ReactDOM from 'react-dom';
import TagsList from './TagsList.jsx';
import * as u from './utils.js';

const showDeletedTag = true;

export default class LeftSidebar extends Component {
  renderTagsList(sectionName, tagNames, tags) {
    if (tagNames.length === 0) {
      return;
    }

    return (
      <TagsList sectionName={ sectionName }
        tagNames={ tagNames }
        tags={ tags }
        selectedTag={ this.props.selectedTag }
        onTagSelected={ this.props.onTagSelected } />
      );
  }

  render() {
    const tags = this.props.tags;
    if (!tags) {
      return (
        <div id="leftSidebar">
        </div>
        );
    }
    let tagNames = [];
    let specialTagNames = [];

    for (let tagName in tags) {
      if (!u.isSpecialTag(tagName)) {
        tagNames.push(tagName);
      }
    }
    tagNames.sort();

    if (this.props.showingMyNotes) {
      // add special tags: all, public, deleted (in reverse order)
      if (showDeletedTag) {
        specialTagNames.unshift('__deleted');
      }
      specialTagNames.unshift('__private');
      specialTagNames.unshift('__public');
      specialTagNames.unshift('__starred');
      specialTagNames.unshift('__all');
    } else {
      tagNames.unshift('__all');
    }

    const specialTagsList = this.renderTagsList('SPECIAL', specialTagNames, tags);
    const tagsList = this.renderTagsList('TAGS', tagNames, tags);
    return (
      <div id="left-sidebar">
        { specialTagsList }
        { tagsList }
      </div>
      );
  }
}

LeftSidebar.propTypes = {
  onTagSelected: PropTypes.func.isRequired,
  tags: PropTypes.object, // TODO: more specific
  showingMyNotes: PropTypes.bool.isRequired,
  selectedTag: PropTypes.string
};

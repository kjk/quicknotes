import React, { Component, PropTypes } from 'react';
import * as ReactDOM from 'react-dom';
import TagsList from './TagsList';
import * as u from './utils';

const showDeletedTag = true;

interface Props {
  tags: any;
  showingMyNotes: boolean;
  selectedTags: string[];
}

export default class LeftSidebar extends Component<Props, {}> {
  renderTagsList(sectionName: string, tagNames: any, tags: any) {
    if (tagNames.length === 0) {
      return;
    }

    return (
      <TagsList sectionName={ sectionName }
        tagNames={ tagNames }
        tags={ tags }
        selectedTags={ this.props.selectedTags } />
    );
  }

  render() {
    const tags = this.props.tags;
    if (!tags) {
      return (
        <div id='leftSidebar'>
        </div>
      );
    }
    let tagNames: string[] = [];
    let specialTagNames: any = [];

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
      <div id='left-sidebar'>
        { specialTagsList }
        { tagsList }
      </div>
    );
  }
}

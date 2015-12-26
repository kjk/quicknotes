/* jshint -W097,-W117 */
'use strict';

var React = require('react');
var ReactDOM = require('react-dom');

var TagsList = require('./TagsList.jsx');
var u = require('./utils.js');

var showDeletedTag = true;

class LeftSidebar extends React.Component {
  renderTagsList(sectionName, tagNames, tags) {
    if (tagNames.length === 0) {
      return;
    }

    return (
      <TagsList
        sectionName={sectionName}
        tagNames={tagNames}
        tags={tags}
        selectedTag={this.props.selectedTag}
        onTagSelected={this.props.onTagSelected}
      />
    );
  }

  render() {
    var tags = this.props.tags;
    if (!tags) {
      return (
        <div id="leftSidebar">
        </div>
      );
    }
    var tagNames = [];
    var specialTagNames = [];

    for (var tagName in tags) {
      if (!u.isSpecialTag(tagName)) {
        tagNames.push(tagName);
      }
    }
    tagNames.sort();

    if (this.props.myNotes) {
      // add special tags: all, public, deleted (in reverse order)
      if (showDeletedTag) {
        specialTagNames.unshift("__deleted");
      }
      specialTagNames.unshift("__private");
      specialTagNames.unshift("__public");
      specialTagNames.unshift("__starred");
      specialTagNames.unshift("__all");
    } else {
      tagNames.unshift("__all");
    }

    var specialTagsList = this.renderTagsList("SPECIAL", specialTagNames, tags);
    var tagsList = this.renderTagsList("TAGS", tagNames, tags);
    return (
      <div id="left-sidebar">
        {specialTagsList}
        {tagsList}
      </div>
    );
  }
}

module.exports = LeftSidebar;

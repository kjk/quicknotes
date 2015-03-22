var TagCount = require('./TagCount.jsx');

var showDeletedTag = true;

var specialTagNames = {
  __all: "all",
  __public: "public",
  __deleted: "deleted"
};

function isSpecialTag(tag) {
  return specialTagNames[tag];
}

function tagNameToDisplayName(tagName) {
  var translated = specialTagNames[tagName];
  if (!translated) {
    return tagName;
  }
  return translated;
}

function getTagCountTuple(tagToCount, tag) {
  return [tag, tagToCount[tag]];
}

var LeftSidebar = React.createClass({
  render: function() {
    var tags = this.props.tags;
    if (!tags) {
      return (
        <div id="leftSidebar">
        </div>
      );
    }
    var tagNames = [];
    for (var tagName in tags) {
      if (!isSpecialTag(tagName)) {
        tagNames.push(tagName);
      }
    }
    tagNames.sort();

    // add special tags: all, public, deleted (in reverse order)
    if (showDeletedTag) {
      tagNames.unshift("__deleted");
    }
    var nPublic = tags.__public;
    if (this.props.showPublicTags && nPublic > 0) {
      tagNames.unshift("__public");
    }
    tagNames.unshift("__all");

    var onTagSelected=this.props.onTagSelected;
    var tagEls = tagNames.map(function (tagName) {
      var count = tags[tagName];
      var displayName = tagNameToDisplayName(tagName);
      return (
        <TagCount onTagSelected={onTagSelected}
          displayName={displayName}
          tagName={tagName}
          count={count}
          key={tagName} />
      );
    });
    return (
      <div id="leftSidebar">
          {tagEls}
      </div>
    );
  }
});

module.exports = LeftSidebar;

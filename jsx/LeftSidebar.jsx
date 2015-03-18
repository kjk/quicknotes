var TagCount = require('./TagCount.jsx');

var LeftSidebar = React.createClass({
  render: function() {
    var tags = this.props.tags;
    if (!tags) {
      return (
        <div id="leftSidebar">
        </div>
      );
    }
    var tagsArr = new Array();
    for (var key in tags) {
      var el = [key, tags[key]];
      tagsArr.push(el);
    }
    tagsArr.sort(function (a, b) {
      // sort by name, which is first element of 2-element array
      if (a[0] > b[0]) {
        return 1;
      }
      if (a[0] < b[0]) {
        return -1;
      }
      return 0;
    })
    var onTagSelected=this.props.onTagSelected;
    var tagEls = tagsArr.map(function (tagNameCount) {
      return (
        <TagCount onTagSelected={onTagSelected}
          name={tagNameCount[0]}
          count={tagNameCount[1]}
          key={tagNameCount[0]} />
      )
    });
    return (
      <div id="leftSidebar">
          {tagEls}
      </div>
    );
  }
});

module.exports = LeftSidebar;

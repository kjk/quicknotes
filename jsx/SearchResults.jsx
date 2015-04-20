/* jshint -W097,-W117 */
'use strict';

var utils = require('./utils.js');
var format = require('./format.js');

var TypeTitle = 1;
var TypeLine = 2;

/*
Format of search results:
{
  Term: "foo",
  Results: [
    {
      NoteIDStr: "1XRy",
      Items: [
        {
          Type: 1,
          LineNo: 5,
          HTML: 'foo<span class="s-r">bar</span>',
        }
      ]
    }
  ]
}
*/



var SearchResults = React.createClass({

  handleClick: function(noteIDStr, e) {
    e.preventDefault();
    this.props.searchResultSelectedCb(noteIDStr);
  },

  createNoResults: function(term) {
    return (
      <div id="search-results">
        <div className="box">
          <p>No results for {term}</p>
        </div>
      </div>
    );
  },

  createResultItem: function(i) {
      // TODO: different format for title match
      // TODO: show line number
      var k = "" + i.Type + "-" + i.LineNo;
      var html = { __html: i.HTML };
      return (
        <div
          key={k}
          className="search-result-item"
          dangerouslySetInnerHTML={html}
          ></div>
      );
  },

  createResultNote: function(o) {
    var noteID = o.NoteIDStr;
    var cb = this.handleClick.bind(this, noteID);
    var items = o.Items;
    var self = this;
    var results = items.map(function(i) {
      return self.createResultItem(i);
    });
    return (
      <div
        key={noteID}
        className="search-result-note"
        onClick={cb}>
        {results}
      </div>
    );
  },

  render: function() {
    var searchResults = this.props.searchResults;
    var results = searchResults.Results;
    if (!results || (results.length === 0)) {
      return this.createNoResults(searchResults.Term);
    }

    var self = this;
    var resultsHTML = results.map(function(o) {
      return self.createResultNote(o);
    });

    return (
      <div id="search-results">
        <div className="search-results-list">
          {resultsHTML}
        </div>
      </div>
    );
  }
});

module.exports = SearchResults;

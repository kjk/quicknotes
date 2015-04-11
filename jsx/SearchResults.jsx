/* jshint -W097,-W117 */
'use strict';

var utils = require('./utils.js');
var format = require('./format.js');

var maxResults = 100;

// TODO: make search results more compact by sending an array of arrays

/*
Format of search results:
{
  Term: "foo",
  Results: [
    {
      NoteIDStr: "1XRy",
      PreviewHTML: "result"
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
    return <div id="search-results">
      No results for {term}
    </div>;
  },

  createResult: function(o) {
    var noteID = o.NoteIDStr;
    var cb = this.handleClick.bind(this, noteID);
    return (
      <pre
        key={noteID}
        className="search-result"
        onClick={cb}>
        {o.PreviewHTML}
      </pre>
    );
  },

  render: function() {
    var searchResults = this.props.searchResults;
    var results = searchResults.Results;
    if (!results || (results.length === 0)) {
      return this.createNoResults(searchResults.Term);
    }

    results = results.slice(0, maxResults);
    var self = this;
    var resultsHTML = results.map(function(o) {
      return self.createResult(o);
    });

    return (
      <div id="search-results">
        {resultsHTML}
      </div>
    );
  }
});

module.exports = SearchResults;

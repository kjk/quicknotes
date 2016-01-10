import React from 'react';

const TypeTitle = 1;
const TypeLine = 2;

// if true, show line number at the beginning of search results
const showLineNumbers = true;

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

const NoResults = (props) => {
  return (
    <div id="search-results">
      <div className="box">
        <p>
          No results for
          { props.term }
        </p>
      </div>
    </div>
    );
};

NoResults.propTypes = {
  term: React.PropTypes.string
};


export default class SearchResults extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick(noteIDStr, e) {
    e.preventDefault();
    this.props.onSearchResultSelected(noteIDStr);
  }

  renderResultItem(noteID, i, n) {
    // Maybe: show line number
    const k = noteID + '-' + i.Type + '-' + i.LineNo + '-' + n;
    //console.log(k);
    const cls = i.Type == TypeTitle ? 'search-result-title-item' : 'search-result-item';
    let lineNo = i.LineNo + ':';
    if (i.LineNo == -1) {
      lineNo = '';
    }
    if (!showLineNumbers) {
      lineNo = '';
    }
    return (
      <div key={ k } className={ cls }>
        <span className="line-no">{ lineNo }</span>
        <span dangerouslySetInnerHTML={ {  __html: i.HTML} }></span>
      </div>
      );
  }

  renderResultNote(o) {
    const noteID = o.NoteIDStr;
    const cb = this.handleClick.bind(this, noteID);
    let n = 0;
    const children = o.Items.map((i) => {
      n++;
      return this.renderResultItem(noteID, i, n);
    });
    return (
      <div key={ noteID } className="search-result-note" onClick={ cb }>
        { children }
      </div>
      );
  }

  render() {
    const searchResults = this.props.searchResults;
    const term = searchResults.Term;
    const results = searchResults.Results;
    if (!results || (results.length === 0)) {
      return <NoResults term={ term } />;
    }

    const resultsHTML = results.map((o) => {
      return this.renderResultNote(o);
    });

    return (
      <div id="search-results">
        <div className="search-results-list">
          { resultsHTML }
        </div>
      </div>
      );
  }
}

SearchResults.propTypes = {
  term: React.PropTypes.string,
  onSearchResultSelected: React.PropTypes.func,
  searchResults: React.PropTypes.object, // TODO: more specific
};

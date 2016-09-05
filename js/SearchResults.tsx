import React from 'react';
import Overlay from './Overlay';
import * as action from './action';
import * as api from './api';

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
      NoteHashID: "1XRy",
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

interface State {
  searchResults: any;
}

/*
SearchResults.propTypes = {
  onSearchResultSelected: React.PropTypes.func,
};
*/
interface Props {
  onSearchResultSelected: any;
}

export default class SearchResults extends React.Component<Props, State> {
  currSearchTerm: any;
  searchDelayTimerID: any;

  constructor(props?: Props, context?: any) {
    super(props, context);

    this.handleClick = this.handleClick.bind(this);
    this.handleOverlayClick = this.handleOverlayClick.bind(this);
    this.handleStartSearchDelayed = this.handleStartSearchDelayed.bind(this);
    this.handleClearSearchTerm = this.handleClearSearchTerm.bind(this);
    this.startSearch = this.startSearch.bind(this);

    this.currSearchTerm = null;
    this.searchDelayTimerID = null;
    this.state = {
      searchResults: null
    };
  }

  componentDidMount() {
    action.onStartSearchDelayed(this.handleStartSearchDelayed, this);
    action.onClearSearchTerm(this.handleClearSearchTerm, this);
  }

  componentWillUnmount() {
    action.offAllForOwner(this);
  }

  startSearch(userID: any, searchTerm: string) {
    this.currSearchTerm = searchTerm;
    if (searchTerm === '') {
      return;
    }
    api.searchUserNotes(userID, searchTerm, (json: any) => {
      console.log('finished search for ' + json.Term);
      if (json.Term != this.currSearchTerm) {
        console.log('discarding search results because not for ' + this.currSearchTerm);
        return;
      }
      this.setState({
        searchResults: json
      });
    });
  }

  handleClearSearchTerm() {
    // user cancelled the search
    this.currSearchTerm = '';
    clearTimeout(this.searchDelayTimerID);
    this.setState({
      searchResults: null
    });
  }

  handleStartSearchDelayed(userHashID: string, searchTerm: string) {
    this.currSearchTerm = searchTerm;
    // start search query with a delay to not hammer the server too much
    if (this.searchDelayTimerID) {
      clearTimeout(this.searchDelayTimerID);
    }
    this.searchDelayTimerID = setTimeout(() => {
      console.log('starting search for ' + searchTerm);
      this.startSearch(userHashID, searchTerm);
    }, 300);
  }

  handleClick(noteHashID: any, e: any) {
    this.props.onSearchResultSelected(noteHashID);
    this.setState({
      searchResults: null
    });
    action.clearSearchTerm();
  }

  handleOverlayClick(e: any) {
    this.setState({
      searchResults: null
    });
    action.clearSearchTerm();
  }

  renderResultItem(noteID: any, i: any, n: any) {
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
      <div key={k} className={cls}>
        <span className='line-no'>{lineNo}</span>
        <span dangerouslySetInnerHTML={{ __html: i.HTML }}></span>
      </div>
    );
  }

  renderResultNote(o: any) {
    const noteID = o.NoteHashID;
    const cb = this.handleClick.bind(this, noteID);
    let n = 0;
    const children = o.Items.map((i: any) => {
      n++;
      return this.renderResultItem(noteID, i, n);
    });
    return (
      <div key={noteID} className='search-result-note' onClick={cb}>
        {children}
      </div>
    );
  }

  renderNoResults(term: string) {
    return (
      <div className='box'>
        <p>
          No results for: <b>{term}</b>
        </p>
      </div>
    );
  }

  render() {
    const searchResults = this.state.searchResults;
    if (searchResults == null) {
      return null;
    }

    const term = searchResults.Term;
    const results = searchResults.Results;
    let inner: any;
    if (!results || (results.length === 0)) {
      inner = this.renderNoResults(term);
    } else {
      inner = results.map((o: any) => {
        return this.renderResultNote(o);
      });
    }

    return (
      <Overlay onClick={this.handleOverlayClick}>
        <div id='search-results-wrapper'>
          <div id='search-results-triangle-wrapper'></div>
          <div className='search-results-list'>
            {inner}
          </div>
        </div>
      </Overlay>
    );
  }
}

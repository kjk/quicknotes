import React, { Component } from 'react';
import * as ReactDOM from 'react-dom';
import page from 'page';

import ConnectionStatus from './ConnectionStatus';
import Editor from './Editor';
import ImportSimpleNote from './ImportSimpleNote';
import { LogInLink } from './LogInLink';
import NotesList from './NotesList';
import SearchResults from './SearchResults';
import Settings from './Settings';
import TemporaryMessage from './TemporaryMessage';

import { Note, toNotes } from './Note';
import * as action from './action';

const stHeader: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'nowrap',
  justifyContent: 'space-between',
}

const stHeaderLinks: React.CSSProperties = {
  marginRight: 16,
}

// like Top but only for index page
export class TopIndex extends Component<any, any> {

  constructor(props?: any, context?: any) {
    super(props, context);
  }

  render() {
    let userUrl: string = null;
    if (gLoggedUser) {
      userUrl = '/u/' + gLoggedUser.HashID + '/' + gLoggedUser.Handle;
    }

    return (
      <div id='header' style={stHeader}>
        <a id='logo' className='logo colored' href='/'>QuickNotes</a>
        {userUrl ?
          <a href={userUrl} className='header-link' style={stHeaderLinks}>Your Notes</a> : <LogInLink />
        }
      </div>
    );
  }
}


const stWrapper: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflow: 'auto',
}

const stContainer: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'nowrap',
  backgroundColor: '#fdfdfd',
  width: '100%',
}

const stLeft: React.CSSProperties = {
  flexBasis: 40,
  //backgroundColor: 'lightcyan',
}

const stScreenshotContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  justifyContent: 'center',

  flexGrow: 2,
  flexShrink: 2,
  alignItems: 'center',
  fontSize: '2em',
  //backgroundColor: 'lightblue',
}

const stScreenshot: React.CSSProperties = {
  // note: this doesn't work despite internet advice
  // needs inline-block wrapper?
  // http://stackoverflow.com/questions/3380252/how-to-create-proportional-image-height-width
  /*maxWidth: '80%',
  height: 'auto',
  */
  maxHeight: 600,
}

const stRight: React.CSSProperties = {
  flexBasis: 40,
  //backgroundColor: 'lightcyan',
}

const stTagline: React.CSSProperties = {
  textAlign: 'center',
  marginTop: 56,
}

const stLinkContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  //backgroundColor: '#fcfcfc',
  justifyContent: 'center',
  marginBottom: 8,
  marginTop: -12,
  fontSize: '1.3em',
}

const images: string[] = [
  '/s/img/shot-index.png',
  '/s/img/shot-edit.png',
  '/s/img/shot-search.png',
  '/s/img/shot-note-view.png',
];

interface State {
  imgNo: number,
}

export default class AppIndex extends Component<any, State> {
  constructor(props: any, context: any) {
    super(props, context);

    this.nextImage = this.nextImage.bind(this);
    this.prevImage = this.prevImage.bind(this);


    this.state = {
      imgNo: 0,
    }
  }

  goToYourNotes(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    console.log('goToYourNotes');
    const uri = `/u/${gLoggedUser.HashID}/${gLoggedUser.Handle}`;
    page(uri);
  }

  nextImage(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const newImgNo = (this.state.imgNo + 1) % images.length;
    this.setState({
      imgNo: newImgNo,
    })
  }

  prevImage(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    const newImgNo = (this.state.imgNo - 1 + images.length) % images.length;
    this.setState({
      imgNo: newImgNo,
    })
  }

  render() {
    // console.log('AppIndex: gLoggedUser: ', gLoggedUser);
    const imgURL = images[this.state.imgNo];

    return (
      <div style={stWrapper}>
        <TopIndex />
        <div style={stTagline}>
          <h1>QuickNotes is the fastest way to take notes</h1>
        </div>
        <div style={stContainer}>
          <div style={stLeft}></div>
          <div style={stScreenshotContainer}>
            <a className='header-link' href='#' onClick={this.prevImage}>
              <i className='fa fa-chevron-left'></i>
            </a>
            <img style={stScreenshot} src={imgURL} />
            <a className='header-link' href='#' onClick={this.nextImage}>
              <i className='fa fa-chevron-right'></i>
            </a>
          </div>
          <div style={stRight}></div>
        </div>
      </div>
    );
  }
}

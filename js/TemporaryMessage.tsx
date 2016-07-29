/// <reference path="../typings/index.d.ts" />

import React, { Component, PropTypes } from 'react';
import * as action from './action';

const hideTimeOut = 5 * 1000; // 5 secs

interface State {
  message?: any;
}

export default class TemporaryMessage extends Component<{}, State> {

  currTimerID: any;

  constructor(props, context) {
    super(props, context);

    this.showMessage = this.showMessage.bind(this);

    this.currTimerID = null;

    this.state = {
      message: null
    };
  }

  componentDidMount() {
    action.onShowTemporaryMessage(this.showMessage, this);
  }

  componentWillUnmount() {
    action.offAllForOwner(this);
  }

  showMessage(msg, delay) {
    this.setState({
      message: msg
    });
    clearTimeout(this.currTimerID);
    if (delay) {
      this.currTimerID = setTimeout(() => this.showMessage(msg, delay));
      return;
    }
    this.currTimerID = setTimeout(() => {
      this.setState({
        message: null
      });
    }, hideTimeOut);
  }

  render() {
    if (!this.state.message) {
      return <div className='hidden'></div>;
    }
    const html = {
      __html: this.state.message
    };
    return <div className='temporary-message' dangerouslySetInnerHTML={ html }></div>;
  }
}

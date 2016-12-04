import React, { Component, PropTypes } from 'react';
import * as action from './action';

interface State {
  message?: string;
}

export default class ConnectionStatus extends Component<any, State> {

  constructor(props?: any, context?: any) {
    super(props, context);

    this.showMessage = this.showMessage.bind(this);

    this.state = {
      message: null,
    };
  }

  componentDidMount() {
    action.onShowConnectionStatus(this.showMessage, this);
    const msg = action.getConnectionStatus();
    // console.log('ConnectionStatus.componentDidMount msg:', msg);
    this.showMessage(msg);
  }

  componentWillUnmount() {
    action.offAllForOwner(this);
  }

  showMessage(msg?: string) {
    // console.log('ConnectionStatus.showMessage:', msg);
    this.setState({
      message: msg
    });
  }

  render() {
    if (!this.state.message) {
      return <div className='hidden'></div>;
    }
    const html = {
      __html: this.state.message
    };
    return <div className='connection-status' dangerouslySetInnerHTML={html}></div>;
  }
}

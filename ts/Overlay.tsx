import React, { Component } from 'react';

interface Props {
  children?: any[];
  onClick?: (e: any) => void;
}

export default class Overlay extends Component<Props, any> {
  constructor(props?: Props, context?: any) {
    super(props, context);
  }

  /*
    handleClick(e) {
      this.props.onClick && this.props.onClick(e);
    }
  */

  render() {
    return (
      <div className="modal-overlay" onClick={this.props.onClick}>
        {this.props.children}
      </div>
    );
  }
}

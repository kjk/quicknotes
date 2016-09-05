import React, { Component, PropTypes } from 'react';

/*
Overlay.propTypes = {
  children: PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
  onClick: PropTypes.func
};
*/

interface Props {
  children?: any;
  onClick?: any;
}

export default class Overlay extends Component<Props, {}> {

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
      <div className='modal-overlay' onClick={this.props.onClick}>
        {this.props.children}
      </div>
    );
  }
}

'use strict';

import React, { Component, PropTypes } from 'react';

export default class Overlay extends Component {

  constructor(props, context) {
    super(props, context);
  }

  /*
    handleClick(e) {
      this.props.onClick && this.props.onClick(e);
    }
  */

  render() {
    return (
      <div className='modal-overlay' onClick={ this.props.onClick }>
        { this.props.children }
      </div>
      );
  }
}

Overlay.propTypes = {
  children: PropTypes.oneOfType([PropTypes.array, PropTypes.object]),
  onClick: PropTypes.func
};

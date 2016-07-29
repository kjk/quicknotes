/// <reference path="../typings/index.d.ts" />

import React, { Component, PropTypes } from 'react';
import * as action from './action';

/*
TagCount.propTypes = {
  count: PropTypes.number,
  displayName: PropTypes.string,
  isSelected: PropTypes.bool,
  tagName: PropTypes.string
};
*/

interface Props {
  count: number;
  displayName: string;
  isSelected: boolean;
  tagName: string;
}

export default class TagCount extends Component<Props, {}> {
  constructor(props, context) {
    super(props, context);
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick(e) {
    e.preventDefault();
    const op = e.altKey ? 'toggle' : 'set';
    action.tagSelected(this.props.tagName, op);
  }

  render() {
    const cls = this.props.isSelected ? 'tag selected' : 'tag';
    return (
      <div className={ cls } onClick={ this.handleClick }>
        <span className='tag-name'>{ this.props.displayName }</span>
        <span className='tag-count'>{ this.props.count }</span>
      </div>
      );
  }
}


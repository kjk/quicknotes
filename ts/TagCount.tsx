import React, { Component, PropTypes } from 'react';
import * as action from './action';

interface Props {
  count: number;
  displayName: string;
  isSelected: boolean;
  tagName: string;
}

export default class TagCount extends Component<Props, any> {
  constructor(props?: Props, context?: any) {
    super(props, context);
    this.onTagClicked = this.onTagClicked.bind(this);
  }

  onTagClicked(e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    const op = e.altKey ? 'toggle' : 'set';
    action.tagSelected(this.props.tagName, op);
  }

  render() {
    const cls = this.props.isSelected ? 'tag selected' : 'tag';
    return (
      <div className={cls} onClick={this.onTagClicked}>
        <span className='tag-name'>{this.props.displayName}</span>
        <span className='tag-count'>{this.props.count}</span>
      </div>
    );
  }
}

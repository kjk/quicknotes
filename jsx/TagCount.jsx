import React from 'react';

export default class TagCount extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick(e) {
    e.preventDefault();
    this.props.onTagSelected(this.props.tagName);
  }

  render() {
    const cls = this.props.isSelected ? 'tag selected' : 'tag';
    return (
      <div className={ cls } onClick={ this.handleClick }>
        <span className="tag-name">{ this.props.displayName }</span>
        <span className="tag-count">{ this.props.count }</span>
      </div>
      );
  }
}

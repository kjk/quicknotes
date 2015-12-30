import React from 'react';

export default class TagCount extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.click = this.click.bind(this);
  }

  click(e) {
    e.preventDefault();
    this.props.onTagSelected(this.props.tagName);
  }

  render() {
    const cls = this.props.isSelected ? "tag selected" : "tag";
    return (
      <div className={cls} onClick={this.click}>
        <span className="tag-name">{this.props.displayName}</span>
        <span className="tag-count">{this.props.count}</span>
      </div>
    );
  }
}

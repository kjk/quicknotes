import React, { Component, PropTypes } from 'react';
import ReactDOM from 'react-dom';

export default class DragBarHoriz extends Component {
  constructor(props, context) {
    super(props, context);

    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.isAllowed = this.isAllowed.bind(this);

    this.y = this.props.initialY;
    this.state = {
      dragging: false,
    };
  }

  componentDidUpdate(props, prevState) {
    const dragEnter = !prevState.dragging && this.state.dragging;
    const dragLeave = prevState.dragging && !this.state.dragging;
    if (dragEnter) {
      document.addEventListener('mousemove', this.handleMouseMove);
      document.addEventListener('mouseup', this.handleMouseUp);
    } else if (dragLeave) {
      document.removeEventListener('mousemove', this.handleMouseMove);
      document.removeEventListener('mouseup', this.handleMouseUp);
    }
  }

  handleMouseDown(e) {
    // only left mouse button
    if (e.button !== 0)
      return;
    e.stopPropagation();
    e.preventDefault();
    this.setState({
      dragging: true,
    });
  }

  handleMouseUp(e) {
    e.stopPropagation();
    e.preventDefault();
    this.setState({
      dragging: false,
    });
  }

  isAllowed(y) {
    const yMin = this.props.min || 0;
    const yMax = this.props.max || 9999999;
    return (y >= yMin) && (y <= yMax);
  }

  handleMouseMove(e) {
    if (!this.state.dragging) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();

    const y = e.pageY;
    if (!this.isAllowed(y)) {
      return;
    }
    this.y = y;
    const yDelta = this.props.initialY - yDelta;
    const el = ReactDOM.findDOMNode(this);
    el.style.top = y + 'px';
    this.props.onPosChanged(y, yDelta);
  }

  render() {
    const style = this.props.style || {
        position: 'fixed',
        backgroundColor: '#377CE4',
        minWidth: '100%',
        height: 3,
        cursor: 'row-resize',
        zIndex: 3,
        top: this.y
      };

    return (
      <div style={ style } onMouseDown={ this.handleMouseDown }>
      </div>
      );
  }
}

DragBarHoriz.propTypes = {
  onPosChanged: PropTypes.func.isRequired,
  initialY: PropTypes.number.isRequired,
  min: PropTypes.number,
  max: PropTypes.number,
  style: PropTypes.object
};

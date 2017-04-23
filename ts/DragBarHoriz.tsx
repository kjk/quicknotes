import React from 'react';
import * as ReactDOM from 'react-dom';

interface OnPosChangedCallback {
  (y: number): void;
}

interface Props {
  onPosChanged: OnPosChangedCallback;
  initialY: number;
  min: number;
  max: number;
  dy: number;
}

interface State {
  dragging?: boolean;
}

export default class DragBarHoriz extends React.Component<Props, State> {
  y: number;

  constructor(props?: Props, context?: any) {
    super(props, context);

    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.isAllowed = this.isAllowed.bind(this);
    this.calcBottom = this.calcBottom.bind(this);

    this.y = this.props.initialY;
    this.state = {
      dragging: false,
    };
  }

  componentDidUpdate(props: Props, prevState: State) {
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

  handleMouseDown(e: React.MouseEvent<HTMLDivElement>): void {
    // only left mouse button
    if (e.button !== 0)
      return;
    e.stopPropagation();
    e.preventDefault();
    this.setState({
      dragging: true,
    });
  }

  handleMouseUp(e: MouseEvent): any {
    e.stopPropagation();
    e.preventDefault();
    this.setState({
      dragging: false,
    });
  }

  isAllowed(y: number) {
    const min = this.props.min || 0;
    const max = this.props.max || 9999999;
    return (y >= min) && (y <= max);
  }

  calcBottom() {
    return window.innerHeight - this.y - this.props.dy;
  }

  handleMouseMove(e: MouseEvent): any {
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
    // const yDelta = this.props.initialY - y;
    const el = ReactDOM.findDOMNode(this) as HTMLElement;
    el.style.bottom = this.calcBottom() + 'px';
    this.props.onPosChanged(y);
  }

  render() {
    const style = {
      height: this.props.dy,
      bottom: this.calcBottom()
    };

    return (
      <div className='drag-bar-horiz' style={style} onMouseDown={this.handleMouseDown}>
      </div>
    );
  }
}

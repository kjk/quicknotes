import React, { Component, PropTypes } from 'react';

// based on https://github.com/javierbyte/react-textselect

/*
TextSelect.propTypes = {
  values: PropTypes.array.isRequired,
  selectedIdx: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
};
*/

interface Props {
  values?: any;
  selectedIdx?: any;
  onChange?: any;
  className?: string;
}

export default class TextSelect extends Component<Props, any> {
  constructor(props?: Props, context?: any) {
    super(props, context);

    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(e: any) {
    const selectedIdx = e.target.value;
    this.props.onChange(e, selectedIdx, this.props.values[selectedIdx]);
  }

  render() {
    const {values, selectedIdx, className} = this.props;

    let classes = 'text-select';
    if (className) {
      classes += ' ' + className;
    }
    const selected = values[selectedIdx];
    const vals = values.map((val: any, key: any) => {
      return (
        <option value={key} key={key}>
          {val}
        </option>
      );
    });
    return (
      <div className={classes}>
        {selected}
        <select className='text-select-select' onChange={this.handleChange} value={selectedIdx}>
          {vals}
        </select>
      </div>
    );
  }
}

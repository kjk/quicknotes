'use strict';

// based on https://github.com/javierbyte/react-textselect
import React, { Component, PropTypes } from 'react';

export default class TextSelect extends Component {
  constructor(props, context) {
    super(props, context);

    this.handleChange = this.handleChange.bind(this);
  }

  handleChange(e) {
    const selectedIdx = e.target.value;
    this.props.onChange(e, selectedIdx, this.props.values[selectedIdx]);
  }

  render() {
    const {values, selectedIdx, className} = this.props;

    let classes = 'textselect';
    if (className) {
      classes += ' ' + className;
    }
    const selected = values[selectedIdx];
    const vals = values.map((val, key) => {
      return (
        <option value={ key } key={ key }>
          { val }
        </option>
        );
    });
    return (
      <span className={ classes }>{ selected } <select className='textselect-select' onChange={ this.handleChange } value={ selectedIdx }> { vals } </select></span>
      );
  }
}

TextSelect.propTypes = {
  values: PropTypes.array.isRequired,
  selectedIdx: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
  className: PropTypes.string
};


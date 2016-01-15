import React, { PropTypes } from 'react';

const Overlay = (props) => {
  return (
    <div className="overlay">
      { props.children }
    </div>
    );
};

Overlay.propTypes = {
  children: PropTypes.array
};

export default Overlay;

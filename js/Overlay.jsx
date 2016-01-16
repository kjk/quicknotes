import React, { PropTypes } from 'react';

const Overlay = (props) => {
  return (
    <div className="modal-overlay">
      { props.children }
    </div>
    );
};

Overlay.propTypes = {
  children: PropTypes.array
};

export default Overlay;

import React from 'react';

const Column = ({ width, height, scale }) => {
  return (
    <g>
      <rect
        x={-width / 2}
        y={-height / 2}
        width={width}
        height={height}
        fill="#fff"
        stroke="#000"
        strokeWidth={2 / scale}
      />
      <line
        x1={-width / 2}
        y1={-height / 2}
        x2={width / 2}
        y2={height / 2}
        stroke="#000"
        strokeWidth={1 / scale}
      />
      <line
        x1={width / 2}
        y1={-height / 2}
        x2={-width / 2}
        y2={height / 2}
        stroke="#000"
        strokeWidth={1 / scale}
      />
    </g>
  );
};

export default Column;

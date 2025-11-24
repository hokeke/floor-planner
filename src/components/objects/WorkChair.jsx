import React from 'react';

const WorkChair = ({ width, height, scale }) => {
  // SVG coordinates are roughly -22.5 to 22.5.
  // Using a scale factor based on 45 units width/height.

  return (
    <g transform={`scale(${width / 45}, ${height / 45})`}>
      {/* Fill Layer */}
      <path
        fill="#D6CCAB"
        stroke="none"
        d="M 22.5 -10.05 L -22.5 -10.05 -22.5 22.45 22.5 22.45 22.5 -10.05 M 22.5 -10.05 L 22.5 -22.45 -22.5 -22.45 -22.5 -10.05 22.5 -10.05 Z"
      />

      {/* Stroke Layer */}
      <path
        stroke="#666666"
        strokeWidth="1"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
        vectorEffect="non-scaling-stroke"
        d="M -22.5 -10.05 L -22.5 -22.45 22.5 -22.45 22.5 -10.05 22.5 22.45 -22.5 22.45 -22.5 -10.05 22.5 -10.05"
      />
    </g>
  );
};

export default WorkChair;

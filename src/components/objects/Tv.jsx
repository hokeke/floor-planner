import React from 'react';

const Tv = ({ width, height }) => {
  // Custom TV Path based on user request
  // Native size approx: Width 67 (-33.5 to 33.5), Height 15 (-7.5 to 7.5)
  // The user provided SVG has a rotation transform, but we'll normalize to the bounds.

  const nativeWidth = 67;
  const nativeHeight = 15;

  const scaleX = width / nativeWidth;
  const scaleY = height / nativeHeight;

  return (
    <g transform={`scale(${scaleX}, ${scaleY})`}>
      <g id="Layer0_0_FILL_fur04_07">
        <path fill="#D6CCAB" stroke="none" d="
M 31 -2.25
L 7.8 -2.25 6.65 -7.5 -6.65 -7.5 -7.85 -2.25 -31 -2.25 -33.5 0.7 -33.5 2.25 -8.85 2.25 -10 7.5 -6.1 7.5 6.1 7.5 10 7.5 8.8 2.25 33.5 2.25 33.5 0.7 31 -2.25 Z"></path>
      </g>
      <path id="Layer0_1_1_STROKES_fur04_07" stroke="#666666" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" fill="none" d="
M 7.825 -2.25
L 31 -2.25 33.5 0.7 33.5 2.25 8.825 2.25 10 7.5 6.1 7.5 -6.1 7.5 -10 7.5 -8.825 2.25 -33.5 2.25 -33.5 0.7 -31 -2.25 -7.825 -2.25 -6.65 -7.5 6.65 -7.5 7.825 -2.25 -7.825 -2.25
M -33.5 0.7
L -8.475 0.7 8.475 0.7 33.5 0.7
M -8.825 2.25
L 8.825 2.25"></path>
    </g>
  );
};

export default Tv;

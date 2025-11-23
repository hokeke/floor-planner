import React from 'react';

const TvStand = ({ width, height }) => {
  // Custom TV Stand Path based on user request
  // Native size approx: Width 102 (-51 to 51), Height 28.5 (-14.25 to 14.25)
  // The user provided SVG has a rotation transform, but we'll normalize to the bounds.

  const nativeWidth = 102;
  const nativeHeight = 28.5;

  const scaleX = width / nativeWidth;
  const scaleY = height / nativeHeight;

  return (
    <g transform={`scale(${scaleX}, ${scaleY})`}>
      <g id="Layer0_0_FILL_fur06_01">
        <path fill="#D6CCAB" stroke="none" d="
M -51 11.25
L 51 11.25 51 -14.25 -51 -14.25 -51 11.25
M -51 11.25
L -51 14.25 51 14.25 51 11.25 -51 11.25 Z"></path>
      </g>
      <path id="Layer0_0_1_STROKES_fur06_01" stroke="#666666" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" fill="none" d="
M -51 11.25
L -51 -14.25 51 -14.25 51 11.25 51 14.25 -51 14.25 -51 11.25 51 11.25"></path>
    </g>
  );
};

export default TvStand;

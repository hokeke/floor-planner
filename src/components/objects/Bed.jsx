import React from 'react';

const Bed = ({ width, height }) => {
  // Custom Bed Path based on user request
  // The provided SVG has coordinates roughly within x: -27 to 27, y: -54 to 54
  // Width ~ 54, Height ~ 108
  // The user provided transform has rotation, but we'll assume standard orientation for the component
  // and let the app handle rotation via the object's rotation property.
  // However, the path itself seems to be vertical (height > width).
  // Let's normalize to the bounds.

  const nativeWidth = 54;
  const nativeHeight = 108;

  const scaleX = width / nativeWidth;
  const scaleY = height / nativeHeight;

  return (
    <g transform={`scale(${scaleX}, ${scaleY})`}>
      <g id="Layer0_0_FILL_fur02_01">
        <path fill="#D6CCAB" stroke="none" d="
M 27 54
L 27 -47.8 -27 -47.8 -27 54 27 54
M 27 -47.8
L 27 -54 -27 -54 -27 -47.8 27 -47.8 Z"></path>
      </g>
      <path id="Layer0_0_1_STROKES_fur02_01" stroke="#666666" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" fill="none" d="
M 27 -47.8
L 27 54 -27 54 -27 -47.8 -27 -54 27 -54 27 -47.8 -27 -47.8"></path>
    </g>
  );
};

export default Bed;

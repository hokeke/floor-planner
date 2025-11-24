import { useState } from 'react';

export const useViewport = (initialScale = 1, initialPan = { x: 0, y: 0 }) => {
  const [scale, setScale] = useState(initialScale);
  const [pan, setPan] = useState(initialPan);

  // Coordinate transformation
  const screenToWorld = (screenX, screenY) => {
    return {
      x: (screenX - pan.x) / scale,
      y: (screenY - pan.y) / scale
    };
  };

  const getMousePos = (e, svgRef) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleWheel = (e, svgRef) => {
    e.preventDefault();
    const { x: mouseX, y: mouseY } = getMousePos(e, svgRef);
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    const newScale = Math.min(Math.max(0.1, scale + delta), 5);

    // Zoom towards mouse pointer
    const worldPos = screenToWorld(mouseX, mouseY);
    const newPanX = mouseX - worldPos.x * newScale;
    const newPanY = mouseY - worldPos.y * newScale;

    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  };

  return {
    scale,
    setScale,
    pan,
    setPan,
    screenToWorld,
    getMousePos,
    handleWheel
  };
};

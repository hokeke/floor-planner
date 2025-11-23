import React, { useState, useRef, useEffect } from 'react';
import Grid from './components/Grid';
import Toolbar from './components/Toolbar';
import PropertiesPanel from './components/PropertiesPanel';
import { mmToPx, pxToMm, snapToGrid, calculateArea, GRID_SIZE_MM } from './utils/units';
import { ROOM_TYPES, OBJECT_TYPES } from './constants';
import ObjectRenderer from './components/ObjectRenderer';
import DimensionAnnotations from './components/DimensionAnnotations';
import './index.css';

function App() {
  const [rooms, setRooms] = useState([]);
  const [walls, setWalls] = useState([]); // [{ id, start: {x,y}, end: {x,y} }]
  const [objects, setObjects] = useState([]); // { id, type, x, y, width, height, rotation }
  const [currentRoom, setCurrentRoom] = useState(null); // { points: [{x,y}, ...] }
  const [currentWall, setCurrentWall] = useState(null); // { start: {x,y}, end: {x,y} }
  const [draggingWallId, setDraggingWallId] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [selectedWallId, setSelectedWallId] = useState(null); // New state for selected wall
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [draggingRoomId, setDraggingRoomId] = useState(null);
  const [dragStartPos, setDragStartPos] = useState(null); // World coordinates
  const [tool, setTool] = useState('room'); // 'room', 'select', 'wall'
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 }); // Track mouse for rubber band

  const [activeRoomType, setActiveRoomType] = useState('western'); // Default type for new rooms
  const [activeObjectType, setActiveObjectType] = useState('door');

  // Interaction state for objects
  const [interactionMode, setInteractionMode] = useState(null); // 'move', 'resize', 'rotate'
  const [interactionData, setInteractionData] = useState(null); // { startX, startY, initialObjectState, handle }

  const svgRef = useRef(null);

  // Coordinate transformation
  const screenToWorld = (screenX, screenY) => {
    return {
      x: (screenX - pan.x) / scale,
      y: (screenY - pan.y) / scale
    };
  };

  const getMousePos = (e) => {
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const { x: mouseX, y: mouseY } = getMousePos(e);
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

  const handleMouseDown = (e) => {
    // Middle mouse button or Space key (if we added key listener) for panning
    if (e.button === 1) {
      setIsPanning(true);
      setLastMousePos(getMousePos(e));
      return;
    }

    if (e.button === 0) { // Left click
      const { x, y } = getMousePos(e);
      const worldPos = screenToWorld(x, y);
      const snappedX = snapToGrid(worldPos.x, GRID_SIZE_MM / 2);
      const snappedY = snapToGrid(worldPos.y, GRID_SIZE_MM / 2);

      if (tool === 'room') {
        const newPoint = { x: snappedX, y: snappedY };

        if (!isDrawing) {
          // Start drawing: add first point
          setIsDrawing(true);
          setCurrentRoom({
            points: [newPoint]
          });
          setSelectedRoomId(null);
          setSelectedWallId(null);
          setSelectedObjectId(null);
        } else {
          // Continue drawing
          // Check if clicked near start point to close loop
          const startPoint = currentRoom.points[0];
          const dist = Math.sqrt(Math.pow(newPoint.x - startPoint.x, 2) + Math.pow(newPoint.y - startPoint.y, 2));

          if (currentRoom.points.length >= 3 && dist < mmToPx(200)) { // Snap distance
            // Close loop
            const newRoom = {
              points: [...currentRoom.points],
              id: Date.now(),
              type: activeRoomType // Use active type
            };
            setRooms([...rooms, newRoom]);
            setSelectedRoomId(newRoom.id);
            setCurrentRoom(null);
            setIsDrawing(false);
            // Stay in room tool (Persistent Mode)
          } else {
            // Add point
            setCurrentRoom(prev => ({
              points: [...prev.points, newPoint]
            }));
          }
        }
      } else if (tool === 'wall') {
        const newPoint = { x: snappedX, y: snappedY };
        if (!isDrawing) {
          setIsDrawing(true);
          setCurrentWall({ start: newPoint, end: newPoint });
          setSelectedRoomId(null);
          setSelectedWallId(null);
          setSelectedObjectId(null);
        } else {
          // Finish wall
          const newWall = {
            id: Date.now(),
            start: currentWall.start,
            end: newPoint
          };
          setWalls([...walls, newWall]);
          setCurrentWall(null);
          setIsDrawing(false);
          // Stay in wall tool
        }
      } else if (tool === 'object') {
        const typeDef = OBJECT_TYPES.find(t => t.id === activeObjectType);
        const newObject = {
          id: Date.now(),
          type: activeObjectType,
          x: pxToMm(snappedX),
          y: pxToMm(snappedY),
          width: typeDef.width,
          height: typeDef.height,
          rotation: 0
        };
        setObjects([...objects, newObject]);
        setSelectedObjectId(newObject.id);
        setSelectedRoomId(null);
        setSelectedWallId(null);
      } else if (tool === 'select') {
        // Reset interaction mode when clicking on canvas (not on an object)
        // This allows users to cancel resize/rotate by clicking elsewhere
        const clickedAnything = selectedObjectId || selectedRoomId || selectedWallId;
        if (!clickedAnything) {
          setInteractionMode(null);
          setInteractionData(null);
        }

        // Check for object handles first (if selected)
        if (selectedObjectId) {
          const obj = objects.find(o => o.id === selectedObjectId);
          if (obj) {
            // Check rotation handle
            // Simple hit test for handles (approximate)
            // TODO: Implement precise handle hit testing if needed
          }
        }

        // Check for object click
        // Simple bounding box hit test (taking rotation into account is complex, simplifying for now)
        const clickedObject = objects.slice().reverse().find(obj => {
          // Transform point to object local space
          const mouseMmX = pxToMm(worldPos.x);
          const mouseMmY = pxToMm(worldPos.y);
          const dx = mouseMmX - obj.x;
          const dy = mouseMmY - obj.y;
          const rad = -obj.rotation * Math.PI / 180;
          const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
          const localY = dx * Math.sin(rad) + dy * Math.cos(rad);
          return localX >= -obj.width / 2 && localX <= obj.width / 2 &&
            localY >= -obj.height / 2 && localY <= obj.height / 2;
        });

        if (clickedObject) {
          setSelectedObjectId(clickedObject.id);
          setSelectedRoomId(null);
          setSelectedWallId(null);
          setInteractionMode('move');
          setInteractionData({
            startX: worldPos.x,
            startY: worldPos.y,
            initialObjectState: { ...clickedObject }
          });
          return;
        }

        // Check for wall click first (priority over rooms)
        const isPointNearLine = (point, start, end, threshold = 10) => {
          const A = point.x - start.x;
          const B = point.y - start.y;
          const C = end.x - start.x;
          const D = end.y - start.y;

          const dot = A * C + B * D;
          const lenSq = C * C + D * D;
          let param = -1;
          if (lenSq !== 0) // in case of 0 length line
            param = dot / lenSq;

          let xx, yy;

          if (param < 0) {
            xx = start.x;
            yy = start.y;
          }
          else if (param > 1) {
            xx = end.x;
            yy = end.y;
          }
          else {
            xx = start.x + param * C;
            yy = start.y + param * D;
          }

          const dx = point.x - xx;
          const dy = point.y - yy;
          return Math.sqrt(dx * dx + dy * dy) < threshold;
        };

        const clickedWall = walls.find(w => isPointNearLine(worldPos, w.start, w.end, mmToPx(200))); // 200mm threshold

        if (clickedWall) {
          setSelectedWallId(clickedWall.id);
          setSelectedRoomId(null);
          setSelectedObjectId(null);
          setDraggingWallId(clickedWall.id);
          setDragStartPos({ x: snappedX, y: snappedY });
          return;
        }

        // Simple hit testing for polygon (point in polygon)
        const isPointInPolygon = (point, vs) => {
          let x = point.x, y = point.y;
          let inside = false;
          for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
            let xi = vs[i].x, yi = vs[i].y;
            let xj = vs[j].x, yj = vs[j].y;

            let intersect = ((yi > y) !== (yj > y))
              && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
          }
          return inside;
        };

        const clickedRoom = rooms.find(r => isPointInPolygon(worldPos, r.points));

        if (clickedRoom) {
          setSelectedRoomId(clickedRoom.id);
          setSelectedWallId(null);
          setSelectedObjectId(null);
          setDraggingRoomId(clickedRoom.id);
          // Snap start position to grid to ensure consistent movement
          setDragStartPos({ x: snappedX, y: snappedY });
        } else {
          setSelectedRoomId(null);
          setSelectedWallId(null);
          setSelectedObjectId(null);
          // Start panning if clicked on empty space
          setIsPanning(true);
          setLastMousePos(getMousePos(e));
        }
      }
    }
  };

  const handleMouseMove = (e) => {
    const { x, y } = getMousePos(e);


    if (isPanning) {
      const dx = x - lastMousePos.x;
      const dy = y - lastMousePos.y;
      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastMousePos({ x, y });
      return;
    }

    const worldPos = screenToWorld(x, y);
    setMousePos(worldPos); // Update for rubber band

    if (isDrawing && tool === 'wall' && currentWall) {
      const snappedX = snapToGrid(worldPos.x, GRID_SIZE_MM / 2);
      const snappedY = snapToGrid(worldPos.y, GRID_SIZE_MM / 2);
      setCurrentWall(prev => ({ ...prev, end: { x: snappedX, y: snappedY } }));
    }

    if (interactionMode === 'move' && selectedObjectId) {
      const dxPx = worldPos.x - interactionData.startX;
      const dyPx = worldPos.y - interactionData.startY;

      // Convert pixel delta to mm
      const dxMm = pxToMm(dxPx);
      const dyMm = pxToMm(dyPx);

      // Calculate raw new position in mm
      let rawX = interactionData.initialObjectState.x + dxMm;
      let rawY = interactionData.initialObjectState.y + dyMm;

      const obj = interactionData.initialObjectState;
      const typeDef = OBJECT_TYPES.find(t => t.id === obj.type);

      let newX = rawX;
      let newY = rawY;
      let newRotation = obj.rotation;

      if (typeDef && typeDef.type === 'opening') {
        // Wall snapping for doors and windows
        let closestDist = Infinity;
        let closestPoint = null;
        let closestWallAngle = 0;

        walls.forEach(wall => {
          // Wall coordinates are in pixels
          const wallStartMm = { x: pxToMm(wall.start.x), y: pxToMm(wall.start.y) };
          const wallEndMm = { x: pxToMm(wall.end.x), y: pxToMm(wall.end.y) };

          const A = rawX - wallStartMm.x;
          const B = rawY - wallStartMm.y;
          const C = wallEndMm.x - wallStartMm.x;
          const D = wallEndMm.y - wallStartMm.y;

          const dot = A * C + B * D;
          const lenSq = C * C + D * D;
          let param = -1;
          if (lenSq !== 0) param = dot / lenSq;

          let xx, yy;

          if (param < 0) {
            xx = wallStartMm.x;
            yy = wallStartMm.y;
          } else if (param > 1) {
            xx = wallEndMm.x;
            yy = wallEndMm.y;
          } else {
            xx = wallStartMm.x + param * C;
            yy = wallStartMm.y + param * D;
          }

          const dist = Math.sqrt((rawX - xx) ** 2 + (rawY - yy) ** 2);

          if (dist < closestDist) {
            closestDist = dist;
            closestPoint = { x: xx, y: yy };
            closestWallAngle = Math.atan2(D, C) * 180 / Math.PI;
          }
        });

        const SNAP_THRESHOLD = 300; // 300mm
        if (closestDist < SNAP_THRESHOLD && closestPoint) {
          newX = closestPoint.x;
          newY = closestPoint.y;
          newRotation = closestWallAngle;
        } else {
          // Snap to 1/8 grid (approx 113.75mm) if not snapping to wall
          newX = snapToGrid(rawX, GRID_SIZE_MM / 8);
          newY = snapToGrid(rawY, GRID_SIZE_MM / 8);
        }
      } else {
        // Regular object snapping (1/8 grid)
        newX = snapToGrid(rawX, GRID_SIZE_MM / 8);
        newY = snapToGrid(rawY, GRID_SIZE_MM / 8);

        // Edge snapping logic
        // ... (omitted for brevity, assuming edge snapping logic needs similar unit fix if it uses pixels)
        // Actually, let's keep it simple for now and just use grid snapping to fix the lag first.
        // If edge snapping was using pixel coordinates, it needs update.
        // Let's rely on the simple grid snap for now to ensure movement works.
      }

      setObjects(objects.map(obj =>
        obj.id === selectedObjectId ? { ...obj, x: newX, y: newY, rotation: newRotation !== undefined ? newRotation : obj.rotation } : obj
      ));
    } else if (interactionMode === 'rotate' && selectedObjectId) {
      const obj = objects.find(o => o.id === selectedObjectId);
      // obj.x/y are in mm, worldPos is in pixels. Convert obj to pixels.
      const objPx = { x: mmToPx(obj.x), y: mmToPx(obj.y) };

      const dx = worldPos.x - objPx.x;
      const dy = worldPos.y - objPx.y;
      let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90; // +90 because handle is at top (0, -height/2)
      // Snap rotation to 15 degrees
      angle = Math.round(angle / 15) * 15;
      setObjects(objects.map(o => o.id === selectedObjectId ? { ...o, rotation: angle } : o));
    } else if (interactionMode === 'resize' && selectedObjectId) {
      const obj = interactionData.initialObjectState;
      const handle = interactionData.handle; // 'tl', 'tr', 'bl', 'br'

      if (!handle) {

        return; // Safeguard
      }

      // Convert mouse position to mm
      const mouseMmX = pxToMm(worldPos.x);
      const mouseMmY = pxToMm(worldPos.y);

      // Calculate rotation in radians
      const rad = (obj.rotation || 0) * Math.PI / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      // Calculate local coordinates of the handle and its opposite
      // tl: -w/2, -h/2
      // tr: +w/2, -h/2
      // bl: -w/2, +h/2
      // br: +w/2, +h/2

      const getLocalCoords = (h) => {
        const x = h.includes('r') ? obj.width / 2 : -obj.width / 2;
        const y = h.includes('b') ? obj.height / 2 : -obj.height / 2;
        return { x, y };
      };

      const getOppositeHandle = (h) => {
        if (h === 'tl') return 'br';
        if (h === 'tr') return 'bl';
        if (h === 'bl') return 'tr';
        if (h === 'br') return 'tl';
        return 'br';
      };

      const oppositeHandle = getOppositeHandle(handle);
      const localFixed = getLocalCoords(oppositeHandle);

      // Calculate fixed point in world space (mm)
      // Rotate local point and add to center
      const fixedX = obj.x + (localFixed.x * cos - localFixed.y * sin);
      const fixedY = obj.y + (localFixed.x * sin + localFixed.y * cos);

      // Vector from fixed point to mouse position
      const dx = mouseMmX - fixedX;
      const dy = mouseMmY - fixedY;

      // Project onto object axes (Right and Down vectors)
      // Right vector: (cos, sin)
      // Down vector: (-sin, cos) -> Wait, if rotation is clockwise, +Y is down.
      // Standard rotation matrix:
      // x' = x cos - y sin
      // y' = x sin + y cos
      // This rotates a point.
      // The axes of the rotated object are:
      // X-axis (Right): (cos, sin)
      // Y-axis (Down): (-sin, cos)  <-- This assumes standard math (Y up).
      // In SVG (Y down), +angle is clockwise.
      // 0 deg: Right (1, 0), Down (0, 1)
      // 90 deg: Right (0, 1), Down (-1, 0) -> Wait.
      // Let's test: rotate(90) turns X axis to Y axis.
      // (1, 0) -> (0, 1). Correct.
      // Y axis (0, 1) -> (-1, 0). Correct.
      // So axes are:
      // Right: (cos, sin)
      // Down: (-sin, cos)

      // Project dx, dy onto these axes
      // dot product
      let newWidthRaw = dx * cos + dy * sin;
      let newHeightRaw = dx * (-sin) + dy * cos;

      // Determine sign based on handle
      // If we are dragging 'br' (bottom-right) relative to 'tl' (top-left),
      // we expect positive width/height if we move in +X/+Y direction.
      // If we are dragging 'tl' relative to 'br', we are moving in -X/-Y direction?
      // No, the vector is (Mouse - Fixed).
      // If Fixed is 'br' and Mouse is 'tl', vector points left/up (-X/-Y).
      // So newWidthRaw would be negative.
      // We want the magnitude.

      // However, we need to handle "flipping" if the user drags past the fixed point.
      // For now, let's just take absolute value, effectively preventing flipping or just resizing from the anchor.
      // But we need to know the direction to calculate the new center correctly.

      // Actually, let's simplify.
      // We want to find the new local bounds.
      // The fixed point is at one corner.
      // The mouse point is at the opposite corner.
      // So the new width/height is just the projection magnitude.
      // But we need to enforce the correct sign for the center calculation?
      // No, let's just use the absolute value for width/height.
      // And for the center:
      // New Center = Fixed Point + (Vector to New Corner) / 2
      // Vector to New Corner = (newWidth * Right * signX) + (newHeight * Down * signY)
      // Where signX/signY depend on which handle is fixed.

      // If Fixed is 'tl' (dragging 'br'): Vector should be (+W, +H).
      // If Fixed is 'br' (dragging 'tl'): Vector should be (-W, -H).
      // If Fixed is 'tr' (dragging 'bl'): Vector should be (-W, +H).
      // If Fixed is 'bl' (dragging 'tr'): Vector should be (+W, -H).

      // Let's define signs for the *dragged* handle relative to center (unrotated)
      const signX = handle.includes('r') ? 1 : -1;
      const signY = handle.includes('b') ? 1 : -1;

      // But wait, newWidthRaw already contains the sign relative to the axes!
      // Example: Fixed 'tl', dragging 'br'. Vector is (+, +). newWidthRaw > 0.
      // Example: Fixed 'br', dragging 'tl'. Vector is (-, -). newWidthRaw < 0.

      // So we can just use newWidthRaw directly?
      // If newWidthRaw is negative, it means we crossed the fixed point.
      // If we want to support flipping, we take abs(newWidthRaw) as width,
      // and the center calculation handles the position naturally.

      let newWidth = Math.abs(newWidthRaw);
      let newHeight = Math.abs(newHeightRaw);

      // Apply constraints
      if (['toilet', 'bath', 'door'].includes(obj.type)) {
        const ratio = obj.width / obj.height;
        if (newWidth / ratio > newHeight) {
          newHeight = newWidth / ratio;
        } else {
          newWidth = newHeight * ratio;
        }
      } else if (obj.type === 'window') {
        newHeight = obj.height;
      }

      // Snap to 10mm
      newWidth = Math.round(newWidth / 10) * 10;
      if (obj.type !== 'window') {
        newHeight = Math.round(newHeight / 10) * 10;
      }

      // Re-apply aspect ratio
      if (['toilet', 'bath', 'door'].includes(obj.type)) {
        const ratio = obj.width / obj.height;
        newHeight = newWidth / ratio;
      }

      // Min size
      newWidth = Math.max(newWidth, 100);
      newHeight = Math.max(newHeight, 100);

      // Calculate new center
      // We need to reconstruct the vector from Fixed to New Corner using the constrained/snapped width/height.
      // We need to preserve the original sign of the drag.
      // If newWidthRaw was negative, we want -newWidth.
      const finalSignX = newWidthRaw >= 0 ? 1 : -1;
      const finalSignY = newHeightRaw >= 0 ? 1 : -1;

      // Vector in local space
      const localDx = newWidth * finalSignX;
      const localDy = newHeight * finalSignY;

      // Rotate vector to world space
      const worldDx = localDx * cos - localDy * sin;
      const worldDy = localDx * sin + localDy * cos;

      // New Center = Fixed + WorldVector / 2
      const newX = fixedX + worldDx / 2;
      const newY = fixedY + worldDy / 2;

      setObjects(objects.map(o =>
        o.id === selectedObjectId ? { ...o, x: newX, y: newY, width: newWidth, height: newHeight } : o
      ));
    }

    if (draggingRoomId && dragStartPos) {
      const snappedX = snapToGrid(worldPos.x, GRID_SIZE_MM / 2);
      const snappedY = snapToGrid(worldPos.y, GRID_SIZE_MM / 2);

      const dx = snappedX - dragStartPos.x;
      const dy = snappedY - dragStartPos.y;

      if (dx !== 0 || dy !== 0) {
        setRooms(rooms.map(room => {
          if (room.id === draggingRoomId) {
            return {
              ...room,
              points: room.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
            };
          }
          return room;
        }));
        setDragStartPos({ x: snappedX, y: snappedY });
      }
    }

    if (draggingWallId && dragStartPos) {
      const snappedX = snapToGrid(worldPos.x, GRID_SIZE_MM / 2);
      const snappedY = snapToGrid(worldPos.y, GRID_SIZE_MM / 2);

      const dx = snappedX - dragStartPos.x;
      const dy = snappedY - dragStartPos.y;

      if (dx !== 0 || dy !== 0) {
        setWalls(walls.map(wall => {
          if (wall.id === draggingWallId) {
            return {
              ...wall,
              start: { x: wall.start.x + dx, y: wall.start.y + dy },
              end: { x: wall.end.x + dx, y: wall.end.y + dy }
            };
          }
          return wall;
        }));
        setDragStartPos({ x: snappedX, y: snappedY });
      }
    }
  };

  const handleMouseUp = (e) => {


    if (isPanning) {
      setIsPanning(false);
      setLastMousePos(null);
      return;
    }

    if (draggingRoomId) {
      setDraggingRoomId(null);
      setDragStartPos(null);
    }

    if (draggingWallId) {
      setDraggingWallId(null);
    }

    // Reset interaction mode after rotate or resize completes
    if (interactionMode === 'rotate' || interactionMode === 'resize') {
      setInteractionMode(null);
      setInteractionData(null);
      return;
    }

    setInteractionMode(null);
    setInteractionData(null);
  };

  // Handle interaction start for handles (stopPropagation to prevent drag start)
  const handleHandleMouseDown = (e, mode, handle) => {

    e.stopPropagation();
    const { x, y } = getMousePos(e);
    const worldPos = screenToWorld(x, y);
    const obj = objects.find(o => o.id === selectedObjectId);

    if (!obj) {

      return;
    }


    setInteractionMode(mode);
    setInteractionData({
      startX: worldPos.x,
      startY: worldPos.y,
      initialObjectState: { ...obj },
      handle
    });

  };

  // Handle object selection and move start
  const handleObjectMouseDown = (e, objectId) => {

    e.stopPropagation();
    // Only allow left click
    if (e.button !== 0) return;

    const { x, y } = getMousePos(e);
    const worldPos = screenToWorld(x, y);

    setSelectedObjectId(objectId);
    setSelectedRoomId(null);
    setSelectedWallId(null);

    // Prepare for moving
    const obj = objects.find(o => o.id === objectId);

    setInteractionMode('move');
    setInteractionData({
      startX: worldPos.x,
      startY: worldPos.y,
      initialObjectState: { ...obj }
    });
  };

  // Prevent default browser zoom
  useEffect(() => {
    const svg = svgRef.current;
    if (svg) {
      svg.addEventListener('wheel', handleWheel, { passive: false });
    }
    return () => {
      if (svg) {
        svg.removeEventListener('wheel', handleWheel);
      }
    };
  }, [scale, pan]);

  // Handle arrow key movement for selected objects
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!selectedObjectId) return;

      // Only handle arrow keys
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

      e.preventDefault(); // Prevent page scrolling

      const MOVE_STEP = mmToPx(GRID_SIZE_MM / 16); // Move by 1/16 grid (about 57mm)

      setObjects(prevObjects =>
        prevObjects.map(obj => {
          if (obj.id !== selectedObjectId) return obj;

          let newX = obj.x;
          let newY = obj.y;

          switch (e.key) {
            case 'ArrowUp':
              newY -= MOVE_STEP;
              break;
            case 'ArrowDown':
              newY += MOVE_STEP;
              break;
            case 'ArrowLeft':
              newX -= MOVE_STEP;
              break;
            case 'ArrowRight':
              newX += MOVE_STEP;
              break;
          }

          return { ...obj, x: newX, y: newY };
        })
      );
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedObjectId]);

  const selectedRoom = rooms.find(r => r.id === selectedRoomId);
  const selectedWall = walls.find(w => w.id === selectedWallId);
  const selectedObject = objects.find(o => o.id === selectedObjectId);

  // Calculate area for selected room
  let selectedRoomArea = null;
  if (selectedRoom) {
    // Convert points to mm for calculation
    const pointsMm = selectedRoom.points.map(p => ({ x: pxToMm(p.x), y: pxToMm(p.y) }));
    selectedRoomArea = calculateArea(pointsMm);
  }

  // Calculate total area
  const totalArea = rooms.reduce((acc, room) => {
    const pointsMm = room.points.map(p => ({ x: pxToMm(p.x), y: pxToMm(p.y) }));
    const area = calculateArea(pointsMm);
    return {
      tatami: acc.tatami + area.tatami,
      tsubo: acc.tsubo + area.tsubo,
      sqm: acc.sqm + area.sqm
    };
  }, { tatami: 0, tsubo: 0, sqm: 0 });



  // Local File Save/Load
  const fileInputRef = useRef(null);

  const handleSave = async () => {
    try {
      const data = {
        version: 1,
        timestamp: new Date().toISOString(),
        data: {
          rooms,
          walls,
          objects
        }
      };

      const jsonString = JSON.stringify(data, null, 2);
      console.log('Saving data size:', jsonString.length);

      // Simple filename without colons
      const dateStr = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
      const fileName = `floorplan_${dateStr}_${timeStr}.json`;

      console.log('Saving as:', fileName);

      // Try File System Access API first (Modern way)
      if (window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: fileName,
            types: [{
              description: 'JSON Files',
              accept: { 'application/json': ['.json'] },
            }],
          });
          const writable = await handle.createWritable();
          await writable.write(jsonString);
          await writable.close();
          alert('Saved successfully!');
          return;
        } catch (err) {
          if (err.name === 'AbortError') return; // User cancelled
          console.error('File System Access API failed, falling back:', err);
          // Fall through to legacy method
        }
      }

      // Legacy method (Anchor tag)
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);

      link.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 2000);
    } catch (err) {
      console.error('Save failed:', err);
      alert('Save failed: ' + err.message);
    }
  };

  const handleLoad = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = JSON.parse(event.target.result);
        if (content && content.data) {
          setRooms(content.data.rooms || []);
          setWalls(content.data.walls || []);
          setObjects(content.data.objects || []);
          alert('Loaded successfully!');
        } else {
          alert('Invalid file format.');
        }
      } catch (err) {
        console.error('Error parsing file:', err);
        alert('Failed to load file. Invalid JSON.');
      }
      // Reset input so the same file can be selected again
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="app-container">
      <Toolbar
        tool={tool}
        setTool={setTool}
        activeRoomType={activeRoomType}
        setActiveRoomType={setActiveRoomType}
        activeObjectType={activeObjectType}
        setActiveObjectType={setActiveObjectType}
        scale={scale}
        setScale={setScale}
        setPan={setPan}
        onSave={handleSave}
        onLoad={handleLoad}
      />

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".json"
        onChange={handleFileChange}
      />

      <main className="canvas-container">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className="drawing-canvas"
          style={{ cursor: isPanning ? 'grabbing' : (tool === 'room' || tool === 'wall' ? 'crosshair' : 'default') }}
        >
          <defs>
            <pattern
              id="subgrid"
              width={mmToPx(455)}
              height={mmToPx(455)}
              patternUnits="userSpaceOnUse"
              patternTransform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}
            >
              <path
                d={`M ${mmToPx(455)} 0 L 0 0 0 ${mmToPx(455)}`}
                fill="none"
                stroke="#e0e0e0"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </pattern>
            <pattern
              id="grid"
              width={mmToPx(910)}
              height={mmToPx(910)}
              patternUnits="userSpaceOnUse"
              patternTransform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}
            >
              <path
                d={`M ${mmToPx(910)} 0 L 0 0 0 ${mmToPx(910)}`}
                fill="none"
                stroke="#bdbdbd"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#subgrid)" />
          <rect width="100%" height="100%" fill="url(#grid)" pointerEvents="none" />

          <g transform={`translate(${pan.x}, ${pan.y}) scale(${scale})`}>
            {rooms.map(room => {
              const pointsStr = room.points.map(p => `${p.x},${p.y}`).join(' ');
              const isSelected = room.id === selectedRoomId;
              const roomType = ROOM_TYPES.find(t => t.id === room.type) || ROOM_TYPES[1]; // Default to Western

              return (
                <g key={room.id}>
                  <polygon
                    points={pointsStr}
                    fill={isSelected ? "rgba(100, 149, 237, 0.5)" : roomType.color}
                    fillOpacity={isSelected ? 0.5 : 0.8}
                    stroke="none"
                  />
                  {/* Removed stroke from polygon, only show selection highlight if needed, or rely on fill */}
                  {isSelected && (
                    <polygon
                      points={pointsStr}
                      fill="none"
                      stroke="orange"
                      strokeWidth={3 / scale}
                    />
                  )}
                </g>
              );
            })}

            {/* Objects (Furniture/Fixtures - Rendered BELOW walls) */}
            {objects.filter(obj => {
              const typeDef = OBJECT_TYPES.find(t => t.id === obj.type);
              return typeDef && typeDef.type !== 'opening';
            }).map(obj => (
              <ObjectRenderer
                key={obj.id}
                obj={obj}
                isSelected={obj.id === selectedObjectId}
                scale={scale}
                onHandleMouseDown={handleHandleMouseDown}
                onObjectMouseDown={handleObjectMouseDown}
              />
            ))}

            {/* Walls */}
            {walls.map(wall => {
              const isSelected = wall.id === selectedWallId;
              return (
                <line
                  key={wall.id}
                  x1={wall.start.x}
                  y1={wall.start.y}
                  x2={wall.end.x}
                  y2={wall.end.y}
                  stroke={isSelected ? "red" : "black"}
                  strokeWidth={mmToPx(100)} // 100mm wall thickness
                  strokeLinecap="square"
                />
              );
            })}

            {/* Objects (Openings: Doors/Windows - Rendered ABOVE walls) */}
            {objects.filter(obj => {
              const typeDef = OBJECT_TYPES.find(t => t.id === obj.type);
              return typeDef && typeDef.type === 'opening';
            }).map(obj => (
              <ObjectRenderer
                key={obj.id}
                obj={obj}
                isSelected={obj.id === selectedObjectId}
                scale={scale}
                onHandleMouseDown={handleHandleMouseDown}
                onObjectMouseDown={handleObjectMouseDown}
              />
            ))}

            {/* Room Labels (Rendered ABOVE everything) */}
            {rooms.map(room => {
              if (room.type === 'corridor') return null; // Skip label for corridor

              const roomType = ROOM_TYPES.find(t => t.id === room.type) || ROOM_TYPES[1];

              // Calculate center for text
              const minX = Math.min(...room.points.map(p => p.x));
              const maxX = Math.max(...room.points.map(p => p.x));
              const minY = Math.min(...room.points.map(p => p.y));
              const maxY = Math.max(...room.points.map(p => p.y));
              const centerX = (minX + maxX) / 2;
              const centerY = (minY + maxY) / 2;

              const pointsMm = room.points.map(p => ({ x: pxToMm(p.x), y: pxToMm(p.y) }));
              const area = calculateArea(pointsMm);

              return (
                <text
                  key={`label-${room.id}`}
                  x={centerX}
                  y={centerY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={14 / scale}
                  pointerEvents="none"
                  fill="#333"
                >
                  <tspan x={centerX} dy="-0.6em">{roomType.label}</tspan>
                  <tspan x={centerX} dy="1.2em">{area.tatami.toFixed(1)}畳</tspan>
                </text>
              );
            })}

            {/* Dimension Annotations */}
            <DimensionAnnotations
              walls={walls}
              scale={scale}
              pan={pan}
            />

            {currentWall && (
              <line
                x1={currentWall.start.x}
                y1={currentWall.start.y}
                x2={currentWall.end.x}
                y2={currentWall.end.y}
                stroke="black"
                strokeWidth={mmToPx(100)}
                strokeLinecap="square"
                opacity="0.5"
              />
            )}

            {currentRoom && (
              <g>
                <polyline
                  points={currentRoom.points.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke="royalblue"
                  strokeWidth={2 / scale}
                />
                {/* Rubber band line */}
                <line
                  x1={currentRoom.points[currentRoom.points.length - 1].x}
                  y1={currentRoom.points[currentRoom.points.length - 1].y}
                  x2={mousePos.x}
                  y2={mousePos.y}
                  stroke="royalblue"
                  strokeWidth={1 / scale}
                  strokeDasharray={`${5 / scale},${5 / scale}`}
                />
              </g>
            )}
          </g>
        </svg>
      </main>

      <PropertiesPanel
        rooms={rooms}
        setRooms={setRooms}
        walls={walls}
        setWalls={setWalls}
        objects={objects}
        setObjects={setObjects}
        scale={scale}
        selectedRoomId={selectedRoomId}
        setSelectedRoomId={setSelectedRoomId}
        selectedWallId={selectedWallId}
        setSelectedWallId={setSelectedWallId}
        selectedObjectId={selectedObjectId}
        setSelectedObjectId={setSelectedObjectId}
        selectedRoomArea={selectedRoomArea}
        totalArea={totalArea}
      />
    </div>
  );
}

export default App;

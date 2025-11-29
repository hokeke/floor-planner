import React, { useState, useRef, useEffect } from 'react';
import Grid from './components/Grid';
import Toolbar from './components/Toolbar';
import PropertiesPanel from './components/PropertiesPanel';
import { mmToPx, pxToMm, snapToGrid, calculateArea, GRID_SIZE_MM } from './utils/units';
import { getDistanceToLineSegment, isPointNearLine, isPointInPolygon, getClosestRoomEdge, getPolygonCentroid } from './utils/geometry';
import { useViewport } from './hooks/useViewport';
import { useFileHandler } from './hooks/useFileHandler';
import { ROOM_TYPES, OBJECT_TYPES } from './constants';
import ObjectRenderer from './components/ObjectRenderer';
import Snackbar from './components/Snackbar';
import DimensionAnnotations from './components/DimensionAnnotations';
import SeismicCheckPro from './components/SeismicCheckPro';
import './index.css';

function App() {
  const [rooms, setRooms] = useState([]);
  const [walls, setWalls] = useState([]); // [{ id, start: {x,y}, end: {x,y} }]
  const [objects, setObjects] = useState([]); // { id, type, x, y, width, height, rotation }
  const [snackbar, setSnackbar] = useState({ message: '', type: 'info', isOpen: false });
  const [currentRoom, setCurrentRoom] = useState(null); // { points: [{x,y}, ...] }
  const [currentCustomObject, setCurrentCustomObject] = useState(null); // { points: [{x,y}, ...] }
  const [currentWall, setCurrentWall] = useState(null); // { start: {x,y}, end: {x,y} }
  const [draggingWallId, setDraggingWallId] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [lastMousePos, setLastMousePos] = useState(null);
  const [isSeismicModalOpen, setIsSeismicModalOpen] = useState(false);
  const [seismicData, setSeismicData] = useState(null);

  const svgRef = useRef(null);

  // Use custom hooks
  const {
    scale,
    setScale,
    pan,
    setPan,
    screenToWorld,
    getMousePos: getViewportMousePos,
    handleWheel: handleViewportWheel
  } = useViewport();

  const showSnackbar = (message, type = 'info') => {
    setSnackbar({ message, type, isOpen: true });
  };

  const closeSnackbar = () => {
    setSnackbar(prev => ({ ...prev, isOpen: false }));
  };

  const {
    fileInputRef,
    handleSave,
    handleLoad,
    handleFileChange
  } = useFileHandler({
    rooms,
    walls,
    objects,
    setRooms,
    setWalls,
    setObjects,
    showSnackbar
  });

  // Coordinate conversion helpers
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [selectedWallId, setSelectedWallId] = useState(null); // New state for selected wall
  const [selectedObjectId, setSelectedObjectId] = useState(null);
  const [draggingRoomId, setDraggingRoomId] = useState(null);
  const [dragStartPos, setDragStartPos] = useState(null); // World coordinates
  const [tool, setTool] = useState('select'); // 'room', 'select', 'wall'
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 }); // Track mouse for rubber band

  const [activeRoomType, setActiveRoomType] = useState('western'); // Default type for new rooms
  const [activeObjectType, setActiveObjectType] = useState('door');
  const [activeWallMode, setActiveWallMode] = useState('wall'); // 'wall' or 'column'

  // Interaction state for objects
  const [interactionMode, setInteractionMode] = useState(null); // 'move', 'resize', 'rotate'
  const [interactionData, setInteractionData] = useState(null); // { startX, startY, initialObjectState, handle }

  // Room edge resizing state
  const [hoveredRoomEdge, setHoveredRoomEdge] = useState(null); // { roomId, edgeIndex }
  const [draggingRoomEdge, setDraggingRoomEdge] = useState(null); // { roomId, edgeIndex, startPos: {x,y}, originalPoints: [] }
  const [draggingVertex, setDraggingVertex] = useState(null); // { roomId, pointIndex }
  const [draggingWallHandle, setDraggingWallHandle] = useState(null); // { wallId, handle: 'start' | 'end' }

  const getMousePos = (e) => getViewportMousePos(e, svgRef);
  const handleWheel = (e) => handleViewportWheel(e, svgRef);

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
              ...prev,
              points: [...prev.points, newPoint]
            }));
          }
        }
      } else if (tool === 'wall') {
        if (activeWallMode === 'column') {
          // Place Column
          const newObject = {
            id: Date.now(),
            type: 'column',
            x: pxToMm(snappedX),
            y: pxToMm(snappedY),
            width: 100,
            height: 100,
            rotation: 0
          };
          setObjects([...objects, newObject]);
          setSelectedObjectId(newObject.id);
          setSelectedRoomId(null);
          setSelectedWallId(null);
        } else {
          // Create Wall
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
        }
      } else if (tool === 'custom_object') {
        const newPoint = { x: snappedX, y: snappedY };

        if (!isDrawing) {
          setIsDrawing(true);
          setCurrentCustomObject({
            points: [newPoint]
          });
          setSelectedRoomId(null);
          setSelectedWallId(null);
          setSelectedObjectId(null);
        } else {
          // Check if clicked near start point to close loop
          const startPoint = currentCustomObject.points[0];
          const dist = Math.sqrt(Math.pow(newPoint.x - startPoint.x, 2) + Math.pow(newPoint.y - startPoint.y, 2));

          if (currentCustomObject.points.length >= 3 && dist < mmToPx(200)) {
            // Close loop and create object
            const pointsPx = currentCustomObject.points;

            // Calculate bounding box center
            const minX = Math.min(...pointsPx.map(p => p.x));
            const maxX = Math.max(...pointsPx.map(p => p.x));
            const minY = Math.min(...pointsPx.map(p => p.y));
            const maxY = Math.max(...pointsPx.map(p => p.y));
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;

            // Create relative points in mm
            const relativePoints = pointsPx.map(p => ({
              x: pxToMm(p.x - centerX),
              y: pxToMm(p.y - centerY)
            }));

            const newObject = {
              id: Date.now(),
              type: 'custom',
              x: pxToMm(centerX),
              y: pxToMm(centerY),
              width: pxToMm(maxX - minX), // Store dimensions for selection box
              height: pxToMm(maxY - minY),
              rotation: 0,
              points: relativePoints
            };

            setObjects([...objects, newObject]);
            setSelectedObjectId(newObject.id);
            setCurrentCustomObject(null);
            setIsDrawing(false);
          } else {
            // Add point
            setCurrentCustomObject(prev => ({
              points: [...prev.points, newPoint]
            }));
          }
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

        // Check for room edge dragging first (priority over objects, walls and rooms)
        if (hoveredRoomEdge) {
          const room = rooms.find(r => r.id === hoveredRoomEdge.roomId);
          if (room) {
            // Use finer grid for edge dragging start position to match movement
            const edgeStartX = snapToGrid(worldPos.x, GRID_SIZE_MM / 8);
            const edgeStartY = snapToGrid(worldPos.y, GRID_SIZE_MM / 8);

            setDraggingRoomEdge({
              roomId: hoveredRoomEdge.roomId,
              edgeIndex: hoveredRoomEdge.edgeIndex,
              startPos: { x: edgeStartX, y: edgeStartY },
              originalPoints: [...room.points]
            });
            // Do NOT deselect the room, as we are modifying it
            // setSelectedRoomId(null); 
            setSelectedWallId(null);
            setSelectedObjectId(null);
            return; // Prevent further click handling if an edge is being dragged
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

    if (draggingVertex) {
      const snappedX = snapToGrid(worldPos.x, GRID_SIZE_MM / 2);
      const snappedY = snapToGrid(worldPos.y, GRID_SIZE_MM / 2);

      setRooms(rooms.map(room => {
        if (room.id === draggingVertex.roomId) {
          const newPoints = [...room.points];
          newPoints[draggingVertex.pointIndex] = { x: snappedX, y: snappedY };
          return { ...room, points: newPoints };
        }
        return room;
      }));
      return;
    }

    if (draggingWallHandle) {
      const snappedX = snapToGrid(worldPos.x, GRID_SIZE_MM / 2);
      const snappedY = snapToGrid(worldPos.y, GRID_SIZE_MM / 2);

      setWalls(walls.map(wall => {
        if (wall.id === draggingWallHandle.wallId) {
          const updates = {};
          if (draggingWallHandle.handle === 'start') {
            updates.start = { x: snappedX, y: snappedY };
          } else {
            updates.end = { x: snappedX, y: snappedY };
          }
          return { ...wall, ...updates };
        }
        return wall;
      }));
      return;
    }

    if (!draggingRoomEdge && !draggingRoomId && !draggingWallId && !interactionMode && tool === 'select') {
      if (selectedRoomId) {
        const selectedRoom = rooms.find(r => r.id === selectedRoomId);
        if (selectedRoom) {
          // Only check edges of the selected room
          const closestEdge = getClosestRoomEdge(worldPos, [selectedRoom], scale);
          setHoveredRoomEdge(closestEdge);
        } else {
          setHoveredRoomEdge(null);
        }
      } else {
        setHoveredRoomEdge(null);
      }
    }
    // Do not clear hoveredRoomEdge if dragging, so it persists for double-click
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

      setObjects(objects.map(o => {
        if (o.id === selectedObjectId) {
          const updates = { x: newX, y: newY, width: newWidth, height: newHeight };

          if (o.type === 'custom' && o.points) {
            const scaleX = newWidth / obj.width;
            const scaleY = newHeight / obj.height;
            updates.points = obj.points.map(p => ({
              x: p.x * scaleX,
              y: p.y * scaleY
            }));
          }

          return { ...o, ...updates };
        }
        return o;
      }));
    }

    if (draggingRoomEdge) {
      const snappedX = snapToGrid(worldPos.x, GRID_SIZE_MM / 8);
      const snappedY = snapToGrid(worldPos.y, GRID_SIZE_MM / 8);

      const dx = snappedX - draggingRoomEdge.startPos.x;
      const dy = snappedY - draggingRoomEdge.startPos.y;

      if (dx !== 0 || dy !== 0) {
        setRooms(rooms.map(room => {
          if (room.id === draggingRoomEdge.roomId) {
            const newPoints = [...draggingRoomEdge.originalPoints];
            const i = draggingRoomEdge.edgeIndex;
            const nextI = (i + 1) % newPoints.length;

            // Calculate edge vector and normal
            const p1 = draggingRoomEdge.originalPoints[i];
            const p2 = draggingRoomEdge.originalPoints[nextI];
            const edgeDx = p2.x - p1.x;
            const edgeDy = p2.y - p1.y;

            // Normal vector (-dy, dx)
            let nx = -edgeDy;
            let ny = edgeDx;
            const len = Math.sqrt(nx * nx + ny * ny);
            if (len > 0) {
              nx /= len;
              ny /= len;
            }

            // Project delta onto normal
            const dot = dx * nx + dy * ny;
            const projDx = dot * nx;
            const projDy = dot * ny;

            // Move the two points forming the edge by the projected delta
            newPoints[i] = { x: p1.x + projDx, y: p1.y + projDy };
            newPoints[nextI] = { x: p2.x + projDx, y: p2.y + projDy };

            return { ...room, points: newPoints };
          }
          return room;
        }));
      }
      return;
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

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      setLastMousePos(null);
    }

    if (draggingRoomId) {
      setDraggingRoomId(null);
      setDragStartPos(null);
    }

    if (draggingWallId) {
      setDraggingWallId(null);
    }

    if (draggingRoomEdge) {
      setDraggingRoomEdge(null);
    }

    if (draggingVertex) {
      setDraggingVertex(null);
    }

    if (draggingWallHandle) {
      setDraggingWallHandle(null);
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

  const handleDoubleClick = (e) => {
    let targetEdge = hoveredRoomEdge;

    // Robustness: If hoveredRoomEdge is lost (e.g. due to drag), try to find it again
    if (!targetEdge && selectedRoomId) {
      const { x, y } = getMousePos(e);
      const worldPos = screenToWorld(x, y);
      const selectedRoom = rooms.find(r => r.id === selectedRoomId);
      if (selectedRoom) {
        targetEdge = getClosestRoomEdge(worldPos, [selectedRoom], scale);
      }
    }

    if (targetEdge) {
      const room = rooms.find(r => r.id === targetEdge.roomId);
      if (room) {
        const { x, y } = getMousePos(e);
        const worldPos = screenToWorld(x, y);

        // Calculate projection point on the edge for precision
        const p1 = room.points[targetEdge.edgeIndex];
        const p2 = room.points[(targetEdge.edgeIndex + 1) % room.points.length];

        // Vector P1->P2
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const l2 = dx * dx + dy * dy;

        let newPoint = worldPos;

        if (l2 > 0) {
          // Projection of Mouse->P1 onto P1->P2
          const t = ((worldPos.x - p1.x) * dx + (worldPos.y - p1.y) * dy) / l2;
          const clampedT = Math.max(0, Math.min(1, t));

          // Calculate projected point
          let px = p1.x + clampedT * dx;
          let py = p1.y + clampedT * dy;

          // Snap to 0.5 grid (GRID_SIZE_MM / 2)
          // Note: We snap the projected point to the grid. 
          // If the wall is not on the grid, this might move the point slightly off the line.
          // However, for standard usage where walls are grid-aligned, this ensures vertices are on grid.
          px = snapToGrid(px, GRID_SIZE_MM / 2);
          py = snapToGrid(py, GRID_SIZE_MM / 2);

          newPoint = { x: px, y: py };
        }

        // Insert new point after the start point of the edge
        const newPoints = [...room.points];
        newPoints.splice(targetEdge.edgeIndex + 1, 0, newPoint);

        setRooms(rooms.map(r => r.id === room.id ? { ...r, points: newPoints } : r));
      }
    }
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

  // Handle Esc key to cancel drawing
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (tool === 'room' && currentRoom) {
          setCurrentRoom(null);
          setIsDrawing(false);
        } else if (tool === 'wall' && currentWall) {
          setCurrentWall(null);
          setIsDrawing(false);
        } else if (tool === 'custom_object' && currentCustomObject) {
          setCurrentCustomObject(null);
          setIsDrawing(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tool, currentRoom, currentWall, currentCustomObject]);

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

  const updateRoomLabel = (id, label) => {
    setRooms(rooms.map(r => r.id === id ? { ...r, customLabel: label } : r));
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50">
      <Toolbar
        tool={tool}
        setTool={setTool}
        activeRoomType={activeRoomType}
        setActiveRoomType={setActiveRoomType}
        activeObjectType={activeObjectType}
        setActiveObjectType={setActiveObjectType}
        activeWallMode={activeWallMode}
        setActiveWallMode={setActiveWallMode}
        scale={scale}
        setScale={setScale}
        setPan={setPan}
        onSave={handleSave}
        onLoad={handleLoad}
        onOpenSeismicCheck={() => {
          const data = {
            version: 1,
            timestamp: Date.now(),
            rooms,
            walls,
            objects
          };
          setSeismicData(data);
          setIsSeismicModalOpen(true);
        }}
      />

      {/* Hidden file input for loading */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept=".json"
        onChange={handleFileChange}
      />

      {snackbar.isOpen && (
        <Snackbar
          message={snackbar.message}
          type={snackbar.type}
          onClose={closeSnackbar}
        />
      )}

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 relative bg-slate-50 overflow-hidden cursor-crosshair">
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={handleDoubleClick}
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
              {/* Render UNSELECTED rooms first (Background) */}
              {rooms.filter(r => r.id !== selectedRoomId).map(room => {
                const pointsStr = room.points.map(p => `${p.x},${p.y}`).join(' ');
                const roomType = ROOM_TYPES.find(t => t.id === room.type) || ROOM_TYPES[1]; // Default to Western

                return (
                  <g key={room.id}>
                    <polygon
                      points={pointsStr}
                      fill={roomType.color}
                      fillOpacity={0.8}
                      stroke="none"
                    />
                    {/* Highlight hovered edge */}
                    {hoveredRoomEdge && hoveredRoomEdge.roomId === room.id && (
                      <line
                        x1={room.points[hoveredRoomEdge.edgeIndex].x}
                        y1={room.points[hoveredRoomEdge.edgeIndex].y}
                        x2={room.points[(hoveredRoomEdge.edgeIndex + 1) % room.points.length].x}
                        y2={room.points[(hoveredRoomEdge.edgeIndex + 1) % room.points.length].y}
                        stroke="blue"
                        strokeWidth={4 / scale}
                        strokeLinecap="round"
                        pointerEvents="none"
                      />
                    )}
                    {/* Vertices (Only show if not selected - maybe simpler to not show vertices for unselected rooms?) */}
                    {/* For now, keep vertices hidden for unselected rooms to reduce clutter, or show them if needed. 
                      Original code didn't show vertices for unselected rooms in the same way. 
                      Let's just add the label. */}

                    {/* Room Label */}

                  </g>
                );
              })}

              {/* Objects (Furniture/Fixtures - Rendered BELOW walls) */}
              {objects.filter(obj => {
                const typeDef = OBJECT_TYPES.find(t => t.id === obj.type);
                // Render if it's a custom object (no typeDef) or if it's not an opening
                return !typeDef || typeDef.type !== 'opening';
              }).sort((a, b) => (a.id === selectedObjectId ? 1 : b.id === selectedObjectId ? -1 : 0)).map(obj => (
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
              {[...walls].sort((a, b) => (a.id === selectedWallId ? 1 : b.id === selectedWallId ? -1 : 0)).map(wall => {
                const isSelected = wall.id === selectedWallId;
                return (
                  <g key={wall.id}>
                    <line
                      x1={wall.start.x}
                      y1={wall.start.y}
                      x2={wall.end.x}
                      y2={wall.end.y}
                      stroke={isSelected ? "red" : "black"}
                      strokeWidth={mmToPx(100)} // 100mm wall thickness
                      strokeLinecap="square"
                    />
                    {isSelected && (
                      <>
                        <circle
                          cx={wall.start.x}
                          cy={wall.start.y}
                          r={5 / scale}
                          fill="white"
                          stroke="red"
                          strokeWidth={2 / scale}
                          style={{ cursor: 'pointer' }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setDraggingWallHandle({ wallId: wall.id, handle: 'start' });
                          }}
                        />
                        <circle
                          cx={wall.end.x}
                          cy={wall.end.y}
                          r={5 / scale}
                          fill="white"
                          stroke="red"
                          strokeWidth={2 / scale}
                          style={{ cursor: 'pointer' }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setDraggingWallHandle({ wallId: wall.id, handle: 'end' });
                          }}
                        />
                      </>
                    )}
                  </g>
                );
              })}

              {/* Objects (Openings: Doors/Windows - Rendered ABOVE walls) */}
              {objects.filter(obj => {
                const typeDef = OBJECT_TYPES.find(t => t.id === obj.type);
                return typeDef && typeDef.type === 'opening';
              }).sort((a, b) => (a.id === selectedObjectId ? 1 : b.id === selectedObjectId ? -1 : 0)).map(obj => (
                <ObjectRenderer
                  key={obj.id}
                  obj={obj}
                  isSelected={obj.id === selectedObjectId}
                  scale={scale}
                  onHandleMouseDown={handleHandleMouseDown}
                  onObjectMouseDown={handleObjectMouseDown}
                />
              ))}

              {/* Render SELECTED room last (Foreground, on top of walls) */}
              {rooms.filter(r => r.id === selectedRoomId).map(room => {
                const pointsStr = room.points.map(p => `${p.x},${p.y}`).join(' ');
                const roomType = ROOM_TYPES.find(t => t.id === room.type) || ROOM_TYPES[1];

                return (
                  <g key={room.id}>
                    <polygon
                      points={pointsStr}
                      fill="rgba(100, 149, 237, 0.5)"
                      fillOpacity={0.5}
                      stroke="none"
                    />
                    {/* Selection highlight */}
                    <polygon
                      points={pointsStr}
                      fill="none"
                      stroke="orange"
                      strokeWidth={3 / scale}
                    />
                    {/* Highlight hovered edge */}
                    {hoveredRoomEdge && hoveredRoomEdge.roomId === room.id && (
                      <line
                        x1={room.points[hoveredRoomEdge.edgeIndex].x}
                        y1={room.points[hoveredRoomEdge.edgeIndex].y}
                        x2={room.points[(hoveredRoomEdge.edgeIndex + 1) % room.points.length].x}
                        y2={room.points[(hoveredRoomEdge.edgeIndex + 1) % room.points.length].y}
                        stroke="blue"
                        strokeWidth={4 / scale}
                        strokeLinecap="round"
                        pointerEvents="stroke"
                      />
                    )}
                    {/* Vertices */}
                    {room.points.map((p, i) => (
                      <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r={5 / scale}
                        fill="white"
                        stroke="blue"
                        strokeWidth={2 / scale}
                        style={{ cursor: 'pointer' }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setDraggingVertex({ roomId: room.id, pointIndex: i });
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation(); // Prevent adding a vertex when removing one
                          if (room.points.length > 3) {
                            const newPoints = room.points.filter((_, index) => index !== i);
                            setRooms(rooms.map(r => r.id === room.id ? { ...r, points: newPoints } : r));
                          } else {
                            showSnackbar('Cannot remove vertex: Room must have at least 3 points', 'error');
                          }
                        }}
                      />
                    ))}
                    {/* Room Label */}

                  </g>
                );
              })}

              {/* Room Labels (Rendered ABOVE everything) */}
              {rooms.map(room => {
                if (room.type === 'corridor') return null; // Skip label for corridor

                const roomType = ROOM_TYPES.find(t => t.id === room.type) || ROOM_TYPES[1];

                // Calculate center for text using centroid
                const centroid = getPolygonCentroid(room.points);
                const pointsMm = room.points.map(p => ({ x: pxToMm(p.x), y: pxToMm(p.y) }));
                const area = calculateArea(pointsMm);

                const labelText = room.type === 'free' ? (room.customLabel || '') : roomType.label;

                return (
                  <text
                    key={`label-${room.id}`}
                    x={centroid.x}
                    y={centroid.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={14 / scale}
                    pointerEvents="none"
                    fill="#333"
                    style={{ userSelect: 'none' }}
                  >
                    <tspan x={centroid.x} dy="-0.6em">{labelText}</tspan>
                    <tspan x={centroid.x} dy="1.2em">{area.tatami.toFixed(1)}畳</tspan>
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

              {currentCustomObject && (
                <g>
                  <polyline
                    points={currentCustomObject.points.map(p => `${p.x},${p.y}`).join(' ')}
                    fill="none"
                    stroke="#666"
                    strokeWidth={2 / scale}
                  />
                  {/* Rubber band line */}
                  <line
                    x1={currentCustomObject.points[currentCustomObject.points.length - 1].x}
                    y1={currentCustomObject.points[currentCustomObject.points.length - 1].y}
                    x2={mousePos.x}
                    y2={mousePos.y}
                    stroke="#666"
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


      {isSeismicModalOpen && (
        <div className="fixed inset-0 z-[9999] bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="relative w-full max-w-[95vw] h-[96vh] flex flex-col">
            {/* Close Button - Positioned outside the content container */}
            <button
              onClick={() => setIsSeismicModalOpen(false)}
              className="absolute -top-6 -right-5 z-50 p-2 text-white hover:text-gray-300 transition-colors"
              title="閉じる"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            <div className="bg-white w-full h-full rounded-lg shadow-xl overflow-hidden flex flex-col">
              <SeismicCheckPro initialData={seismicData} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

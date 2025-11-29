"use client";

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Upload, Activity, Shield, AlertTriangle, CheckCircle, Info, Move, MousePointer2, Trash2, RotateCcw, X, Home, ArrowUpCircle, Sparkles, Loader2, FileJson, Key } from 'lucide-react';

const SeismicCheckPro = ({ initialData }) => {
  // State
  const [jsonFloorPlan, setJsonFloorPlan] = useState(null); // Parsed JSON data for background rendering
  const [elements, setElements] = useState([]); // { id, type: 'wall'|'column', x, y, width, height, length }
  const [tool, setTool] = useState('wall'); // 'wall', 'column', 'select', 'eraser'
  const [buildingType, setBuildingType] = useState('1'); // '1' (平家) or '2' (2階建て)
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  // ViewBox State (Controls the visible area and aspect ratio)
  // Default is arbitrary, will be set by JSON data
  const [viewBox, setViewBox] = useState("0 0 100 100");

  // Gemini API State for Advice
  const [apiKey, setApiKey] = useState(""); // User input API Key
  const [aiAdvice, setAiAdvice] = useState(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiError, setAiError] = useState(null);

  // Refs
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Constants
  const WALL_MULTIPLIER = 2.5; // Wall strength multiplier
  const COLUMN_STRENGTH = 0.1; // Column contribution to stiffness
  const MODULE_GRID = 910; // 910mm module

  // Helper: Generate Unique ID
  const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Process JSON Data: Keep original coordinates (mm), adjust ViewBox
  const processJsonData = (data) => {
    const COORD_SCALE = 5;
    const scalePt = (val) => val * COORD_SCALE;

    // 1. Calculate Bounding Box
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const checkPoint = (x, y) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    };

    data.rooms?.forEach(room => room.points.forEach(p => checkPoint(scalePt(p.x), scalePt(p.y))));
    data.walls?.forEach(wall => {
      checkPoint(scalePt(wall.start.x), scalePt(wall.start.y));
      checkPoint(scalePt(wall.end.x), scalePt(wall.end.y));
    });
    data.objects?.forEach(obj => checkPoint(obj.x, obj.y));

    if (minX === Infinity) { minX = 0; maxX = 10000; minY = 0; maxY = 10000; }

    const padding = 1000;
    const vbMinX = minX - padding;
    const vbMinY = minY - padding;
    const vbWidth = (maxX - minX) + padding * 2;
    const vbHeight = (maxY - minY) + padding * 2;
    setViewBox(`${vbMinX} ${vbMinY} ${vbWidth} ${vbHeight}`);

    // --- Wall Splitting Logic ---

    // 2-a. Extract Openings (Windows/Doors) from objects
    const openings = [];
    data.objects?.forEach(obj => {
      if (
        obj.type.includes('window') ||
        obj.type.includes('door') ||
        obj.type === 'entrance' ||
        obj.type === 'opening'
      ) {
        // Determine orientation based on rotation
        const rotation = (obj.rotation || 0) % 360;
        const isVertical = (Math.abs(rotation - 90) < 1 || Math.abs(rotation - 270) < 1);

        const openingSize = obj.width;
        const thickness = obj.height > 100 ? obj.height : 300;

        openings.push({
          x: obj.x,
          y: obj.y,
          size: openingSize,
          thickness: thickness,
          isVertical: isVertical
        });
      }
    });

    const newElements = [];

    // 2-b. Process Walls: Subtract Openings
    if (data.walls) {
      data.walls.forEach(w => {
        const x1 = scalePt(w.start.x);
        const y1 = scalePt(w.start.y);
        const x2 = scalePt(w.end.x);
        const y2 = scalePt(w.end.y);

        const isWallVertical = Math.abs(x1 - x2) < 10;
        const isWallHorizontal = Math.abs(y1 - y2) < 10;

        let intervals = [];
        let wallPos = 0;

        if (isWallHorizontal) {
          intervals = [{ start: Math.min(x1, x2), end: Math.max(x1, x2) }];
          wallPos = y1;
        } else if (isWallVertical) {
          intervals = [{ start: Math.min(y1, y2), end: Math.max(y1, y2) }];
          wallPos = x1;
        } else {
          // Diagonal walls
          const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
          if (length > 100) {
            newElements.push({
              id: generateId(),
              type: 'wall',
              x1, y1, x2, y2, length, strength: length * WALL_MULTIPLIER
            });
          }
          return;
        }

        // Find intersecting openings
        const overlappingOpenings = openings.filter(op => {
          if (isWallHorizontal) {
            const opYMin = op.isVertical ? op.y - op.size / 2 : op.y - op.thickness / 2;
            const opYMax = op.isVertical ? op.y + op.size / 2 : op.y + op.thickness / 2;
            return (wallPos >= opYMin - 50 && wallPos <= opYMax + 50);
          } else {
            const opXMin = op.isVertical ? op.x - op.thickness / 2 : op.x - op.size / 2;
            const opXMax = op.isVertical ? op.x + op.thickness / 2 : op.x + op.size / 2;
            return (wallPos >= opXMin - 50 && wallPos <= opXMax + 50);
          }
        }).map(op => {
          if (isWallHorizontal) {
            const halfSize = (op.isVertical ? op.thickness : op.size) / 2;
            return { start: op.x - halfSize, end: op.x + halfSize };
          } else {
            const halfSize = (op.isVertical ? op.size : op.thickness) / 2;
            return { start: op.y - halfSize, end: op.y + halfSize };
          }
        });

        // Subtract intervals
        if (overlappingOpenings.length > 0) {
          overlappingOpenings.sort((a, b) => a.start - b.start);
          let currentIntervals = [...intervals];

          overlappingOpenings.forEach(op => {
            const nextIntervals = [];
            currentIntervals.forEach(iv => {
              const intersectStart = Math.max(iv.start, op.start);
              const intersectEnd = Math.min(iv.end, op.end);

              if (intersectStart < intersectEnd) {
                if (iv.start < intersectStart) {
                  nextIntervals.push({ start: iv.start, end: intersectStart });
                }
                if (intersectEnd < iv.end) {
                  nextIntervals.push({ start: intersectEnd, end: iv.end });
                }
              } else {
                nextIntervals.push(iv);
              }
            });
            currentIntervals = nextIntervals;
          });
          intervals = currentIntervals;
        }

        // Create wall elements
        intervals.forEach(iv => {
          const len = iv.end - iv.start;
          if (len > 100) {
            if (isWallHorizontal) {
              newElements.push({
                id: generateId(),
                type: 'wall',
                x1: iv.start, y1: wallPos,
                x2: iv.end, y2: wallPos,
                length: len, strength: len * WALL_MULTIPLIER
              });
            } else {
              newElements.push({
                id: generateId(),
                type: 'wall',
                x1: wallPos, y1: iv.start,
                x2: wallPos, y2: iv.end,
                length: len, strength: len * WALL_MULTIPLIER
              });
            }
          }
        });

      });
    }

    // 3. Import Columns
    const importColumns = (list) => {
      list?.forEach(obj => {
        newElements.push({
          id: generateId(),
          type: 'column',
          x: obj.x,
          y: obj.y,
          strength: COLUMN_STRENGTH
        });
      });
    };

    if (data.objects) importColumns(data.objects.filter(o => o.type === 'column'));
    if (data.columns) importColumns(data.columns);

    setElements(newElements);
    setJsonFloorPlan(data);
    setAiAdvice(null);
  };

  // --- Handlers ---

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type === "application/json" || file.name.endsWith('.json')) {
      handleJsonUpload(file);
    } else {
      alert("対応していないファイル形式です。間取りデータ(JSON)を選択してください。");
    }
  };

  const handleJsonUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        processJsonData(json);
      } catch (err) {
        console.error("JSON Parse Error", err);
        alert("JSONファイルの読み込みに失敗しました。");
      }
    };
    reader.readAsText(file);
  };

  // API Key & Local Storage Logic
  useEffect(() => {
    // Load API Key from local storage on mount
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  const handleApiKeyChange = (e) => {
    const newKey = e.target.value;
    setApiKey(newKey);
    // Save to local storage
    localStorage.setItem('gemini_api_key', newKey);
  };

  // Load initial data if provided
  useEffect(() => {
    if (initialData) {
      processJsonData(initialData);
    }
  }, [initialData]);

  // Convert Mouse Event to SVG Coordinates
  const getMousePos = (e) => {
    if (!containerRef.current) return { x: 0, y: 0 };

    const svg = containerRef.current.querySelector('svg');
    if (!svg) return { x: 0, y: 0 };

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;

    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());

    // Always snap to grid in JSON mode
    const snap = 455;
    return {
      x: Math.round(svgP.x / snap) * snap,
      y: Math.round(svgP.y / snap) * snap
    };
  };

  const handleMouseDown = (e) => {
    if (!jsonFloorPlan) return;
    const pos = getMousePos(e);

    if (tool === 'wall') {
      setIsDrawing(true);
      setStartPos(pos);
    } else if (tool === 'column') {
      const newElement = {
        id: generateId(),
        type: 'column',
        x: pos.x,
        y: pos.y,
        strength: COLUMN_STRENGTH
      };
      setElements([...elements, newElement]);
    } else if (tool === 'eraser') {
      const threshold = 500;
      const remaining = elements.filter(el => {
        let dist;
        if (el.type === 'wall') {
          const A = pos.x - el.x1;
          const B = pos.y - el.y1;
          const C = el.x2 - el.x1;
          const D = el.y2 - el.y1;
          const dot = A * C + B * D;
          const len_sq = C * C + D * D;
          let param = -1;
          if (len_sq !== 0) param = dot / len_sq;
          let xx, yy;
          if (param < 0) { xx = el.x1; yy = el.y1; }
          else if (param > 1) { xx = el.x2; yy = el.y2; }
          else { xx = el.x1 + param * C; yy = el.y1 + param * D; }
          const dx = pos.x - xx;
          const dy = pos.y - yy;
          dist = Math.sqrt(dx * dx + dy * dy);
        } else {
          dist = Math.sqrt(Math.pow(el.x - pos.x, 2) + Math.pow(el.y - pos.y, 2));
        }
        return dist > threshold;
      });
      setElements(remaining);
    }
  };

  const handleMouseMove = (e) => {
    // Visual feedback
  };

  const handleMouseUp = (e) => {
    if (!isDrawing || tool !== 'wall') return;
    const endPos = getMousePos(e);

    const length = Math.sqrt(
      Math.pow(endPos.x - startPos.x, 2) +
      Math.pow(endPos.y - startPos.y, 2)
    );

    const minLen = 100;

    if (length > minLen) {
      const newElement = {
        id: generateId(),
        type: 'wall',
        x1: startPos.x,
        y1: startPos.y,
        x2: endPos.x,
        y2: endPos.y,
        length: length,
        strength: length * WALL_MULTIPLIER
      };
      setElements([...elements, newElement]);
      if (aiAdvice) setAiAdvice(null);
    }
    setIsDrawing(false);
  };

  // --- Background Renderer ---
  const renderJsonBackground = () => {
    if (!jsonFloorPlan) return null;
    const COORD_SCALE = 5;

    return (
      <g className="opacity-60 pointer-events-none">
        {jsonFloorPlan.rooms?.map((room, i) => {
          const pointsStr = room.points.map(p => `${p.x * COORD_SCALE},${p.y * COORD_SCALE}`).join(' ');
          let fill = "#e5e7eb";
          if (room.type === 'ldk') fill = "#ffedd5";
          if (room.type === 'bath' || room.type === 'toilet' || room.type === 'wash') fill = "#dbeafe";
          if (room.type === 'western' || room.type === 'japanese') fill = "#f0fdf4";
          if (room.type === 'storage' || room.type === 'wic') fill = "#f3f4f6";
          if (room.type === 'entrance' || room.type === 'corridor') fill = "#fffbeb";

          return (
            <polygon
              key={`room-${i}`}
              points={pointsStr}
              fill={fill}
              stroke="#9ca3af"
              strokeWidth="10"
            />
          );
        })}

        {jsonFloorPlan.objects?.map((obj, i) => {
          if (obj.type === 'column') return null;

          let color = "#9ca3af";
          if (obj.type.includes('window')) { color = "#60a5fa"; }
          else if (obj.type.includes('door')) { color = "#d97706"; }
          else if (obj.type === 'kitchen' || obj.type === 'bath' || obj.type === 'toilet') { color = "#10b981"; }

          const transform = `rotate(${obj.rotation || 0}, ${obj.x}, ${obj.y})`;

          return (
            <g key={`obj-${i}`} transform={transform}>
              <rect
                x={obj.x - obj.width / 2}
                y={obj.y - obj.height / 2}
                width={obj.width}
                height={obj.height}
                fill="none"
                stroke={color}
                strokeWidth="20"
              />
              {(obj.label || obj.type === 'kitchen') && (
                <text x={obj.x} y={obj.y} fontSize="200" textAnchor="middle" fill={color} className="select-none">
                  {obj.label || obj.type}
                </text>
              )}
            </g>
          );
        })}
      </g>
    );
  };

  const renderGrid = () => {
    if (!showGrid) return null;

    // Extract bounds from viewBox string
    const [vx, vy, vw, vh] = viewBox.split(' ').map(Number);

    // Calculate grid lines
    const lines = [];
    const startX = Math.floor(vx / MODULE_GRID) * MODULE_GRID;
    const startY = Math.floor(vy / MODULE_GRID) * MODULE_GRID;
    const endX = vx + vw;
    const endY = vy + vh;

    for (let x = startX; x <= endX; x += MODULE_GRID) {
      lines.push(<line key={`v-${x}`} x1={x} y1={vy} x2={x} y2={endY} stroke="#e5e7eb" strokeWidth="5" />);
    }
    for (let y = startY; y <= endY; y += MODULE_GRID) {
      lines.push(<line key={`h-${y}`} x1={vx} y1={y} x2={endX} y2={y} stroke="#e5e7eb" strokeWidth="5" />);
    }
    return <g>{lines}</g>;
  };

  // Helper: Polygon Area and Centroid
  const calculatePolygonMetrics = (points) => {
    let area = 0;
    let cx = 0;
    let cy = 0;
    const n = points.length;

    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const cross = points[i].x * points[j].y - points[j].x * points[i].y;
      area += cross;
      cx += (points[i].x + points[j].x) * cross;
      cy += (points[i].y + points[j].y) * cross;
    }

    area = area / 2;
    if (Math.abs(area) < 0.001) return { area: 0, cx: 0, cy: 0 };

    cx = cx / (6 * area);
    cy = cy / (6 * area);

    return { area: Math.abs(area), cx, cy };
  };


  // --- Structural Calculation Logic ---
  const analysisResult = useMemo(() => {
    if (elements.length === 0) return null;

    // 1. Determine bounds
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    elements.forEach(el => {
      if (el.type === 'wall') {
        minX = Math.min(minX, el.x1, el.x2);
        maxX = Math.max(maxX, el.x1, el.x2);
        minY = Math.min(minY, el.y1, el.y2);
        maxY = Math.max(maxY, el.y1, el.y2);
      } else {
        minX = Math.min(minX, el.x);
        maxX = Math.max(maxX, el.x);
        minY = Math.min(minY, el.y);
        maxY = Math.max(maxY, el.y);
      }
    });

    const width = maxX - minX || 1;
    const height = maxY - minY || 1;

    // Calculate Gravity Center (G)
    let centerX, centerY;

    if (jsonFloorPlan && jsonFloorPlan.rooms && jsonFloorPlan.rooms.length > 0) {
      let sumAx = 0;
      let sumAy = 0;
      let totalArea = 0;
      const COORD_SCALE = 5;

      jsonFloorPlan.rooms.forEach(room => {
        const scaledPoints = room.points.map(p => ({
          x: p.x * COORD_SCALE,
          y: p.y * COORD_SCALE
        }));

        const { area: rArea, cx: rCx, cy: rCy } = calculatePolygonMetrics(scaledPoints);

        if (rArea > 0) {
          sumAx += rArea * rCx;
          sumAy += rArea * rCy;
          totalArea += rArea;
        }
      });

      if (totalArea > 0) {
        centerX = sumAx / totalArea;
        centerY = sumAy / totalArea;
      } else {
        centerX = (minX + maxX) / 2;
        centerY = (minY + maxY) / 2;
      }
    } else {
      centerX = (minX + maxX) / 2;
      centerY = (minY + maxY) / 2;
    }

    // --- Rigidity Center (K) Calculation ---

    let totalStiffnessX = 0;
    let totalStiffnessY = 0;
    let momentX = 0; // Stiffness * distY
    let momentY = 0; // Stiffness * distX
    let totalWallLength = 0;

    elements.forEach(el => {
      let st = el.strength;
      let cx, cy;

      if (el.type === 'wall') {
        cx = (el.x1 + el.x2) / 2;
        cy = (el.y1 + el.y2) / 2;
        totalWallLength += el.length;

        const dx = Math.abs(el.x1 - el.x2);
        const dy = Math.abs(el.y1 - el.y2);

        if (dx > dy) {
          totalStiffnessX += st;
          momentY += st * cy;
        } else {
          totalStiffnessY += st;
          momentX += st * cx;
        }
      }
    });

    const rigidityY = totalStiffnessX > 0 ? momentY / totalStiffnessX : centerY;
    const rigidityX = totalStiffnessY > 0 ? momentX / totalStiffnessY : centerX;

    const eccentricityX = Math.abs(centerX - rigidityX);
    const eccentricityY = Math.abs(centerY - rigidityY);

    const sizeScale = (width + height) / 2 || 1;
    const normEcc = (eccentricityX + eccentricityY) / sizeScale;

    const balanceScore = Math.max(0, 100 - normEcc * 500);

    const area = width * height || 1;
    const wallDensity = area > 0 ? (totalWallLength / area) : 0;

    let scoreFactor = 300000;

    const targetBase = buildingType === '2' ? 1.5 : 1.0;
    const quantityScore = Math.min(100, wallDensity * scoreFactor / targetBase);

    // Quadrants
    const midX = centerX;
    const midY = centerY;
    const quadrants = { tl: 0, tr: 0, bl: 0, br: 0 };

    elements.forEach(el => {
      if (el.type !== 'wall') return;
      const cx = (el.x1 + el.x2) / 2;
      const cy = (el.y1 + el.y2) / 2;
      const val = el.length;

      if (cx < midX && cy < midY) quadrants.tl += val;
      else if (cx >= midX && cy < midY) quadrants.tr += val;
      else if (cx < midX && cy >= midY) quadrants.bl += val;
      else quadrants.br += val;
    });

    const north = quadrants.tl + quadrants.tr;
    const south = quadrants.bl + quadrants.br;
    const east = quadrants.tr + quadrants.br;
    const west = quadrants.tl + quadrants.bl;

    const nsRatio = north > 0 && south > 0 ? Math.min(north, south) / Math.max(north, south) : 0;
    const ewRatio = east > 0 && west > 0 ? Math.min(east, west) / Math.max(east, west) : 0;

    return {
      centerX, centerY,
      rigidityX, rigidityY,

      normCenterX: centerX,
      normCenterY: centerY,
      normRigidityX: rigidityX,
      normRigidityY: rigidityY,

      balanceScore,
      quantityScore,
      eccentricityX, eccentricityY,
      nsRatio, ewRatio,
      quadrants,
      grade: (quantityScore > 80 && balanceScore > 80) ? 3 : (quantityScore > 50 && balanceScore > 50) ? 2 : 1
    };
  }, [elements, buildingType, jsonFloorPlan]);


  // --- Gemini API: Advice Generation ---
  const generateAIAdvice = async () => {
    if (!analysisResult) return;
    if (!apiKey) {
      setAiError("APIキーが入力されていません。");
      return;
    }

    setIsLoadingAI(true);
    setAiError(null);

    const biasY = analysisResult.normRigidityY - analysisResult.normCenterY;
    const rigidityBiasNS = biasY < -2 ? "北側（画面上）" : biasY > 2 ? "南側（画面下）" : "中央付近";
    const weakSideNS = biasY < -2 ? "南側" : biasY > 2 ? "北側" : "なし";

    const biasX = analysisResult.normRigidityX - analysisResult.normCenterX;
    const rigidityBiasEW = biasX < -2 ? "西側（画面左）" : biasX > 2 ? "東側（画面右）" : "中央付近";
    const weakSideEW = biasX < -2 ? "東側" : biasX > 2 ? "西側" : "なし";

    const northWalls = analysisResult.quadrants.tl + analysisResult.quadrants.tr;
    const southWalls = analysisResult.quadrants.bl + analysisResult.quadrants.br;
    const wallBalanceMsg = northWalls > southWalls * 1.2
      ? "北側の壁量が南側より大幅に多いです。"
      : southWalls > northWalls * 1.2
        ? "南側の壁量が北側より大幅に多いです。"
        : "南北の壁量は比較的バランスが取れています。";

    // Prepare detailed wall and opening data strings
    // Limit to avoid excessive prompt length, but include key info
    const wallDetails = elements
      .filter(el => el.type === 'wall')
      .map((el, i) => {
        const cx = (el.x1 + el.x2) / 2;
        const cy = (el.y1 + el.y2) / 2;
        const relX = cx - analysisResult.centerX;
        const relY = cy - analysisResult.centerY;
        // Area description
        const ns = relY < 0 ? "北" : "南";
        const ew = relX < 0 ? "西" : "東";
        const orientation = Math.abs(el.x1 - el.x2) > Math.abs(el.y1 - el.y2) ? "横(東西)" : "縦(南北)";
        return `壁${i + 1}: ${ns}${ew}エリア, ${orientation}, 長さ${el.length.toFixed(0)}, 座標(${cx.toFixed(0)}, ${cy.toFixed(0)})`;
      }).slice(0, 40).join('\n'); // limit items

    const openingDetails = jsonFloorPlan?.objects
      ?.filter(obj => obj.type.includes('window') || obj.type.includes('door') || obj.type === 'entrance' || obj.type === 'opening')
      .map((obj, i) => {
        const relX = obj.x - analysisResult.centerX;
        const relY = obj.y - analysisResult.centerY;
        const ns = relY < 0 ? "北" : "南";
        const ew = relX < 0 ? "西" : "東";
        return `${obj.type}${i + 1}: ${ns}${ew}エリア, 幅${obj.width}, 座標(${obj.x}, ${obj.y})`;
      }).slice(0, 40).join('\n') || "特になし";


    const systemPrompt = `
      あなたは経験豊富な日本の構造設計一級建築士です。
      ユーザーが作成した間取りの簡易耐震診断結果データを元に、施主に向けて具体的でわかりやすい改善アドバイスを行ってください。
      
      特に「剛心（強さの中心）の偏り」と「壁量の不足エリア」に着目し、具体的な方角や、提供された「壁・開口部の詳細配置データ」を参照して具体的な位置（座標や窓の近くなど）を挙げて弱点を指摘してください。
      
      重要なルール:
      - 座標系は画面左上が原点、Y軸は下向きがプラスです（画面上が北、画面下が南）。
      - 剛心が重心より「北」にある場合、建物は北側が強く、相対的に「南側」が弱点になります。逆も然りです。
      - 提供される「判定データ」を最も信頼し、それに基づいてアドバイスを組み立ててください。
      - 「南東にある大きな掃き出し窓（window3）付近」のように具体的に言及してください。
      
      出力フォーマット:
      1. **診断総評**: 現状の安全レベルについての率直な評価
      2. **詳細リスク分析**: 
         - 重心と剛心のズレから予測される地震時の挙動（ねじれ等）
         - 壁が不足している具体的な方角と、それが開口部によるものかどうかの分析
      3. **プロの改善案**: 
         - 具体的にどの方角・位置に壁を追加・補強すべきか（座標や近くの窓を目印に）
    `;

    const userPrompt = `
      以下の構造計算データに基づいて診断してください。
      建物種別: ${buildingType === '2' ? '木造2階建て（1階部分の診断）' : '木造平家'}
      
      【計算結果サマリー】
      - 壁量充足率: ${analysisResult.quantityScore.toFixed(1)}% (目標値に対する充足度)
      - 偏心率バランススコア: ${analysisResult.balanceScore.toFixed(1)}/100
      
      【偏心・バランス判定データ (これを最優先)】
      - 剛心の位置: 重心よりも **${rigidityBiasNS}**、**${rigidityBiasEW}** に偏っています。
      - 構造的に弱い方角: **${weakSideNS}**、**${weakSideEW}** の壁が不足している、または開口部が多すぎる可能性があります。
      - 壁量分布状況: ${wallBalanceMsg}
      
      【詳細数値データ】
      - 重心位置(建物中心): (X:${analysisResult.centerX.toFixed(1)}, Y:${analysisResult.centerY.toFixed(1)})
      - 剛心位置(強さ中心): (X:${analysisResult.rigidityX.toFixed(1)}, Y:${analysisResult.rigidityY.toFixed(1)})
      
      【4分割エリアの壁量スコア】
      (数値が大きいほど壁が多い)
      - 北西エリア: ${analysisResult.quadrants.tl.toFixed(1)}
      - 北東エリア: ${analysisResult.quadrants.tr.toFixed(1)}
      - 南西エリア: ${analysisResult.quadrants.bl.toFixed(1)}
      - 南東エリア: ${analysisResult.quadrants.br.toFixed(1)}

      【詳細配置データ (一部抜粋)】
      [壁リスト]
      ${wallDetails}

      [開口部リスト]
      ${openingDetails}
    `;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
          }),
        }
      );

      if (!response.ok) throw new Error('API request failed');
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) setAiAdvice(text);
      else throw new Error('No advice generated');
    } catch (error) {
      console.error('Gemini API Error:', error);
      setAiError('AIアドバイスの生成に失敗しました。');
    } finally {
      setIsLoadingAI(false);
    }
  };


  return (
    <div className="flex flex-col h-screen bg-gray-50 text-slate-800 font-sans">
      {/* Header */}
      <header className="bg-slate-900 text-white p-4 shadow-md flex justify-between items-center z-10">
        <div className="flex items-center space-x-2">
          <Shield className="w-6 h-6 text-emerald-400" />
          <h1 className="text-xl font-bold tracking-tight">耐震AIチェッカー <span className="text-xs font-normal opacity-70 ml-2">Structural Health Check Pro</span></h1>
        </div>
        <div className="flex space-x-4 text-sm">
          {!jsonFloorPlan && (
            <button
              onClick={() => fileInputRef.current.click()}
              className="flex items-center px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
            >
              <Upload className="w-4 h-4 mr-2" />
              ファイルを開く
            </button>
          )}
          {(jsonFloorPlan) && (
            <button
              onClick={() => { setJsonFloorPlan(null); setElements([]); setAiAdvice(null); }}
              className="flex items-center px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded transition-colors"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              リセット
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden">

        {/* Left: Canvas Area */}
        <div className="flex-1 bg-gray-200 relative overflow-hidden flex items-center justify-center p-8">
          {!jsonFloorPlan ? (
            <div
              onClick={() => fileInputRef.current.click()}
              className="w-full max-w-2xl h-96 border-4 border-dashed border-gray-400 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors bg-white/50"
            >
              <div className="flex space-x-4 mb-4">
                <FileJson className="w-16 h-16 text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-600">間取り図をドロップ</h3>
              <p className="text-gray-500 mt-2">JSONファイルを選択してください</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          ) : (
            <div className="relative shadow-2xl bg-white select-none group w-full h-full max-h-[85vh] aspect-auto bg-white flex items-center justify-center overflow-hidden">

              <div className="relative w-full h-full" ref={containerRef}>
                {/* Main Interactive SVG */}
                <svg
                  width="100%"
                  height="100%"
                  viewBox={viewBox}
                  preserveAspectRatio="xMidYMid meet"
                  className={`absolute inset-0 w-full h-full ${tool === 'eraser' ? 'cursor-crosshair' : 'cursor-crosshair'}`}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                >
                  {/* Grid */}
                  {renderGrid()}

                  {/* JSON Background Layer */}
                  {renderJsonBackground()}

                  {/* Walls & Columns */}
                  {elements.map((el) => {
                    if (el.type === 'wall') {
                      return (
                        <g key={el.id}>
                          <line
                            x1={el.x1} y1={el.y1}
                            x2={el.x2} y2={el.y2}
                            stroke="#ef4444"
                            strokeWidth={150}
                            strokeLinecap="round"
                            className="drop-shadow-sm opacity-90"
                          />
                          <circle cx={el.x1} cy={el.y1} r={75} fill="#991b1b" />
                          <circle cx={el.x2} cy={el.y2} r={75} fill="#991b1b" />
                        </g>
                      );
                    } else {
                      return (
                        <rect
                          key={el.id}
                          x={el.x - 150} y={el.y - 150}
                          width={300} height={300}
                          fill="#3b82f6"
                          className="drop-shadow-sm"
                        />
                      );
                    }
                  })}

                  {/* Analysis Overlays */}
                  {analysisResult && showAnalysis && (
                    <>
                      {/* Center of Gravity */}
                      <circle cx={analysisResult.centerX} cy={analysisResult.centerY} r={300} fill="rgba(255, 165, 0, 0.8)" stroke="white" strokeWidth={50} />

                      {/* Center of Rigidity */}
                      <circle cx={analysisResult.rigidityX} cy={analysisResult.rigidityY} r={300} fill="rgba(16, 185, 129, 0.8)" stroke="white" strokeWidth={50} />

                      {/* Connection Line */}
                      <line
                        x1={analysisResult.centerX} y1={analysisResult.centerY}
                        x2={analysisResult.rigidityX} y2={analysisResult.rigidityY}
                        stroke="purple" strokeWidth={50} strokeDasharray="100,100"
                      />
                    </>
                  )}
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Right: Sidebar Controls & Analysis */}
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col overflow-y-auto shadow-xl">
          {/* Building Settings */}
          <div className="p-4 border-b border-gray-100 bg-slate-50">
            <h2 className="text-xs font-bold text-gray-500 uppercase mb-3">建物設定</h2>
            <div className="flex bg-white rounded-lg border border-gray-200 p-1">
              <button
                onClick={() => { setBuildingType('1'); setAiAdvice(null); }}
                className={`flex-1 flex items-center justify-center py-2 px-3 rounded text-sm font-medium transition-colors ${buildingType === '1' ? 'bg-emerald-100 text-emerald-800' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <Home className="w-4 h-4 mr-2" />
                平家
              </button>
              <button
                onClick={() => { setBuildingType('2'); setAiAdvice(null); }}
                className={`flex-1 flex items-center justify-center py-2 px-3 rounded text-sm font-medium transition-colors ${buildingType === '2' ? 'bg-indigo-100 text-indigo-800' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <ArrowUpCircle className="w-4 h-4 mr-2" />
                2階建て
              </button>
            </div>
          </div>

          {/* Tools */}
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-xs font-bold text-gray-400 uppercase mb-3">編集ツール</h2>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setTool('wall')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${tool === 'wall' ? 'bg-red-50 border-red-500 text-red-600' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <Move className="w-5 h-5 mb-1" />
                <span className="text-xs font-bold">耐力壁</span>
              </button>
              <button
                onClick={() => setTool('column')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${tool === 'column' ? 'bg-blue-50 border-blue-500 text-blue-600' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <MousePointer2 className="w-5 h-5 mb-1" />
                <span className="text-xs font-bold">柱</span>
              </button>
              <button
                onClick={() => setTool('eraser')}
                className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${tool === 'eraser' ? 'bg-gray-100 border-gray-400 text-gray-700' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <Trash2 className="w-5 h-5 mb-1" />
                <span className="text-xs font-bold">削除</span>
              </button>
            </div>
            <div className="mt-3 flex items-center space-x-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showAnalysis"
                  checked={showAnalysis}
                  onChange={(e) => setShowAnalysis(e.target.checked)}
                  className="mr-2 rounded text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="showAnalysis" className="text-sm text-gray-600 cursor-pointer">重心・剛心</label>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="showGrid"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="mr-2 rounded text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="showGrid" className="text-sm text-gray-600 cursor-pointer">910グリッド</label>
              </div>
            </div>
          </div>

          {/* Real-time Analysis Report */}
          <div className="flex-1 p-4">
            <h2 className="text-xs font-bold text-gray-400 uppercase mb-3">構造診断レポート</h2>

            {!analysisResult ? (
              <div className="text-center text-gray-400 py-10">
                <Activity className="w-12 h-12 mx-auto mb-2 opacity-20" />
                <p className="text-sm">壁や柱を配置すると<br />診断が始まります</p>
              </div>
            ) : (
              <div className="space-y-6">

                {/* Overall Grade */}
                <div className="bg-slate-50 p-4 rounded-xl text-center border border-slate-100">
                  <div className="text-sm text-slate-500 mb-1">推定耐震等級</div>
                  <div className="flex items-center justify-center space-x-2">
                    {[1, 2, 3].map(g => (
                      <div key={g} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${analysisResult.grade >= g ? 'bg-emerald-500 text-white shadow-lg scale-110' : 'bg-gray-200 text-gray-400'}`}>
                        {g}
                      </div>
                    ))}
                  </div>
                  <div className={`mt-2 text-lg font-bold ${analysisResult.grade === 3 ? 'text-emerald-600' : analysisResult.grade === 2 ? 'text-amber-600' : 'text-red-500'}`}>
                    {analysisResult.grade === 3 ? '極めて良好' : analysisResult.grade === 2 ? '良好' : '要注意'}
                  </div>
                </div>

                {/* Metrics */}
                <div className="space-y-4">
                  {/* Wall Quantity */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-semibold text-gray-700">壁量充足率</span>
                      <span className="font-mono text-gray-500">{analysisResult.quantityScore.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${analysisResult.quantityScore > 80 ? 'bg-emerald-500' : analysisResult.quantityScore > 50 ? 'bg-amber-400' : 'bg-red-500'}`}
                        style={{ width: `${analysisResult.quantityScore}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Balance / Eccentricity */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-semibold text-gray-700">偏心率バランス</span>
                      <span className="font-mono text-gray-500">{analysisResult.balanceScore.toFixed(0)}/100</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${analysisResult.balanceScore > 80 ? 'bg-emerald-500' : analysisResult.balanceScore > 60 ? 'bg-amber-400' : 'bg-red-500'}`}
                        style={{ width: `${analysisResult.balanceScore}%` }}
                      ></div>
                    </div>
                  </div>
                </div>

                {/* AI Architect Advice Section */}
                <div className="mt-6 border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-bold text-slate-800 flex items-center">
                      <Sparkles className="w-4 h-4 mr-1 text-purple-500" />
                      AI構造設計士レポート
                    </h4>
                  </div>

                  {/* API Key Input */}
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-500 mb-1 flex items-center">
                      <Key className="w-3 h-3 mr-1" />
                      Gemini API Key
                    </label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={handleApiKeyChange}
                      placeholder="APIキーを入力..."
                      className="w-full px-3 py-2 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 bg-gray-50"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                      ※キーはブラウザ内にのみ保存され、外部には送信されません。
                    </p>
                  </div>

                  {!aiAdvice ? (
                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-center">
                      <button
                        onClick={generateAIAdvice}
                        disabled={isLoadingAI}
                        className="w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-bold shadow-sm transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoadingAI ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            分析中...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2" />
                            詳細アドバイスを生成 ✨
                          </>
                        )}
                      </button>
                      {aiError && (
                        <p className="text-xs text-red-500 mt-2">{aiError}</p>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white p-4 rounded-xl border border-purple-200 shadow-sm relative animate-in fade-in duration-500">
                      <button
                        onClick={() => setAiAdvice(null)}
                        className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="prose prose-sm prose-purple max-w-none text-xs leading-relaxed text-gray-700 whitespace-pre-wrap">
                        {aiAdvice}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SeismicCheckPro;
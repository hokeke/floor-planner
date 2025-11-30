"use client";

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Upload, Activity, Shield, AlertTriangle, CheckCircle, Info, Move, MousePointer2, Trash2, RotateCcw, X, Home, ArrowUpCircle, Sparkles, Loader2, FileJson, Key, Settings, Send, Layers, Wand2, Network, Calculator } from 'lucide-react';

// --- Logic Extraction: Pure Calculation Function ---
const calculateAnalysis = (elements, buildingType, jsonFloorPlan, seismicGrade = 1) => {
  if (!elements || elements.length === 0) return null;

  // 1. Helper: Polygon Metrics
  const calculatePolygonMetrics = (points) => {
    let area = 0, cx = 0, cy = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const cross = points[i].x * points[j].y - points[j].x * points[i].y;
      area += cross;
      cx += (points[i].x + points[j].x) * cross;
      cy += (points[i].y + points[j].y) * cross;
    }
    area /= 2;
    if (Math.abs(area) < 0.001) return { area: 0, cx: 0, cy: 0 };
    return { area: Math.abs(area), cx: cx / (6 * area), cy: cy / (6 * area) };
  };

  // 2. Gravity Center (G)
  let centerX, centerY, totalArea = 0;
  if (jsonFloorPlan && jsonFloorPlan.rooms) {
    let sumAx = 0, sumAy = 0;
    const COORD_SCALE = 5;
    jsonFloorPlan.rooms.forEach(room => {
      const pts = room.points.map(p => ({ x: p.x * COORD_SCALE, y: p.y * COORD_SCALE }));
      const { area, cx, cy } = calculatePolygonMetrics(pts);
      if (area > 0) { sumAx += area * cx; sumAy += area * cy; totalArea += area; }
    });
    if (totalArea > 0) { centerX = sumAx / totalArea; centerY = sumAy / totalArea; }
  }

  // Fallback center if no rooms
  if (centerX === undefined) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    elements.forEach(el => {
      if (el.type === 'wall') { minX = Math.min(minX, el.x1, el.x2); maxX = Math.max(maxX, el.x1, el.x2); minY = Math.min(minY, el.y1, el.y2); maxY = Math.max(maxY, el.y1, el.y2); }
    });
    if (minX === Infinity) { centerX = 5000; centerY = 5000; totalArea = 1; } // Default fallback
    else {
      centerX = (minX + maxX) / 2; centerY = (minY + maxY) / 2;
      totalArea = (maxX - minX) * (maxY - minY) || 1;
    }
  }

  // 3. Rigidity (K)
  let Kx = 0, Ky = 0;
  let Kx_y = 0, Ky_x = 0;
  let totalWallLength = 0;

  elements.forEach(el => {
    if (el.type !== 'wall') return;
    const cx = (el.x1 + el.x2) / 2;
    const cy = (el.y1 + el.y2) / 2;
    const dx = Math.abs(el.x1 - el.x2);
    const dy = Math.abs(el.y1 - el.y2);

    const mult = el.multiplier || 2.5;
    const stiffness = el.length * mult;
    totalWallLength += el.length;

    if (dx > dy) {
      Kx += stiffness;
      Kx_y += stiffness * cy;
    } else {
      Ky += stiffness;
      Ky_x += stiffness * cx;
    }
  });

  const rigidityY = Kx > 0 ? Kx_y / Kx : centerY;
  const rigidityX = Ky > 0 ? Ky_x / Ky : centerX;

  // 4. Torsional Stiffness & Elastic Radius
  let K_rot = 0;
  elements.forEach(el => {
    if (el.type !== 'wall') return;
    const cx = (el.x1 + el.x2) / 2;
    const cy = (el.y1 + el.y2) / 2;
    const dx = Math.abs(el.x1 - el.x2);
    const dy = Math.abs(el.y1 - el.y2);
    const mult = el.multiplier || 2.5;
    const st = el.length * mult;

    if (dx > dy) {
      const distY = cy - rigidityY;
      K_rot += st * distY * distY;
    } else {
      const distX = cx - rigidityX;
      K_rot += st * distX * distX;
    }
  });

  const rex = Math.sqrt(K_rot / Kx) || 1;
  const rey = Math.sqrt(K_rot / Ky) || 1;

  // 5. Eccentricity Ratio
  const ex = Math.abs(rigidityX - centerX);
  const ey = Math.abs(rigidityY - centerY);
  const Rex = ey / rex;
  const Rey = ex / rey;
  const maxRe = Math.max(Rex, Rey);

  // Score Calculation Logic (Strict)
  let balanceScore = 0;
  if (maxRe <= 0.15) {
    balanceScore = 100;
  } else if (maxRe <= 0.30) {
    const ratio = (maxRe - 0.15) / 0.15;
    balanceScore = 100 - (ratio * 40);
  } else {
    const ratio = Math.min(1, (maxRe - 0.30) / 0.30);
    balanceScore = 60 - (ratio * 60);
  }

  // 6. Wall Quantity
  const baseCoeff = buildingType === '2' ? 0.0018 : 0.0011;
  let gradeFactor = 1.0;
  if (seismicGrade === 2) gradeFactor = 1.25;
  if (seismicGrade === 3) gradeFactor = 1.50;

  const targetStiffness = totalArea * baseCoeff * gradeFactor;
  const totalStiffness = Kx + Ky;
  const quantityScore = Math.min(100, (totalStiffness / targetStiffness) * 100);

  // Quadrants
  const quadrants = { tl: 0, tr: 0, bl: 0, br: 0 };
  elements.forEach(el => {
    if (el.type !== 'wall') return;
    const cx = (el.x1 + el.x2) / 2;
    const cy = (el.y1 + el.y2) / 2;
    const val = el.length;
    if (cx < centerX && cy < centerY) quadrants.tl += val;
    else if (cx >= centerX && cy < centerY) quadrants.tr += val;
    else if (cx < centerX && cy >= centerY) quadrants.bl += val;
    else quadrants.br += val;
  });

  return {
    centerX, centerY, rigidityX, rigidityY,
    normCenterX: centerX, normCenterY: centerY,
    normRigidityX: rigidityX, normRigidityY: rigidityY,
    ex: ex, ey: ey, rex, rey, Rex, Rey, maxRe,
    balanceScore, quantityScore,
    targetStiffness, totalStiffness,
    quadrants
  };
};


const SeismicCheckPro = ({ initialData }) => {
  // State
  const [jsonFloorPlan, setJsonFloorPlan] = useState(null);
  const [elements, setElements] = useState([]);
  const [beams, setBeams] = useState([]); // 梁のデータ
  const [weakPoints, setWeakPoints] = useState([]); // 許容応力度計算の弱点データ
  const [hoveredWeakPoint, setHoveredWeakPoint] = useState(null);
  const [tool, setTool] = useState('wall');
  const [wallMultiplier, setWallMultiplier] = useState(2.5);
  const [buildingType, setBuildingType] = useState('1');
  const [seismicGrade, setSeismicGrade] = useState(1); // Added State
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showBeams, setShowBeams] = useState(true);

  const [viewBox, setViewBox] = useState("0 0 100 100");

  // Gemini API State
  const [apiKey, setApiKey] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  // Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isSimulatingBeams, setIsSimulatingBeams] = useState(false);
  const [isCalculatingStress, setIsCalculatingStress] = useState(false);
  const [aiError, setAiError] = useState(null);

  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Constants
  const WALL_MULTIPLIER = 2.5;
  const COLUMN_STRENGTH = 0.1;
  const MODULE_GRID = 910;

  const WALL_TYPES = [
    { value: 1.0, label: '1.0 (片筋交い/構造用合板薄)' },
    { value: 1.5, label: '1.5 (木ずり)' },
    { value: 2.0, label: '2.0 (両筋交い)' },
    { value: 2.5, label: '2.5 (構造用合板 標準)' },
    { value: 3.0, label: '3.0 (2.5+筋交い等)' },
    { value: 4.0, label: '4.0 (強固な耐力壁)' },
    { value: 5.0, label: '5.0 (最強クラス)' },
  ];

  const WALL_PRESETS = [1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0];

  const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return `id-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  };

  useEffect(() => {
    if (chatMessages.length > 0 || isLoadingAI) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isLoadingAI]);

  const getValidWallSegments = (data) => {
    if (!data || !data.walls) return [];
    const COORD_SCALE = 5;
    const scalePt = (val) => val * COORD_SCALE;
    const openings = [];
    data.objects?.forEach(obj => {
      if (obj.type.includes('window') || obj.type.includes('door') || obj.type === 'entrance' || obj.type === 'opening') {
        const rotation = (obj.rotation || 0) % 360;
        const isVertical = (Math.abs(rotation - 90) < 1 || Math.abs(rotation - 270) < 1);
        const openingSize = obj.width;
        const thickness = obj.height > 100 ? obj.height : 300;
        openings.push({ x: obj.x, y: obj.y, size: openingSize, thickness, isVertical });
      }
    });
    const validSegments = [];
    data.walls.forEach(w => {
      const x1 = scalePt(w.start.x);
      const y1 = scalePt(w.start.y);
      const x2 = scalePt(w.end.x);
      const y2 = scalePt(w.end.y);
      const isVertical = Math.abs(x1 - x2) < 10;
      const isHorizontal = Math.abs(y1 - y2) < 10;
      let intervals = [];
      let fixedPos = 0;
      if (isHorizontal) { intervals = [{ start: Math.min(x1, x2), end: Math.max(x1, x2) }]; fixedPos = y1; }
      else if (isVertical) { intervals = [{ start: Math.min(y1, y2), end: Math.max(y1, y2) }]; fixedPos = x1; }
      else {
        const len = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        if (len > 100) validSegments.push({ x1, y1, x2, y2, length: len });
        return;
      }
      const overlapping = openings.filter(op => {
        if (isHorizontal) {
          const opYMin = op.isVertical ? op.y - op.size / 2 : op.y - op.thickness / 2;
          const opYMax = op.isVertical ? op.y + op.size / 2 : op.y + op.thickness / 2;
          return (fixedPos >= opYMin - 50 && fixedPos <= opYMax + 50);
        } else {
          const opXMin = op.isVertical ? op.x - op.thickness / 2 : op.x - op.size / 2;
          const opXMax = op.isVertical ? op.x + op.thickness / 2 : op.x + op.size / 2;
          return (fixedPos >= opXMin - 50 && fixedPos <= opXMax + 50);
        }
      }).map(op => {
        if (isHorizontal) {
          const half = (op.isVertical ? op.thickness : op.size) / 2;
          return { start: op.x - half, end: op.x + half };
        } else {
          const half = (op.isVertical ? op.size : op.thickness) / 2;
          return { start: op.y - half, end: op.y + half };
        }
      });
      if (overlapping.length > 0) {
        overlapping.sort((a, b) => a.start - b.start);
        let currentInts = [...intervals];
        overlapping.forEach(op => {
          const nextInts = [];
          currentInts.forEach(iv => {
            const iStart = Math.max(iv.start, op.start);
            const iEnd = Math.min(iv.end, op.end);
            if (iStart < iEnd) {
              if (iv.start < iStart) nextInts.push({ start: iv.start, end: iStart });
              if (iEnd < iv.end) nextInts.push({ start: iEnd, end: iv.end });
            } else { nextInts.push(iv); }
          });
          currentInts = nextInts;
        });
        intervals = currentInts;
      }
      intervals.forEach(iv => {
        const len = iv.end - iv.start;
        if (len > 100) {
          if (isHorizontal) validSegments.push({ x1: iv.start, y1: fixedPos, x2: iv.end, y2: fixedPos, length: len });
          else validSegments.push({ x1: fixedPos, y1: iv.start, x2: fixedPos, y2: iv.end, length: len });
        }
      });
    });
    return validSegments;
  };

  const processJsonData = (data) => {
    const COORD_SCALE = 5;
    const scalePt = (val) => val * COORD_SCALE;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const check = (x, y) => { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; };
    data.rooms?.forEach(r => r.points.forEach(p => check(scalePt(p.x), scalePt(p.y))));
    data.walls?.forEach(w => { check(scalePt(w.start.x), scalePt(w.start.y)); check(scalePt(w.end.x), scalePt(w.end.y)); });
    data.objects?.forEach(o => check(o.x, o.y));
    if (minX === Infinity) { minX = 0; maxX = 10000; minY = 0; maxY = 10000; }
    const padding = 1000;
    setViewBox(`${minX - padding} ${minY - padding} ${maxX - minX + padding * 2} ${maxY - minY + padding * 2}`);

    const validSegments = getValidWallSegments(data);
    const newElements = validSegments.map(s => ({
      id: generateId(), type: 'wall', x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, length: s.length,
      multiplier: wallMultiplier, strength: s.length * wallMultiplier
    }));
    const importCols = (list) => {
      list?.forEach(obj => {
        newElements.push({ id: generateId(), type: 'column', x: obj.x, y: obj.y, strength: COLUMN_STRENGTH });
      });
    };
    if (data.objects) importCols(data.objects.filter(o => o.type === 'column'));
    if (data.columns) importCols(data.columns);
    setElements(newElements);
    setJsonFloorPlan(data);
    setChatMessages([]);
    setBeams([]); // Reset beams
    setWeakPoints([]); // Reset weak points
  };

  // Handlers
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type === "application/json" || file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try { processJsonData(JSON.parse(ev.target.result)); } catch (err) { alert("JSON読み込みエラー"); }
      };
      reader.readAsText(file);
    } else { alert("JSONファイルを選択してください。"); }
  };

  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) setApiKey(savedKey);
    if (initialData) processJsonData(initialData);
  }, [initialData]);

  const handleApiKeyChange = (e) => {
    setApiKey(e.target.value);
    localStorage.setItem('gemini_api_key', e.target.value);
  };

  const getMousePos = (e) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const svg = containerRef.current.querySelector('svg');
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
    const snap = 455;
    return { x: Math.round(svgP.x / snap) * snap, y: Math.round(svgP.y / snap) * snap };
  };

  const handleMouseDown = (e) => {
    if (!jsonFloorPlan) return;
    const pos = getMousePos(e);
    if (tool === 'wall') {
      setIsDrawing(true);
      setStartPos(pos);
    } else if (tool === 'column') {
      setElements([...elements, { id: generateId(), type: 'column', x: pos.x, y: pos.y, strength: COLUMN_STRENGTH }]);
    } else if (tool === 'eraser') {
      const threshold = 500;
      setElements(elements.filter(el => {
        let dist;
        if (el.type === 'wall') {
          const A = pos.x - el.x1, B = pos.y - el.y1, C = el.x2 - el.x1, D = el.y2 - el.y1;
          const dot = A * C + B * D, len_sq = C * C + D * D;
          let param = -1;
          if (len_sq !== 0) param = dot / len_sq;
          let xx, yy;
          if (param < 0) { xx = el.x1; yy = el.y1; }
          else if (param > 1) { xx = el.x2; yy = el.y2; }
          else { xx = el.x1 + param * C; yy = el.y1 + param * D; }
          dist = Math.sqrt(Math.pow(pos.x - xx, 2) + Math.pow(pos.y - yy, 2));
        } else {
          dist = Math.sqrt(Math.pow(el.x - pos.x, 2) + Math.pow(el.y - pos.y, 2));
        }
        return dist > threshold;
      }));
    }
  };

  const handleMouseMove = (e) => { };

  const handleMouseUp = (e) => {
    if (!isDrawing || tool !== 'wall') return;
    const endPos = getMousePos(e);
    const len = Math.sqrt(Math.pow(endPos.x - startPos.x, 2) + Math.pow(endPos.y - startPos.y, 2));
    if (len > 100) {
      setElements([...elements, {
        id: generateId(), type: 'wall',
        x1: startPos.x, y1: startPos.y, x2: endPos.x, y2: endPos.y,
        length: len, multiplier: wallMultiplier, strength: len * wallMultiplier
      }]);
    }
    setIsDrawing(false);
  };

  const analysisResult = useMemo(() => {
    return calculateAnalysis(elements, buildingType, jsonFloorPlan, seismicGrade);
  }, [elements, buildingType, jsonFloorPlan, seismicGrade]);

  const generateAIAdvice = async (overrideMessage = null) => {
    if (!analysisResult || !apiKey) { setAiError("APIキーを入力してください"); return; }
    setIsLoadingAI(true);
    setAiError(null);

    const isFirst = chatMessages.length === 0;
    let userMessageText = overrideMessage || inputMessage;
    if (isFirst && !userMessageText) userMessageText = "詳細診断をお願いします。";

    let apiPromptText = userMessageText;
    if (isFirst || overrideMessage) {
      const wallList = elements.filter(e => e.type === 'wall').map((e, i) => {
        const cx = (e.x1 + e.x2) / 2, cy = (e.y1 + e.y2) / 2;
        const orient = Math.abs(e.x1 - e.x2) > Math.abs(e.y1 - e.y2) ? "横" : "縦";
        return `壁${i}: ${orient}, 倍率${e.multiplier}, 座標(${cx.toFixed(0)},${cy.toFixed(0)})`;
      }).slice(0, 30).join('\n');

      apiPromptText = `
          構造計算詳細データ:
          - 壁量充足率: ${analysisResult.quantityScore.toFixed(0)}%
          - 最大偏心率: ${analysisResult.maxRe.toFixed(3)}
          - 判定基準: 偏心率0.15以下=優良(Rank S), 0.30以下=適合(Rank A), 0.30超=要注意(Rank B)
          - 重心(G): (${analysisResult.centerX.toFixed(0)}, ${analysisResult.centerY.toFixed(0)})
          - 剛心(K): (${analysisResult.rigidityX.toFixed(0)}, ${analysisResult.rigidityY.toFixed(0)})
          
          現在の壁リスト(一部):
          ${wallList}
          
          ユーザーからの要望: "${userMessageText}"
          このデータを元に、プロの構造設計士として詳細な診断と、偏心率を0.15以下にするための具体的な壁の追加・補強案（位置と倍率）を提案してください。
        `;
    }

    const newHistory = [...chatMessages, { role: 'user', text: userMessageText }];
    setChatMessages(newHistory);
    setInputMessage("");

    try {
      const contents = newHistory.map((m, i) => {
        if (i === newHistory.length - 1) return { role: m.role, parts: [{ text: apiPromptText }] };
        return { role: m.role, parts: [{ text: m.text }] };
      });
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
      });
      const data = await res.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "エラーが発生しました";
      setChatMessages(prev => [...prev, { role: 'model', text: reply }]);
    } catch (e) { setAiError("通信エラー"); } finally { setIsLoadingAI(false); }
  };

  const optimizeStructure = async () => {
    if (!analysisResult || !apiKey) { setAiError("APIキーを入力してください"); return; }
    setIsOptimizing(true);
    setAiError(null);

    const validCandidates = getValidWallSegments(jsonFloorPlan);
    const candidateList = validCandidates.map((s, i) => ({
      id: i, x1: Math.round(s.x1), y1: Math.round(s.y1), x2: Math.round(s.x2), y2: Math.round(s.y2), len: Math.round(s.length)
    }));

    const MAX_RETRIES = 3;
    let bestElements = null;
    let bestScore = -1;
    let bestReasoning = "";
    let bestMetrics = null;
    let tryCount = 0;
    let targetReached = false;

    const cols = elements.filter(e => e.type === 'column');

    while (tryCount < MAX_RETRIES && !targetReached) {
      tryCount++;
      const systemPrompt = `
          あなたは構造設計の専門家AIです。
          与えられた「壁配置候補（Candidate Walls）」の中から、耐震性能が最適になる組み合わせを選定してください。
          
          【目標】
          1. 壁量充足率 100%以上
          2. 偏心率バランススコア 98点以上 (偏心率を限りなく0.15以下、できれば0に近づける)
          
          【ルール】
          - 使用する壁の倍率は ${wallMultiplier} です。
          - 窓やドアの位置には壁を配置しないでください。
          - 試行回数: ${tryCount}/${MAX_RETRIES}回目。前の結果にとらわれず、ベストな配置を探ってください。
          
          【出力フォーマット】
          JSON形式のみ: { "selectedWallIds": [...], "reasoning": "..." }
        `;
      const userPrompt = `
          条件:
          - 壁倍率: ${wallMultiplier}倍
          - 重心位置: (X:${analysisResult.centerX.toFixed(0)}, Y:${analysisResult.centerY.toFixed(0)})
          - 壁候補: ${JSON.stringify(candidateList)}
        `;

      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { responseMimeType: "application/json" }
          })
        });
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const result = JSON.parse(text);
          if (result.selectedWallIds) {
            const generatedElements = result.selectedWallIds.map(id => {
              const s = validCandidates[id];
              if (!s) return null;
              return {
                id: generateId(), type: 'wall',
                x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2,
                length: s.length,
                multiplier: wallMultiplier,
                strength: s.length * wallMultiplier
              };
            }).filter(Boolean);
            const testElements = [...generatedElements, ...cols];
            const metrics = calculateAnalysis(testElements, buildingType, jsonFloorPlan, seismicGrade);
            let currentScore = metrics.balanceScore;
            if (metrics.quantityScore < 100) currentScore = currentScore * (metrics.quantityScore / 100);
            if (currentScore > bestScore) {
              bestScore = currentScore;
              bestElements = testElements;
              bestReasoning = result.reasoning;
              bestMetrics = metrics;
            }
            if (metrics.balanceScore >= 98 && metrics.quantityScore >= 100) targetReached = true;
          }
        }
      } catch (e) { console.error("Optimization Attempt Failed", e); }
    }

    if (bestElements) {
      setElements(bestElements);
      const systemMsg = `【自動最適化完了】 (試行回数: ${tryCount})\n\nAI思考: ${bestReasoning}\n\n📊 実測結果:\n- 最大偏心率: ${bestMetrics.maxRe.toFixed(3)}\n- バランススコア: ${bestMetrics.balanceScore.toFixed(0)}/100\n- 壁量充足率: ${bestMetrics.quantityScore.toFixed(0)}%`;
      setChatMessages(prev => [...prev, { role: 'model', text: systemMsg }]);
    } else {
      setAiError("最適化に失敗しました。");
    }
    setIsOptimizing(false);
  };

  // --- New Function: Beam Layout Simulation ---
  const simulateBeamLayout = async () => {
    if (!elements.length || !apiKey) { setAiError("APIキーまたは構造データが不足しています"); return; }
    setIsSimulatingBeams(true);
    setAiError(null);

    // 1. Extract current structure data for AI
    const walls = elements.filter(e => e.type === 'wall').map(e => ({ x1: Math.round(e.x1), y1: Math.round(e.y1), x2: Math.round(e.x2), y2: Math.round(e.y2) }));
    const columns = elements.filter(e => e.type === 'column').map(e => ({ x: Math.round(e.x), y: Math.round(e.y) }));

    // Extract room shapes to help understand layout
    const roomShapes = jsonFloorPlan?.rooms?.map((r, i) => {
      const COORD_SCALE = 5;
      return r.points.map(p => ({ x: Math.round(p.x * COORD_SCALE), y: Math.round(p.y * COORD_SCALE) }));
    });

    // OPENING DATA PREPARATION FOR FILTERING
    const openings = jsonFloorPlan?.objects?.filter(obj =>
      obj.type.includes('window') ||
      obj.type.includes('door') ||
      obj.type === 'entrance' ||
      obj.type === 'opening'
    ).map(obj => {
      const isVertical = (Math.abs((obj.rotation || 0) - 90) < 1 || Math.abs((obj.rotation || 0) - 270) < 1);
      const width = isVertical ? (obj.height > 100 ? obj.height : 200) : obj.width;
      const height = isVertical ? obj.width : (obj.height > 100 ? obj.height : 200);
      return { x: obj.x, y: obj.y, width, height };
    }) || [];

    const systemPrompt = `
      あなたは木造住宅の構造設計の専門家です。
      与えられた壁・柱・部屋の配置データから、最適な「梁伏図（はりぶせず）」を作成してください。
      
      【設計ルール】
      1. 梁は、柱と柱、柱と壁、壁と壁を直線で結ぶように配置してください。
      2. **【重要】梁のスパン（長さ）は、原則として「2間（約3640mm）」以内に収めることを目指してください。**
         - 基本的には3640mmを超える場合、中間に柱を追加してスパンを短くすることを優先してください。
         - **ただし、部屋の形状や用途により柱を追加することが著しく不適切（部屋の中央に柱が来るなど）な場合に限り、3640mmを超えるスパンを許容します。**
      3. 荷重を支える主要な「大梁（Main Beam）」と、それを補完する「小梁（Sub Beam）」を区別してください。
      4. 座標系は画面左上(0,0)、Y軸下向きプラスです。梁はグリッド（910mmモジュール）に乗るのが望ましいです。
      5. **【最重要】全ての梁の始点と終点は、必ず何らかの支持点（柱、壁、または他の梁）の上に載るようにしてください。**
      6. **【最重要】独立した梁は禁止です。梁全体で一つの強固なグリッド状の構造を形成してください。**
      7. **【柱の追加に関する禁止事項】**
         - 追加する柱はレスポンスに含めないでください（beamsリストのみ返すこと）。柱の追加判断はクライアント側のロジックで行います。
      
      【出力フォーマット】
      JSON形式のみ:
      {
        "beams": [
          { "x1": number, "y1": number, "x2": number, "y2": number, "type": "main" }, 
          ...
        ]
      }
    `;

    const userPrompt = `
      以下の構造データに基づいて梁を配置してください。
      【壁データ】${JSON.stringify(walls)}
      【柱データ】${JSON.stringify(columns)}
      【部屋形状（参考）】${JSON.stringify(roomShapes)}
    `;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const result = JSON.parse(text);
        if (result.beams) {
          setBeams(result.beams);

          // --- LOGIC-BASED COLUMN ADDITION ---
          const newCols = [];
          const existingCols = [...elements.filter(e => e.type === 'column')];
          const COL_INTERVAL = MODULE_GRID;

          // Function to check if a point is on a wall
          const isPointOnWall = (px, py) => {
            return elements.some(el => {
              if (el.type !== 'wall') return false;
              const tolerance = 150;
              const minX = Math.min(el.x1, el.x2) - tolerance;
              const maxX = Math.max(el.x1, el.x2) + tolerance;
              const minY = Math.min(el.y1, el.y2) - tolerance;
              const maxY = Math.max(el.y1, el.y2) + tolerance;
              if (px < minX || px > maxX || py < minY || py > maxY) return false;

              const A = px - el.x1, B = py - el.y1, C = el.x2 - el.x1, D = el.y2 - el.y1;
              const dot = A * C + B * D, len_sq = C * C + D * D;
              let param = -1;
              if (len_sq !== 0) param = dot / len_sq;
              let xx, yy;
              if (param < 0) { xx = el.x1; yy = el.y1; }
              else if (param > 1) { xx = el.x2; yy = el.y2; }
              else { xx = el.x1 + param * C; yy = el.y1 + param * D; }
              const dx = px - xx, dy = py - yy;
              return Math.sqrt(dx * dx + dy * dy) < tolerance;
            });
          };

          // Helper: Check if point is on any beam (excluding specific beam)
          const isPointOnAnyBeam = (px, py, excludeBeam = null) => {
            return result.beams.some(b => {
              if (b === excludeBeam) return false;
              const tolerance = 100;
              // Bounding box check
              if (px < Math.min(b.x1, b.x2) - tolerance || px > Math.max(b.x1, b.x2) + tolerance ||
                py < Math.min(b.y1, b.y2) - tolerance || py > Math.max(b.y1, b.y2) + tolerance) return false;
              // Distance check
              const len2 = Math.pow(b.x2 - b.x1, 2) + Math.pow(b.y2 - b.y1, 2);
              if (len2 === 0) return false;
              const t = ((px - b.x1) * (b.x2 - b.x1) + (py - b.y1) * (b.y2 - b.y1)) / len2;
              const tClamped = Math.max(0, Math.min(1, t));
              const projX = b.x1 + tClamped * (b.x2 - b.x1);
              const projY = b.y1 + tClamped * (b.y2 - b.y1);
              return Math.sqrt(Math.pow(px - projX, 2) + Math.pow(py - projY, 2)) < tolerance;
            });
          };

          // Helper: Opening check
          const isInOpening = (px, py) => {
            return openings.some(op => {
              const margin = 100;
              const minX = op.x - op.width / 2 - margin;
              const maxX = op.x + op.width / 2 + margin;
              const minY = op.y - op.height / 2 - margin;
              const maxY = op.y + op.height / 2 + margin;
              return (px >= minX && px <= maxX && py >= minY && py <= maxY);
            });
          };

          // Candidate Points Generation
          let candidates = [];

          // A. Wall Endpoints
          elements.filter(e => e.type === 'wall').forEach(w => {
            candidates.push({ x: w.x1, y: w.y1 });
            candidates.push({ x: w.x2, y: w.y2 });
          });

          // B. Beam Endpoints
          result.beams.forEach(b => {
            candidates.push({ x: b.x1, y: b.y1 });
            candidates.push({ x: b.x2, y: b.y2 });

            // C. Intermediate Points on Beam (Standard Grid)
            const len = Math.sqrt(Math.pow(b.x2 - b.x1, 2) + Math.pow(b.y2 - b.y1, 2));
            // Use COL_INTERVAL (910mm) instead of 455mm to avoid excessive columns
            const steps = Math.floor(len / COL_INTERVAL);
            if (steps > 0) {
              const dx = (b.x2 - b.x1) / len * COL_INTERVAL;
              const dy = (b.y2 - b.y1) / len * COL_INTERVAL;
              for (let i = 1; i < steps; i++) {
                candidates.push({ x: b.x1 + dx * i, y: b.y1 + dy * i });
              }
            }
          });

          // Filter candidates
          // ... existing filtering logic ...
          candidates = candidates.filter((p, index, self) =>
            index === self.findIndex((t) => (Math.abs(t.x - p.x) < 10 && Math.abs(t.y - p.y) < 10)) // Unique
          );

          candidates.forEach(pt => {
            // 1. Check existing columns (Wide tolerance)
            if (existingCols.some(c => Math.abs(c.x - pt.x) < 100 && Math.abs(c.y - pt.y) < 100)) return;

            // 2. Check Opening
            if (isInOpening(pt.x, pt.y)) return;

            const onWall = isPointOnWall(pt.x, pt.y);

            if (onWall) {
              // On Wall -> Add Column (Priority)
              // Filter intermediate points to avoid too many columns?
              // But "half grid allowed" implies we should keep them if on grid.
              newCols.push(pt);
            } else {
              // Open space
              // Only add column if it is a floating beam endpoint
              // Is this point a beam endpoint?
              const isBeamEnd = result.beams.some(b =>
                (Math.abs(b.x1 - pt.x) < 10 && Math.abs(b.y1 - pt.y) < 10) ||
                (Math.abs(b.x2 - pt.x) < 10 && Math.abs(b.y2 - pt.y) < 10)
              );

              if (isBeamEnd) {
                // Is it supported by another beam (T-junction / intersection)?
                // We check if point is ON any other beam (including endpoints)
                const supportedByBeam = isPointOnAnyBeam(pt.x, pt.y);

                if (supportedByBeam) {
                  // Supported -> No Column
                  return;
                } else {
                  // Floating -> Add Column
                  newCols.push(pt);
                }
              }
            }
          });

          // ... existing deduplication and state update ...
          // Deduplicate and Filter again for final list
          const uniqueNewCols = [];
          newCols.forEach(nc => {
            if (elements.some(el => el.type === 'column' && Math.abs(el.x - nc.x) < 100 && Math.abs(el.y - nc.y) < 100)) return;
            if (uniqueNewCols.some(c => Math.abs(c.x - nc.x) < 100 && Math.abs(c.y - nc.y) < 100)) return;
            if (isInOpening(nc.x, nc.y)) return;

            uniqueNewCols.push({
              id: generateId(),
              type: 'column',
              x: Math.round(nc.x),
              y: Math.round(nc.y),
              strength: COLUMN_STRENGTH
            });
          });

          let message = `【梁シミュレーション完了】\n${result.beams.length}本の梁を配置しました。`;
          if (uniqueNewCols.length > 0) {
            setElements(prev => [...prev, ...uniqueNewCols]);
            message += `\n構造的に必要な柱を${uniqueNewCols.length}本追加しました。`;
          }
          setChatMessages(prev => [...prev, { role: 'model', text: message }]);
        }
      }
    } catch (e) {
      console.error(e);
      setAiError("梁シミュレーション中にエラーが発生しました。");
    } finally {
      setIsSimulatingBeams(false);
    }
  };

  // --- New Function: Allowable Stress Calculation Simulation ---
  const calculateAllowableStress = async () => {
    if (!elements.length || !apiKey) { setAiError("APIキーまたは構造データが不足しています"); return; }
    if (!beams.length) { setAiError("梁のデータがありません。先に「梁シミュレーション」を行ってください。"); return; }

    setIsCalculatingStress(true);
    setAiError(null);

    const walls = elements.filter(e => e.type === 'wall').map(e => ({ x1: Math.round(e.x1), y1: Math.round(e.y1), x2: Math.round(e.x2), y2: Math.round(e.y2), multiplier: e.multiplier }));
    const columns = elements.filter(e => e.type === 'column').map(e => ({ x: Math.round(e.x), y: Math.round(e.y) }));

    const systemPrompt = `
      あなたは木造住宅の許容応力度計算を行う専門家AIです。
      ユーザーから提供される「壁」「柱」「梁」の配置データに基づき、簡易的な許容応力度計算のシミュレーションを行ってください。

      【計算・評価のポイント】
      1. **長期荷重**: 梁のたわみ、曲げ応力が許容範囲内か。スパンが長い梁や、柱を受けている梁（梁上柱）に注意。
      2. **短期荷重（地震・風）**: 耐力壁の負担剪断力、柱の引抜力（N値計算相当）、梁の接合部にかかる力。
      3. **判定**: 各部材について「OK」「NG」「注意」を判定し、検定比（応力/許容応力）を推定してください（目安で可）。

      【出力フォーマット】
      JSON形式のみ:
      {
        "overallResult": "OK" | "NG" | "Warning", // 総合判定
        "summary": "...", // 全体的な評価コメント
        "checkPoints": [
          { "item": "梁の曲げ", "status": "OK", "ratio": 0.6, "comment": "..." },
          { "item": "梁のたわみ", "status": "Warning", "ratio": 0.95, "comment": "..." },
          { "item": "柱の座屈", "status": "OK", "ratio": 0.4, "comment": "..." },
          // ... その他必要な項目
        ],
        "weakPoints": [ // 具体的に危険な箇所（座標や部材IDで指定）
          { "location": "X:3640, Y:1820付近", "issue": "梁スパンが飛びすぎているためたわみが懸念されます。" }
        ]
      }
    `;

    const userPrompt = `
      以下の構造モデルについて許容応力度計算を行ってください。
      【壁データ】${JSON.stringify(walls)}
      【柱データ】${JSON.stringify(columns)}
      【梁データ】${JSON.stringify(beams)}
    `;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userPrompt }] }],
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { responseMimeType: "application/json" }
        })
      });
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const result = JSON.parse(text);

        // Construct result message
        let msg = `【許容応力度計算結果】判定: ${result.overallResult}\n\n${result.summary}\n\n`;
        result.checkPoints?.forEach(cp => {
          const icon = cp.status === 'OK' ? '✅' : cp.status === 'NG' ? '❌' : '⚠️';
          msg += `${icon} ${cp.item} (検定比: ${cp.ratio}): ${cp.comment}\n`;
        });
        if (result.weakPoints?.length > 0) {
          msg += `\n📍 重点指摘事項:\n`;
          result.weakPoints.forEach(wp => msg += `- ${wp.location}: ${wp.issue}\n`);
        }

        setChatMessages(prev => [...prev, { role: 'model', text: msg }]);
      }
    } catch (e) {
      console.error(e);
      setAiError("計算中にエラーが発生しました。");
    } finally {
      setIsCalculatingStress(false);
    }
  };

  // Render Grid
  const renderGrid = () => {
    if (!showGrid) return null;
    const [vx, vy, vw, vh] = viewBox.split(' ').map(Number);
    const lines = [];
    for (let x = Math.floor(vx / MODULE_GRID) * MODULE_GRID; x <= vx + vw; x += MODULE_GRID) lines.push(<line key={`v${x}`} x1={x} y1={vy} x2={x} y2={vy + vh} stroke="#eee" strokeWidth="5" />);
    for (let y = Math.floor(vy / MODULE_GRID) * MODULE_GRID; y <= vy + vh; y += MODULE_GRID) lines.push(<line key={`h${y}`} x1={vx} y1={y} x2={vx + vw} y2={y} stroke="#eee" strokeWidth="5" />);
    return <g>{lines}</g>;
  };

  return (
    <div className={`flex flex-col ${initialData ? 'h-full' : 'h-screen'} bg-gray-50 text-slate-800 font-sans`}>
      <header className="bg-slate-900 text-white p-4 shadow flex justify-between items-center z-10">
        <div className="flex items-center gap-2"><Shield className="w-6 h-6 text-emerald-400" /><h1 className="font-bold">耐震AIチェッカー Pro</h1></div>
        {!jsonFloorPlan ? (
          <button onClick={() => fileInputRef.current.click()} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-sm flex gap-2"><Upload className="w-4 h-4" />ファイルを開く</button>
        ) : (
          <button onClick={() => { setJsonFloorPlan(null); setElements([]); setBeams([]); setWeakPoints([]); }} className="px-3 py-1 bg-slate-700 rounded text-sm flex gap-2"><RotateCcw className="w-3 h-3" />リセット</button>
        )}
      </header>

      <main className="flex-1 flex overflow-hidden">
        <div className="flex-1 bg-gray-200 relative p-8 flex items-center justify-center">
          {!jsonFloorPlan ? (
            <div onClick={() => fileInputRef.current.click()} className="w-full max-w-xl h-80 border-4 border-dashed border-gray-400 rounded-xl flex flex-col items-center justify-center bg-white/50 cursor-pointer">
              <FileJson className="w-16 h-16 text-gray-400 mb-4" />
              <p className="text-gray-600 font-bold">間取りJSONファイルをドロップ</p>
              <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileUpload} />
            </div>
          ) : (
            <div className="relative w-full h-full bg-white shadow-2xl" ref={containerRef}>
              <svg width="100%" height="100%" viewBox={viewBox} preserveAspectRatio="xMidYMid meet"
                className={`w-full h-full ${tool === 'eraser' ? 'cursor-crosshair' : 'cursor-crosshair'}`}
                onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
                {renderGrid()}
                {jsonFloorPlan.rooms?.map((r, i) => (
                  <polygon key={`room-${i}`} points={r.points.map(p => `${p.x * 5},${p.y * 5}`).join(' ')} fill="#f3f4f6" stroke="#ccc" strokeWidth="10" />
                ))}
                {jsonFloorPlan.objects?.map((o, i) => {
                  if (o.type === 'column') return null;
                  return <g key={`obj-${i}`} transform={`rotate(${o.rotation || 0},${o.x},${o.y})`}><rect x={o.x - o.width / 2} y={o.y - o.height / 2} width={o.width} height={o.height} fill="none" stroke="#cbd5e1" strokeWidth="20" /></g>;
                })}

                {/* Beams Layer */}
                {showBeams && beams.map((beam, i) => (
                  <line
                    key={`beam-${i}`}
                    x1={beam.x1} y1={beam.y1} x2={beam.x2} y2={beam.y2}
                    stroke={beam.type === 'main' ? '#059669' : '#34d399'} // Emerald green for beams
                    strokeWidth={beam.type === 'main' ? 60 : 30}
                    strokeDasharray={beam.type === 'main' ? "" : "40,20"}
                    strokeLinecap="round"
                    opacity="0.8"
                  />
                ))}

                {elements.map(el => {
                  if (el.type === 'wall') {
                    const strokeW = 100 + (el.multiplier * 20);
                    const opacity = 0.5 + (el.multiplier * 0.1);
                    return <line key={el.id} x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke="#ef4444" strokeWidth={strokeW} strokeLinecap="round" opacity={opacity} />;
                  }
                  return <rect key={el.id} x={el.x - 100} y={el.y - 100} width={200} height={200} fill="#3b82f6" />;
                })}

                {/* Weak Points Overlay */}
                {weakPoints.map((wp, i) => (
                  <g
                    key={`wp-${i}`}
                    transform={`translate(${wp.x}, ${wp.y})`}
                    onMouseEnter={() => setHoveredWeakPoint(wp)}
                    onMouseLeave={() => setHoveredWeakPoint(null)}
                    style={{ cursor: 'help' }}
                  >
                    <circle r="150" fill="rgba(255, 0, 0, 0.3)" stroke="red" strokeWidth="20" />
                    <text y="50" fontSize="200" textAnchor="middle">⚠️</text>
                  </g>
                ))}

                {analysisResult && showAnalysis && (
                  <>
                    <circle cx={analysisResult.centerX} cy={analysisResult.centerY} r={300} fill="orange" stroke="white" strokeWidth="50" />
                    <circle cx={analysisResult.rigidityX} cy={analysisResult.rigidityY} r={300} fill="green" stroke="white" strokeWidth="50" />
                    <line x1={analysisResult.centerX} y1={analysisResult.centerY} x2={analysisResult.rigidityX} y2={analysisResult.rigidityY} stroke="purple" strokeWidth="50" strokeDasharray="100,100" />
                  </>
                )}
              </svg>

              {/* Tooltip Overlay */}
              {hoveredWeakPoint && (
                <div
                  className="absolute bg-black/80 text-white p-2 rounded text-xs pointer-events-none z-50 max-w-xs"
                  style={{
                    left: '50%', // Simple centering for now, ideally dynamic
                    top: '10%',
                    transform: 'translateX(-50%)'
                  }}
                >
                  <p className="font-bold text-amber-400 mb-1">指摘事項</p>
                  {String(hoveredWeakPoint.issue)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-96 bg-white border-l border-gray-200 flex flex-col overflow-y-auto shadow-xl z-20">
          <div className="p-4 border-b border-gray-100">
            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500">編集ツール</label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <button onClick={() => setTool('wall')} className={`p-2 border rounded flex flex-col items-center ${tool === 'wall' ? 'bg-red-50 border-red-500 text-red-600' : ''}`}><Move className="w-4 h-4 mb-1" /><span className="text-xs">耐力壁</span></button>
                <button onClick={() => setTool('column')} className={`p-2 border rounded flex flex-col items-center ${tool === 'column' ? 'bg-blue-50 border-blue-500 text-blue-600' : ''}`}><MousePointer2 className="w-4 h-4 mb-1" /><span className="text-xs">柱</span></button>
                <button onClick={() => setTool('eraser')} className={`p-2 border rounded flex flex-col items-center ${tool === 'eraser' ? 'bg-gray-100' : ''}`}><Trash2 className="w-4 h-4 mb-1" /><span className="text-xs">削除</span></button>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 flex items-center mb-1"><Layers className="w-3 h-3 mr-1" /> 壁倍率 (強度)</label>
              <div className="flex items-center gap-2 mb-2">
                <input type="number" value={wallMultiplier} onChange={(e) => setWallMultiplier(parseFloat(e.target.value) || 0)} step="0.1" min="0.1" max="10.0" className="w-20 text-xs border border-gray-300 rounded p-2 bg-white font-bold text-right" />
                <span className="text-xs text-gray-500">倍</span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {WALL_PRESETS.map(val => (
                  <button key={val} onClick={() => setWallMultiplier(val)} className={`text-[10px] py-1 px-1 rounded border ${wallMultiplier === val ? 'bg-slate-600 text-white border-slate-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{val.toFixed(1)}</button>
                ))}
              </div>
            </div>

            <div className="flex gap-4 text-xs text-gray-600 mb-4">
              <label className="flex items-center cursor-pointer"><input type="checkbox" checked={showAnalysis} onChange={e => setShowAnalysis(e.target.checked)} className="mr-1" /> 重心・剛心</label>
              <label className="flex items-center cursor-pointer"><input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} className="mr-1" /> グリッド</label>
              <label className="flex items-center cursor-pointer"><input type="checkbox" checked={showBeams} onChange={e => setShowBeams(e.target.checked)} className="mr-1" /> 梁(シミュ)</label>
            </div>

            {/* Seismic Grade Selector */}
            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 mb-1 block">目標耐震等級</label>
              <div className="flex bg-white rounded-lg border border-gray-200 p-1">
                {[1, 2, 3].map(g => (
                  <button
                    key={g}
                    onClick={() => setSeismicGrade(g)}
                    className={`flex-1 py-1 px-2 rounded text-xs font-medium transition-colors ${seismicGrade === g ? 'bg-orange-100 text-orange-800' : 'text-gray-500 hover:bg-gray-50'}`}
                  >
                    等級{g}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Analysis Report */}
          <div className="flex-1 p-4">
            <h2 className="text-xs font-bold text-gray-400 mb-3">構造診断レポート (精密版)</h2>
            {analysisResult ? (
              <div className="space-y-4">
                <div className="bg-slate-50 p-3 rounded-lg text-center border border-slate-100">
                  <div className="text-sm text-gray-500">判定結果</div>
                  <div className={`text-xl font-bold ${analysisResult.balanceScore >= 100 && analysisResult.quantityScore >= 100 ? 'text-emerald-600' : analysisResult.balanceScore >= 60 && analysisResult.quantityScore >= 100 ? 'text-amber-600' : 'text-red-500'}`}>
                    {analysisResult.balanceScore >= 100 && analysisResult.quantityScore >= 100 ? '優良 (Rank S)' : analysisResult.balanceScore >= 60 && analysisResult.quantityScore >= 100 ? '適合 (Rank A)' : '要注意 (Rank B)'}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-left text-xs">
                    <div className="bg-white p-2 rounded border">
                      <span className="block text-gray-400">壁量充足率</span>
                      <span className={`font-bold text-base ${analysisResult.quantityScore >= 100 ? 'text-emerald-600' : 'text-red-500'}`}>{analysisResult.quantityScore.toFixed(0)}%</span>
                    </div>
                    <div className="bg-white p-2 rounded border">
                      <span className="block text-gray-400">最大偏心率</span>
                      <span className={`font-bold text-base ${Math.max(analysisResult.Rex, analysisResult.Rey) <= 0.15 ? 'text-emerald-600' : Math.max(analysisResult.Rex, analysisResult.Rey) <= 0.3 ? 'text-amber-600' : 'text-red-500'}`}>
                        {Math.max(analysisResult.Rex, analysisResult.Rey).toFixed(3)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-gray-500 bg-white p-2 rounded border text-left space-y-1">
                    <p>必要壁量: {analysisResult.targetStiffness.toFixed(0)} (等級{seismicGrade} × 床面積)</p>
                    <p>存在壁量: {analysisResult.totalStiffness.toFixed(0)} (壁倍率考慮)</p>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1 text-left">※ 偏心率 0.15以下: 優良, 0.30以下: 適合</div>
                </div>

                <div className="text-xs space-y-1 text-gray-600">
                  <p>偏心率X: {analysisResult.Rex.toFixed(3)} (Y方向の壁バランス)</p>
                  <p>偏心率Y: {analysisResult.Rey.toFixed(3)} (X方向の壁バランス)</p>
                  <p>重心G: ({analysisResult.centerX.toFixed(0)}, {analysisResult.centerY.toFixed(0)})</p>
                  <p>剛心K: ({analysisResult.rigidityX.toFixed(0)}, {analysisResult.rigidityY.toFixed(0)})</p>
                </div>

                <div className="border-t pt-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold">AI建築士チャット</span>
                    <button onClick={() => setShowApiKeyInput(!showApiKeyInput)}><Settings className="w-3 h-3 text-gray-400" /></button>
                  </div>
                  {showApiKeyInput && (
                    <input type="password" value={apiKey} onChange={e => { setApiKey(e.target.value); localStorage.setItem('gemini_api_key', e.target.value) }} placeholder="Gemini API Key" className="w-full text-xs border p-1 rounded mb-2" />
                  )}

                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button onClick={() => generateAIAdvice("詳細な診断をお願いします。")} disabled={isLoadingAI || isOptimizing || isSimulatingBeams || isCalculatingStress} className="py-2 px-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-sm flex items-center justify-center disabled:opacity-50">
                      {isLoadingAI ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />} 詳細アドバイス
                    </button>

                    <button onClick={optimizeStructure} disabled={isLoadingAI || isOptimizing || isSimulatingBeams || isCalculatingStress} className="py-2 px-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg text-xs font-bold shadow-sm flex items-center justify-center disabled:opacity-50">
                      {isOptimizing ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />最適化中...</> : <><Wand2 className="w-3 h-3 mr-1" />AI自動最適化</>}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <button onClick={simulateBeamLayout} disabled={isLoadingAI || isOptimizing || isSimulatingBeams || isCalculatingStress} className="py-2 px-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-lg text-xs font-bold shadow-sm flex items-center justify-center disabled:opacity-50">
                      {isSimulatingBeams ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />梁シミュ...</> : <><Network className="w-3 h-3 mr-1" />梁掛けシミュ</>}
                    </button>

                    <button onClick={calculateAllowableStress} disabled={isLoadingAI || isOptimizing || isSimulatingBeams || isCalculatingStress} className="py-2 px-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white rounded-lg text-xs font-bold shadow-sm flex items-center justify-center disabled:opacity-50">
                      {isCalculatingStress ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" />計算中...</> : <><Calculator className="w-3 h-3 mr-1" />許容応力度計算</>}
                    </button>
                  </div>

                  <div className="h-48 overflow-y-auto bg-gray-50 rounded p-2 mb-2 border text-xs space-y-2">
                    {chatMessages.map((m, i) => (
                      <div key={i} className={`${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                        <span className={`inline-block p-2 rounded ${m.role === 'user' ? 'bg-purple-600 text-white' : 'bg-white border whitespace-pre-wrap'}`}>{m.text}</span>
                      </div>
                    ))}
                    {(isLoadingAI || isSimulatingBeams || isCalculatingStress) && <Loader2 className="w-4 h-4 animate-spin mx-auto" />}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="flex gap-1">
                    <textarea value={inputMessage} onChange={e => setInputMessage(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { handleSendMessage() } }} placeholder="Ctrl+Enterで送信" className="flex-1 text-xs border rounded p-1 h-8 resize-none" />
                    <button onClick={() => handleSendMessage()} disabled={isLoadingAI} className="bg-purple-600 text-white rounded p-1 px-2 disabled:opacity-50"><Send className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-400 py-10"><Activity className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>間取りを読み込むと<br />診断が始まります</p></div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default SeismicCheckPro;
"use client";

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Upload, Activity, Shield, AlertTriangle, CheckCircle, Info, Move, MousePointer2, Trash2, RotateCcw, X, Home, ArrowUpCircle, Sparkles, Loader2, FileJson, Key, Settings, Send, Layers, Wand2 } from 'lucide-react';

const SeismicCheckPro = ({ initialData }) => {
  // State
  const [jsonFloorPlan, setJsonFloorPlan] = useState(null); // Parsed JSON data for background rendering
  const [elements, setElements] = useState([]); // { id, type: 'wall'|'column', x, y, width, height, length }
  const [tool, setTool] = useState('wall'); // 'wall', 'column', 'select', 'eraser'
  const [wallMultiplier, setWallMultiplier] = useState(2.5); // Current selected wall multiplier
  const [buildingType, setBuildingType] = useState('1'); // '1' (平家) or '2' (2階建て)
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [showAnalysis, setShowAnalysis] = useState(true);
  const [showGrid, setShowGrid] = useState(true);

  // ViewBox State (Controls the visible area and aspect ratio)
  // Default is arbitrary, will be set by JSON data
  const [viewBox, setViewBox] = useState("0 0 100 100");

  // Gemini API State
  const [apiKey, setApiKey] = useState(""); // User input API Key
  const [showApiKeyInput, setShowApiKeyInput] = useState(false); // Toggle for API Key input

  // Chat State
  const [chatMessages, setChatMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false); // Optimization state
  const [aiError, setAiError] = useState(null);

  const messagesEndRef = useRef(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Constants
  // Removed fixed WALL_MULTIPLIER to rely on state
  const COLUMN_STRENGTH = 0.1; // Column contribution to stiffness
  const MODULE_GRID = 910; // 910mm module

  // Wall Multiplier Options
  const WALL_TYPES = [
    { value: 1.0, label: '1.0 (片筋交い/構造用合板薄)' },
    { value: 1.5, label: '1.5 (木ずり)' },
    { value: 2.0, label: '2.0 (両筋交い)' },
    { value: 2.5, label: '2.5 (構造用合板 標準)' },
    { value: 3.0, label: '3.0 (2.5+筋交い等)' },
    { value: 4.0, label: '4.0 (強固な耐力壁)' },
    { value: 5.0, label: '5.0 (最強クラス)' },
  ];

  // Generate Unique ID with fallback
  const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `id-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
  };

  // Scroll to bottom of chat
  useEffect(() => {
    // Only scroll if there are messages or loading state, preventing scroll on initial load
    if (chatMessages.length > 0 || isLoadingAI) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, isLoadingAI]);

  // --- Logic Extraction: Get Valid Wall Segments from JSON ---
  const getValidWallSegments = (data) => {
    if (!data || !data.walls) return [];
    const COORD_SCALE = 5;
    const scalePt = (val) => val * COORD_SCALE;

    const openings = [];
    data.objects?.forEach(obj => {
      if (
        obj.type.includes('window') ||
        obj.type.includes('door') ||
        obj.type === 'entrance' ||
        obj.type === 'opening'
      ) {
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

      if (isHorizontal) {
        intervals = [{ start: Math.min(x1, x2), end: Math.max(x1, x2) }];
        fixedPos = y1;
      } else if (isVertical) {
        intervals = [{ start: Math.min(y1, y2), end: Math.max(y1, y2) }];
        fixedPos = x1;
      } else {
        const len = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        if (len > 100) {
          validSegments.push({ x1, y1, x2, y2, length: len });
        }
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
            } else {
              nextInts.push(iv);
            }
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
      id: generateId(),
      type: 'wall',
      x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2,
      length: s.length,
      multiplier: wallMultiplier,
      strength: s.length * wallMultiplier
    }));

    const importCols = (list) => {
      list?.forEach(obj => {
        newElements.push({
          id: generateId(),
          type: 'column',
          x: obj.x, y: obj.y,
          strength: COLUMN_STRENGTH
        });
      });
    };
    if (data.objects) importCols(data.objects.filter(o => o.type === 'column'));
    if (data.columns) importCols(data.columns);

    setElements(newElements);
    setJsonFloorPlan(data);
    setChatMessages([]);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type === "application/json" || file.name.endsWith('.json')) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const json = JSON.parse(ev.target.result);
          processJsonData(json);
        } catch (err) {
          alert("JSON読み込みエラー");
        }
      };
      reader.readAsText(file);
    } else {
      alert("JSONファイルを選択してください。");
    }
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

  const handleMouseMove = (e) => {
    // Only for visual feedback if needed in future
  };

  const handleMouseUp = (e) => {
    if (!isDrawing || tool !== 'wall') return;
    const endPos = getMousePos(e);
    const len = Math.sqrt(Math.pow(endPos.x - startPos.x, 2) + Math.pow(endPos.y - startPos.y, 2));
    if (len > 100) {
      setElements([...elements, {
        id: generateId(), type: 'wall',
        x1: startPos.x, y1: startPos.y, x2: endPos.x, y2: endPos.y,
        length: len,
        multiplier: wallMultiplier,
        strength: len * wallMultiplier
      }]);
    }
    setIsDrawing(false);
  };

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

  const analysisResult = useMemo(() => {
    if (elements.length === 0) return null;

    // 1. Gravity Center (G)
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
    // Fallback center
    if (!centerX) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      elements.forEach(el => {
        if (el.type === 'wall') { minX = Math.min(minX, el.x1, el.x2); maxX = Math.max(maxX, el.x1, el.x2); minY = Math.min(minY, el.y1, el.y2); maxY = Math.max(maxY, el.y1, el.y2); }
      });
      centerX = (minX + maxX) / 2; centerY = (minY + maxY) / 2;
      totalArea = (maxX - minX) * (maxY - minY) || 1;
    }

    // 2. Rigidity (K)
    let Kx = 0, Ky = 0; // Total Stiffness
    let Kx_y = 0; // Moment of Stiffness X around origin Y
    let Ky_x = 0; // Moment of Stiffness Y around origin X

    elements.forEach(el => {
      if (el.type !== 'wall') return;
      const cx = (el.x1 + el.x2) / 2;
      const cy = (el.y1 + el.y2) / 2;
      const dx = Math.abs(el.x1 - el.x2);
      const dy = Math.abs(el.y1 - el.y2);

      const mult = el.multiplier || 2.5;
      const stiffness = el.length * mult;

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

    // 3. Eccentricity (e)
    const ex = Math.abs(rigidityX - centerX);
    const ey = Math.abs(rigidityY - centerY);

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
    const Rex = ey / rex;
    const Rey = ex / rey;
    const maxRe = Math.max(Rex, Rey);

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
    const targetStiffness = totalArea * (buildingType === '2' ? 0.0018 : 0.0011);
    const totalStiffness = Kx + Ky;
    const quantityScore = Math.min(100, (totalStiffness / targetStiffness) * 100);

    return {
      centerX, centerY, rigidityX, rigidityY,
      ex, ey, rex, rey, Rex, Rey,
      balanceScore, quantityScore,
      grade: (quantityScore >= 100 && balanceScore >= 100) ? 3 : (quantityScore >= 100 && balanceScore >= 60) ? 2 : 1
    };
  }, [elements, buildingType, jsonFloorPlan]);

  const generateAIAdvice = async (overrideMessage = null) => {
    if (!analysisResult || !apiKey) { setAiError("APIキーを入力してください"); return; }
    setIsLoadingAI(true);
    setAiError(null);

    const isFirst = chatMessages.length === 0;
    let userMessageText = overrideMessage || inputMessage;

    if (isFirst && !userMessageText) {
      userMessageText = "詳細診断をお願いします。";
    }

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
          - 最大偏心率: ${Math.max(analysisResult.Rex, analysisResult.Rey).toFixed(3)} (X方向:${analysisResult.Rex.toFixed(3)}, Y方向:${analysisResult.Rey.toFixed(3)})
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
        if (i === newHistory.length - 1) {
          return { role: m.role, parts: [{ text: apiPromptText }] };
        }
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

    // Get all valid wall segments from JSON (zero-based)
    const validCandidates = getValidWallSegments(jsonFloorPlan);
    const candidateList = validCandidates.map((s, i) => ({
      id: i,
      x1: Math.round(s.x1), y1: Math.round(s.y1),
      x2: Math.round(s.x2), y2: Math.round(s.y2),
      len: Math.round(s.length)
    }));

    const systemPrompt = `
      あなたは構造設計の専門家AIです。
      与えられた「壁配置候補（Candidate Walls）」の中から、耐震性能が最適になる組み合わせを選定してください。
      現在の壁配置は無視し、ゼロベースで考えてください。
      
      【目標】
      1. 壁量充足率 100%以上 (十分な量の壁を確保)
      2. 偏心率バランススコア 98点以上 (重心と剛心をほぼ一致させる)
      
      【ルール】
      - 提供された「Candidate Walls」のリストから、耐力壁として採用する壁のIDを選んでください。
      - 使用する壁の倍率は ${wallMultiplier} (ユーザー選択値) です。この倍率で計算してください。
      - 窓やドア（Openings）の位置には壁を配置しないでください（候補リストは既に考慮済みですが念のため）。
      - バランススコア98以上が達成不可能な場合は、スコアが最も高くなる組み合わせを選び、その理由を説明してください。
      
      【出力フォーマット】
      JSON形式のみで返してください。
      {
        "selectedWallIds": [0, 2, 5, ...], // 採用する壁のID配列
        "reasoning": "..." // 達成できたか、できなかった場合の理由とアドバイス
      }
    `;

    const userPrompt = `
      以下の条件で壁配置を最適化してください。
      【前提条件】
      - 壁倍率: ${wallMultiplier}倍 の壁を使用
      - 重心位置: (X:${analysisResult.centerX.toFixed(0)}, Y:${analysisResult.centerY.toFixed(0)})
      
      【壁候補リスト (ここから選ぶ)】
      ${JSON.stringify(candidateList)}
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
          const newElements = result.selectedWallIds.map(id => {
            const s = validCandidates[id];
            if (!s) return null;
            return {
              id: generateId(),
              type: 'wall',
              x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2,
              length: s.length,
              multiplier: wallMultiplier, // Use selected multiplier state
              strength: s.length * wallMultiplier
            };
          }).filter(Boolean);
          const cols = elements.filter(e => e.type === 'column');
          setElements([...newElements, ...cols]);
          setChatMessages(prev => [...prev, { role: 'model', text: `【自動最適化完了】\n${result.reasoning}` }]);
        }
      }
    } catch (e) { setAiError("最適化エラー"); } finally { setIsOptimizing(false); }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-slate-800 font-sans">
      <header className="bg-slate-900 text-white p-4 shadow flex justify-between items-center z-10">
        <div className="flex items-center gap-2"><Shield className="w-6 h-6 text-emerald-400" /><h1 className="font-bold">耐震AIチェッカー Pro</h1></div>
        {!jsonFloorPlan ? (
          <button onClick={() => fileInputRef.current.click()} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded text-sm flex gap-2"><Upload className="w-4 h-4" />ファイルを開く</button>
        ) : (
          <button onClick={() => { setJsonFloorPlan(null); setElements([]); }} className="px-3 py-1 bg-slate-700 rounded text-sm flex gap-2"><RotateCcw className="w-3 h-3" />リセット</button>
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
                {/* Grid & Background */}
                {(() => {
                  const [vx, vy, vw, vh] = viewBox.split(' ').map(Number);
                  const lines = [];
                  for (let x = Math.floor(vx / MODULE_GRID) * MODULE_GRID; x <= vx + vw; x += MODULE_GRID) lines.push(<line key={`v${x}`} x1={x} y1={vy} x2={x} y2={vy + vh} stroke="#eee" strokeWidth="5" />);
                  for (let y = Math.floor(vy / MODULE_GRID) * MODULE_GRID; y <= vy + vh; y += MODULE_GRID) lines.push(<line key={`h${y}`} x1={vx} y1={y} x2={vx + vw} y2={y} stroke="#eee" strokeWidth="5" />);
                  return <g>{lines}</g>;
                })()}
                {jsonFloorPlan.rooms?.map((r, i) => (
                  <polygon key={`room-${i}`} points={r.points.map(p => `${p.x * 5},${p.y * 5}`).join(' ')} fill="#f3f4f6" stroke="#ccc" strokeWidth="10" />
                ))}
                {jsonFloorPlan.objects?.map((o, i) => {
                  if (o.type === 'column') return null;
                  return <g key={`obj-${i}`} transform={`rotate(${o.rotation || 0},${o.x},${o.y})`}><rect x={o.x - o.width / 2} y={o.y - o.height / 2} width={o.width} height={o.height} fill="none" stroke="#cbd5e1" strokeWidth="20" /></g>;
                })}

                {/* Elements */}
                {elements.map(el => {
                  if (el.type === 'wall') {
                    const strokeW = 100 + (el.multiplier * 20);
                    const opacity = 0.5 + (el.multiplier * 0.1);
                    return <line key={el.id} x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke="#ef4444" strokeWidth={strokeW} strokeLinecap="round" opacity={opacity} />;
                  }
                  return <rect key={el.id} x={el.x - 100} y={el.y - 100} width={200} height={200} fill="#3b82f6" />;
                })}

                {/* Analysis Markers */}
                {analysisResult && showAnalysis && (
                  <>
                    <circle cx={analysisResult.centerX} cy={analysisResult.centerY} r={300} fill="orange" stroke="white" strokeWidth="50" />
                    <circle cx={analysisResult.rigidityX} cy={analysisResult.rigidityY} r={300} fill="green" stroke="white" strokeWidth="50" />
                    <line x1={analysisResult.centerX} y1={analysisResult.centerY} x2={analysisResult.rigidityX} y2={analysisResult.rigidityY} stroke="purple" strokeWidth="50" strokeDasharray="100,100" />
                  </>
                )}
              </svg>
            </div>
          )}
        </div>

        {/* Sidebar */}
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

            {/* Wall Multiplier Selector */}
            <div className="mb-4">
              <label className="text-xs font-bold text-gray-500 flex items-center mb-1"><Layers className="w-3 h-3 mr-1" /> 壁倍率 (強度)</label>
              <select
                value={wallMultiplier}
                onChange={(e) => setWallMultiplier(parseFloat(e.target.value))}
                className="w-full text-xs border border-gray-300 rounded p-2 bg-white"
              >
                {WALL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <p className="text-[10px] text-gray-400 mt-1">※これから描画する壁に適用されます</p>
            </div>

            <div className="flex gap-4 text-xs text-gray-600">
              <label className="flex items-center cursor-pointer"><input type="checkbox" checked={showAnalysis} onChange={e => setShowAnalysis(e.target.checked)} className="mr-1" /> 重心・剛心</label>
              <label className="flex items-center cursor-pointer"><input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} className="mr-1" /> グリッド</label>
            </div>
          </div>

          {/* Analysis Report */}
          <div className="flex-1 p-4">
            <h2 className="text-xs font-bold text-gray-400 mb-3">構造診断レポート (精密版)</h2>
            {analysisResult ? (
              <div className="space-y-4">
                <div className="bg-slate-50 p-3 rounded-lg text-center border border-slate-100">
                  <div className="text-sm text-gray-500">判定結果</div>
                  <div className={`text-xl font-bold ${analysisResult.balanceScore >= 100 ? 'text-emerald-600' : analysisResult.balanceScore >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
                    {analysisResult.balanceScore >= 100 ? '優良 (Rank S)' : analysisResult.balanceScore >= 60 ? '適合 (Rank A)' : '要注意 (Rank B)'}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-left text-xs">
                    <div className="bg-white p-2 rounded border">
                      <span className="block text-gray-400">壁量充足率</span>
                      <span className="font-bold text-base">{analysisResult.quantityScore.toFixed(0)}%</span>
                    </div>
                    <div className="bg-white p-2 rounded border">
                      <span className="block text-gray-400">最大偏心率</span>
                      <span className={`font-bold text-base ${Math.max(analysisResult.Rex, analysisResult.Rey) <= 0.15 ? 'text-emerald-600' : Math.max(analysisResult.Rex, analysisResult.Rey) <= 0.3 ? 'text-amber-600' : 'text-red-500'}`}>
                        {Math.max(analysisResult.Rex, analysisResult.Rey).toFixed(3)}
                      </span>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-1 text-left">
                    ※ 偏心率 0.15以下: 優良, 0.30以下: 適合
                  </div>
                </div>

                <div className="text-xs space-y-1 text-gray-600">
                  <p>偏心率X: {analysisResult.Rex.toFixed(3)} (Y方向の壁バランス)</p>
                  <p>偏心率Y: {analysisResult.Rey.toFixed(3)} (X方向の壁バランス)</p>
                  <p>重心G: ({analysisResult.centerX.toFixed(0)}, {analysisResult.centerY.toFixed(0)})</p>
                  <p>剛心K: ({analysisResult.rigidityX.toFixed(0)}, {analysisResult.rigidityY.toFixed(0)})</p>
                </div>

                {/* Chat & Optimization */}
                <div className="border-t pt-3">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold">AI建築士チャット</span>
                    <button onClick={() => setShowApiKeyInput(!showApiKeyInput)}><Settings className="w-3 h-3 text-gray-400" /></button>
                  </div>
                  {showApiKeyInput && (
                    <input type="password" value={apiKey} onChange={e => { setApiKey(e.target.value); localStorage.setItem('gemini_api_key', e.target.value) }} placeholder="Gemini API Key" className="w-full text-xs border p-1 rounded mb-2" />
                  )}

                  {/* Restored Advice Button */}
                  <button
                    onClick={() => generateAIAdvice("詳細な診断をお願いします。")}
                    disabled={isLoadingAI || isOptimizing}
                    className="w-full mb-2 py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoadingAI ? (
                      <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3 mr-2" />
                    )}
                    詳細アドバイスを生成
                  </button>

                  {/* Optimize Button */}
                  <button
                    onClick={optimizeStructure}
                    disabled={isLoadingAI || isOptimizing}
                    className="w-full mb-2 py-2 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed group"
                  >
                    {isOptimizing ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                        最適化計算中...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-3 h-3 mr-2 group-hover:scale-110 transition-transform" />
                        AI自動最適化
                      </>
                    )}
                  </button>

                  <div className="h-48 overflow-y-auto bg-gray-50 rounded p-2 mb-2 border text-xs space-y-2">
                    {chatMessages.map((m, i) => (
                      <div key={i} className={`${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                        <span className={`inline-block p-2 rounded ${m.role === 'user' ? 'bg-purple-600 text-white' : 'bg-white border whitespace-pre-wrap'}`}>{m.text}</span>
                      </div>
                    ))}
                    {isLoadingAI && <Loader2 className="w-4 h-4 animate-spin mx-auto" />}
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
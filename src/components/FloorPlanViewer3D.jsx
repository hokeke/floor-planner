import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
// 拡張子 .js を明示的に追加してインポートエラーを回避
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * 間取りデータ (JSON) を受け取って3D表示するコンポーネント
 * @param {Object} props
 * @param {Object} [props.initialData] - 初期表示する間取りJSONデータ (省略可)
 */
const FloorPlanViewer3D = ({ initialData = null, onClose }) => {
  const mountRef = useRef(null);
  const miniMapRef = useRef(null);

  // Three.js インスタンス保持用
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const objectGroupRef = useRef(null);
  const wallGroupRef = useRef(null);
  const requestRef = useRef(null);

  // データ管理用Ref
  const centerMmRef = useRef({ x: 0, y: 0 });
  const dataBoundsRef = useRef({ minX: 0, maxX: 1000, minY: 0, maxY: 1000 });
  const floorPlanDataRef = useRef(initialData);

  // 移動用キー状態管理
  const keysPressed = useRef({});
  // マウスドラッグ状態管理 (歩行モード用)
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });

  // ステート管理
  const [floorPlanData, setFloorPlanData] = useState(initialData);
  const [wallHeight, setWallHeight] = useState(2400);
  const [wallOpacity, setWallOpacity] = useState(1.0);
  const [isWalkMode, setIsWalkMode] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(true); // メニュー開閉状態
  const [sceneInitialized, setSceneInitialized] = useState(false); // シーン初期化完了フラグ

  // 定数
  const MM_TO_SCENE = 0.01; // 100mm = 1 unit
  const DATA_SCALE = 5.0;   // データの座標補正値
  const WALL_THICKNESS = 120 * MM_TO_SCENE;
  const EYE_LEVEL = 1500 * MM_TO_SCENE; // 目の高さ 1.5m

  const COLORS = {
    floor: {
      default: 0xffffff,
      bath: 0xaaccff,
      wash: 0xddeeff,
      toilet: 0xffffee,
      entrance: 0xdddddd,
      western: 0xf5f5dc,
      storage: 0xeeeeee,
      ldk: 0xfffcf0,
      corridor: 0xfafafa
    },
    wall: 0xeeeeee,
    furniture: 0x8B4513,
    kitchen: 0x808080,
    sofa: 0x556B2F,
    window: 0x87CEEB,
    door: 0x8B4513
  };

  // --- キーボードイベント設定 ---
  useEffect(() => {
    const handleKeyDown = (e) => { keysPressed.current[e.code] = true; };
    const handleKeyUp = (e) => { keysPressed.current[e.code] = false; };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // --- 初期化処理 (マウント時) ---
  useEffect(() => {
    if (!mountRef.current) return;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x333333);
    // ズームアウト時に暗くならないようにフォグの距離を調整
    scene.fog = new THREE.Fog(0x333333, 200, 1000);
    sceneRef.current = scene;

    // Group
    const objectGroup = new THREE.Group();
    const wallGroup = new THREE.Group();
    scene.add(objectGroup);
    scene.add(wallGroup);
    objectGroupRef.current = objectGroup;
    wallGroupRef.current = wallGroup;

    // Camera
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 50, 60);
    // カメラの回転順序をYXZ（水平回転してから垂直回転）に設定することで、FPS視点の挙動を安定させる
    camera.rotation.order = 'YXZ';
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // キャンバスを親要素内に正しく配置するためのスタイル設定
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(20, 50, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.left = -60;
    dirLight.shadow.camera.right = 60;
    dirLight.shadow.camera.top = 60;
    dirLight.shadow.camera.bottom = -60;
    scene.add(dirLight);

    // ★修正: ResizeObserverを使用して、コンテナのサイズ変更を正確に検知する
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        if (entry.target === mountRef.current && cameraRef.current && rendererRef.current) {
          const { width, height } = entry.contentRect;
          // サイズが0の場合は処理しない（エラー防止）
          if (width === 0 || height === 0) return;

          cameraRef.current.aspect = width / height;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(width, height);
        }
      }
    });

    // 監視開始
    resizeObserver.observe(mountRef.current);

    // シーン初期化完了を通知
    setSceneInitialized(true);

    // クリーンアップ
    return () => {
      resizeObserver.disconnect();
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      setSceneInitialized(false);
    };
  }, []);

  const isWalkModeRef = useRef(isWalkMode);

  // --- マウス操作（歩行モード用：自前LookAround） ---
  useEffect(() => {
    const handleMouseDown = (e) => {
      if (!isWalkModeRef.current) return;
      isDraggingRef.current = true;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
      if (!isWalkModeRef.current || !isDraggingRef.current || !cameraRef.current) return;

      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;

      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };

      const camera = cameraRef.current;
      const rotateSpeed = 0.002;

      // Y軸（左右）回転: ワールド座標系で回す
      camera.rotation.y -= deltaX * rotateSpeed;

      // X軸（上下）回転: 制限付き
      camera.rotation.x -= deltaY * rotateSpeed;
      // 首の角度制限（上向きすぎ・下向きすぎ防止: 約85度）
      const maxPolarAngle = Math.PI / 2 - 0.1;
      camera.rotation.x = Math.max(-maxPolarAngle, Math.min(maxPolarAngle, camera.rotation.x));

      // Z軸回転（傾き）はゼロに保つ
      camera.rotation.z = 0;
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    // Canvas要素に対してイベントをつけるのが理想だが、簡単のためwindowに
    const canvas = rendererRef.current?.domElement;
    if (canvas) {
      canvas.addEventListener('mousedown', handleMouseDown);
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener('mousedown', handleMouseDown);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // --- スクロール（ホイール）イベント設定 ---
  useEffect(() => {
    const handleWheel = (e) => {
      if (!isWalkModeRef.current || !cameraRef.current) return;

      // 歩行モード時はコントロール無効化しているので自前で移動
      const sensitivity = 0.03;
      const moveDistance = -e.deltaY * sensitivity;

      const cam = cameraRef.current;
      const forward = new THREE.Vector3();
      cam.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();

      if (forward.lengthSq() === 0) return;

      const move = forward.multiplyScalar(moveDistance);
      cam.position.add(move);
      // OrbitControlsが無効なのでターゲット更新は不要
    };
    window.addEventListener('wheel', handleWheel);
    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, []);

  useEffect(() => {
    isWalkModeRef.current = isWalkMode;

    // モード切り替え時のカメラ制御
    if (controlsRef.current && cameraRef.current) {
      const ctrl = controlsRef.current;
      const cam = cameraRef.current;

      if (isWalkMode) {
        // --- 歩行モード開始 ---

        // 1. OrbitControls を無効化（干渉を防ぐ）
        ctrl.enabled = false;

        // 2. 現在のターゲット位置にカメラを移動させ、高さを合わせる
        const target = ctrl.target.clone();

        // 現在のカメラからターゲットへのベクトル
        const vec = new THREE.Vector3().subVectors(target, cam.position);
        vec.y = 0; // 水平距離のみ
        const dist = vec.length();

        // もし遠すぎたら近づける、近すぎたらそのまま
        if (dist > 10) {
          vec.normalize().multiplyScalar(dist - 10);
          cam.position.add(vec);
        }
        cam.position.y = EYE_LEVEL;

        // 3. カメラの角度（Rotation）を調整
        cam.lookAt(target.x, EYE_LEVEL, target.z);

      } else {
        // --- 歩行モード終了（俯瞰に戻る） ---

        // 1. 現在のカメラ位置と向きから、新しいターゲット（注視点）を計算
        const forward = new THREE.Vector3();
        cam.getWorldDirection(forward);

        const newTarget = cam.position.clone().add(forward.multiplyScalar(20));
        newTarget.y = 0; // ターゲットは床レベルに

        // 2. カメラ位置を引き上げる（俯瞰ポジションへ）
        const back = new THREE.Vector3();
        cam.getWorldDirection(back);
        back.y = 0;
        back.normalize().negate(); // 後ろ方向

        cam.position.add(back.multiplyScalar(30)); // 30下がる
        cam.position.y = 50; // 高さ確保

        // 3. OrbitControls を有効化・更新
        ctrl.target.copy(newTarget);
        ctrl.enabled = true;
        ctrl.update();
      }
    }
  }, [isWalkMode]);

  // ミニマップ描画関数
  const drawMiniMap = () => {
    const canvas = miniMapRef.current;
    if (!canvas || !isWalkModeRef.current) return;

    const currentData = floorPlanDataRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(0, 0, width, height);

    if (!currentData) {
      ctx.fillStyle = "#666";
      ctx.font = "14px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("No Data", width / 2, height / 2);
      return;
    }

    const bounds = dataBoundsRef.current;
    const dataW = bounds.maxX - bounds.minX;
    const dataH = bounds.maxY - bounds.minY;
    if (dataW === 0 || dataH === 0) return;

    const margin = 20;
    const drawW = width - margin * 2;
    const drawH = height - margin * 2;

    const scaleX = drawW / dataW;
    const scaleY = drawH / dataH;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = margin + (drawW - dataW * scale) / 2;
    const offsetY = margin + (drawH - dataH * scale) / 2;

    const toCanvasX = (x) => offsetX + (x - bounds.minX) * scale;
    const toCanvasY = (y) => offsetY + (y - bounds.minY) * scale;

    if (currentData.rooms) {
      currentData.rooms.forEach(room => {
        let colorHex = "#e0e0e0";
        if (room.type && COLORS.floor[room.type]) {
          colorHex = '#' + COLORS.floor[room.type].toString(16).padStart(6, '0');
        } else if (room.type === 'free' && room.customLabel === 'WIC') {
          colorHex = '#' + COLORS.floor.storage.toString(16).padStart(6, '0');
        }
        if (colorHex.toLowerCase() === '#ffffff') colorHex = '#f0f0f0';

        ctx.beginPath();
        room.points.forEach((p, i) => {
          const cx = toCanvasX(p.x);
          const cy = toCanvasY(p.y);
          if (i === 0) ctx.moveTo(cx, cy);
          else ctx.lineTo(cx, cy);
        });
        ctx.closePath();
        ctx.fillStyle = colorHex;
        ctx.fill();
        ctx.strokeStyle = "#888";
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }

    if (cameraRef.current) {
      const cam = cameraRef.current;
      const centerMm = centerMmRef.current;
      const rawX = (cam.position.x / MM_TO_SCENE + centerMm.x) / DATA_SCALE;
      const rawY = (cam.position.z / MM_TO_SCENE + centerMm.y) / DATA_SCALE;
      const myCx = toCanvasX(rawX);
      const myCy = toCanvasY(rawY);

      const dir = new THREE.Vector3();
      cam.getWorldDirection(dir);
      const angle = Math.atan2(dir.z, dir.x);

      ctx.save();
      ctx.translate(myCx, myCy);
      ctx.rotate(angle);

      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-7, 6);
      ctx.lineTo(-7, -6);
      ctx.closePath();
      ctx.fillStyle = "#ff0000";
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(myCx, myCy, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#ff0000";
      ctx.fill();
      ctx.stroke();
    }
  };

  // ★追加: ミニマップクリックハンドラ
  const handleMiniMapClick = (e) => {
    // 歩行モードかつデータがある場合のみ
    if (!isWalkModeRef.current || !floorPlanDataRef.current || !cameraRef.current) return;

    // Canvas上のクリック位置
    const rect = e.target.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // スケール・オフセット再計算 (drawMiniMapと同じロジック)
    const canvas = miniMapRef.current;
    const bounds = dataBoundsRef.current;
    const dataW = bounds.maxX - bounds.minX;
    const dataH = bounds.maxY - bounds.minY;
    if (dataW === 0 || dataH === 0) return;

    const margin = 20;
    const drawW = canvas.width - margin * 2;
    const drawH = canvas.height - margin * 2;

    const scaleX = drawW / dataW;
    const scaleY = drawH / dataH;
    const scale = Math.min(scaleX, scaleY);

    const offsetX = margin + (drawW - dataW * scale) / 2;
    const offsetY = margin + (drawH - dataH * scale) / 2;

    // Canvas座標 -> データ座標(raw) -> 3D座標
    // x = (canvasX - offsetX) / scale + bounds.minX
    const rawX = (clickX - offsetX) / scale + bounds.minX;
    const rawY = (clickY - offsetY) / scale + bounds.minY;

    // データ座標 -> 3D座標
    // 3D X = (rawX * DATA_SCALE - center.x) * MM_TO_SCENE
    const centerMm = centerMmRef.current;
    const targetX = (rawX * DATA_SCALE - centerMm.x) * MM_TO_SCENE;
    const targetZ = (rawY * DATA_SCALE - centerMm.y) * MM_TO_SCENE;

    // カメラ移動
    const cam = cameraRef.current;
    cam.position.x = targetX;
    cam.position.z = targetZ;

    // 即時再描画
    drawMiniMap();
  };


  useEffect(() => {
    // アニメーションループ本体
    const animate = () => {
      requestRef.current = requestAnimationFrame(animate);

      const cam = cameraRef.current;

      // 歩行モード時の移動ロジック
      if (cam && isWalkModeRef.current) {
        const moveSpeed = 0.5;
        const forward = new THREE.Vector3();
        cam.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        const right = new THREE.Vector3();
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        const move = new THREE.Vector3(0, 0, 0);
        if (keysPressed.current['KeyW'] || keysPressed.current['ArrowUp']) move.add(forward);
        if (keysPressed.current['KeyS'] || keysPressed.current['ArrowDown']) move.sub(forward);
        if (keysPressed.current['KeyA'] || keysPressed.current['ArrowLeft']) move.sub(right);
        if (keysPressed.current['KeyD'] || keysPressed.current['ArrowRight']) move.add(right);

        if (move.lengthSq() > 0) {
          move.normalize().multiplyScalar(moveSpeed);
          cam.position.add(move);
        }

        drawMiniMap();
      } else {
        // 俯瞰モード時はControlsを更新
        if (controlsRef.current) controlsRef.current.update();
      }

      if (rendererRef.current && sceneRef.current && cam) {
        // 最初の数フレームだけログを出力
        if (!window._3dDebugFrameCount) window._3dDebugFrameCount = 0;
        if (window._3dDebugFrameCount < 3) {
          console.log('[3D DEBUG] Rendering frame', window._3dDebugFrameCount, {
            sceneChildren: sceneRef.current.children.length,
            cameraPos: cam.position,
            cameraTarget: controlsRef.current?.target,
            rendererSize: { width: rendererRef.current.domElement.width, height: rendererRef.current.domElement.height }
          });
          window._3dDebugFrameCount++;
        }
        rendererRef.current.render(sceneRef.current, cam);
      }
    };

    if (requestRef.current) cancelAnimationFrame(requestRef.current);
    animate();

    return () => {
      cancelAnimationFrame(requestRef.current);
    };
  }, []);


  // --- シーン構築 ---
  useEffect(() => {
    floorPlanDataRef.current = floorPlanData;
    if (!floorPlanData || !sceneRef.current || !sceneInitialized) {
      return;
    }
    rebuildScene(floorPlanData);
  }, [floorPlanData, wallHeight, wallOpacity, sceneInitialized]);


  // データから中心座標と範囲を計算 (mm単位)
  const calcDataBounds = (data) => {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    if (!data.rooms || data.rooms.length === 0) return { x: 0, y: 0 };

    data.rooms.forEach(room => {
      room.points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      });
    });

    if (minX === Infinity) { minX = 0; maxX = 0; minY = 0; maxY = 0; }
    dataBoundsRef.current = { minX, maxX, minY, maxY };

    return {
      x: (minX + maxX) / 2 * DATA_SCALE,
      y: (minY + maxY) / 2 * DATA_SCALE
    };
  };

  const clearGroups = () => {
    if (objectGroupRef.current) {
      while (objectGroupRef.current.children.length > 0) {
        const child = objectGroupRef.current.children[0];
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
        objectGroupRef.current.remove(child);
      }
    }
    if (wallGroupRef.current) {
      while (wallGroupRef.current.children.length > 0) {
        const child = wallGroupRef.current.children[0];
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
        wallGroupRef.current.remove(child);
      }
    }
  };

  const rebuildScene = (data) => {
    clearGroups();
    const centerMm = calcDataBounds(data);
    centerMmRef.current = centerMm;
    buildWalls(data, centerMm);
    buildFloorsAndObjects(data, centerMm);

    // カメラのターゲットをシーンの中心に設定（これがないと床が見えない）
    if (controlsRef.current && !isWalkModeRef.current && cameraRef.current) {
      // カメラのターゲットを原点に
      controlsRef.current.target.set(0, 0, 0);

      // カメラの位置もリセット（床を見やすい位置に）
      cameraRef.current.position.set(0, 50, 60);

      controlsRef.current.update();
    }
  };

  const buildWalls = (data, center) => {
    if (!data.walls) return;
    const currentWallHeight = wallHeight * MM_TO_SCENE;
    const isTransparent = wallOpacity < 1.0;
    const wallMat = new THREE.MeshLambertMaterial({
      color: COLORS.wall,
      transparent: isTransparent,
      opacity: wallOpacity,
      depthWrite: !isTransparent
    });

    data.walls.forEach(wall => {
      const sx = (wall.start.x * DATA_SCALE - center.x) * MM_TO_SCENE;
      const sz = (wall.start.y * DATA_SCALE - center.y) * MM_TO_SCENE;
      const ex = (wall.end.x * DATA_SCALE - center.x) * MM_TO_SCENE;
      const ez = (wall.end.y * DATA_SCALE - center.y) * MM_TO_SCENE;
      const dist = Math.sqrt((ex - sx) ** 2 + (ez - sz) ** 2);
      const angle = Math.atan2(ez - sz, ex - sx);

      const geometry = new THREE.BoxGeometry(dist, currentWallHeight, WALL_THICKNESS);
      const mesh = new THREE.Mesh(geometry, wallMat);
      mesh.position.set((sx + ex) / 2, currentWallHeight / 2, (sz + ez) / 2);
      mesh.rotation.y = -angle;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      wallGroupRef.current.add(mesh);
    });
  };

  const buildFloorsAndObjects = (data, center) => {
    if (data.rooms) {
      data.rooms.forEach(room => {
        const shape = new THREE.Shape();
        room.points.forEach((p, index) => {
          const x = (p.x * DATA_SCALE - center.x) * MM_TO_SCENE;
          const z = (p.y * DATA_SCALE - center.y) * MM_TO_SCENE;
          if (index === 0) shape.moveTo(x, z);
          else shape.lineTo(x, z);
        });
        const geometry = new THREE.ShapeGeometry(shape);
        let color = COLORS.floor.default;
        if (room.type && COLORS.floor[room.type]) {
          color = COLORS.floor[room.type];
        } else if (room.type === 'free' && room.customLabel === 'WIC') {
          color = COLORS.floor.storage;
        }
        const material = new THREE.MeshLambertMaterial({ color: color, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = -Math.PI / 2;
        mesh.receiveShadow = true;
        objectGroupRef.current.add(mesh);
      });
    }

    if (data.objects) {
      data.objects.forEach(obj => {
        let objWidth = (obj.width || 500) * MM_TO_SCENE;
        let objDepth = (obj.height || 500) * MM_TO_SCENE;
        let objHeight = 50 * MM_TO_SCENE;
        let color = COLORS.furniture;
        let elevation = 0;
        let opacity = 1.0;
        let transparent = false;

        switch (obj.type) {
          case 'window':
          case 'fix_window':
            objHeight = 1100 * MM_TO_SCENE;
            elevation = 900 * MM_TO_SCENE;
            color = COLORS.window;
            opacity = 0.5;
            transparent = true;
            objDepth = WALL_THICKNESS * 1.5;
            break;
          case 'door':
          case 'sliding_door':
            objHeight = 2000 * MM_TO_SCENE;
            elevation = 0;
            color = COLORS.door;
            objDepth = WALL_THICKNESS * 1.2; // 壁より少し厚くして表示させる
            break;
          case 'kitchen':
            objHeight = 850 * MM_TO_SCENE;
            color = COLORS.kitchen;
            break;
          case 'bath':
            objHeight = 600 * MM_TO_SCENE;
            color = COLORS.floor.bath;
            opacity = 0.8;
            transparent = true;
            break;
          case 'wash_basin':
            objHeight = 800 * MM_TO_SCENE;
            color = 0xffffff;
            break;
          case 'toilet':
            objHeight = 450 * MM_TO_SCENE;
            color = 0xffffff;
            break;
          case 'refrigerator':
            objHeight = 1800 * MM_TO_SCENE;
            color = 0xeeeeee;
            break;
          case 'sofa':
            objHeight = 400 * MM_TO_SCENE;
            color = COLORS.sofa;
            break;
          case 'table':
          case 'desk':
            objHeight = 700 * MM_TO_SCENE;
            color = 0x8B4513;
            break;
          case 'tv_stand':
            objHeight = 400 * MM_TO_SCENE;
            break;
          case 'tv':
            objHeight = 650 * MM_TO_SCENE;
            elevation = 450 * MM_TO_SCENE;
            color = 0x111111;
            objDepth = 50 * MM_TO_SCENE;
            break;
          case 'storage':
          case 'custom':
            objHeight = 1800 * MM_TO_SCENE;
            if (obj.label) {
              if (obj.label.includes("机")) objHeight = 700 * MM_TO_SCENE;
              else if (obj.label.includes("台")) objHeight = 800 * MM_TO_SCENE;
              else if (obj.label.includes("靴")) objHeight = 1000 * MM_TO_SCENE;
              else if (obj.label.includes("棚")) objHeight = 1800 * MM_TO_SCENE;
            }
            color = 0xdeb887;
            break;
          case 'column':
            objHeight = 2400 * MM_TO_SCENE;
            color = COLORS.wall;
            break;
          default:
            objHeight = 700 * MM_TO_SCENE;
        }

        const geometry = new THREE.BoxGeometry(objWidth, objHeight, objDepth);
        const material = new THREE.MeshLambertMaterial({ color: color, transparent: transparent, opacity: opacity });
        const mesh = new THREE.Mesh(geometry, material);
        const px = (obj.x - center.x) * MM_TO_SCENE;
        const pz = (obj.y - center.y) * MM_TO_SCENE;
        mesh.position.set(px, elevation + objHeight / 2, pz);
        if (obj.rotation) mesh.rotation.y = -obj.rotation * Math.PI / 180;
        mesh.castShadow = !transparent;
        mesh.receiveShadow = true;
        objectGroupRef.current.add(mesh);
      });
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        setFloorPlanData(json);
      } catch (err) {
        alert("JSONファイルの読み込みに失敗しました。");
        console.error(err);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="relative w-full h-screen bg-gray-900 overflow-hidden text-gray-800">
      <div ref={mountRef} className="relative w-full h-full cursor-pointer"></div>
      <canvas
        ref={miniMapRef}
        width="200"
        height="200"
        onClick={handleMiniMapClick}
        className={`absolute bottom-4 right-4 rounded-lg shadow-lg border-2 border-white bg-white/90 transition-opacity duration-300 ${isWalkMode ? "opacity-100 cursor-pointer" : "opacity-0 pointer-events-none"}`}
      />

      {/* --- BACK TO 2D BUTTON (Always Visible) --- */}
      <button
        onClick={onClose}
        className="absolute top-4 left-4 py-2 px-4 bg-gray-600 text-white rounded-lg shadow-lg font-bold hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
        title="2D編集に戻る"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        2D編集に戻る
      </button>

      {/* --- MENU TOGGLE BUTTON (When Closed) --- */}
      {!isMenuOpen && (
        <button
          onClick={() => setIsMenuOpen(true)}
          className="absolute top-16 left-4 bg-white/90 p-2 rounded-lg shadow-lg hover:bg-white transition-colors"
          title="メニューを開く"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* --- CONTROL PANEL (Animated Slide) --- */}
      <div className={`absolute top-16 left-4 bg-white/95 p-4 rounded-lg shadow-xl max-w-xs max-h-[90vh] overflow-y-auto transition-transform duration-300 ${isMenuOpen ? "translate-x-0" : "-translate-x-[120%]"}`}>

        {/* Header with Close Button */}
        <div className="flex justify-between items-center border-b-2 border-gray-200 pb-2 mb-2">
          <h1 className="text-lg font-bold">3D 間取りビューアー</h1>
          <button
            onClick={() => setIsMenuOpen(false)}
            className="text-gray-500 hover:text-gray-800 p-1 rounded-full hover:bg-gray-100 transition-colors"
            title="メニューを閉じる"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <button
            onClick={() => setIsWalkMode(!isWalkMode)}
            className={`w-full py-2 px-4 rounded font-bold transition-colors ${isWalkMode
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
          >
            {isWalkMode ? "🚶‍♂️ 歩行モード中 (終了)" : "🦅 俯瞰モード (歩く)"}
          </button>
          <p className="text-xs text-gray-600 mt-1">
            {isWalkMode
              ? "移動: WASD / 矢印 / スクロール\n視点: マウスドラッグ\nミニマップ: クリックで移動"
              : "操作: 回転 / ズーム / 移動"
            }
          </p>
        </div>
        <div className="border-t border-gray-100 pt-3 mt-2">
          <div className="mb-3">
            <label className="block text-sm font-bold mb-1">
              壁の高さ: {wallHeight}mm
            </label>
            <input
              type="range"
              min="500" max="4000" step="100"
              value={wallHeight}
              onChange={(e) => setWallHeight(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-bold mb-1">
              壁の透明度: {wallOpacity}
            </label>
            <input
              type="range"
              min="0.1" max="1.0" step="0.1"
              value={wallOpacity}
              onChange={(e) => setWallOpacity(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <div className="mb-3">
            <label className="block text-sm font-bold mb-1">ファイル読み込み</label>
            <input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
        </div>
        <div className="mt-4 bg-gray-50 p-3 rounded text-sm">
          <div className="font-bold mb-2">凡例</div>
          <div className="flex items-center mb-1"><span className="w-4 h-4 mr-2 bg-[#e0e0e0] border border-gray-300"></span>床 (LDKなど)</div>
          <div className="flex items-center mb-1"><span className="w-4 h-4 mr-2 bg-[#aaccff] border border-gray-300"></span>水回り</div>
          <div className="flex items-center mb-1"><span className="w-4 h-4 mr-2 bg-[#eeeeee] border border-gray-400"></span>壁</div>
          <div className="flex items-center mb-1"><span className="w-4 h-4 mr-2 bg-[#8B4513] border border-gray-300"></span>家具・建具</div>
          <div className="flex items-center mb-1"><span className="w-4 h-4 mr-2 bg-[#87CEEB] border border-gray-300"></span>窓</div>
        </div>
      </div>
    </div>
  );
};

export default FloorPlanViewer3D;

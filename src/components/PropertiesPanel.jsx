import React from 'react';
import { ROOM_TYPES, OBJECT_TYPES } from '../constants';
import { Settings, Trash2, Copy, RefreshCw, Ruler, Maximize2, Type } from 'lucide-react';

function PropertiesPanel({
  rooms,
  setRooms,
  walls,
  setWalls,
  objects,
  setObjects,
  scale,
  selectedRoomId,
  setSelectedRoomId,
  selectedWallId,
  setSelectedWallId,
  selectedObjectId,
  setSelectedObjectId,
  selectedRoomArea,
  totalArea
}) {
  const selectedRoom = rooms.find(r => r.id === selectedRoomId);
  const selectedWall = walls.find(w => w.id === selectedWallId);
  const selectedObject = objects.find(o => o.id === selectedObjectId);

  return (
    <aside className="w-[300px] bg-white border-l border-slate-200 h-full overflow-y-auto flex flex-col shadow-lg z-10">
      <div className="p-4 border-b border-slate-100 bg-slate-50">
        <h2 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2">
          <Settings className="w-4 h-4" />
          プロパティ
        </h2>
      </div>

      <div className="p-4 space-y-6">
        {/* Global Stats */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">全体情報</h3>
          <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
            <div className="bg-slate-50 p-2 rounded border border-slate-100">
              <span className="block text-xs text-slate-400">部屋数</span>
              <span className="font-mono font-bold">{rooms.length}</span>
            </div>
            <div className="bg-slate-50 p-2 rounded border border-slate-100">
              <span className="block text-xs text-slate-400">設備数</span>
              <span className="font-mono font-bold">{objects.length}</span>
            </div>
          </div>

          <div className="bg-indigo-50 p-3 rounded-lg border border-indigo-100">
            <div className="text-xs font-bold text-indigo-400 uppercase mb-2">合計面積</div>
            <div className="space-y-1">
              <div className="flex justify-between items-baseline">
                <span className="text-2xl font-bold text-indigo-700">{totalArea?.tatami.toFixed(1)}</span>
                <span className="text-xs text-indigo-500 font-medium">畳</span>
              </div>
              <div className="flex justify-between text-xs text-indigo-600 border-t border-indigo-200 pt-1 mt-1">
                <span>{totalArea?.tsubo.toFixed(2)} 坪</span>
                <span>{totalArea?.sqm.toFixed(2)} m²</span>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Room */}
        {selectedRoom && selectedRoomArea && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800">選択中の部屋</h3>
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">Room</span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">部屋タイプ</label>
                <select
                  value={selectedRoom.type || 'western'}
                  onChange={(e) => {
                    setRooms(rooms.map(r => r.id === selectedRoom.id ? { ...r, type: e.target.value } : r));
                  }}
                  className="w-full text-sm border-slate-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                >
                  {ROOM_TYPES.map(type => (
                    <option key={type.id} value={type.id}>{type.label}</option>
                  ))}
                </select>
              </div>

              {selectedRoom.type === 'free' && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">部屋名ラベル</label>
                  <div className="relative">
                    <Type className="absolute left-2 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={selectedRoom.customLabel || ''}
                      placeholder="例: 書斎"
                      onChange={(e) => {
                        setRooms(rooms.map(r => r.id === selectedRoom.id ? { ...r, customLabel: e.target.value } : r));
                      }}
                      className="w-full pl-8 text-sm border-slate-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="text-xs font-medium text-slate-500 mb-2">面積詳細</div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <span className="block text-lg font-bold text-slate-700">{selectedRoomArea.tatami.toFixed(1)}</span>
                    <span className="text-[10px] text-slate-400">畳</span>
                  </div>
                  <div>
                    <span className="block text-lg font-bold text-slate-700">{selectedRoomArea.tsubo.toFixed(1)}</span>
                    <span className="text-[10px] text-slate-400">坪</span>
                  </div>
                  <div>
                    <span className="block text-lg font-bold text-slate-700">{selectedRoomArea.sqm.toFixed(1)}</span>
                    <span className="text-[10px] text-slate-400">m²</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setRooms(rooms.filter(r => r.id !== selectedRoom.id));
                  setSelectedRoomId(null);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-md text-sm font-medium hover:bg-red-100 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                部屋を削除
              </button>
            </div>
          </div>
        )}

        {/* Selected Wall */}
        {selectedWall && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800">選択中の壁</h3>
              <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium">Wall</span>
            </div>

            <div className="bg-slate-50 p-3 rounded text-xs text-slate-500 font-mono break-all">
              ID: {selectedWall.id}
            </div>

            <button
              onClick={() => {
                setWalls(walls.filter(w => w.id !== selectedWall.id));
                setSelectedWallId(null);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-md text-sm font-medium hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              壁を削除
            </button>
          </div>
        )}

        {/* Selected Object */}
        {selectedObject && (
          <div className="space-y-4 animate-in slide-in-from-right-4 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-800">選択中の設備</h3>
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">Object</span>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-700 bg-blue-50 p-2 rounded border border-blue-100">
                {OBJECT_TYPES.find(t => t.id === selectedObject.type)?.label || selectedObject.type}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">ラベル</label>
                <input
                  type="text"
                  value={selectedObject.label || ''}
                  onChange={(e) => {
                    setObjects(objects.map(o =>
                      o.id === selectedObject.id ? { ...o, label: e.target.value } : o
                    ));
                  }}
                  placeholder="例: 冷蔵庫"
                  className="w-full text-sm border-slate-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                    <Ruler className="w-3 h-3" /> 幅 (mm)
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="5000"
                    step="10"
                    value={selectedObject.width}
                    onChange={(e) => {
                      const newWidth = parseInt(e.target.value) || selectedObject.width;
                      setObjects(objects.map(o => {
                        if (o.id === selectedObject.id) {
                          const updates = { width: newWidth };
                          if (o.type === 'custom' && o.points) {
                            const scaleX = newWidth / o.width;
                            updates.points = o.points.map(p => ({ ...p, x: p.x * scaleX }));
                          }
                          return { ...o, ...updates };
                        }
                        return o;
                      }));
                    }}
                    className="w-full text-sm border-slate-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                    <Maximize2 className="w-3 h-3" /> 高さ (mm)
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="5000"
                    step="10"
                    value={selectedObject.height}
                    onChange={(e) => {
                      const newHeight = parseInt(e.target.value) || selectedObject.height;
                      setObjects(objects.map(o => {
                        if (o.id === selectedObject.id) {
                          const updates = { height: newHeight };
                          if (o.type === 'custom' && o.points) {
                            const scaleY = newHeight / o.height;
                            updates.points = o.points.map(p => ({ ...p, y: p.y * scaleY }));
                          }
                          return { ...o, ...updates };
                        }
                        return o;
                      }));
                    }}
                    className="w-full text-sm border-slate-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3" /> 回転 (度)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="15"
                    value={selectedObject.rotation}
                    onChange={(e) => {
                      const newRotation = parseInt(e.target.value) || 0;
                      setObjects(objects.map(o =>
                        o.id === selectedObject.id ? { ...o, rotation: newRotation } : o
                      ));
                    }}
                    className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs font-mono w-10 text-right">{selectedObject.rotation}°</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  onClick={() => {
                    setObjects(objects.map(o =>
                      o.id === selectedObject.id ? { ...o, flipX: !o.flipX } : o
                    ));
                  }}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-200 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  左右反転
                </button>
                <button
                  onClick={() => {
                    const newObject = {
                      ...selectedObject,
                      id: Date.now(),
                      x: selectedObject.x + 100,
                      y: selectedObject.y + 100
                    };
                    setObjects([...objects, newObject]);
                    setSelectedObjectId(newObject.id);
                  }}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-md text-xs font-medium hover:bg-blue-100 transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  複製
                </button>
              </div>

              <button
                onClick={() => {
                  setObjects(objects.filter(o => o.id !== selectedObject.id));
                  setSelectedObjectId(null);
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-md text-sm font-medium hover:bg-red-100 transition-colors mt-2"
              >
                <Trash2 className="w-4 h-4" />
                設備を削除
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

export default PropertiesPanel;

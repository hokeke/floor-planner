import React from 'react';
import { ROOM_TYPES, OBJECT_TYPES } from '../constants';
import { MousePointer2, Square, Grid, Box, Hexagon, Armchair, ZoomIn, Save, Upload, Activity, Cuboid } from 'lucide-react';

function Toolbar({
  tool,
  setTool,
  activeRoomType,
  setActiveRoomType,
  activeObjectType,
  setActiveObjectType,
  activeWallMode,
  setActiveWallMode,
  scale,
  setScale,
  setPan,
  onSave,
  onLoad,
  onOpenSeismicCheck,
  onOpen3D,
  onSavePNG
}) {
  return (
    <header className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between shadow-sm z-20 relative h-[60px]">
      <div className="flex items-center gap-6">
        <h1 className="text-lg font-bold text-slate-700 flex items-center gap-2">
          <Grid className="w-5 h-5 text-indigo-600" />
          <span>間取り作成</span>
        </h1>

        <div className="flex items-center gap-2 border-l border-slate-200 pl-6">
          {/* Select Tool */}
          <button
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tool === 'select'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              : 'text-slate-600 hover:bg-slate-50 border border-transparent'
              }`}
            onClick={() => setTool('select')}
          >
            <MousePointer2 className="w-4 h-4" />
            選択
          </button>

          {/* Room Tool */}
          <div className="flex items-center gap-1 bg-slate-50 rounded-md p-1 border border-slate-200">
            <button
              className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${tool === 'room'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
                }`}
              onClick={() => setTool('room')}
            >
              <Square className="w-4 h-4" />
              部屋
            </button>
            {tool === 'room' && (
              <select
                value={activeRoomType}
                onChange={(e) => setActiveRoomType(e.target.value)}
                className="text-sm border-none bg-transparent focus:ring-0 text-slate-700 font-medium cursor-pointer py-1 pl-2 pr-8"
              >
                {ROOM_TYPES.map(type => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </select>
            )}
          </div>

          {/* Wall Tool */}
          <div className="flex items-center gap-1 bg-slate-50 rounded-md p-1 border border-slate-200">
            <button
              className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${tool === 'wall'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
                }`}
              onClick={() => setTool('wall')}
            >
              <Box className="w-4 h-4" />
              壁・柱
            </button>
            {tool === 'wall' && (
              <select
                value={activeWallMode}
                onChange={(e) => setActiveWallMode(e.target.value)}
                className="text-sm border-none bg-transparent focus:ring-0 text-slate-700 font-medium cursor-pointer py-1 pl-2 pr-8"
              >
                <option value="wall">壁</option>
                <option value="column">柱</option>
              </select>
            )}
          </div>

          {/* Polygon Tool */}
          <button
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tool === 'custom_object'
              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
              : 'text-slate-600 hover:bg-slate-50 border border-transparent'
              }`}
            onClick={() => setTool('custom_object')}
          >
            <Hexagon className="w-4 h-4" />
            多角形
          </button>

          {/* Object Tool */}
          <div className="flex items-center gap-1 bg-slate-50 rounded-md p-1 border border-slate-200">
            <button
              className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-sm font-medium transition-colors ${tool === 'object'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
                }`}
              onClick={() => setTool('object')}
            >
              <Armchair className="w-4 h-4" />
              設備
            </button>
            {tool === 'object' && (
              <select
                value={activeObjectType}
                onChange={(e) => setActiveObjectType(e.target.value)}
                className="text-sm border-none bg-transparent focus:ring-0 text-slate-700 font-medium cursor-pointer py-1 pl-2 pr-8"
              >
                {OBJECT_TYPES.map(type => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Zoom Controls */}
        <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
          <ZoomIn className="w-4 h-4 text-slate-400" />
          <span className="font-mono">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-medium ml-2"
          >
            Reset
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
          <button
            onClick={onSave}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Save className="w-4 h-4" />
            保存
          </button>
          <button
            onClick={onLoad}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Upload className="w-4 h-4" />
            読込
          </button>
          <button
            onClick={onSavePNG}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 rounded-md text-sm font-medium hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Save className="w-4 h-4" />
            画像保存
          </button>
          <button
            onClick={onOpenSeismicCheck}
            className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-md text-sm font-bold hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm hover:shadow-md"
          >
            <Activity className="w-4 h-4" />
            耐震チェック
          </button>
          <button
            onClick={onOpen3D}
            className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-md text-sm font-bold hover:from-blue-600 hover:to-indigo-600 transition-all shadow-sm hover:shadow-md"
          >
            <Cuboid className="w-4 h-4" />
            3D表示
          </button>
        </div>
      </div>
    </header>
  );
}

export default Toolbar;

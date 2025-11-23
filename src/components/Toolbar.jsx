import React from 'react';
import { ROOM_TYPES, OBJECT_TYPES } from '../constants';

function Toolbar({
  tool,
  setTool,
  activeRoomType,
  setActiveRoomType,
  activeObjectType,
  setActiveObjectType,
  scale,
  setScale,
  setPan,
  onSave,
  onLoad
}) {
  return (
    <header className="toolbar" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', padding: '10px', borderBottom: '1px solid #ccc' }}>
      <h1 style={{ margin: 0, marginRight: '20px', fontSize: '1.2rem' }}>間取り作成 (Floor Plan)</h1>
      <div className="tools" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
        <button
          className={tool === 'select' ? 'active' : ''}
          onClick={() => setTool('select')}
          style={{ padding: '8px 12px', cursor: 'pointer', backgroundColor: tool === 'select' ? '#ddd' : '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px' }}
        >
          選択 (Select)
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <button
            className={tool === 'room' ? 'active' : ''}
            onClick={() => setTool('room')}
            style={{ padding: '8px 12px', cursor: 'pointer', backgroundColor: tool === 'room' ? '#ddd' : '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px' }}
          >
            部屋作成 (Room)
          </button>
          {tool === 'room' && (
            <select
              value={activeRoomType}
              onChange={(e) => setActiveRoomType(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              {ROOM_TYPES.map(type => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </select>
          )}
        </div>
        <button
          className={tool === 'wall' ? 'active' : ''}
          onClick={() => setTool('wall')}
          style={{ padding: '8px 12px', cursor: 'pointer', backgroundColor: tool === 'wall' ? '#ddd' : '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px' }}
        >
          壁作成 (Wall)
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <button
            className={tool === 'object' ? 'active' : ''}
            onClick={() => setTool('object')}
            style={{ padding: '8px 12px', cursor: 'pointer', backgroundColor: tool === 'object' ? '#ddd' : '#f0f0f0', border: '1px solid #ccc', borderRadius: '4px' }}
          >
            設備・家具 (Object)
          </button>
          {tool === 'object' && (
            <select
              value={activeObjectType}
              onChange={(e) => setActiveObjectType(e.target.value)}
              style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            >
              {OBJECT_TYPES.map(type => (
                <option key={type.id} value={type.id}>{type.label}</option>
              ))}
            </select>
          )}
        </div>
      </div>
      <div className="zoom-controls" style={{ marginLeft: 'auto', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <span>Zoom: {Math.round(scale * 100)}%</span>
        <button onClick={() => { setScale(1); setPan({ x: 0, y: 0 }); }} style={{ padding: '5px 10px', cursor: 'pointer' }}>Reset</button>
      </div>
      <div className="drive-controls" style={{ marginLeft: '10px', display: 'flex', gap: '10px', alignItems: 'center', borderLeft: '1px solid #ccc', paddingLeft: '10px' }}>
        <button onClick={onSave} style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: '#e6f7ff', border: '1px solid #1890ff', borderRadius: '4px', color: '#1890ff' }}>
          Save
        </button>
        <button onClick={onLoad} style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: '#f6ffed', border: '1px solid #52c41a', borderRadius: '4px', color: '#52c41a' }}>
          Load
        </button>
      </div>
    </header>
  );
}

export default Toolbar;

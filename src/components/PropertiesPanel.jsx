import React from 'react';
import { ROOM_TYPES, OBJECT_TYPES } from '../constants';

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
    <aside className="properties-panel">
      <h2>プロパティ (Properties)</h2>
      <div className="property-group">
        <h3>全体 (Global)</h3>
        <p>部屋数: {rooms.length}</p>
        <p>壁数: {walls.length}</p>
        <p>設備数: {objects.length}</p>
        <p>Zoom: {Math.round(scale * 100)}%</p>
        <div style={{ marginTop: '10px', borderTop: '1px solid #ddd', paddingTop: '5px' }}>
          <strong>合計面積 (Total Area):</strong>
          <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
            <li>{totalArea?.tatami.toFixed(2)} 畳 (Jō)</li>
            <li>{totalArea?.tsubo.toFixed(2)} 坪 (Tsubo)</li>
            <li>{totalArea?.sqm.toFixed(2)} m²</li>
          </ul>
        </div>
      </div>

      {selectedRoom && selectedRoomArea && (
        <div className="property-group">
          <h3>選択中の部屋 (Selected)</h3>
          <label style={{ display: 'block', marginBottom: '5px' }}>種類 (Type):</label>
          <select
            value={selectedRoom.type || 'western'}
            onChange={(e) => {
              setRooms(rooms.map(r => r.id === selectedRoom.id ? { ...r, type: e.target.value } : r));
            }}
            style={{ width: '100%', marginBottom: '10px', padding: '5px' }}
          >
            {ROOM_TYPES.map(type => (
              <option key={type.id} value={type.id}>{type.label}</option>
            ))}
          </select>
          <p>面積 (Area):</p>
          <ul>
            <li>{selectedRoomArea.tatami.toFixed(2)} 畳 (Jō)</li>
            <li>{selectedRoomArea.tsubo.toFixed(2)} 坪 (Tsubo)</li>
            <li>{selectedRoomArea.sqm.toFixed(2)} m²</li>
          </ul>
          <button
            className="delete-btn"
            onClick={() => {
              setRooms(rooms.filter(r => r.id !== selectedRoom.id));
              setSelectedRoomId(null);
            }}
          >
            削除 (Delete)
          </button>
        </div>
      )}

      {selectedWall && (
        <div className="property-group">
          <h3>選択中の壁 (Selected Wall)</h3>
          <p>ID: {selectedWall.id}</p>
          <button
            className="delete-btn"
            onClick={() => {
              setWalls(walls.filter(w => w.id !== selectedWall.id));
              setSelectedWallId(null);
            }}
          >
            削除 (Delete)
          </button>
        </div>
      )}

      {selectedObject && (
        <div className="property-group">
          <h3>選択中の設備 (Selected Object)</h3>
          <p>Type: {OBJECT_TYPES.find(t => t.id === selectedObject.type)?.label}</p>

          <label style={{ display: 'block', marginTop: '10px', marginBottom: '5px' }}>
            幅 (Width): {selectedObject.width} mm
          </label>
          <input
            type="number"
            min="100"
            max="5000"
            step="10"
            value={selectedObject.width}
            onChange={(e) => {
              const newWidth = parseInt(e.target.value) || selectedObject.width;
              setObjects(objects.map(o =>
                o.id === selectedObject.id ? { ...o, width: newWidth } : o
              ));
            }}
            style={{ width: '100%', padding: '5px', marginBottom: '10px' }}
          />

          <label style={{ display: 'block', marginBottom: '5px' }}>
            高さ (Height): {selectedObject.height} mm
          </label>
          <input
            type="number"
            min="100"
            max="5000"
            step="10"
            value={selectedObject.height}
            onChange={(e) => {
              const newHeight = parseInt(e.target.value) || selectedObject.height;
              setObjects(objects.map(o =>
                o.id === selectedObject.id ? { ...o, height: newHeight } : o
              ));
            }}
            style={{ width: '100%', padding: '5px', marginBottom: '10px' }}
          />

          <label style={{ display: 'block', marginBottom: '5px' }}>
            回転 (Rotation): {selectedObject.rotation}°
          </label>
          <input
            type="number"
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
            style={{ width: '100%', padding: '5px', marginBottom: '10px' }}
          />

          <button
            className="delete-btn"
            onClick={() => {
              setObjects(objects.filter(o => o.id !== selectedObject.id));
              setSelectedObjectId(null);
            }}
          >
            削除 (Delete)
          </button>
        </div>
      )}
    </aside>
  );
}

export default PropertiesPanel;

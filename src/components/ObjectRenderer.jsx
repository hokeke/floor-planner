import React from 'react';
import { OBJECT_TYPES } from '../constants';
import { mmToPx } from '../utils/units';
import Door from './objects/Door';
import Window from './objects/Window';
import FixWindow from './objects/FixWindow';
import Toilet from './objects/Toilet';
import Bath from './objects/Bath';
import WashBasin from './objects/WashBasin';
import Bed from './objects/Bed';
import Sofa from './objects/Sofa';
import Kitchen from './objects/Kitchen';
import WashingMachine from './objects/WashingMachine';
import TvStand from './objects/TvStand';
import Tv from './objects/Tv';
import Table from './objects/Table';
import Refrigerator from './objects/Refrigerator';

const ObjectRenderer = ({ obj, isSelected, scale, onHandleMouseDown, onObjectMouseDown }) => {
  const { x, y, width, height, rotation, type, flipX } = obj;

  // Convert mm to px
  const xPx = mmToPx(x);
  const yPx = mmToPx(y);
  const widthPx = mmToPx(width);
  const heightPx = mmToPx(height);

  const renderObjectContent = () => {
    switch (type) {
      case 'door':
        return <Door width={widthPx} height={heightPx} scale={scale} />;
      case 'window':
        return <Window width={widthPx} height={heightPx} scale={scale} />;
      case 'fix_window':
        return <FixWindow width={widthPx} height={heightPx} scale={scale} />;
      case 'toilet':
        return <Toilet width={widthPx} height={heightPx} scale={scale} />;
      case 'bath':
        return <Bath width={widthPx} height={heightPx} scale={scale} />;
      case 'wash_basin':
        return <WashBasin width={widthPx} height={heightPx} scale={scale} />;
      case 'bed':
        return <Bed width={widthPx} height={heightPx} scale={scale} />;
      case 'sofa':
        return <Sofa width={widthPx} height={heightPx} scale={scale} />;
      case 'kitchen':
        return <Kitchen width={widthPx} height={heightPx} scale={scale} />;
      case 'washing_machine':
        return <WashingMachine width={widthPx} height={heightPx} scale={scale} />;
      case 'tv_stand':
        return <TvStand width={widthPx} height={heightPx} scale={scale} />;
      case 'tv':
        return <Tv width={widthPx} height={heightPx} scale={scale} />;
      case 'table':
        return <Table width={widthPx} height={heightPx} scale={scale} />;
      case 'refrigerator':
        return <Refrigerator width={widthPx} height={heightPx} scale={scale} />;
      case 'custom':
        if (obj.points) {
          const pointsStr = obj.points.map(p => `${mmToPx(p.x)},${mmToPx(p.y)}`).join(' ');
          return (
            <polygon
              points={pointsStr}
              fill="#e0e0e0"
              stroke="#666"
              strokeWidth="2"
            />
          );
        }
        return null;
      default:
        return (
          <rect
            x={-widthPx / 2}
            y={-heightPx / 2}
            width={widthPx}
            height={heightPx}
            fill="#e0e0e0"
            stroke="#757575"
            strokeWidth="2"
          />
        );
    }
  };

  return (
    <g
      transform={`translate(${xPx}, ${yPx}) rotate(${rotation}) scale(${flipX ? -1 : 1}, 1)`}
      onMouseDown={(e) => {
        // Stop propagation to prevent canvas from handling the click (which might deselect)
        e.stopPropagation();
        if (onObjectMouseDown) {
          onObjectMouseDown(e, obj.id);
        }
      }}
      style={{ cursor: 'move' }}
    >
      {renderObjectContent()}
      {isSelected && (
        <g>
          <rect x={-widthPx / 2 - 5} y={-heightPx / 2 - 5} width={widthPx + 10} height={heightPx + 10} fill="none" stroke="blue" strokeWidth={2 / scale} strokeDasharray="5,5" />
          {/* Rotation Handle */}
          <line x1={0} y1={-heightPx / 2} x2={0} y2={-heightPx / 2 - 30 / scale} stroke="blue" strokeWidth={1 / scale} />
          <circle
            cx={0} cy={-heightPx / 2 - 30 / scale} r={5 / scale} fill="white" stroke="blue" strokeWidth={1 / scale}
            style={{ cursor: 'grab', pointerEvents: 'all' }}
            onMouseDown={(e) => { e.stopPropagation(); onHandleMouseDown(e, 'rotate'); }}
          />
          {/* Resize Handles (Corners) */}
          <rect x={-widthPx / 2 - 10 / scale} y={-heightPx / 2 - 10 / scale} width={20 / scale} height={20 / scale} fill="white" stroke="blue" strokeWidth={1 / scale} style={{ cursor: 'nwse-resize', pointerEvents: 'all' }} onMouseDown={(e) => { e.stopPropagation(); onHandleMouseDown(e, 'resize', 'tl'); }} />
          <rect x={widthPx / 2 - 10 / scale} y={-heightPx / 2 - 10 / scale} width={20 / scale} height={20 / scale} fill="white" stroke="blue" strokeWidth={1 / scale} style={{ cursor: 'nesw-resize', pointerEvents: 'all' }} onMouseDown={(e) => { e.stopPropagation(); onHandleMouseDown(e, 'resize', 'tr'); }} />
          <rect x={widthPx / 2 - 10 / scale} y={heightPx / 2 - 10 / scale} width={20 / scale} height={20 / scale} fill="white" stroke="blue" strokeWidth={1 / scale} style={{ cursor: 'nwse-resize', pointerEvents: 'all' }} onMouseDown={(e) => { e.stopPropagation(); onHandleMouseDown(e, 'resize', 'br'); }} />
          <rect x={-widthPx / 2 - 10 / scale} y={heightPx / 2 - 10 / scale} width={20 / scale} height={20 / scale} fill="white" stroke="blue" strokeWidth={1 / scale} style={{ cursor: 'nesw-resize', pointerEvents: 'all' }} onMouseDown={(e) => { e.stopPropagation(); onHandleMouseDown(e, 'resize', 'bl'); }} />
        </g>
      )}
    </g>
  );
};

export default ObjectRenderer;

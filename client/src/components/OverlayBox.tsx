import React from 'react';
import { Rnd } from 'react-rnd';
import type { FormField } from '../types/api';

interface OverlayBoxProps {
  item: FormField;
  bounds: { width: number; height: number };
  onPositionChange: (id: string, x: number, y: number) => void;
  onSizeChange: (id: string, width: number, height: number) => void;
  isHighlighted?: boolean;
}

const OverlayBox: React.FC<OverlayBoxProps> = ({
  item,
  bounds,
  onPositionChange,
  onSizeChange,
  isHighlighted = false,
}) => {
  const boundingBox = item.bounding_box;

  // Convert PDF coordinates to DOM coordinates
  const x = boundingBox.x_min * bounds.width;
  const y = (1 - boundingBox.y_max) * bounds.height; // Invert Y coordinate
  const width = (boundingBox.x_max - boundingBox.x_min) * bounds.width;
  const height = (boundingBox.y_max - boundingBox.y_min) * bounds.height;

  const label = item.name;

  // Create unique ID for the item
  const itemId = `field-${item.name}`;

  const handleDragStop = (e: any, data: any) => {
    console.log('Drag stopped for', itemId, 'new position:', data.x, data.y);
    onPositionChange(itemId, data.x, data.y);
  };

  const handleDragStart = (e: any, data: any) => {
    console.log('Drag started for', itemId);
  };

  const handleResizeStop = (e: any, direction: any, ref: any, delta: any, position: any) => {
    console.log('Resize stopped for', itemId, 'new size:', ref.offsetWidth, ref.offsetHeight);
    onSizeChange(itemId, ref.offsetWidth, ref.offsetHeight);
    onPositionChange(itemId, position.x, position.y);
  };

  return (
    <Rnd
      size={{ width, height }}
      position={{ x, y }}
      onDragStart={handleDragStart}
      onDragStop={handleDragStop}
      onResizeStop={handleResizeStop}
      bounds="parent"
      minWidth={20}
      minHeight={20}
      enableResizing={{
        top: false,
        right: false,
        bottom: false,
        left: false,
        topRight: true,
        bottomRight: true,
        bottomLeft: true,
        topLeft: true,
      }}
      resizeHandleStyles={{
        topLeft: {
          width: '6px',
          height: '6px',
          backgroundColor: '#3b82f6',
          border: '1px solid white',
          borderRadius: '50%',
          position: 'absolute',
          top: '-3px',
          left: '-3px',
          cursor: 'nw-resize',
        },
        topRight: {
          width: '6px',
          height: '6px',
          backgroundColor: '#3b82f6',
          border: '1px solid white',
          borderRadius: '50%',
          position: 'absolute',
          top: '-3px',
          right: '-3px',
          cursor: 'ne-resize',
        },
        bottomLeft: {
          width: '6px',
          height: '6px',
          backgroundColor: '#3b82f6',
          border: '1px solid white',
          borderRadius: '50%',
          position: 'absolute',
          bottom: '-3px',
          left: '-3px',
          cursor: 'sw-resize',
        },
        bottomRight: {
          width: '6px',
          height: '6px',
          backgroundColor: '#3b82f6',
          border: '1px solid white',
          borderRadius: '50%',
          position: 'absolute',
          bottom: '-3px',
          right: '-3px',
          cursor: 'se-resize',
        },
      }}
      style={{
        pointerEvents: 'auto',
        zIndex: 10,
      }}
      className={`
        border-2 border-blue-500 bg-blue-500/20
        ${isHighlighted ? 'ring-4 ring-yellow-400 ring-opacity-75' : ''}
        transition-all duration-200
        cursor-move
      `}
    >
      <div className="absolute top-0 left-0 transform -translate-y-full pointer-events-none">
        <span className="text-xs px-1 py-0.5 rounded text-white font-medium whitespace-nowrap bg-blue-600">
          {label}
        </span>
      </div>
    </Rnd>
  );
};

export default OverlayBox; 
import React, { useState, useRef, useCallback } from 'react';
import type { Field, PageDimension } from '../types/api';

interface OverlayBoxProps {
  field: Field;
  pageDimensions?: PageDimension;
  onClick?: () => void;
  isSelected?: boolean;
  isHovered?: boolean;
  onPositionChange?: (fieldId: string, newPosition: { x: number; y: number; width: number; height: number }) => void;
  onClose?: (fieldId: string) => void;
}

const OverlayBox: React.FC<OverlayBoxProps> = ({ 
  field, 
  pageDimensions, 
  onClick, 
  isSelected = false,
  isHovered = false,
  onPositionChange,
  onClose 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState({
    x: field.bounding_box.x_min * 100,
    y: field.bounding_box.y_min * 100,
    width: (field.bounding_box.x_max - field.bounding_box.x_min) * 100,
    height: (field.bounding_box.y_max - field.bounding_box.y_min) * 100
  });
  
  const overlayRef = useRef<HTMLDivElement>(null);

  const getFieldTypeStyle = () => {
    const baseStyle = "absolute border-2 overflow-hidden";
    const interactionStyle = isDragging ? "cursor-grabbing" : isResizing ? "cursor-se-resize" : "cursor-grab";
    const transitionStyle = (isDragging || isResizing) ? "" : "transition-all duration-200";
    const hoverStyle = "hover:shadow-lg";
    
    let colorStyle = "";
    switch (field.type) {
      case 'label':
        if (isHovered && !isSelected) {
          colorStyle = "border-blue-600 bg-blue-200 shadow-md";
        } else {
          colorStyle = "border-blue-500 bg-blue-100 hover:bg-blue-200";
        }
        break;
      case 'text_input':
        if (isHovered && !isSelected) {
          colorStyle = "border-green-600 bg-green-200 shadow-md";
        } else {
          colorStyle = "border-green-500 bg-green-100 hover:bg-green-200";
        }
        break;
      case 'checkbox':
        if (isHovered && !isSelected) {
          colorStyle = "border-orange-600 bg-orange-200 shadow-md";
        } else {
          colorStyle = "border-orange-500 bg-orange-100 hover:bg-orange-200";
        }
        break;
      default:
        if (isHovered && !isSelected) {
          colorStyle = "border-gray-600 bg-gray-200 shadow-md";
        } else {
          colorStyle = "border-gray-500 bg-gray-100 hover:bg-gray-200";
        }
    }
    
    return `${baseStyle} ${interactionStyle} ${transitionStyle} ${hoverStyle} ${colorStyle}`;
  };

  const getSelectedStyle = () => {
    if (isSelected) {
      return "ring-4 ring-blue-300 shadow-xl z-[1003]";
    } else if (isHovered) {
      return "ring-2 ring-yellow-300 shadow-lg z-[1003] scale-105";
    } else {
      return "z-[1002]";
    }
  };

  const getFieldTypeLabel = () => {
    switch (field.type) {
      case 'label': return 'Label';
      case 'text_input': return 'Text Input';
      case 'checkbox': return 'Checkbox';
      default: return 'Field';
    }
  };

  const getFieldInputType = () => {
    if (field.form_field_info?.field_type) {
      return field.form_field_info.field_type.charAt(0).toUpperCase() + 
             field.form_field_info.field_type.slice(1);
    }
    return null;
  };

  // Calculate expanded dimensions for better visibility
  const rawWidth = position.width;
  const rawHeight = position.height;
  
  const minWidth = Math.max(rawWidth, 1);
  const minHeight = Math.max(rawHeight, 0.5);
  
  // Always use actual dimensions - remove the expansion logic that was interfering with resize
  const expandedWidth = rawWidth;
  const expandedHeight = rawHeight;

  // Mouse event handlers for dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    console.log('Mouse down on overlay', field.id);
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    setLastMousePos({ x: e.clientX, y: e.clientY });
    
    onClick?.();
  }, [onClick, field.id]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const parent = overlayRef.current?.parentElement;
    if (!parent) return;
    
    const parentRect = parent.getBoundingClientRect();
    
    // Calculate how much the mouse moved since last time
    const deltaX = e.clientX - lastMousePos.x;
    const deltaY = e.clientY - lastMousePos.y;
    
    // Convert pixel movement to percentage of parent container
    const deltaXPercent = (deltaX / parentRect.width) * 100;
    const deltaYPercent = (deltaY / parentRect.height) * 100;
    
    if (isDragging) {
      // Move the overlay by the mouse delta
      setPosition(prev => {
        const newX = Math.max(0, Math.min(95, prev.x + deltaXPercent));
        const newY = Math.max(0, Math.min(95, prev.y + deltaYPercent));
        
        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
          console.log(`Drag [${field.id}]: ${newX.toFixed(1)}%, ${newY.toFixed(1)}%`);
        }
        
        return { ...prev, x: newX, y: newY };
      });
    }
    
    if (isResizing) {
      // Resize the overlay by the mouse delta
      setPosition(prev => {
        const newWidth = Math.max(1, Math.min(50, prev.width + deltaXPercent));
        const newHeight = Math.max(0.5, Math.min(50, prev.height + deltaYPercent));
        
        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
          console.log(`Resize [${field.id}]:`, {
            deltaY: deltaY.toFixed(0),
            prevHeight: prev.height.toFixed(1),
            newHeight: newHeight.toFixed(1),
            size: `${newWidth.toFixed(1)}% x ${newHeight.toFixed(1)}%`
          });
        }
        
        return { ...prev, width: newWidth, height: newHeight };
      });
    }
    
    // Update mouse position for next movement
    setLastMousePos({ x: e.clientX, y: e.clientY });
  }, [isDragging, isResizing, lastMousePos, field.id]);

  const handleMouseUp = useCallback(() => {
    if (isDragging || isResizing) {
      setIsDragging(false);
      setIsResizing(false);
      
      // Notify parent of position change
      onPositionChange?.(field.id, {
        x: position.x / 100,
        y: position.y / 100,
        width: position.width / 100,
        height: position.height / 100
      });
    }
  }, [isDragging, isResizing, position, field.id, onPositionChange]);

  // Resize handle mouse down
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    console.log('Resize handle clicked for', field.id);
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    setIsDragging(false);
    setLastMousePos({ x: e.clientX, y: e.clientY });
  }, [field.id]);

  const handleCloseClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClose?.(field.id);
  }, [onClose, field.id]);

  // Add global mouse event listeners
  React.useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  // Get dynamic font size based on overlay dimensions
  const getDynamicFontSize = () => {
    // Base font size calculation on both width and height
    const area = expandedWidth * expandedHeight;
    const minDimension = Math.min(expandedWidth, expandedHeight);
    
    // Balanced font sizes - in between original and larger
    if (area > 300 && minDimension > 10) return '15px';
    if (area > 200 && minDimension > 8) return '13px';
    if (area > 100 && minDimension > 6) return '11px';
    if (area > 50 && minDimension > 4) return '10px';
    if (area > 30 && minDimension > 3) return '9px';
    if (area > 20 && minDimension > 2) return '8px';
    if (area > 12 && minDimension > 1.5) return '7px';
    if (area > 6 && minDimension > 1) return '6px';
    
    // Very small overlays
    return '5px';
  };

  // Calculate line height based on font size
  const getLineHeight = () => {
    const fontSize = getDynamicFontSize();
    const sizeValue = parseInt(fontSize);
    
    // Tighter line height for better text fitting
    if (sizeValue >= 12) return '1.2';
    if (sizeValue >= 8) return '1.1';
    return '1.0';
  };

  // Get text that fits within the overlay dimensions
  const getDisplayText = () => {
    const text = field.text.trim();
    
    // For very small overlays, show abbreviated text
    if (expandedWidth < 2 || expandedHeight < 1) {
      return text.substring(0, 2);
    }
    
    // For small overlays, limit text length but allow wrapping
    if (expandedWidth < 4 && expandedHeight < 2) {
      return text.length > 10 ? text.substring(0, 8) + '...' : text;
    }
    
    // For medium and large overlays, show full text
    return text;
  };

  const style = {
    left: `${position.x}%`,
    top: `${position.y}%`,
    width: `${expandedWidth}%`,
    height: `${expandedHeight}%`,
    minWidth: `${minWidth}%`,
    minHeight: `${minHeight}%`,
    userSelect: 'none' as const,
  };

  return (
    <div
      ref={overlayRef}
      className={`${getFieldTypeStyle()} ${getSelectedStyle()}`}
      style={style}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => field.type === 'checkbox' && setShowTooltip(true)}
      onMouseLeave={() => field.type === 'checkbox' && setShowTooltip(false)}
      title={field.type !== 'checkbox' ? `${getFieldTypeLabel()}: ${field.text} (Page ${field.page}) - Size: ${rawWidth.toFixed(1)}% x ${rawHeight.toFixed(1)}%` : undefined}
    >
      {/* Field type indicator - show for selected fields or larger fields */}
      {(isSelected || expandedWidth > 15) && (
        <div className="absolute -top-6 left-0 flex items-center space-x-1 pointer-events-none">
          <span className="text-xs font-bold px-2 py-1 rounded-t bg-white border border-gray-300 shadow-sm whitespace-nowrap">
            {getFieldTypeLabel()}
          </span>
          {getFieldInputType() && (
            <span className="text-xs px-2 py-1 rounded-t bg-gray-100 border border-gray-300 shadow-sm whitespace-nowrap">
              {getFieldInputType()}
            </span>
          )}
        </div>
      )}
      
      {/* Field content - multi-line responsive text */}
      <div 
        className={`w-full h-full flex items-center justify-center text-gray-800 text-center drag-handle`}
        style={{
          fontSize: getDynamicFontSize(),
          lineHeight: getLineHeight(),
          padding: '0px',
          fontWeight: '500',
          wordWrap: 'break-word',
          wordBreak: 'break-word',
          hyphens: 'auto',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ 
          maxWidth: '100%', 
          maxHeight: '100%',
          overflow: 'hidden',
          textAlign: 'center',
        }}>
          {getDisplayText()}
        </span>
      </div>
      
      {/* Resize handle - only show when selected */}
      {isSelected && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 border-2 border-white cursor-se-resize hover:bg-blue-600 z-[1004]"
          onMouseDown={handleResizeMouseDown}
          style={{
            borderRadius: '0 0 4px 0',
            transform: 'translate(50%, 50%)',
          }}
          title="Drag to resize"
        />
      )}
      
      {/* Field ID for debugging - only show when selected */}
      {isSelected && (
        <div className="absolute -bottom-8 left-0 text-xs text-gray-500 bg-white px-1 rounded whitespace-nowrap pointer-events-none">
          <div>{field.id} ({rawWidth.toFixed(1)}% x {rawHeight.toFixed(1)}%)</div>
          <div className="text-blue-600">Pos: ({position.x.toFixed(1)}%, {position.y.toFixed(1)}%)</div>
        </div>
      )}
      
      {/* Debug: Show coordinates on hover for small fields */}
      {!isSelected && expandedWidth < 10 && (
        <div className="absolute top-0 right-0 opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
          <div className="text-xs bg-black text-white px-1 rounded whitespace-nowrap">
            {(position.x).toFixed(1)},{(position.y).toFixed(1)}
          </div>
        </div>
      )}
      
      {/* Checkbox hover tooltip */}
      {field.type === 'checkbox' && showTooltip && field.text && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 z-[1005] pointer-events-none">
          <div className="bg-black text-white text-xs px-2 py-1 rounded whitespace-nowrap max-w-xs">
            {field.text}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black"></div>
          </div>
        </div>
      )}

    </div>
  );
};

export default OverlayBox; 
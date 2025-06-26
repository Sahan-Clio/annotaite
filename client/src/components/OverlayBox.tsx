import React from 'react';
import type { Field, PageDimension } from '../types/api';

interface OverlayBoxProps {
  field: Field;
  pageDimensions?: PageDimension;
  onClick?: () => void;
  isSelected?: boolean;
}

const OverlayBox: React.FC<OverlayBoxProps> = ({ field, pageDimensions, onClick, isSelected = false }) => {
  const getFieldTypeStyle = () => {
    const baseStyle = "absolute border-2 transition-all duration-200 hover:shadow-lg cursor-pointer overflow-hidden";
    
    switch (field.type) {
      case 'form_field_label':
        return `${baseStyle} border-blue-500 bg-blue-100 hover:bg-blue-200`;
      case 'form_field_input':
        return `${baseStyle} border-green-500 bg-green-100 hover:bg-green-200`;
      case 'section_header':
        return `${baseStyle} border-purple-500 bg-purple-100 hover:bg-purple-200`;
      case 'instruction_text':
        return `${baseStyle} border-yellow-500 bg-yellow-100 hover:bg-yellow-200`;
      case 'checkbox':
        return `${baseStyle} border-orange-500 bg-orange-100 hover:bg-orange-200`;
      case 'signature_area':
        return `${baseStyle} border-red-500 bg-red-100 hover:bg-red-200`;
      default:
        return `${baseStyle} border-gray-500 bg-gray-100 hover:bg-gray-200`;
    }
  };

  const getSelectedStyle = () => {
    return isSelected ? "ring-4 ring-blue-300 shadow-xl z-20" : "z-10";
  };

  const getFieldTypeLabel = () => {
    switch (field.type) {
      case 'form_field_label': return 'Label';
      case 'form_field_input': return 'Input';
      case 'section_header': return 'Header';
      case 'instruction_text': return 'Instructions';
      case 'checkbox': return 'Checkbox';
      case 'signature_area': return 'Signature';
      case 'static_text': return 'Text';
      default: return 'Text';
    }
  };

  const getFieldInputType = () => {
    if (field.form_field_info?.field_type) {
      return field.form_field_info.field_type.charAt(0).toUpperCase() + 
             field.form_field_info.field_type.slice(1);
    }
    return null;
  };

  // Calculate position within the page container
  // The bounding box coordinates are normalized (0-1) relative to the page
  const rawWidth = (field.bounding_box.x_max - field.bounding_box.x_min) * 100;
  const rawHeight = (field.bounding_box.y_max - field.bounding_box.y_min) * 100;
  
  // Ensure minimum visibility - make small boxes larger
  const minWidth = Math.max(rawWidth, 2); // At least 2% of page width
  const minHeight = Math.max(rawHeight, 1); // At least 1% of page height
  
  // For very small elements, expand them slightly for better visibility
  const expandedWidth = rawWidth < 5 ? Math.max(rawWidth * 1.5, 3) : rawWidth;
  const expandedHeight = rawHeight < 2 ? Math.max(rawHeight * 2, 1.5) : rawHeight;

  const style = {
    left: `${field.bounding_box.x_min * 100}%`,
    top: `${field.bounding_box.y_min * 100}%`,
    width: `${expandedWidth}%`,
    height: `${expandedHeight}%`,
    minWidth: `${minWidth}%`,
    minHeight: `${minHeight}%`,
  };

  // Determine appropriate font size based on box dimensions
  const getFontSize = () => {
    if (expandedWidth > 25 && expandedHeight > 5) return 'text-xs'; // Very large boxes
    if (expandedWidth > 15 && expandedHeight > 3) return 'text-xs'; // Large boxes
    if (expandedWidth > 8 && expandedHeight > 2) return 'text-xs'; // Medium boxes
    if (expandedWidth > 4 && expandedHeight > 1.2) return 'text-xs'; // Small boxes
    return 'text-xs'; // Very small boxes - use smallest available
  };

  // Get custom font size for very small boxes
  const getCustomFontSize = () => {
    if (expandedWidth > 20 && expandedHeight > 4) return '8px'; // Large boxes
    if (expandedWidth > 12 && expandedHeight > 2.5) return '7px'; // Medium boxes
    if (expandedWidth > 6 && expandedHeight > 1.5) return '6px'; // Small boxes
    if (expandedWidth > 3 && expandedHeight > 1) return '5px'; // Very small boxes
    return '4px'; // Tiny boxes
  };

  // Calculate how much text can fit in a single line
  const getDisplayText = () => {
    const text = field.text.trim();
    
    // Estimate characters that fit based on box width and font size
    // Very rough approximation: 1% width ≈ 1-2 characters depending on font size
    let maxChars;
    
    if (expandedWidth > 25) {
      maxChars = Math.floor(expandedWidth * 1.8); // ~45 chars for 25% width
    } else if (expandedWidth > 15) {
      maxChars = Math.floor(expandedWidth * 1.5); // ~22 chars for 15% width
    } else if (expandedWidth > 8) {
      maxChars = Math.floor(expandedWidth * 1.2); // ~10 chars for 8% width
    } else if (expandedWidth > 4) {
      maxChars = Math.floor(expandedWidth * 1.0); // ~4 chars for 4% width
    } else if (expandedWidth > 2) {
      maxChars = Math.floor(expandedWidth * 0.8); // ~2 chars for 2% width
    } else {
      maxChars = 1; // Just 1 character for very tiny boxes
    }
    
    // Ensure minimum of 1 character
    maxChars = Math.max(1, maxChars);
    
    if (text.length <= maxChars) {
      return text;
    }
    
    // For longer text, truncate and add ellipsis only if there's room
    if (maxChars > 3) {
      return `${text.substring(0, maxChars - 3)}...`;
    } else if (maxChars > 1) {
      return `${text.substring(0, maxChars - 1)}…`;
    } else {
      return text.substring(0, 1);
    }
  };

  return (
    <div
      className={`${getFieldTypeStyle()} ${getSelectedStyle()}`}
      style={style}
      onClick={onClick}
      title={`${getFieldTypeLabel()}: ${field.text} (Page ${field.page}) - Size: ${rawWidth.toFixed(1)}% x ${rawHeight.toFixed(1)}%`}
    >
      {/* Field type indicator - show for selected fields or larger fields */}
      {(isSelected || expandedWidth > 15) && (
        <div className="absolute -top-6 left-0 flex items-center space-x-1">
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
      
      {/* Field content - single line only */}
      <div 
        className={`w-full h-full flex items-center justify-center text-gray-800 text-center`}
        style={{
          fontSize: getCustomFontSize(),
          padding: '0.5px',
          lineHeight: '1',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontWeight: '500',
        }}
      >
        {getDisplayText()}
      </div>
      
      {/* Field ID for debugging - only show when selected */}
      {isSelected && (
        <div className="absolute -bottom-4 left-0 text-xs text-gray-500 bg-white px-1 rounded whitespace-nowrap">
          {field.id} ({rawWidth.toFixed(1)}% x {rawHeight.toFixed(1)}%)
        </div>
      )}
      
      {/* Debug: Show coordinates on hover for small fields */}
      {!isSelected && expandedWidth < 10 && (
        <div className="absolute top-0 right-0 opacity-0 hover:opacity-100 transition-opacity">
          <div className="text-xs bg-black text-white px-1 rounded whitespace-nowrap">
            {(field.bounding_box.x_min * 100).toFixed(1)},{(field.bounding_box.y_min * 100).toFixed(1)}
          </div>
        </div>
      )}
    </div>
  );
};

export default OverlayBox; 
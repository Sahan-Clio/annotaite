import React from 'react';
import type { Field } from '../types/api';

interface OverlayBoxProps {
  field: Field;
  onClick?: () => void;
  isSelected?: boolean;
}

const OverlayBox: React.FC<OverlayBoxProps> = ({ field, onClick, isSelected = false }) => {
  const getFieldTypeStyle = () => {
    const baseStyle = "absolute border-2 transition-all duration-200 hover:shadow-lg cursor-pointer";
    
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
    return isSelected ? "ring-4 ring-blue-300 shadow-xl" : "";
  };

  const getFieldTypeLabel = () => {
    switch (field.type) {
      case 'form_field_label': return 'Label';
      case 'form_field_input': return 'Input';
      case 'section_header': return 'Header';
      case 'instruction_text': return 'Instructions';
      case 'checkbox': return 'Checkbox';
      case 'signature_area': return 'Signature';
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

  const style = {
    left: `${field.bounding_box.x_min * 100}%`,
    top: `${field.bounding_box.y_min * 100}%`,
    width: `${(field.bounding_box.x_max - field.bounding_box.x_min) * 100}%`,
    height: `${(field.bounding_box.y_max - field.bounding_box.y_min) * 100}%`,
  };

  return (
    <div
      className={`${getFieldTypeStyle()} ${getSelectedStyle()}`}
      style={style}
      onClick={onClick}
      title={`${getFieldTypeLabel()}: ${field.text}`}
    >
      {/* Field type indicator */}
      <div className="absolute -top-6 left-0 flex items-center space-x-1">
        <span className="text-xs font-bold px-2 py-1 rounded-t bg-white border border-gray-300 shadow-sm">
          {getFieldTypeLabel()}
        </span>
        {getFieldInputType() && (
          <span className="text-xs px-2 py-1 rounded-t bg-gray-100 border border-gray-300 shadow-sm">
            {getFieldInputType()}
          </span>
        )}
      </div>
      
      {/* Field content preview */}
      <div className="p-1 text-xs font-medium text-gray-800 overflow-hidden">
        {field.text.length > 50 ? `${field.text.substring(0, 50)}...` : field.text}
      </div>
      
      {/* Field ID for debugging */}
      <div className="absolute -bottom-4 left-0 text-xs text-gray-500 bg-white px-1 rounded">
        {field.id}
      </div>
    </div>
  );
};

export default OverlayBox; 
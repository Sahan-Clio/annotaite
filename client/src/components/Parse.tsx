import React, { useState, useEffect } from 'react';
import { parseDocument } from '../api/parseApi';
import { PdfViewer } from './PdfViewer';
import OverlayBox from './OverlayBox';
import type { ParseResponse, Field, FieldType } from '../types/api';

const Parse: React.FC = () => {
  const [parseData, setParseData] = useState<ParseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [visibleFieldTypes, setVisibleFieldTypes] = useState<Set<FieldType>>(new Set([
    'form_field_label',
    'form_field_input',
    'section_header',
    'instruction_text',
    'checkbox',
    'signature_area',
    'static_text'
  ]));

  const fieldTypeColors = {
    form_field_label: { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-800' },
    form_field_input: { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-800' },
    section_header: { bg: 'bg-purple-100', border: 'border-purple-500', text: 'text-purple-800' },
    instruction_text: { bg: 'bg-yellow-100', border: 'border-yellow-500', text: 'text-yellow-800' },
    checkbox: { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-800' },
    signature_area: { bg: 'bg-red-100', border: 'border-red-500', text: 'text-red-800' },
    static_text: { bg: 'bg-gray-100', border: 'border-gray-500', text: 'text-gray-800' }
  };

  useEffect(() => {
    handleParse();
  }, []);

  const handleParse = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await parseDocument();
      setParseData(data);
      console.log('Parse data received:', data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse document');
      console.error('Parse error:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFieldType = (fieldType: FieldType) => {
    const newVisibleTypes = new Set(visibleFieldTypes);
    if (newVisibleTypes.has(fieldType)) {
      newVisibleTypes.delete(fieldType);
    } else {
      newVisibleTypes.add(fieldType);
    }
    setVisibleFieldTypes(newVisibleTypes);
  };

  const getFieldTypeCount = (fieldType: FieldType) => {
    return parseData?.fields.filter(field => field.type === fieldType).length || 0;
  };

  const getVisibleFields = () => {
    if (!parseData) return [];
    return parseData.fields.filter(field => visibleFieldTypes.has(field.type));
  };

  const getFieldTypeLabel = (fieldType: FieldType) => {
    switch (fieldType) {
      case 'form_field_label': return 'Labels';
      case 'form_field_input': return 'Inputs';
      case 'section_header': return 'Headers';
      case 'instruction_text': return 'Instructions';
      case 'checkbox': return 'Checkboxes';
      case 'signature_area': return 'Signatures';
      case 'static_text': return 'Static Text';
      default: return fieldType;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Parsing document with Google Document AI...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-8 bg-red-50 rounded-lg max-w-md">
          <div className="text-red-600 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-red-800 mb-2">Parsing Failed</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={handleParse}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!parseData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">No data available</p>
      </div>
    );
  }

  const visibleFields = getVisibleFields();

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white shadow-lg border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-800">Document Analysis</h2>
            <button
              onClick={handleParse}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>
          <div className="text-sm text-gray-600">
            <p>{parseData.document_info.total_pages} pages • {parseData.fields.length} fields total</p>
            <p>{visibleFields.length} fields visible</p>
          </div>
        </div>

        {/* Field Type Filters */}
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Field Types</h3>
          <div className="space-y-2">
            {Object.keys(fieldTypeColors).map((fieldType) => {
              const typedFieldType = fieldType as FieldType;
              const count = getFieldTypeCount(typedFieldType);
              const colors = fieldTypeColors[typedFieldType];
              const isVisible = visibleFieldTypes.has(typedFieldType);
              
              return (
                <label key={fieldType} className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={isVisible}
                    onChange={() => toggleFieldType(typedFieldType)}
                    className="mr-3"
                  />
                  <div className={`w-4 h-4 rounded border-2 ${colors.border} ${colors.bg} mr-2`}></div>
                  <span className="text-sm text-gray-700 group-hover:text-gray-900 flex-1">
                    {getFieldTypeLabel(typedFieldType)}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">({count})</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Selected Field Info */}
        {selectedField && (
          <div className="p-4 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Selected Field</h3>
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-gray-600">Type:</span>
                <span className={`ml-2 px-2 py-1 rounded text-xs ${fieldTypeColors[selectedField.type]?.bg} ${fieldTypeColors[selectedField.type]?.text}`}>
                  {getFieldTypeLabel(selectedField.type)}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-600">Text:</span>
                <p className="mt-1 text-gray-800 break-words">{selectedField.text}</p>
              </div>
              <div>
                <span className="font-medium text-gray-600">Page:</span>
                <span className="ml-2 text-gray-800">{selectedField.page}</span>
              </div>
              <div>
                <span className="font-medium text-gray-600">ID:</span>
                <span className="ml-2 text-gray-500 font-mono text-xs">{selectedField.id}</span>
              </div>
              {selectedField.form_field_info && (
                <div>
                  <span className="font-medium text-gray-600">Input Type:</span>
                  <span className="ml-2 text-gray-800">{selectedField.form_field_info.field_type}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Field List */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Fields ({visibleFields.length})</h3>
          <div className="space-y-2">
            {visibleFields.map((field) => {
              const colors = fieldTypeColors[field.type];
              const isSelected = selectedField?.id === field.id;
              
              return (
                <div
                  key={field.id}
                  className={`p-3 rounded border cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                      : `${colors.border} ${colors.bg} hover:shadow-md`
                  }`}
                  onClick={() => setSelectedField(field)}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className={`text-xs px-2 py-1 rounded ${colors.bg} ${colors.text} font-medium`}>
                      {getFieldTypeLabel(field.type)}
                    </span>
                    <span className="text-xs text-gray-500">Page {field.page}</span>
                  </div>
                  <p className="text-sm text-gray-800 break-words line-clamp-2">
                    {field.text}
                  </p>
                  <div className="text-xs text-gray-500 mt-1 font-mono">
                    {field.id}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 relative">
        <div className="relative w-full h-full">
          <PdfViewer fileUrl="/i-907_Jaz6iX6.pdf" />
          
          {/* Overlay container */}
          <div className="absolute inset-0 pointer-events-none">
            {visibleFields.map((field) => (
              <div key={field.id} className="pointer-events-auto">
                <OverlayBox
                  field={field}
                  onClick={() => setSelectedField(field)}
                  isSelected={selectedField?.id === field.id}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Parse; 
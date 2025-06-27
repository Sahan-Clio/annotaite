import React from 'react';
import type { FieldAssociation, Field, FieldType } from '../types/api';
import { INPUT_TYPE_COLORS } from '../constants/ui';

interface AssociationSidebarProps {
  // Data
  currentAssociations: FieldAssociation[];
  currentFields: Field[];
  
  // State
  showingAssociations: boolean;
  showingIndividualFields: boolean;
  aiAnalysisCompleted: boolean;
  isUsingAIFiltering: boolean;
  selectedAssociation: FieldAssociation | null;
  selectedField: Field | null;
  searchTerm: string;
  visibleFieldTypes: Set<FieldType>;
  visibleInputTypes: Set<'text_input' | 'checkbox'>;
  hiddenAssociations: Set<string>;
  fieldTypesOpen: boolean;
  fieldsOpen: boolean;
  
  // Handlers
  onToggleAIFiltering: () => void;
  onAIAnalyze: () => void;
  onSearchChange: (term: string) => void;
  onToggleFieldType: (inputType: 'text_input' | 'checkbox') => void;
  onToggleIndividualFieldType: (fieldType: FieldType) => void;
  onToggleAllFields: () => void;
  onAssociationSelect: (association: FieldAssociation) => void;
  onFieldSelect: (field: Field) => void;
  onScrollToAssociation: (association: FieldAssociation) => void;
  onScrollToField: (field: Field) => void;
  onToggleAssociationVisibility: (associationId: string) => void;
  onSetFieldTypesOpen: (open: boolean) => void;
  onSetFieldsOpen: (open: boolean) => void;
  
  // Utilities
  getFieldTypeCount: (fieldType: FieldType | 'text_input' | 'checkbox') => number;
  getVisibleFields: () => Field[];
  getVisibleAssociations: () => FieldAssociation[];
  getInputTypeLabel: (inputType: 'text_input' | 'checkbox') => string;
}



export const AssociationSidebar: React.FC<AssociationSidebarProps> = ({
  currentAssociations,
  currentFields,
  showingAssociations,
  showingIndividualFields,
  aiAnalysisCompleted,
  isUsingAIFiltering,
  selectedAssociation,
  selectedField,
  searchTerm,
  visibleFieldTypes,
  visibleInputTypes,
  hiddenAssociations,
  fieldTypesOpen,
  fieldsOpen,
  onToggleAIFiltering,
  onAIAnalyze,
  onSearchChange,
  onToggleFieldType,
  onToggleIndividualFieldType,
  onToggleAllFields,
  onAssociationSelect,
  onFieldSelect,
  onScrollToAssociation,
  onScrollToField,
  onToggleAssociationVisibility,
  onSetFieldTypesOpen,
  onSetFieldsOpen,
  getFieldTypeCount,
  getVisibleFields,
  getVisibleAssociations,
  getInputTypeLabel
}) => {
  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Form Analysis</h2>
        
        {/* AI Analysis Toggle */}
        <div className="space-y-3">
          {!aiAnalysisCompleted && (
            <button
              onClick={onAIAnalyze}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
            >
              🤖 Analyze with AI
            </button>
          )}
          
          {aiAnalysisCompleted && (
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">AI Filtering</span>
              <button
                onClick={onToggleAIFiltering}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isUsingAIFiltering ? 'bg-blue-600' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isUsingAIFiltering ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-200">
        <input
          type="text"
          placeholder="Search fields..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Field Type Filters */}
      <div className="border-b border-gray-200">
        <button
          onClick={() => onSetFieldTypesOpen(!fieldTypesOpen)}
          className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50"
        >
          <span className="font-medium text-gray-700">Field Types</span>
          <span className={`transform transition-transform ${fieldTypesOpen ? 'rotate-90' : ''}`}>
            ▶
          </span>
        </button>
        
        {fieldTypesOpen && (
          <div className="px-4 pb-4 space-y-2">
            {showingAssociations ? (
              // Show input type filters for associations
              ['text_input', 'checkbox'].map((inputType) => {
                const count = getFieldTypeCount(inputType as 'text_input' | 'checkbox');
                const colors = INPUT_TYPE_COLORS[inputType as 'text_input' | 'checkbox'];
                const isVisible = visibleInputTypes.has(inputType as 'text_input' | 'checkbox');
                
                return (
                  <label key={inputType} className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => onToggleFieldType(inputType as 'text_input' | 'checkbox')}
                      className="mr-3 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className={`px-2 py-1 rounded text-xs font-medium ${colors.bg} ${colors.text} ${colors.border} border`}>
                      {getInputTypeLabel(inputType as 'text_input' | 'checkbox')} ({count})
                    </span>
                  </label>
                );
              })
            ) : (
              // Show field type filters for individual fields
              ['label', 'text_input', 'checkbox'].map((fieldType) => {
                const count = getFieldTypeCount(fieldType as FieldType);
                const isVisible = visibleFieldTypes.has(fieldType as FieldType);
                
                return (
                  <label key={fieldType} className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => onToggleIndividualFieldType(fieldType as FieldType)}
                      className="mr-3 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">
                      {fieldType.replace('_', ' ')} ({count})
                    </span>
                  </label>
                );
              })
            )}
            
            <button
              onClick={onToggleAllFields}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Toggle All
            </button>
          </div>
        )}
      </div>

      {/* Fields/Associations List */}
      <div className="flex-1 overflow-hidden">
        <button
          onClick={() => onSetFieldsOpen(!fieldsOpen)}
          className="w-full p-4 text-left flex items-center justify-between hover:bg-gray-50 border-b border-gray-200"
        >
          <span className="font-medium text-gray-700">
            {showingAssociations ? 'Associations' : 'Fields'}
            {showingAssociations && ` (${getVisibleAssociations().length})`}
            {showingIndividualFields && ` (${getVisibleFields().length})`}
          </span>
          <span className={`transform transition-transform ${fieldsOpen ? 'rotate-90' : ''}`}>
            ▶
          </span>
        </button>
        
        {fieldsOpen && (
          <div className="flex-1 overflow-y-auto">
            {showingAssociations && (
              <div className="p-2 space-y-2">
                {getVisibleAssociations().map((assoc) => (
                  <div
                    key={assoc.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedAssociation?.id === assoc.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    } ${hiddenAssociations.has(assoc.id) ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div 
                        className="flex-1 min-w-0"
                        onClick={() => onAssociationSelect(assoc)}
                      >
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {assoc.label.text || 'Unnamed Label'}
                        </div>
                        <div className={`inline-block mt-1 px-2 py-1 rounded text-xs font-medium ${
                          INPUT_TYPE_COLORS[assoc.input.type].bg
                        } ${INPUT_TYPE_COLORS[assoc.input.type].text} ${INPUT_TYPE_COLORS[assoc.input.type].border} border`}>
                          {getInputTypeLabel(assoc.input.type)}
                        </div>
                      </div>
                      
                      <div className="flex space-x-1 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onScrollToAssociation(assoc);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Scroll to association"
                        >
                          🎯
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleAssociationVisibility(assoc.id);
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                          title={hiddenAssociations.has(assoc.id) ? 'Show association' : 'Hide association'}
                        >
                          {hiddenAssociations.has(assoc.id) ? '👁️' : '🙈'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {showingIndividualFields && (
              <div className="p-2 space-y-2">
                {getVisibleFields().map((field) => (
                  <div
                    key={field.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedField?.id === field.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => onFieldSelect(field)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {field.text || `${field.type} field`}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {field.type.replace('_', ' ')} • Page {field.page}
                        </div>
                      </div>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onScrollToField(field);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600 transition-colors ml-2"
                        title="Scroll to field"
                      >
                        🎯
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {!showingAssociations && !showingIndividualFields && (
              <div className="p-4 text-center text-gray-500">
                <div className="text-sm">No data available</div>
                <div className="text-xs mt-1">Upload and parse a document first</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}; 
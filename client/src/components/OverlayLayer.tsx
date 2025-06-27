import React from 'react';
import OverlayBox from './OverlayBox';
import type { Field, FieldAssociation, PageDimension } from '../types/api';

interface OverlayLayerProps {
  // Data
  currentAssociations: FieldAssociation[];
  currentFields: Field[];
  
  // State
  showingAssociations: boolean;
  showingIndividualFields: boolean;
  overlaysReady: boolean;
  selectedAssociation: FieldAssociation | null;
  selectedField: Field | null;
  hiddenAssociations: Set<string>;
  hoveredAssociation: string | null;
  hoveredField: string | null;
  visibleFieldTypes: Set<string>;
  visibleInputTypes: Set<'text_input' | 'checkbox'>;
  
  // Handlers
  onPositionChange: (fieldId: string, newPosition: { x: number; y: number; width: number; height: number }) => void;
  onAssociationSelect: (association: FieldAssociation) => void;
  onFieldSelect: (field: Field) => void;
  
  // Utilities
  getPageElementPosition: (pageNumber: number) => { left: number; top: number; width: number; height: number } | null;
  getPageDimensions: (pageNumber: number) => PageDimension | undefined;
  getVisibleFields: () => Field[];
  getVisibleAssociations: () => FieldAssociation[];
}

export const OverlayLayer: React.FC<OverlayLayerProps> = ({
  currentAssociations,
  currentFields,
  showingAssociations,
  showingIndividualFields,
  overlaysReady,
  selectedAssociation,
  selectedField,
  hiddenAssociations,
  hoveredAssociation,
  hoveredField,
  visibleFieldTypes,
  visibleInputTypes,
  onPositionChange,
  onAssociationSelect,
  onFieldSelect,
  getPageElementPosition,
  getPageDimensions,
  getVisibleFields,
  getVisibleAssociations
}) => {
  if (!overlaysReady) {
    return null;
  }

  const renderAssociationOverlays = () => {
    if (!showingAssociations) return null;

    return getVisibleAssociations()
      .filter(assoc => !hiddenAssociations.has(assoc.id))
      .filter(assoc => visibleInputTypes.has(assoc.input.type))
      .map((assoc) => {
        const pagePosition = getPageElementPosition(assoc.page);
        if (!pagePosition) return null;

        const pageDimensions = getPageDimensions(assoc.page);
        const isSelected = selectedAssociation?.id === assoc.id;
        const isHovered = hoveredAssociation === assoc.id;

        return (
          <React.Fragment key={`assoc-${assoc.id}`}>
            {/* Label overlay */}
            <div
              style={{
                position: 'absolute',
                left: `${pagePosition.left + (assoc.label.bounding_box.x_min * pagePosition.width)}px`,
                top: `${pagePosition.top + (assoc.label.bounding_box.y_min * pagePosition.height)}px`,
                width: `${(assoc.label.bounding_box.x_max - assoc.label.bounding_box.x_min) * pagePosition.width}px`,
                height: `${(assoc.label.bounding_box.y_max - assoc.label.bounding_box.y_min) * pagePosition.height}px`,
                zIndex: isSelected || isHovered ? 1003 : 1002,
              }}
            >
              <OverlayBox
                field={{
                  ...assoc.label,
                  type: 'label' as const,
                  page: assoc.page,
                  bounding_box: assoc.label.bounding_box
                }}
                pageDimensions={pageDimensions}
                onClick={() => onAssociationSelect(assoc)}
                isSelected={isSelected}
                isHovered={isHovered}
                onPositionChange={onPositionChange}
              />
            </div>

            {/* Input overlay */}
            <div
              style={{
                position: 'absolute',
                left: `${pagePosition.left + (assoc.input.bounding_box.x_min * pagePosition.width)}px`,
                top: `${pagePosition.top + (assoc.input.bounding_box.y_min * pagePosition.height)}px`,
                width: `${(assoc.input.bounding_box.x_max - assoc.input.bounding_box.x_min) * pagePosition.width}px`,
                height: `${(assoc.input.bounding_box.y_max - assoc.input.bounding_box.y_min) * pagePosition.height}px`,
                zIndex: isSelected || isHovered ? 1003 : 1002,
              }}
            >
                             <OverlayBox
                 field={{
                   ...assoc.input,
                   text: assoc.input.text || '',
                   page: assoc.page,
                   bounding_box: assoc.input.bounding_box
                 }}
                pageDimensions={pageDimensions}
                onClick={() => onAssociationSelect(assoc)}
                isSelected={isSelected}
                isHovered={isHovered}
                onPositionChange={onPositionChange}
              />
            </div>
          </React.Fragment>
        );
      });
  };

  const renderIndividualFieldOverlays = () => {
    if (!showingIndividualFields) return null;

    return getVisibleFields()
      .filter(field => visibleFieldTypes.has(field.type))
      .map((field) => {
        const pagePosition = getPageElementPosition(field.page);
        if (!pagePosition) return null;

        const pageDimensions = getPageDimensions(field.page);
        const isSelected = selectedField?.id === field.id;
        const isHovered = hoveredField === field.id;

        return (
          <div
            key={field.id}
            style={{
              position: 'absolute',
              left: `${pagePosition.left + (field.bounding_box.x_min * pagePosition.width)}px`,
              top: `${pagePosition.top + (field.bounding_box.y_min * pagePosition.height)}px`,
              width: `${(field.bounding_box.x_max - field.bounding_box.x_min) * pagePosition.width}px`,
              height: `${(field.bounding_box.y_max - field.bounding_box.y_min) * pagePosition.height}px`,
              zIndex: isSelected || isHovered ? 1003 : 1002,
            }}
          >
            <OverlayBox
              field={field}
              pageDimensions={pageDimensions}
              onClick={() => onFieldSelect(field)}
              isSelected={isSelected}
              isHovered={isHovered}
              onPositionChange={onPositionChange}
            />
          </div>
        );
      });
  };

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div className="relative w-full h-full pointer-events-auto">
        {renderAssociationOverlays()}
        {renderIndividualFieldOverlays()}
      </div>
    </div>
  );
}; 
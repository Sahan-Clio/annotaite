// Field Association Data Structures
// This file defines how labels, inputs, and checkboxes can be associated with each other

export interface FieldAssociation {
  id: string;
  type: 'input_group' | 'checkbox_group' | 'standalone';
  label?: AssociatedField;
  primaryField: AssociatedField;
  secondaryFields?: AssociatedField[];
  groupName?: string;
  confidence: number; // 0-1 score of association confidence
  spatialRelationship: SpatialRelationship;
}

export interface AssociatedField {
  id: string;
  type: 'label' | 'text_input' | 'checkbox';
  text: string;
  bbox: BoundingBox;
  page: number;
  role: FieldRole;
}

export type FieldRole = 
  | 'label' // Describes what the field is for
  | 'primary_input' // Main input field
  | 'secondary_input' // Additional input (e.g., middle name after first name)
  | 'checkbox' // Checkbox option
  | 'checkbox_label' // Label specifically for a checkbox
  | 'group_header'; // Header for a group of fields

export interface SpatialRelationship {
  labelPosition: 'left' | 'above' | 'right' | 'below' | 'overlapping';
  distance: number; // Euclidean distance between centers
  alignment: 'horizontal' | 'vertical' | 'diagonal';
  proximityScore: number; // 0-1 score based on how close they are
}

export interface BoundingBox {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
}

// Form Structure - represents the entire form's organization
export interface FormStructure {
  associations: FieldAssociation[];
  orphanedFields: AssociatedField[]; // Fields that couldn't be associated
  formSections: FormSection[];
  metadata: FormMetadata;
}

export interface FormSection {
  id: string;
  name: string;
  type: 'personal_info' | 'address' | 'contact' | 'agreement' | 'other';
  associations: string[]; // IDs of FieldAssociation objects in this section
  boundingBox: BoundingBox; // Area that encompasses this section
  page: number;
}

export interface FormMetadata {
  totalFields: number;
  associatedFields: number;
  orphanedFields: number;
  associationConfidence: number; // Average confidence across all associations
  processingMethod: 'ai_enhanced' | 'spatial_only' | 'manual';
  timestamp: string;
}

// Example usage structures:

// Example 1: Simple input with label
// Label: "First Name:" -> Input: [text box]
export const exampleInputGroup: FieldAssociation = {
  id: 'assoc_1',
  type: 'input_group',
  label: {
    id: 'field_1',
    type: 'label',
    text: 'First Name:',
    bbox: { x_min: 0.1, y_min: 0.2, x_max: 0.25, y_max: 0.23 },
    page: 1,
    role: 'label'
  },
  primaryField: {
    id: 'field_2',
    type: 'text_input',
    text: '',
    bbox: { x_min: 0.3, y_min: 0.2, x_max: 0.6, y_max: 0.23 },
    page: 1,
    role: 'primary_input'
  },
  confidence: 0.95,
  spatialRelationship: {
    labelPosition: 'left',
    distance: 0.05,
    alignment: 'horizontal',
    proximityScore: 0.9
  }
};

// Example 2: Checkbox with label
// Checkbox: [☐] -> Label: "I agree to the terms and conditions"
export const exampleCheckboxGroup: FieldAssociation = {
  id: 'assoc_2',
  type: 'checkbox_group',
  label: {
    id: 'field_4',
    type: 'label',
    text: 'I agree to the terms and conditions',
    bbox: { x_min: 0.15, y_min: 0.8, x_max: 0.7, y_max: 0.83 },
    page: 1,
    role: 'checkbox_label'
  },
  primaryField: {
    id: 'field_3',
    type: 'checkbox',
    text: '',
    bbox: { x_min: 0.1, y_min: 0.8, x_max: 0.13, y_max: 0.83 },
    page: 1,
    role: 'checkbox'
  },
  confidence: 0.88,
  spatialRelationship: {
    labelPosition: 'right',
    distance: 0.02,
    alignment: 'horizontal',
    proximityScore: 0.95
  }
};

// Example 3: Complex group with multiple fields
// Label: "Full Name:" -> Input1: "First" -> Input2: "Last"
export const exampleComplexGroup: FieldAssociation = {
  id: 'assoc_3',
  type: 'input_group',
  label: {
    id: 'field_5',
    type: 'label',
    text: 'Full Name:',
    bbox: { x_min: 0.1, y_min: 0.3, x_max: 0.2, y_max: 0.33 },
    page: 1,
    role: 'label'
  },
  primaryField: {
    id: 'field_6',
    type: 'text_input',
    text: 'First',
    bbox: { x_min: 0.25, y_min: 0.3, x_max: 0.45, y_max: 0.33 },
    page: 1,
    role: 'primary_input'
  },
  secondaryFields: [{
    id: 'field_7',
    type: 'text_input',
    text: 'Last',
    bbox: { x_min: 0.5, y_min: 0.3, x_max: 0.7, y_max: 0.33 },
    page: 1,
    role: 'secondary_input'
  }],
  groupName: 'full_name',
  confidence: 0.92,
  spatialRelationship: {
    labelPosition: 'left',
    distance: 0.05,
    alignment: 'horizontal',
    proximityScore: 0.85
  }
};

// Utility functions for working with associations
export class FieldAssociationUtils {
  
  // Create association between a label and input/checkbox
  static createAssociation(
    label: AssociatedField | undefined,
    primaryField: AssociatedField,
    secondaryFields?: AssociatedField[]
  ): FieldAssociation {
    const relationship = label ? 
      this.calculateSpatialRelationship(label, primaryField) : 
      this.getDefaultSpatialRelationship();
    
    return {
      id: `assoc_${primaryField.id}`,
      type: primaryField.type === 'checkbox' ? 'checkbox_group' : 'input_group',
      label,
      primaryField,
      secondaryFields,
      confidence: this.calculateConfidence(label, primaryField, relationship),
      spatialRelationship: relationship
    };
  }
  
  // Calculate spatial relationship between two fields
  static calculateSpatialRelationship(
    field1: AssociatedField, 
    field2: AssociatedField
  ): SpatialRelationship {
    const center1 = {
      x: (field1.bbox.x_min + field1.bbox.x_max) / 2,
      y: (field1.bbox.y_min + field1.bbox.y_max) / 2
    };
    const center2 = {
      x: (field2.bbox.x_min + field2.bbox.x_max) / 2,
      y: (field2.bbox.y_min + field2.bbox.y_max) / 2
    };
    
    const distance = Math.sqrt(
      Math.pow(center2.x - center1.x, 2) + Math.pow(center2.y - center1.y, 2)
    );
    
    // Determine relative position
    let labelPosition: SpatialRelationship['labelPosition'];
    const dx = center2.x - center1.x;
    const dy = center2.y - center1.y;
    
    if (Math.abs(dx) > Math.abs(dy)) {
      labelPosition = dx > 0 ? 'left' : 'right';
    } else {
      labelPosition = dy > 0 ? 'above' : 'below';
    }
    
    // Determine alignment
    const alignment: SpatialRelationship['alignment'] = 
      Math.abs(dy) < 0.02 ? 'horizontal' : 
      Math.abs(dx) < 0.02 ? 'vertical' : 'diagonal';
    
    // Calculate proximity score (closer = higher score)
    const proximityScore = Math.max(0, 1 - (distance * 10));
    
    return {
      labelPosition,
      distance,
      alignment,
      proximityScore
    };
  }
  
  // Calculate confidence score for an association
  static calculateConfidence(
    label: AssociatedField | undefined,
    primaryField: AssociatedField,
    relationship: SpatialRelationship
  ): number {
    let confidence = 0.5; // Base confidence
    
    // Boost confidence based on proximity
    confidence += relationship.proximityScore * 0.3;
    
    // Boost confidence for good alignment
    if (relationship.alignment === 'horizontal') confidence += 0.1;
    
    // Boost confidence for typical label positions
    if (relationship.labelPosition === 'left' || relationship.labelPosition === 'above') {
      confidence += 0.1;
    }
    
    // Boost confidence for meaningful label text
    if (label && this.isLabelText(label.text)) {
      confidence += 0.2;
    }
    
    return Math.min(1, confidence);
  }
  
  // Check if text looks like a field label
  static isLabelText(text: string): boolean {
    const labelPatterns = [
      /name/i, /email/i, /address/i, /phone/i, /date/i, 
      /birth/i, /age/i, /gender/i, /city/i, /state/i, /zip/i,
      /agree/i, /terms/i, /conditions/i, /signature/i
    ];
    
    return labelPatterns.some(pattern => pattern.test(text)) || text.includes(':');
  }
  
  static getDefaultSpatialRelationship(): SpatialRelationship {
    return {
      labelPosition: 'left',
      distance: 0,
      alignment: 'horizontal',
      proximityScore: 0
    };
  }
  
  // Find all associations for a given field
  static findAssociationsForField(
    fieldId: string, 
    associations: FieldAssociation[]
  ): FieldAssociation[] {
    return associations.filter(assoc => 
      assoc.label?.id === fieldId ||
      assoc.primaryField.id === fieldId ||
      assoc.secondaryFields?.some(field => field.id === fieldId)
    );
  }
  
  // Group associations by form sections
  static groupAssociationsBySections(
    associations: FieldAssociation[]
  ): FormSection[] {
    // This would implement logic to group related associations
    // based on spatial proximity and semantic similarity
    return [];
  }
} 
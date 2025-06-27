export interface BoundingBox {
  page: number;
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
}

export interface FormField {
  name: string;
  bounding_box: BoundingBox;
}

export interface ParseResponse {
  success: boolean;
  fields: Field[];
  field_associations: FieldAssociation[];
  total_fields: number;
  document_info: DocumentInfo;
  error?: string;
  // Enhanced Gemini AI response fields
  processing_info?: ProcessingInfo;
}

export interface FieldAssociation {
  id: string;
  label: {
    id: string;
    text: string;
    bounding_box: BoundingBox;
  };
  input: {
    id: string;
    type: 'text_input' | 'checkbox';
    bounding_box: BoundingBox;
    text?: string;
  };
  page: number;
}



export interface ProcessingInfo {
  enhanced_by?: string;
  enhanced_at?: string;
  model?: string;
  gemini_enhancement_attempted?: boolean;
  gemini_enhancement_failed?: boolean;
  gemini_error?: string;
  fallback_to?: string;
  original_field_count?: number;
  filtered_field_count?: number;
  associations_count?: number;
}

export interface DocumentInfo {
  total_pages: number;
  page_dimensions: PageDimension[];
}

export interface PageDimension {
  page: number;
  width: number;
  height: number;
}

export interface Field {
  id: string;
  type: FieldType;
  text: string;
  page: number;
  bounding_box: BoundingBox;
  form_field_info?: FormFieldInfo;
  // Enhanced Gemini AI fields
  paired_with?: string;
  field_purpose?: FieldPurpose;
  confidence?: number;
}

export type FieldType = 
  | 'label'
  | 'text_input'
  | 'checkbox';

export type FieldPurpose = 
  | 'name'
  | 'email'
  | 'address'
  | 'phone'
  | 'date'
  | 'checkbox_option'
  | 'other';



export interface FormFieldInfo {
  field_type?: 'text' | 'checkbox';
  is_required?: boolean;
  placeholder_text?: string;
}

export interface ApiError {
  error: string;
} 
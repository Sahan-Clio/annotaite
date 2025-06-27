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
  total_fields: number;
  document_info: DocumentInfo;
  error?: string;
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
}

export type FieldType = 
  | 'label'
  | 'text_input'
  | 'checkbox';

export interface FormFieldInfo {
  field_type?: 'text' | 'checkbox';
  is_required?: boolean;
  placeholder_text?: string;
}

export interface ApiError {
  error: string;
} 
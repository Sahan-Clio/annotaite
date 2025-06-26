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
  document_info: DocumentInfo;
  fields: Field[];
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
  related_fields?: string[];
  parent_section?: string;
}

export type FieldType = 
  | 'form_field_label'
  | 'form_field_input'
  | 'section_header'
  | 'instruction_text'
  | 'static_text'
  | 'checkbox'
  | 'signature_area';

export interface FormFieldInfo {
  field_group_id?: string;
  field_type?: 'text' | 'checkbox' | 'radio' | 'date' | 'email' | 'phone' | 'signature';
  is_required?: boolean;
  placeholder_text?: string;
}

export interface ApiError {
  error: string;
} 
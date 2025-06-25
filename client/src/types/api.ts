export interface BoundingBox {
  page: number;
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
}

export interface FormField {
  name: string;
  label_bounding_box: BoundingBox;
  input_bounding_box: BoundingBox;
}

export interface MetadataItem {
  content: string;
  bounding_box: BoundingBox;
}

export interface ParseResponse {
  fields: FormField[];
  metadata: MetadataItem[];
}

export interface ApiError {
  error: string;
} 
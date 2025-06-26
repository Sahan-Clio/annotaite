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
  fields: FormField[];
}

export interface ApiError {
  error: string;
} 
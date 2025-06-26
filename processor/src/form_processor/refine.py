"""
Field refinement and validation for form processing.
Cleans up and validates the final field coordinates and associations.
"""

import cv2
import numpy as np
from typing import List, Dict, Any, Tuple

from .associate import LabelFieldPair
from .detect_fields import FieldBox


def refine_boxes(pairs: List[LabelFieldPair], 
                image: np.ndarray,
                docai_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Refine and validate field coordinates.
    
    Args:
        pairs: List of label-field pairs
        image: Preprocessed binary image
        docai_data: Document AI output
        
    Returns:
        List of refined field dictionaries
    """
    refined_fields = []
    
    for pair in pairs:
        # Snap field boundaries to actual content
        refined_bbox = _snap_to_content(pair.field, image)
        
        # Validate the field
        if _validate_field(refined_bbox, image.shape):
            field_dict = {
                "name": _clean_label_text(pair.label.text),
                "type": pair.field.field_type,
                "bbox": refined_bbox,
                "confidence": pair.label.confidence / 100.0
            }
            refined_fields.append(field_dict)
    
    # Remove duplicates and merge overlapping fields
    refined_fields = _remove_duplicate_fields(refined_fields)
    
    # Sort by reading order
    refined_fields.sort(key=lambda f: (f["bbox"][1], f["bbox"][0]))
    
    return refined_fields


def _snap_to_content(field: FieldBox, image: np.ndarray) -> List[int]:
    """
    Snap field boundaries to actual content in the image.
    
    Args:
        field: Original field box
        image: Binary image
        
    Returns:
        Refined bounding box [x1, y1, x2, y2]
    """
    x, y, w, h = field.bbox
    
    # Extract region of interest
    roi = image[y:y+h, x:x+w]
    if roi.size == 0:
        return [x, y, x + w, y + h]
    
    if field.field_type == 'text':
        # For text fields, find the actual underline
        return _snap_text_field(x, y, w, h, roi)
    elif field.field_type == 'checkbox':
        # For checkboxes, find the actual box outline
        return _snap_checkbox_field(x, y, w, h, roi)
    
    return [x, y, x + w, y + h]


def _snap_text_field(x: int, y: int, w: int, h: int, roi: np.ndarray) -> List[int]:
    """Snap text field to actual underline."""
    # Find horizontal lines in the ROI
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (w // 4, 1))
    lines = cv2.morphologyEx(roi, cv2.MORPH_OPEN, horizontal_kernel)
    
    # Find contours of lines
    contours, _ = cv2.findContours(lines, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        return [x, y, x + w, y + h]
    
    # Find the longest horizontal line (likely the underline)
    best_contour = max(contours, key=lambda c: cv2.boundingRect(c)[2])
    line_x, line_y, line_w, line_h = cv2.boundingRect(best_contour)
    
    # Convert back to image coordinates
    actual_x1 = x + line_x
    actual_y1 = y + line_y
    actual_x2 = x + line_x + line_w
    actual_y2 = y + line_y + line_h
    
    # Expand slightly to include text area above the line
    text_height = max(line_h * 3, 20)
    actual_y1 = max(y, actual_y2 - text_height)
    
    return [actual_x1, actual_y1, actual_x2, actual_y2]


def _snap_checkbox_field(x: int, y: int, w: int, h: int, roi: np.ndarray) -> List[int]:
    """Snap checkbox field to actual box outline."""
    # Find contours in the ROI
    contours, _ = cv2.findContours(roi, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        return [x, y, x + w, y + h]
    
    # Find the most square-like contour
    best_contour = None
    best_score = 0
    
    for contour in contours:
        box_x, box_y, box_w, box_h = cv2.boundingRect(contour)
        
        # Score based on how square it is and how much area it covers
        aspect_ratio = min(box_w, box_h) / max(box_w, box_h) if max(box_w, box_h) > 0 else 0
        area_ratio = cv2.contourArea(contour) / (box_w * box_h) if box_w * box_h > 0 else 0
        score = aspect_ratio * area_ratio
        
        if score > best_score:
            best_score = score
            best_contour = contour
    
    if best_contour is not None:
        box_x, box_y, box_w, box_h = cv2.boundingRect(best_contour)
        return [x + box_x, y + box_y, x + box_x + box_w, y + box_y + box_h]
    
    return [x, y, x + w, y + h]


def _validate_field(bbox: List[int], image_shape: Tuple[int, int]) -> bool:
    """
    Validate that a field bounding box is reasonable.
    
    Args:
        bbox: Bounding box [x1, y1, x2, y2]
        image_shape: (height, width) of the image
        
    Returns:
        True if field is valid
    """
    x1, y1, x2, y2 = bbox
    height, width = image_shape
    
    # Check bounds
    if x1 < 0 or y1 < 0 or x2 > width or y2 > height:
        return False
    
    # Check size
    field_width = x2 - x1
    field_height = y2 - y1
    
    if field_width < 5 or field_height < 5:
        return False
    
    if field_width > width * 0.9 or field_height > height * 0.2:
        return False
    
    return True


def _clean_label_text(text: str) -> str:
    """
    Clean up label text for better readability.
    
    Args:
        text: Raw label text
        
    Returns:
        Cleaned label text
    """
    # Remove extra whitespace
    cleaned = ' '.join(text.split())
    
    # Remove trailing punctuation that's not meaningful
    cleaned = cleaned.rstrip('.:;,-')
    
    # Capitalize properly
    if len(cleaned) > 0:
        cleaned = cleaned[0].upper() + cleaned[1:]
    
    return cleaned


def _remove_duplicate_fields(fields: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Remove duplicate or overlapping fields.
    
    Args:
        fields: List of field dictionaries
        
    Returns:
        Deduplicated list of fields
    """
    if not fields:
        return []
    
    # Sort by confidence (descending)
    fields.sort(key=lambda f: f.get("confidence", 0), reverse=True)
    
    unique_fields = []
    
    for field in fields:
        bbox = field["bbox"]
        is_duplicate = False
        
        for existing_field in unique_fields:
            existing_bbox = existing_field["bbox"]
            
            # Check for significant overlap
            overlap_ratio = _calculate_bbox_overlap(bbox, existing_bbox)
            if overlap_ratio > 0.5:
                is_duplicate = True
                break
        
        if not is_duplicate:
            unique_fields.append(field)
    
    return unique_fields


def _calculate_bbox_overlap(bbox1: List[int], bbox2: List[int]) -> float:
    """
    Calculate overlap ratio between two bounding boxes.
    
    Args:
        bbox1: First bounding box [x1, y1, x2, y2]
        bbox2: Second bounding box [x1, y1, x2, y2]
        
    Returns:
        Overlap ratio (0.0 to 1.0)
    """
    x1_1, y1_1, x2_1, y2_1 = bbox1
    x1_2, y1_2, x2_2, y2_2 = bbox2
    
    # Calculate intersection
    x1 = max(x1_1, x1_2)
    y1 = max(y1_1, y1_2)
    x2 = min(x2_1, x2_2)
    y2 = min(y2_1, y2_2)
    
    if x1 >= x2 or y1 >= y2:
        return 0.0
    
    intersection_area = (x2 - x1) * (y2 - y1)
    
    # Calculate union
    area1 = (x2_1 - x1_1) * (y2_1 - y1_1)
    area2 = (x2_2 - x1_2) * (y2_2 - y1_2)
    union_area = area1 + area2 - intersection_area
    
    if union_area == 0:
        return 0.0
    
    return intersection_area / union_area 
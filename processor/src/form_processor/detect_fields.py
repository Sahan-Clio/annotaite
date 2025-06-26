"""
Field detection for form processing.
Detects text input fields (underlines) and checkboxes using computer vision.
"""

import cv2
import numpy as np
from typing import List, Tuple, Dict, Any
from boxdetect import pipelines


class FieldBox:
    """Represents a detected form field with its bounding box and type."""
    
    def __init__(self, bbox: Tuple[int, int, int, int], field_type: str, confidence: float = 1.0):
        self.bbox = bbox  # (x, y, width, height)
        self.field_type = field_type  # 'text' or 'checkbox'
        self.confidence = confidence
    
    @property
    def x(self) -> int:
        return self.bbox[0]
    
    @property
    def y(self) -> int:
        return self.bbox[1]
    
    @property
    def width(self) -> int:
        return self.bbox[2]
    
    @property
    def height(self) -> int:
        return self.bbox[3]
    
    @property
    def x2(self) -> int:
        return self.x + self.width
    
    @property
    def y2(self) -> int:
        return self.y + self.height
    
    @property
    def center(self) -> Tuple[int, int]:
        return (self.x + self.width // 2, self.y + self.height // 2)
    
    @property
    def area(self) -> int:
        return self.width * self.height
    
    def __repr__(self) -> str:
        return f"FieldBox({self.field_type}, {self.bbox}, conf={self.confidence:.2f})"


def detect_text_fields(image: np.ndarray, min_width: int = 50) -> List[FieldBox]:
    """
    Detect text input fields by finding horizontal lines (underlines).
    
    Args:
        image: Preprocessed binary image
        min_width: Minimum width for a valid text field
        
    Returns:
        List of FieldBox objects representing text input fields
    """
    # Create horizontal kernel for line detection
    horizontal_kernel_size = max(image.shape[1] // 30, 15)  # Adaptive kernel size
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (horizontal_kernel_size, 1))
    
    # Detect horizontal lines
    horizontal_lines = cv2.morphologyEx(image, cv2.MORPH_OPEN, horizontal_kernel)
    
    # Find contours of the lines
    contours, _ = cv2.findContours(horizontal_lines, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    text_fields = []
    
    for contour in contours:
        # Get bounding rectangle
        x, y, w, h = cv2.boundingRect(contour)
        
        # Filter based on size and aspect ratio
        if w < min_width:
            continue
        
        # Lines should be much wider than they are tall
        aspect_ratio = w / h if h > 0 else 0
        if aspect_ratio < 5:  # Not line-like enough
            continue
        
        # Check if this is actually a line (high density of black pixels)
        line_roi = horizontal_lines[y:y+h, x:x+w]
        if line_roi.size == 0:
            continue
        
        line_density = np.sum(line_roi == 0) / line_roi.size
        if line_density < 0.3:  # Not enough black pixels
            continue
        
        # Expand the bounding box slightly to include the text area above the line
        expanded_height = max(h * 3, 20)  # Make room for text above the line
        expanded_y = max(0, y - expanded_height + h)
        
        field_box = FieldBox(
            (x, expanded_y, w, expanded_height),
            'text',
            line_density
        )
        text_fields.append(field_box)
    
    # Remove overlapping fields (keep the one with higher confidence)
    text_fields = _remove_overlapping_fields(text_fields)
    
    return text_fields


def detect_checkboxes(image: np.ndarray, 
                     min_size: int = 10, 
                     max_size: int = 50) -> List[FieldBox]:
    """
    Detect checkbox fields using multiple approaches.
    
    Args:
        image: Preprocessed binary image
        min_size: Minimum size for checkbox detection
        max_size: Maximum size for checkbox detection
        
    Returns:
        List of FieldBox objects representing checkboxes
    """
    checkboxes = []
    
    # Method 1: Use boxdetect library
    try:
        # Configure boxdetect
        config = {
            'min_w': min_size,
            'max_w': max_size,
            'min_h': min_size,
            'max_h': max_size,
            'morph_kernels_thickness': [1, 2],
            'morph_kernels_type': 'rectangular'
        }
        
        # Detect checkboxes
        detected_boxes = pipelines.get_checkboxes(image, **config)
        
        for box in detected_boxes:
            x, y, w, h = box
            field_box = FieldBox((x, y, w, h), 'checkbox', 0.8)
            checkboxes.append(field_box)
    
    except Exception:
        # Fallback to manual detection if boxdetect fails
        pass
    
    # Method 2: Manual square detection
    manual_checkboxes = _detect_squares_manual(image, min_size, max_size)
    checkboxes.extend(manual_checkboxes)
    
    # Remove duplicates and overlapping boxes
    checkboxes = _remove_overlapping_fields(checkboxes, overlap_threshold=0.5)
    
    return checkboxes


def _detect_squares_manual(image: np.ndarray, 
                          min_size: int, 
                          max_size: int) -> List[FieldBox]:
    """
    Manually detect square-like shapes that could be checkboxes.
    
    Args:
        image: Binary image
        min_size: Minimum checkbox size
        max_size: Maximum checkbox size
        
    Returns:
        List of potential checkbox FieldBox objects
    """
    # Find contours
    contours, _ = cv2.findContours(image, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    checkboxes = []
    
    for contour in contours:
        # Get bounding rectangle
        x, y, w, h = cv2.boundingRect(contour)
        
        # Size filter
        if w < min_size or h < min_size or w > max_size or h > max_size:
            continue
        
        # Aspect ratio filter (should be roughly square)
        aspect_ratio = w / h if h > 0 else 0
        if aspect_ratio < 0.7 or aspect_ratio > 1.3:
            continue
        
        # Area filter (contour should fill most of the bounding box)
        contour_area = cv2.contourArea(contour)
        bbox_area = w * h
        if bbox_area == 0:
            continue
        
        fill_ratio = contour_area / bbox_area
        if fill_ratio < 0.3:  # Too sparse
            continue
        
        # Check if it's actually a rectangle-like shape
        epsilon = 0.02 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        
        # Should have 4 corners (approximately)
        if len(approx) >= 4:
            field_box = FieldBox((x, y, w, h), 'checkbox', fill_ratio)
            checkboxes.append(field_box)
    
    return checkboxes


def _remove_overlapping_fields(fields: List[FieldBox], 
                              overlap_threshold: float = 0.7) -> List[FieldBox]:
    """
    Remove overlapping field detections, keeping the one with higher confidence.
    
    Args:
        fields: List of FieldBox objects
        overlap_threshold: Minimum overlap ratio to consider as duplicate
        
    Returns:
        Filtered list with overlapping fields removed
    """
    if not fields:
        return []
    
    # Sort by confidence (descending)
    fields.sort(key=lambda f: f.confidence, reverse=True)
    
    filtered = []
    
    for field in fields:
        # Check if this field overlaps significantly with any already accepted field
        is_duplicate = False
        
        for accepted_field in filtered:
            overlap_ratio = _calculate_overlap_ratio(field, accepted_field)
            if overlap_ratio > overlap_threshold:
                is_duplicate = True
                break
        
        if not is_duplicate:
            filtered.append(field)
    
    return filtered


def _calculate_overlap_ratio(field1: FieldBox, field2: FieldBox) -> float:
    """
    Calculate the overlap ratio between two field boxes.
    
    Args:
        field1: First FieldBox
        field2: Second FieldBox
        
    Returns:
        Overlap ratio (0.0 to 1.0)
    """
    # Calculate intersection rectangle
    x1 = max(field1.x, field2.x)
    y1 = max(field1.y, field2.y)
    x2 = min(field1.x2, field2.x2)
    y2 = min(field1.y2, field2.y2)
    
    # No intersection
    if x1 >= x2 or y1 >= y2:
        return 0.0
    
    # Calculate intersection area
    intersection_area = (x2 - x1) * (y2 - y1)
    
    # Calculate union area
    area1 = field1.area
    area2 = field2.area
    union_area = area1 + area2 - intersection_area
    
    if union_area == 0:
        return 0.0
    
    return intersection_area / union_area


def validate_field_detections(fields: List[FieldBox], 
                             image_shape: Tuple[int, int]) -> List[FieldBox]:
    """
    Validate and filter field detections based on position and size.
    
    Args:
        fields: List of detected fields
        image_shape: (height, width) of the image
        
    Returns:
        Validated list of fields
    """
    height, width = image_shape
    validated = []
    
    for field in fields:
        # Check if field is within image bounds
        if (field.x < 0 or field.y < 0 or 
            field.x2 > width or field.y2 > height):
            continue
        
        # Check reasonable size constraints
        if field.field_type == 'text':
            # Text fields should be reasonably wide
            if field.width < 30 or field.width > width * 0.8:
                continue
            # But not too tall
            if field.height > height * 0.1:
                continue
        
        elif field.field_type == 'checkbox':
            # Checkboxes should be small and roughly square
            if field.width < 8 or field.height < 8:
                continue
            if field.width > 60 or field.height > 60:
                continue
        
        validated.append(field)
    
    return validated 
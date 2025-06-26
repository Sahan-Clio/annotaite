"""
Label-field association for form processing.
Matches detected text labels with detected form fields using spatial relationships.
"""

import math
from typing import List, Dict, Any, Optional, Tuple

from .ocr import TextBox, filter_label_candidates
from .detect_fields import FieldBox


class LabelFieldPair:
    """Represents a matched label-field pair."""
    
    def __init__(self, label: TextBox, field: FieldBox, distance: float):
        self.label = label
        self.field = field
        self.distance = distance
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to output dictionary format."""
        return {
            "name": self.label.text,
            "type": self.field.field_type,
            "bbox": [self.field.x, self.field.y, self.field.x2, self.field.y2],
            "confidence": min(self.label.confidence, self.field.confidence * 100) / 100
        }


def match_labels_to_fields(ocr_boxes: List[TextBox], 
                          text_fields: List[FieldBox],
                          checkboxes: List[FieldBox],
                          docai_data: Dict[str, Any]) -> List[LabelFieldPair]:
    """
    Match text labels to form fields using spatial relationships.
    
    Args:
        ocr_boxes: List of detected text boxes from OCR
        text_fields: List of detected text input fields
        checkboxes: List of detected checkbox fields
        docai_data: Document AI output (for additional context)
        
    Returns:
        List of LabelFieldPair objects
    """
    # Filter OCR boxes to get potential labels
    label_candidates = filter_label_candidates(ocr_boxes)
    
    # Combine all field types
    all_fields = text_fields + checkboxes
    
    matched_pairs = []
    used_fields = set()
    
    # Sort labels by reading order (top to bottom, left to right)
    label_candidates.sort(key=lambda label: (label.y, label.x))
    
    for label in label_candidates:
        best_field = None
        best_distance = float('inf')
        
        for field in all_fields:
            if id(field) in used_fields:
                continue
            
            # Calculate spatial relationship
            distance = _calculate_label_field_distance(label, field)
            
            # Check if this is a valid pairing
            if _is_valid_pairing(label, field) and distance < best_distance:
                best_field = field
                best_distance = distance
        
        # Add the best match if found
        if best_field and best_distance < 200:  # Maximum reasonable distance
            pair = LabelFieldPair(label, best_field, best_distance)
            matched_pairs.append(pair)
            used_fields.add(id(best_field))
    
    return matched_pairs


def _calculate_label_field_distance(label: TextBox, field: FieldBox) -> float:
    """
    Calculate the distance between a label and a field based on spatial relationship.
    
    Args:
        label: Text label box
        field: Form field box
        
    Returns:
        Distance score (lower is better)
    """
    # Check for horizontal relationship (label to the left of field)
    if label.x2 <= field.x and _has_vertical_overlap(label, field):
        # Label is to the left and vertically aligned
        horizontal_gap = field.x - label.x2
        vertical_center_diff = abs(label.center[1] - field.center[1])
        return horizontal_gap + vertical_center_diff * 0.5
    
    # Check for vertical relationship (label above field)
    if label.y2 <= field.y and _has_horizontal_overlap(label, field):
        # Label is above and horizontally aligned
        vertical_gap = field.y - label.y2
        horizontal_center_diff = abs(label.center[0] - field.center[0])
        return vertical_gap + horizontal_center_diff * 0.5
    
    # Fallback: Euclidean distance between centers
    dx = label.center[0] - field.center[0]
    dy = label.center[1] - field.center[1]
    return math.sqrt(dx * dx + dy * dy)


def _has_vertical_overlap(label: TextBox, field: FieldBox) -> bool:
    """Check if label and field have vertical overlap."""
    return not (label.y2 < field.y or field.y2 < label.y)


def _has_horizontal_overlap(label: TextBox, field: FieldBox) -> bool:
    """Check if label and field have horizontal overlap."""
    return not (label.x2 < field.x or field.x2 < label.x)


def _is_valid_pairing(label: TextBox, field: FieldBox) -> bool:
    """
    Check if a label-field pairing makes sense based on content and position.
    
    Args:
        label: Text label
        field: Form field
        
    Returns:
        True if pairing is valid
    """
    label_text = label.text.lower()
    
    # Check field type compatibility
    if field.field_type == 'checkbox':
        # Checkbox fields should have labels that suggest yes/no or selection
        checkbox_keywords = [
            'check', 'select', 'mark', 'yes', 'no', 'requested', 'applicable',
            'premium', 'processing', 'expedite', 'priority'
        ]
        if not any(keyword in label_text for keyword in checkbox_keywords):
            # Allow if label is short (might be an option)
            if len(label.text) > 20:
                return False
    
    elif field.field_type == 'text':
        # Text fields should have descriptive labels
        text_keywords = [
            'name', 'address', 'number', 'date', 'phone', 'email', 'city',
            'state', 'zip', 'country', 'birth', 'place', 'occupation'
        ]
        # More lenient for text fields
        pass
    
    # Check spatial constraints
    max_distance = 300  # pixels
    distance = _calculate_label_field_distance(label, field)
    
    return distance <= max_distance


def refine_associations_with_docai(pairs: List[LabelFieldPair], 
                                  docai_data: Dict[str, Any]) -> List[LabelFieldPair]:
    """
    Refine label-field associations using Document AI context.
    
    Args:
        pairs: Initial label-field pairs
        docai_data: Document AI output
        
    Returns:
        Refined list of pairs
    """
    # TODO: Implement Document AI integration
    # This could use Document AI's detected labels to validate or improve matches
    # For now, return the original pairs
    return pairs 
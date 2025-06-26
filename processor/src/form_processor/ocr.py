"""
OCR text extraction using Tesseract.
Extracts text with bounding box coordinates for label association.
"""

import cv2
import numpy as np
import pytesseract
from pytesseract import Output
from typing import List, Dict, Tuple, Any


class TextBox:
    """Represents a detected text element with its bounding box."""
    
    def __init__(self, text: str, bbox: Tuple[int, int, int, int], confidence: float):
        self.text = text.strip()
        self.bbox = bbox  # (x, y, width, height)
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
    
    def __repr__(self) -> str:
        return f"TextBox('{self.text}', {self.bbox}, conf={self.confidence:.2f})"


def run_ocr(image: np.ndarray, min_confidence: float = 30.0) -> List[TextBox]:
    """
    Run OCR on preprocessed image and return text boxes with coordinates.
    
    Args:
        image: Preprocessed binary image
        min_confidence: Minimum confidence threshold for text detection
        
    Returns:
        List of TextBox objects containing text and coordinates
    """
    # Configure Tesseract for better form recognition
    custom_config = r'--oem 3 --psm 6 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,()[]{}:;-_/\\ '
    
    # Run OCR with detailed output
    data = pytesseract.image_to_data(image, output_type=Output.DICT, config=custom_config)
    
    text_boxes = []
    
    # Parse OCR results
    n_boxes = len(data['level'])
    for i in range(n_boxes):
        # Filter by confidence and text content
        confidence = float(data['conf'][i])
        text = data['text'][i]
        
        if confidence < min_confidence:
            continue
            
        if not text or text.isspace():
            continue
        
        # Get bounding box coordinates
        x = data['left'][i]
        y = data['top'][i]
        w = data['width'][i]
        h = data['height'][i]
        
        # Filter out very small or very large boxes (likely noise or page-level elements)
        if w < 10 or h < 5 or w > image.shape[1] * 0.8 or h > image.shape[0] * 0.1:
            continue
        
        text_box = TextBox(text, (x, y, w, h), confidence)
        text_boxes.append(text_box)
    
    # Sort by reading order (top to bottom, left to right)
    text_boxes.sort(key=lambda box: (box.y, box.x))
    
    return text_boxes


def merge_nearby_text_boxes(text_boxes: List[TextBox], 
                           horizontal_threshold: int = 10,
                           vertical_threshold: int = 5) -> List[TextBox]:
    """
    Merge text boxes that are close together and likely part of the same label.
    
    Args:
        text_boxes: List of TextBox objects
        horizontal_threshold: Maximum horizontal gap to merge
        vertical_threshold: Maximum vertical gap to merge
        
    Returns:
        List of merged TextBox objects
    """
    if not text_boxes:
        return []
    
    merged = []
    current_group = [text_boxes[0]]
    
    for i in range(1, len(text_boxes)):
        current_box = text_boxes[i]
        last_box = current_group[-1]
        
        # Check if boxes are close enough to merge
        horizontal_gap = current_box.x - last_box.x2
        vertical_overlap = min(current_box.y2, last_box.y2) - max(current_box.y, last_box.y)
        
        if (horizontal_gap <= horizontal_threshold and 
            vertical_overlap >= -vertical_threshold):
            # Add to current group
            current_group.append(current_box)
        else:
            # Merge current group and start new group
            if current_group:
                merged.append(_merge_text_group(current_group))
            current_group = [current_box]
    
    # Don't forget the last group
    if current_group:
        merged.append(_merge_text_group(current_group))
    
    return merged


def _merge_text_group(text_boxes: List[TextBox]) -> TextBox:
    """
    Merge a group of text boxes into a single TextBox.
    
    Args:
        text_boxes: List of TextBox objects to merge
        
    Returns:
        Single merged TextBox
    """
    if len(text_boxes) == 1:
        return text_boxes[0]
    
    # Combine text with spaces
    combined_text = ' '.join(box.text for box in text_boxes)
    
    # Calculate bounding box that encompasses all boxes
    min_x = min(box.x for box in text_boxes)
    min_y = min(box.y for box in text_boxes)
    max_x = max(box.x2 for box in text_boxes)
    max_y = max(box.y2 for box in text_boxes)
    
    merged_bbox = (min_x, min_y, max_x - min_x, max_y - min_y)
    
    # Use average confidence
    avg_confidence = sum(box.confidence for box in text_boxes) / len(text_boxes)
    
    return TextBox(combined_text, merged_bbox, avg_confidence)


def filter_label_candidates(text_boxes: List[TextBox]) -> List[TextBox]:
    """
    Filter text boxes to keep only those likely to be field labels.
    
    Args:
        text_boxes: List of all detected text boxes
        
    Returns:
        Filtered list of potential field labels
    """
    labels = []
    
    for box in text_boxes:
        text = box.text.lower()
        
        # Skip very short text (likely not labels)
        if len(box.text) < 3:
            continue
        
        # Skip pure numbers (likely not labels)
        if box.text.isdigit():
            continue
        
        # Skip common form noise
        noise_words = {'page', 'form', 'uscis', 'department', 'homeland', 'security'}
        if any(word in text for word in noise_words):
            continue
        
        # Keep text that looks like field labels
        # Labels often contain words like "name", "address", "date", etc.
        # or end with colons, or contain parentheses
        if (any(word in text for word in ['name', 'address', 'date', 'number', 'phone', 'email']) or
            ':' in box.text or
            '(' in box.text and ')' in box.text or
            len(box.text) > 10):  # Longer text is more likely to be a label
            labels.append(box)
    
    return labels 
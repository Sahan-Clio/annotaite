#!/usr/bin/env python3
"""
Flask server for modern form field extraction using Unstructured library.
Clean, fast, and accurate form processing.
"""

import json
import tempfile
from pathlib import Path
from flask import Flask, request, jsonify
import os
import sys
from typing import List, Dict, Tuple, Any

from .main import process_form_fields

# Configuration constants for filtering
MIN_LABEL_LENGTH = 5  # Minimum character length for labels to be included

# Self-contained form field detection functions
def split_pdf_into_pages(pdf_path: Path, temp_dir: Path):
    """Split a multi-page PDF into individual single-page PDFs."""
    try:
        import PyPDF2
        
        page_paths = []
        
        with open(pdf_path, 'rb') as input_file:
            reader = PyPDF2.PdfReader(input_file)
            total_pages = len(reader.pages)
            
            for page_num in range(total_pages):
                writer = PyPDF2.PdfWriter()
                writer.add_page(reader.pages[page_num])
                
                page_filename = f"page_{page_num + 1:03d}.pdf"
                page_path = temp_dir / page_filename
                
                with open(page_path, 'wb') as output_file:
                    writer.write(output_file)
                
                page_paths.append(page_path)
        
        return page_paths, total_pages
        
    except ImportError:
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "PyPDF2"])
        return split_pdf_into_pages(pdf_path, temp_dir)
    except Exception as e:
        return [], 0


def extract_text_elements_from_page(page_pdf_path: Path, page_number: int):
    """Extract text elements and their coordinates using Unstructured."""
    try:
        from .modern_extractor import extract_with_unstructured
        
        result = extract_with_unstructured(page_pdf_path, debug=False, fast_mode=True)
        
        if result.get('success', False):
            fields = result.get('form_fields', [])
            return fields
        else:
            return []
            
    except Exception as e:
        return []


def remove_text_elements_from_image(image, text_elements):
    """Remove detected text elements from the image by painting them white."""
    import cv2
    import numpy as np
    
    # Create a copy of the image
    cleaned_image = image.copy()
    
    removed_count = 0
    
    for element in text_elements:
        if 'coordinates' in element and element['coordinates']:
            coords = element['coordinates']
            
            if isinstance(coords, dict) and 'points' in coords:
                points = coords['points']
                if len(points) >= 2:
                    # Extract coordinates
                    x1, y1 = points[0][0], points[0][1]
                    if len(points) > 2:
                        x2, y2 = points[2][0], points[2][1]
                    else:
                        x2, y2 = points[1][0], points[1][1]
                    
                    x, y = min(x1, x2), min(y1, y2)
                    width, height = abs(x2 - x1), abs(y2 - y1)
                    
                    # Scale coordinates from PDF points to image pixels
                    scale_factor = 150 / 72  # PDF 72 DPI to image 150 DPI
                    x *= scale_factor
                    y *= scale_factor
                    width *= scale_factor
                    height *= scale_factor
                    
                    # Make sure coordinates are within image bounds
                    img_height, img_width = cleaned_image.shape[:2]
                    if x >= 0 and y >= 0 and x + width <= img_width and y + height <= img_height:
                        # Paint the text area white (remove text)
                        cv2.rectangle(cleaned_image, (int(x), int(y)), (int(x + width), int(y + height)), (255, 255, 255), -1)
                        removed_count += 1
    
    return cleaned_image


def detect_input_boxes_and_checkboxes(cleaned_image):
    """Detect input boxes and checkboxes using contour-based methods only."""
    import cv2
    import numpy as np
    
    if len(cleaned_image.shape) == 3:
        gray = cv2.cvtColor(cleaned_image, cv2.COLOR_BGR2GRAY)
    else:
        gray = cleaned_image.copy()
    
    all_input_boxes = []
    all_checkboxes = []
    
    # Method 1: Contour detection with multiple thresholds (blue elements)
    for thresh_val in [240, 220, 200, 180, 160]:
        _, binary = cv2.threshold(gray, thresh_val, 255, cv2.THRESH_BINARY_INV)
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            area = w * h
            
            # More relaxed size constraints
            if area < 25 or area > 50000:
                continue
            
            aspect_ratio = w / h if h > 0 else 0
            
            # More relaxed aspect ratio constraints
            if 0.6 <= aspect_ratio <= 1.4 and 8 <= w <= 100 and 8 <= h <= 100:
                # Checkbox
                all_checkboxes.append({
                    'type': 'checkbox',
                    'x': x, 'y': y, 'width': w, 'height': h,
                    'area': area, 'aspect_ratio': aspect_ratio,
                    'method': f'contour_t{thresh_val}'
                })
            elif 1.2 <= aspect_ratio <= 20.0 and 25 <= w <= 800 and 6 <= h <= 80:
                # Input box (much more relaxed)
                all_input_boxes.append({
                    'type': 'input_box',
                    'x': x, 'y': y, 'width': w, 'height': h,
                    'area': area, 'aspect_ratio': aspect_ratio,
                    'method': f'contour_t{thresh_val}'
                })
    
    # Remove duplicates based on overlap
    unique_input_boxes = remove_overlapping_boxes(all_input_boxes)
    unique_checkboxes = remove_overlapping_boxes(all_checkboxes)
    
    return unique_input_boxes, unique_checkboxes


def remove_overlapping_boxes(boxes):
    """Remove overlapping boxes, keeping the one with larger area."""
    if not boxes:
        return []
    
    # Sort by area (largest first)
    sorted_boxes = sorted(boxes, key=lambda x: x['area'], reverse=True)
    unique_boxes = []
    
    for box in sorted_boxes:
        is_duplicate = False
        
        for existing_box in unique_boxes:
            # Check for overlap
            overlap = calculate_overlap(box, existing_box)
            if overlap > 0.3:  # 30% overlap threshold (more lenient)
                is_duplicate = True
                break
        
        if not is_duplicate:
            unique_boxes.append(box)
    
    return unique_boxes


def calculate_overlap(box1, box2):
    """Calculate overlap ratio between two boxes."""
    x1_min, y1_min = box1['x'], box1['y']
    x1_max, y1_max = x1_min + box1['width'], y1_min + box1['height']
    
    x2_min, y2_min = box2['x'], box2['y']
    x2_max, y2_max = x2_min + box2['width'], y2_min + box2['height']
    
    # Calculate intersection
    x_overlap = max(0, min(x1_max, x2_max) - max(x1_min, x2_min))
    y_overlap = max(0, min(y1_max, y2_max) - max(y1_min, y2_min))
    
    if x_overlap == 0 or y_overlap == 0:
        return 0.0
    
    intersection = x_overlap * y_overlap
    area1 = box1['width'] * box1['height']
    area2 = box2['width'] * box2['height']
    union = area1 + area2 - intersection
    
    return intersection / union if union > 0 else 0.0


def normalize_pixel_coordinates(pixel_boxes, image_width, image_height, pdf_width=612.0, pdf_height=792.0):
    """Normalize pixel coordinates from image to 0-1 range based on PDF dimensions."""
    normalized_boxes = []
    
    # Calculate scale factor from image pixels to PDF points
    # Image is at 150 DPI, PDF is at 72 DPI
    scale_x = pdf_width / image_width
    scale_y = pdf_height / image_height
    
    for box in pixel_boxes:
        # Convert pixel coordinates to PDF points, then normalize
        pdf_x = box['x'] * scale_x
        pdf_y = box['y'] * scale_y
        pdf_width_box = box['width'] * scale_x
        pdf_height_box = box['height'] * scale_y
        
        # Normalize to 0-1 range
        normalized_box = {
            **box,  # Keep all original properties
            'x': pdf_x / pdf_width,
            'y': pdf_y / pdf_height,
            'width': pdf_width_box / pdf_width,
            'height': pdf_height_box / pdf_height,
            'raw_x': box['x'],  # Keep original pixel coordinates for debugging
            'raw_y': box['y'],
            'raw_width': box['width'],
            'raw_height': box['height']
        }
        normalized_boxes.append(normalized_box)
    
    return normalized_boxes


def process_single_page_for_fields(page_pdf_path, pdf_image, page_number, output_dir):
    """Process a single page using separate pipelines for labels vs input fields with coordinate normalization"""
    try:
        text_labels = extract_labels_with_unstructured(page_pdf_path, page_number)
        
        text_elements = extract_text_elements_from_page(page_pdf_path, page_number)
        
        import numpy as np
        cv_image = np.array(pdf_image)
        cleaned_image = remove_text_elements_from_image(cv_image, text_elements)
        
        input_boxes, checkboxes = detect_input_boxes_and_checkboxes(cleaned_image)
        
        image_height, image_width = cv_image.shape[:2]
        normalized_input_boxes = normalize_pixel_coordinates(input_boxes, image_width, image_height)
        normalized_checkboxes = normalize_pixel_coordinates(checkboxes, image_width, image_height)
        
        return {
            'page': page_number,
            'text_elements': len(text_labels),
            'input_boxes': len(normalized_input_boxes),
            'checkboxes': len(normalized_checkboxes),
            'text_elements_raw': text_labels,
            'input_boxes_raw': normalized_input_boxes,
            'checkboxes_raw': normalized_checkboxes
        }
        
    except Exception as e:
        return {
            'page': page_number,
            'text_elements': 0,
            'input_boxes': 0,
            'checkboxes': 0,
            'text_elements_raw': [],
            'input_boxes_raw': [],
            'checkboxes_raw': []
        }


def process_pdf_for_form_fields(pdf_path, min_label_length=MIN_LABEL_LENGTH):
    """
    Process a PDF file for form field detection and return structured results.
    This function is called by the Flask server.
    
    Args:
        pdf_path: Path to the PDF file to process
        min_label_length: Minimum character length for labels to be included (default: 5)
    """
    try:
        pdf_path = Path(pdf_path)
        
        # Create a temporary output directory
        with tempfile.TemporaryDirectory() as temp_output_dir:
            output_dir = Path(temp_output_dir)
            
            # Process the PDF
            all_results = []
            
            # Split PDF and convert to images
            page_pdf_paths, total_pages = split_pdf_into_pages(pdf_path, output_dir)
            images = []
            
            # Convert each page PDF to image
            from pdf2image import convert_from_path
            for page_pdf_path in page_pdf_paths:
                page_images = convert_from_path(page_pdf_path, dpi=150)
                if page_images:
                    images.append(page_images[0])  # Each single-page PDF has one image
            
            total_text_elements = 0
            total_input_boxes = 0
            total_checkboxes = 0
            
            for page_idx, (page_pdf_path, pdf_image) in enumerate(zip(page_pdf_paths, images)):
                page_number = page_idx + 1
                result = process_single_page_for_fields(page_pdf_path, pdf_image, page_number, output_dir)
                all_results.append(result)
                
                total_text_elements += result['text_elements']
                total_input_boxes += result['input_boxes']
                total_checkboxes += result['checkboxes']
            
            # Create the comprehensive output
            all_elements = []
            
            for page_result in all_results:
                page_num = page_result['page']
                
                # Add text elements (labels) - flatten coordinates for Rails compatibility
                # Filter out labels with less than 5 characters
                for text_elem in page_result.get('text_elements_raw', []):
                    text_content = text_elem.get('text', '').strip()
                    
                    # Skip labels that are too short
                    if len(text_content) < min_label_length:
                        continue
                    
                    element = {
                        'type': 'label',
                        'page': page_num,
                        'text': text_content,
                        'x': text_elem.get('x', 0),
                        'y': text_elem.get('y', 0),
                        'width': text_elem.get('width', 0),
                        'height': text_elem.get('height', 0)
                    }
                    all_elements.append(element)
                
                # Add input boxes - flatten coordinates for Rails compatibility
                for input_box in page_result.get('input_boxes_raw', []):
                    element = {
                        'type': 'input',
                        'page': page_num,
                        'text': '',
                        'x': input_box['x'],
                        'y': input_box['y'],
                        'width': input_box['width'],
                        'height': input_box['height'],
                        'detection_method': input_box.get('method', 'unknown'),
                        'area': input_box.get('area', 0),
                        'aspect_ratio': input_box.get('aspect_ratio', 0)
                    }
                    all_elements.append(element)
                
                # Add checkboxes - flatten coordinates for Rails compatibility
                for checkbox in page_result.get('checkboxes_raw', []):
                    element = {
                        'type': 'checkbox',
                        'page': page_num,
                        'text': '',
                        'x': checkbox['x'],
                        'y': checkbox['y'],
                        'width': checkbox['width'],
                        'height': checkbox['height'],
                        'detection_method': checkbox.get('method', 'unknown'),
                        'area': checkbox.get('area', 0),
                        'aspect_ratio': checkbox.get('aspect_ratio', 0)
                    }
                    all_elements.append(element)
            
            # Create summary
            summary = {
                'total_elements': len(all_elements),
                'total_pages': len(all_results),
                'by_type': {
                    'labels': len([e for e in all_elements if e['type'] == 'label']),
                    'inputs': len([e for e in all_elements if e['type'] == 'input']),
                    'checkboxes': len([e for e in all_elements if e['type'] == 'checkbox'])
                }
            }
            
            return {
                'summary': summary,
                'elements': all_elements
            }
            
    except Exception as e:
        raise


def extract_labels_with_unstructured(page_pdf_path: Path, page_number: int):
    """Extract text labels using Unstructured library (completely separate from input field detection)."""
    try:
        from .modern_extractor import extract_with_unstructured
        
        result = extract_with_unstructured(page_pdf_path, debug=False, fast_mode=True)
        
        if result.get('success', False):
            fields = result.get('form_fields', [])
            return fields
        else:
            return []
            
    except Exception as e:
        return []


app = Flask(__name__)


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({'status': 'healthy', 'service': 'form-field-processor'})


@app.route('/process', methods=['POST'])
def process_form_fields_endpoint():
    """Original endpoint for processing with Document AI data"""
    try:
        # Check if required files are present
        if 'pdf_file' not in request.files or 'docai_file' not in request.files:
            return jsonify({'error': 'Both pdf_file and docai_file are required'}), 400
        
        pdf_file = request.files['pdf_file']
        docai_file = request.files['docai_file']
        
        # Validate files
        if pdf_file.filename == '' or docai_file.filename == '':
            return jsonify({'error': 'Both files must be selected'}), 400
        
        # Save uploaded files temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as pdf_temp:
            pdf_file.save(pdf_temp.name)
            pdf_path = pdf_temp.name
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.json', mode='w') as docai_temp:
            docai_content = docai_file.read().decode('utf-8')
            docai_temp.write(docai_content)
            docai_temp.flush()
            docai_path = docai_temp.name
        
        try:
            # Parse Document AI JSON
            docai_data = json.loads(docai_content)
            
            # Validate Document AI structure
            if 'document_info' not in docai_data or 'fields' not in docai_data:
                return jsonify({'error': 'Invalid Document AI format. Expected document_info and fields'}), 400
            
            # Process the form fields
            result = process_form_fields(pdf_path, docai_data)
            
            return jsonify(result)
            
        finally:
            # Clean up temporary files
            try:
                os.unlink(pdf_path)
                os.unlink(docai_path)
            except OSError:
                pass
                
    except Exception as e:
        app.logger.error(f"Error processing form fields: {str(e)}")
        return jsonify({'error': f'Processing failed: {str(e)}'}), 500


@app.route('/process_pdf', methods=['POST'])
def process_pdf_endpoint():
    """New endpoint for processing PDF files directly without Document AI"""
    try:
        # Check if PDF file is present
        if 'pdf_file' not in request.files:
            return jsonify({'error': 'pdf_file is required'}), 400
        
        pdf_file = request.files['pdf_file']
        
        # Validate file
        if pdf_file.filename == '':
            return jsonify({'error': 'PDF file must be selected'}), 400
        
        # Get optional minimum label length parameter
        min_label_length = request.args.get('min_label_length', MIN_LABEL_LENGTH, type=int)
        min_label_length = max(1, min(50, min_label_length))  # Clamp between 1 and 50
        
        # Save uploaded PDF temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as pdf_temp:
            pdf_file.save(pdf_temp.name)
            pdf_path = pdf_temp.name
        
        try:
            result = process_pdf_for_form_fields(pdf_path, min_label_length)
            
            return jsonify(result)
            
        finally:
            # Clean up temporary file
            try:
                os.unlink(pdf_path)
            except OSError:
                pass
                
    except Exception as e:
        app.logger.error(f"Error processing PDF: {str(e)}")
        return jsonify({'error': f'PDF processing failed: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True) 
#!/usr/bin/env python3
"""
Test script that combines layout analysis with computer vision:
1. Use Unstructured to detect text labels and their bounding boxes
2. Remove detected text elements from the image 
3. Use OpenCV to detect input boxes and checkboxes in the cleaned image
4. Associate detected input fields with nearby text labels
"""

import sys
import json
import tempfile
from pathlib import Path
from typing import List, Dict, Tuple, Any

# Add the src directory to path
sys.path.insert(0, str(Path(__file__).parent / "src"))


def split_pdf_into_pages(pdf_path: Path, temp_dir: Path):
    """Split a multi-page PDF into individual single-page PDFs."""
    try:
        import PyPDF2
        
        page_paths = []
        
        with open(pdf_path, 'rb') as input_file:
            reader = PyPDF2.PdfReader(input_file)
            total_pages = len(reader.pages)
            
            print(f"📄 Splitting PDF into {total_pages} individual pages...")
            
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
        print("❌ PyPDF2 not found. Installing...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "PyPDF2"])
        return split_pdf_into_pages(pdf_path, temp_dir)
    except Exception as e:
        print(f"❌ Error splitting PDF: {e}")
        return [], 0


def extract_text_elements_from_page(page_pdf_path: Path, page_number: int):
    """Extract text elements and their coordinates using Unstructured."""
    try:
        from form_processor.modern_extractor import extract_with_unstructured
        
        print(f"🔍 Extracting text elements from page {page_number}...")
        result = extract_with_unstructured(page_pdf_path, debug=False, fast_mode=True)
        
        if result.get('success', False):
            fields = result.get('form_fields', [])
            print(f"  ✅ Found {len(fields)} text elements in {result.get('processing_time', 0):.2f}s")
            return fields
        else:
            print(f"  ❌ Failed to extract text from page {page_number}")
            return []
            
    except Exception as e:
        print(f"  ❌ Error extracting text from page {page_number}: {e}")
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
    
    print(f"  🧹 Removed {removed_count} text elements from image")
    return cleaned_image


def detect_input_boxes_and_checkboxes(cleaned_image):
    """Detect input boxes and checkboxes using contour-based methods only."""
    import cv2
    import numpy as np
    
    print("  🔍 Detecting input boxes and checkboxes with contour methods only...")
    
    # Convert to grayscale if needed
    if len(cleaned_image.shape) == 3:
        gray = cv2.cvtColor(cleaned_image, cv2.COLOR_BGR2GRAY)
    else:
        gray = cleaned_image.copy()
    
    all_input_boxes = []
    all_checkboxes = []
    
    # Method 1: Contour detection with multiple thresholds (blue elements)
    print("    🔸 Multi-threshold contour detection...")
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
    
    print(f"    📊 Before deduplication: {len(all_input_boxes)} inputs, {len(all_checkboxes)} checkboxes")
    print(f"  ✅ After deduplication: {len(unique_input_boxes)} input boxes, {len(unique_checkboxes)} checkboxes")
    
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
    
    overlap_area = x_overlap * y_overlap
    
    # Calculate union
    area1 = box1['area']
    area2 = box2['area']
    union_area = area1 + area2 - overlap_area
    
    return overlap_area / union_area if union_area > 0 else 0


def create_debug_images(original_image, cleaned_image, text_elements, input_boxes, checkboxes, page_num, output_dir):
    """Create debug images showing the detection process."""
    import cv2
    
    try:
        # 1. Save original image
        original_path = f"{output_dir}/page_{page_num:03d}_01_original.png"
        cv2.imwrite(original_path, original_image)
        
        # 2. Show text elements on original
        text_debug = original_image.copy()
        for elem in text_elements:
            x, y, w, h = int(elem.get('x', 0)), int(elem.get('y', 0)), int(elem.get('width', 0)), int(elem.get('height', 0))
            cv2.rectangle(text_debug, (x, y), (x + w, y + h), (0, 255, 0), 1)  # Green for text
        
        text_path = f"{output_dir}/page_{page_num:03d}_02_text_elements.png"
        cv2.imwrite(text_path, text_debug)
        
        # 3. Save cleaned image (text removed)
        cleaned_path = f"{output_dir}/page_{page_num:03d}_03_text_removed.png"
        cv2.imwrite(cleaned_path, cleaned_image)
        
        # 4. Show detection results on cleaned image only
        cleaned_debug = cleaned_image.copy()
        
        # Color mapping for different methods (only blue tones for contour detection)
        method_colors = {
            'contour_t240': (255, 0, 0),      # Blue
            'contour_t220': (200, 50, 0),     # Darker blue
            'contour_t200': (150, 100, 0),    # Darker blue
            'contour_t180': (100, 150, 0),    # Darker blue
            'contour_t160': (50, 200, 0),     # Darker blue
            'unknown': (128, 128, 128)        # Gray
        }
        
        # Draw input boxes
        for box in input_boxes:
            color = method_colors.get(box.get('method', 'unknown'), (128, 128, 128))
            cv2.rectangle(cleaned_debug, (box['x'], box['y']), 
                         (box['x'] + box['width'], box['y'] + box['height']), color, 2)
        
        # Draw checkboxes
        for box in checkboxes:
            color = method_colors.get(box.get('method', 'unknown'), (128, 128, 128))
            cv2.rectangle(cleaned_debug, (box['x'], box['y']), 
                         (box['x'] + box['width'], box['y'] + box['height']), color, 2)
        
        cleaned_detection_path = f"{output_dir}/page_{page_num:03d}_04_detected_on_cleaned.png"
        cv2.imwrite(cleaned_detection_path, cleaned_debug)
        
        print(f"    💾 Saved debug images for page {page_num}")
        
    except Exception as e:
        print(f"    ❌ Error creating debug images: {e}")
        import traceback
        traceback.print_exc()


def process_page_for_form_fields(page_pdf_path: Path, pdf_image, page_number: int, output_dir: Path):
    """Process a single page to detect form fields using combined approach."""
    import cv2
    import numpy as np
    
    print(f"\n🔍 Processing page {page_number} for form field detection...")
    
    # Convert PIL to OpenCV format
    cv_image = cv2.cvtColor(np.array(pdf_image), cv2.COLOR_RGB2BGR)
    
    # Step 1: Extract text elements
    text_elements = extract_text_elements_from_page(page_pdf_path, page_number)
    
    # Step 2: Remove text elements from image
    cleaned_image = remove_text_elements_from_image(cv_image, text_elements)
    
    # Step 3: Detect input boxes and checkboxes in cleaned image
    input_boxes, checkboxes = detect_input_boxes_and_checkboxes(cleaned_image)
    
    # Step 4: Create debug images
    create_debug_images(cv_image, cleaned_image, text_elements, input_boxes, checkboxes, page_number, output_dir)
    
    # Step 5: Match labels to input fields
    matched_pairs = match_labels_to_inputs(
        text_elements, 
        input_boxes, 
        checkboxes, 
        cv_image.shape[1], 
        cv_image.shape[0]
    )
    
    # Step 6: Create field matching debug image
    create_field_matching_debug_image(
        cv_image, 
        matched_pairs, 
        page_number, 
        output_dir
    )
    
    # Update results with matched pairs and raw data
    page_results = {
        'page': page_number,
        'text_elements': len(text_elements),
        'input_boxes': len(input_boxes),
        'checkboxes': len(checkboxes),
        'matched_pairs': len(matched_pairs),
        'unmatched_inputs': len(input_boxes) + len(checkboxes) - len(matched_pairs),
        'unmatched_labels': len(text_elements) - len(matched_pairs),
        'pairs': matched_pairs,
        # Store raw data for JSON output
        'text_elements_raw': text_elements,
        'input_boxes_raw': input_boxes,
        'checkboxes_raw': checkboxes
    }
    
    return page_results


def process_pdf_for_form_fields(pdf_path):
    """
    Process a PDF file for form field detection and return structured results.
    This function is called by the Flask server.
    """
    from pathlib import Path
    import tempfile
    import shutil
    
    try:
        pdf_path = Path(pdf_path)
        
        # Create a temporary output directory
        with tempfile.TemporaryDirectory() as temp_output_dir:
            output_dir = Path(temp_output_dir)
            
            # Process the PDF
            all_results = []
            
            # Split PDF and convert to images
            page_pdf_paths = split_pdf_into_pages(pdf_path, output_dir)[0]
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
            total_matched_pairs = 0
            
            for page_idx, (page_pdf_path, pdf_image) in enumerate(zip(page_pdf_paths, images)):
                page_number = page_idx + 1
                result = process_single_page_for_fields(page_pdf_path, pdf_image, page_number, output_dir)
                all_results.append(result)
                
                total_text_elements += result['text_elements']
                total_input_boxes += result['input_boxes']
                total_checkboxes += result['checkboxes']
                total_matched_pairs += result['matched_pairs']
            
            # Create the comprehensive output
            all_elements = []
            
            for page_result in all_results:
                page_num = page_result['page']
                
                # Add text elements (labels)
                for text_elem in page_result.get('text_elements_raw', []):
                    element = {
                        'type': 'label',
                        'page': page_num,
                        'text': text_elem.get('text', ''),
                        'coordinates': {
                            'x': text_elem.get('x', 0),
                            'y': text_elem.get('y', 0),
                            'width': text_elem.get('width', 0),
                            'height': text_elem.get('height', 0)
                        }
                    }
                    all_elements.append(element)
                
                # Add input boxes
                for input_box in page_result.get('input_boxes_raw', []):
                    element = {
                        'type': 'input',
                        'page': page_num,
                        'text': '',
                        'coordinates': {
                            'x': input_box['x'],
                            'y': input_box['y'],
                            'width': input_box['width'],
                            'height': input_box['height']
                        },
                        'detection_method': input_box.get('method', 'unknown'),
                        'area': input_box.get('area', 0),
                        'aspect_ratio': input_box.get('aspect_ratio', 0)
                    }
                    all_elements.append(element)
                
                # Add checkboxes
                for checkbox in page_result.get('checkboxes_raw', []):
                    element = {
                        'type': 'checkbox',
                        'page': page_num,
                        'text': '',
                        'coordinates': {
                            'x': checkbox['x'],
                            'y': checkbox['y'],
                            'width': checkbox['width'],
                            'height': checkbox['height']
                        },
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
            
            # Return structured result
            return {
                'summary': summary,
                'elements': all_elements
            }
            
    except Exception as e:
        print(f"❌ Error processing PDF: {e}")
        import traceback
        traceback.print_exc()
        raise


def process_single_page_for_fields(page_pdf_path, pdf_image, page_number, output_dir):
    """Process a single page for form field detection (simplified version for server)"""
    try:
        # Step 1: Extract text elements
        text_elements = extract_text_elements_from_page(page_pdf_path, page_number)
        
        # Step 2: Remove text from image
        cv_image = pdf_image
        cleaned_image = remove_text_elements_from_image(cv_image, text_elements)
        
        # Step 3: Detect input fields
        input_boxes, checkboxes = detect_input_boxes_and_checkboxes(cleaned_image)
        
        # Step 4: Match labels to inputs (simplified)
        matched_pairs = match_labels_to_inputs(
            text_elements, 
            input_boxes, 
            checkboxes, 
            cv_image.shape[1], 
            cv_image.shape[0]
        )
        
        return {
            'page': page_number,
            'text_elements': len(text_elements),
            'input_boxes': len(input_boxes),
            'checkboxes': len(checkboxes),
            'matched_pairs': len(matched_pairs),
            'text_elements_raw': text_elements,
            'input_boxes_raw': input_boxes,
            'checkboxes_raw': checkboxes
        }
        
    except Exception as e:
        print(f"❌ Error processing page {page_number}: {e}")
        return {
            'page': page_number,
            'text_elements': 0,
            'input_boxes': 0,
            'checkboxes': 0,
            'matched_pairs': 0,
            'text_elements_raw': [],
            'input_boxes_raw': [],
            'checkboxes_raw': []
        }


def match_labels_to_inputs(text_elements, input_boxes, checkboxes, page_width, page_height):
    """
    Match text labels to their corresponding input fields.
    Returns matched pairs and removes unmatched labels.
    """
    import math
    
    print("  🔗 Matching labels to input fields...")
    print(f"    📏 Page dimensions: {page_width}x{page_height}")
    print(f"    📝 Text elements: {len(text_elements)}")
    print(f"    🔲 Input fields: {len(input_boxes + checkboxes)}")
    
    # Debug: Print first few elements to understand coordinate systems
    if text_elements:
        print(f"    📝 Sample text element: {text_elements[0]}")
    if input_boxes:
        print(f"    🔲 Sample input box: {input_boxes[0]}")
    if checkboxes:
        print(f"    ☑️  Sample checkbox: {checkboxes[0]}")
    
    # Combine all input elements
    all_inputs = input_boxes + checkboxes
    
    matched_pairs = []
    used_inputs = set()
    
    # Debug counter
    debug_count = 0
    
    for text_elem in text_elements:
        text_x = text_elem.get('x', 0)
        text_y = text_elem.get('y', 0)
        text_w = text_elem.get('width', 0)
        text_h = text_elem.get('height', 0)
        
        # Skip elements with no dimensions
        if text_w <= 0 or text_h <= 0:
            continue
        
        # Calculate text boundaries
        text_left = text_x
        text_right = text_x + text_w
        text_top = text_y
        text_bottom = text_y + text_h
        text_center_x = text_x + text_w / 2
        text_center_y = text_y + text_h / 2
        
        best_match = None
        best_score = float('inf')
        best_input_idx = -1
        
        # Debug first few elements
        if debug_count < 3:
            print(f"    🔍 Text {debug_count+1}: '{text_elem.get('text', 'N/A')[:20]}...' at ({text_x:.1f}, {text_y:.1f}) size ({text_w:.1f}x{text_h:.1f})")
            debug_count += 1
        
        for idx, input_field in enumerate(all_inputs):
            if idx in used_inputs:
                continue
                
            input_x = input_field['x']
            input_y = input_field['y']
            input_w = input_field['width']
            input_h = input_field['height']
            
            # Calculate input boundaries
            input_left = input_x
            input_right = input_x + input_w
            input_top = input_y
            input_bottom = input_y + input_h
            input_center_x = input_x + input_w / 2
            input_center_y = input_y + input_h / 2
            
            # Calculate basic distance
            dx = text_center_x - input_center_x
            dy = text_center_y - input_center_y
            distance = math.sqrt(dx*dx + dy*dy)
            
            # Start with base distance
            score = distance
            
            # Bonus for typical form layouts
            # 1. Input to the right of text (same line)
            if input_left >= text_right - 20 and abs(dy) < 15:
                score *= 0.3  # Strong preference
            
            # 2. Input below text (stacked layout)
            elif input_top >= text_bottom - 10 and abs(dx) < 100:
                score *= 0.5  # Good preference
            
            # 3. Input above text (less common but valid)
            elif input_bottom <= text_top + 10 and abs(dx) < 100:
                score *= 0.7
            
            # 4. Overlapping vertically (side by side)
            elif (text_top <= input_bottom and text_bottom >= input_top):
                if input_left >= text_left - 50:  # Input to right or overlapping
                    score *= 0.4
                else:
                    score *= 1.5  # Penalty for input to left
            
            # Penalties for bad positions
            # Input far to the left of text
            if input_right < text_left - 100:
                score *= 3.0
            
            # Input far above text
            if input_bottom < text_top - 50:
                score *= 2.0
            
            # Very far distances
            if distance > min(page_width * 0.5, 500):
                score *= 2.0
            
            # Prefer reasonable aspect ratios for the pairing
            text_aspect = text_w / text_h if text_h > 0 else 1
            input_aspect = input_w / input_h if input_h > 0 else 1
            
            # Don't match very thin text with very wide inputs or vice versa
            if text_aspect > 10 and input_aspect < 2:
                score *= 1.5
            elif text_aspect < 2 and input_aspect > 10:
                score *= 1.5
            
            if score < best_score:
                best_score = score
                best_match = input_field
                best_input_idx = idx
        
        # More lenient threshold - accept more matches
        max_acceptable_score = min(page_width * 0.8, 800)  # Much more lenient
        
        if best_match and best_score < max_acceptable_score:
            matched_pairs.append({
                'label': text_elem,
                'input': best_match,
                'distance': math.sqrt((text_center_x - (best_match['x'] + best_match['width']/2))**2 + 
                                    (text_center_y - (best_match['y'] + best_match['height']/2))**2),
                'score': best_score
            })
            used_inputs.add(best_input_idx)
            
            # Debug successful matches
            if len(matched_pairs) <= 5:
                print(f"    ✅ Match {len(matched_pairs)}: '{text_elem.get('text', 'N/A')[:15]}' -> input at ({best_match['x']}, {best_match['y']}) score: {best_score:.1f}")
    
    print(f"  ✅ Matched {len(matched_pairs)} label-input pairs")
    print(f"  📊 Unmatched inputs: {len(all_inputs) - len(used_inputs)}")
    print(f"  📊 Unmatched labels: {len(text_elements) - len(matched_pairs)}")
    
    return matched_pairs


def create_field_matching_debug_image(original_image, matched_pairs, page_num, output_dir):
    """Create debug image showing matched label-input pairs in different colors."""
    import cv2
    import numpy as np
    import random
    
    debug_image = original_image.copy()
    
    # Generate distinct colors for each pair
    colors = []
    for i in range(len(matched_pairs)):
        # Generate vibrant, distinct colors
        hue = (i * 137) % 360  # Golden angle for good distribution
        saturation = 0.7 + (i % 3) * 0.1  # Vary saturation slightly
        value = 0.8 + (i % 2) * 0.2  # Vary brightness slightly
        
        # Convert HSV to RGB
        import colorsys
        r, g, b = colorsys.hsv_to_rgb(hue/360, saturation, value)
        color = (int(b*255), int(g*255), int(r*255))  # BGR for OpenCV
        colors.append(color)
    
    # Draw matched pairs
    for i, pair in enumerate(matched_pairs):
        color = colors[i]
        
        # Draw label rectangle
        label = pair['label']
        label_x = int(label.get('x', 0))
        label_y = int(label.get('y', 0))
        label_w = int(label.get('width', 0))
        label_h = int(label.get('height', 0))
        
        cv2.rectangle(debug_image, (label_x, label_y), 
                     (label_x + label_w, label_y + label_h), color, 2)
        
        # Draw input rectangle
        input_field = pair['input']
        input_x = input_field['x']
        input_y = input_field['y']
        input_w = input_field['width']
        input_h = input_field['height']
        
        cv2.rectangle(debug_image, (input_x, input_y), 
                     (input_x + input_w, input_y + input_h), color, 2)
        
        # Draw connecting line
        label_center_x = label_x + label_w // 2
        label_center_y = label_y + label_h // 2
        input_center_x = input_x + input_w // 2
        input_center_y = input_y + input_h // 2
        
        cv2.line(debug_image, (label_center_x, label_center_y), 
                (input_center_x, input_center_y), color, 1)
        
        # Add pair number
        cv2.putText(debug_image, str(i+1), (label_x-15, label_y), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
    
    # Save debug image
    debug_path = f"{output_dir}/page_{page_num:03d}_06_matched_pairs.png"
    cv2.imwrite(debug_path, debug_image)
    print(f"    💾 Saved field matching debug: {debug_path}")
    
    return debug_path


def create_comprehensive_json_output(all_results, output_dir):
    """Create a comprehensive JSON file with all detected elements."""
    import json
    
    all_elements = []
    
    for page_result in all_results:
        page_num = page_result['page']
        
        # Add text elements (labels)
        for text_elem in page_result.get('text_elements_raw', []):
            element = {
                'type': 'label',
                'page': page_num,
                'text': text_elem.get('text', ''),
                'coordinates': {
                    'x': text_elem.get('x', 0),
                    'y': text_elem.get('y', 0),
                    'width': text_elem.get('width', 0),
                    'height': text_elem.get('height', 0)
                },
                'bounding_box': {
                    'left': text_elem.get('x', 0),
                    'top': text_elem.get('y', 0),
                    'right': text_elem.get('x', 0) + text_elem.get('width', 0),
                    'bottom': text_elem.get('y', 0) + text_elem.get('height', 0)
                }
            }
            all_elements.append(element)
        
        # Add input boxes
        for input_box in page_result.get('input_boxes_raw', []):
            element = {
                'type': 'input',
                'page': page_num,
                'text': '',  # Input boxes don't have text
                'coordinates': {
                    'x': input_box['x'],
                    'y': input_box['y'],
                    'width': input_box['width'],
                    'height': input_box['height']
                },
                'bounding_box': {
                    'left': input_box['x'],
                    'top': input_box['y'],
                    'right': input_box['x'] + input_box['width'],
                    'bottom': input_box['y'] + input_box['height']
                },
                'detection_method': input_box.get('method', 'unknown'),
                'area': input_box.get('area', 0),
                'aspect_ratio': input_box.get('aspect_ratio', 0)
            }
            all_elements.append(element)
        
        # Add checkboxes
        for checkbox in page_result.get('checkboxes_raw', []):
            element = {
                'type': 'checkbox',
                'page': page_num,
                'text': '',  # Checkboxes don't have text
                'coordinates': {
                    'x': checkbox['x'],
                    'y': checkbox['y'],
                    'width': checkbox['width'],
                    'height': checkbox['height']
                },
                'bounding_box': {
                    'left': checkbox['x'],
                    'top': checkbox['y'],
                    'right': checkbox['x'] + checkbox['width'],
                    'bottom': checkbox['y'] + checkbox['height']
                },
                'detection_method': checkbox.get('method', 'unknown'),
                'area': checkbox.get('area', 0),
                'aspect_ratio': checkbox.get('aspect_ratio', 0)
            }
            all_elements.append(element)
    
    # Create summary
    summary = {
        'total_elements': len(all_elements),
        'by_type': {
            'labels': len([e for e in all_elements if e['type'] == 'label']),
            'inputs': len([e for e in all_elements if e['type'] == 'input']),
            'checkboxes': len([e for e in all_elements if e['type'] == 'checkbox'])
        },
        'by_page': {}
    }
    
    # Count by page
    for page_num in range(1, 8):  # Assuming 7 pages
        page_elements = [e for e in all_elements if e['page'] == page_num]
        summary['by_page'][f'page_{page_num}'] = {
            'total': len(page_elements),
            'labels': len([e for e in page_elements if e['type'] == 'label']),
            'inputs': len([e for e in page_elements if e['type'] == 'input']),
            'checkboxes': len([e for e in page_elements if e['type'] == 'checkbox'])
        }
    
    # Create final output
    output = {
        'summary': summary,
        'elements': all_elements
    }
    
    # Save to JSON file
    json_path = f"{output_dir}/all_elements.json"
    with open(json_path, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"📄 Comprehensive JSON saved to: {json_path}")
    print(f"📊 Total elements: {summary['total_elements']}")
    print(f"   • Labels: {summary['by_type']['labels']}")
    print(f"   • Inputs: {summary['by_type']['inputs']}")
    print(f"   • Checkboxes: {summary['by_type']['checkboxes']}")
    
    return json_path


def main():
    """Main function to run the form field detection."""
    # Default PDF path
    pdf_path = Path("../uploads/i-907_Jaz6iX6.pdf")
    
    # Check if PDF exists
    if not pdf_path.exists():
        print(f"❌ PDF not found: {pdf_path}")
        print("💡 Please ensure the PDF file exists or update the path in the script")
        return
    
    # Process the PDF
    process_pdf_for_form_fields(pdf_path)


if __name__ == "__main__":
    main() 
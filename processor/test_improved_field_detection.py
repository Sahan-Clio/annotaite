#!/usr/bin/env python3
"""
Improved form field detection with enhanced OpenCV input detection methods.
This version uses multiple detection approaches to find more input fields.
"""

import sys
import json
import tempfile
from pathlib import Path

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


def extract_text_elements(page_pdf_path: Path, page_number: int):
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


def detect_input_fields_improved(cleaned_image):
    """Improved input field detection using multiple OpenCV methods."""
    import cv2
    import numpy as np
    
    print("  🔍 Detecting input fields with improved methods...")
    
    # Convert to grayscale if needed
    if len(cleaned_image.shape) == 3:
        gray = cv2.cvtColor(cleaned_image, cv2.COLOR_BGR2GRAY)
    else:
        gray = cleaned_image.copy()
    
    all_input_boxes = []
    all_checkboxes = []
    
    # Method 1: Contour-based detection (original approach with relaxed parameters)
    print("    🔸 Method 1: Contour detection...")
    boxes1, checks1 = detect_with_contours(gray)
    all_input_boxes.extend(boxes1)
    all_checkboxes.extend(checks1)
    print(f"      Found {len(boxes1)} input boxes, {len(checks1)} checkboxes")
    
    # Method 2: Line-based detection
    print("    🔸 Method 2: Line detection...")
    boxes2, checks2 = detect_with_lines(gray)
    all_input_boxes.extend(boxes2)
    all_checkboxes.extend(checks2)
    print(f"      Found {len(boxes2)} input boxes, {len(checks2)} checkboxes")
    
    # Method 3: Morphological operations
    print("    🔸 Method 3: Morphological detection...")
    boxes3, checks3 = detect_with_morphology(gray)
    all_input_boxes.extend(boxes3)
    all_checkboxes.extend(checks3)
    print(f"      Found {len(boxes3)} input boxes, {len(checks3)} checkboxes")
    
    # Method 4: Template matching for common field patterns
    print("    🔸 Method 4: Pattern detection...")
    boxes4, checks4 = detect_with_patterns(gray)
    all_input_boxes.extend(boxes4)
    all_checkboxes.extend(checks4)
    print(f"      Found {len(boxes4)} input boxes, {len(checks4)} checkboxes")
    
    # Remove duplicates based on overlap
    unique_input_boxes = remove_overlapping_boxes(all_input_boxes)
    unique_checkboxes = remove_overlapping_boxes(all_checkboxes)
    
    print(f"  ✅ Total after deduplication: {len(unique_input_boxes)} input boxes, {len(unique_checkboxes)} checkboxes")
    return unique_input_boxes, unique_checkboxes


def detect_with_contours(gray):
    """Original contour-based detection with relaxed parameters."""
    import cv2
    
    # Apply binary threshold with multiple thresholds
    input_boxes = []
    checkboxes = []
    
    for thresh_val in [240, 220, 200, 180]:
        _, binary = cv2.threshold(gray, thresh_val, 255, cv2.THRESH_BINARY_INV)
        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            area = w * h
            
            # More relaxed size constraints
            if area < 30 or area > 50000:
                continue
            
            aspect_ratio = w / h if h > 0 else 0
            
            # More relaxed aspect ratio constraints
            if 0.7 <= aspect_ratio <= 1.3 and 8 <= w <= 80 and 8 <= h <= 80:
                # Checkbox
                checkboxes.append({
                    'type': 'checkbox',
                    'x': x, 'y': y, 'width': w, 'height': h,
                    'area': area, 'aspect_ratio': aspect_ratio,
                    'method': 'contour', 'threshold': thresh_val
                })
            elif 1.5 <= aspect_ratio <= 15.0 and 30 <= w <= 600 and 8 <= h <= 60:
                # Input box
                input_boxes.append({
                    'type': 'input_box',
                    'x': x, 'y': y, 'width': w, 'height': h,
                    'area': area, 'aspect_ratio': aspect_ratio,
                    'method': 'contour', 'threshold': thresh_val
                })
    
    return input_boxes, checkboxes


def detect_with_lines(gray):
    """Detect input fields by finding rectangular line patterns."""
    import cv2
    import numpy as np
    
    input_boxes = []
    checkboxes = []
    
    # Apply edge detection
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    
    # Detect horizontal and vertical lines
    horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))
    vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 40))
    
    horizontal_lines = cv2.morphologyEx(edges, cv2.MORPH_OPEN, horizontal_kernel)
    vertical_lines = cv2.morphologyEx(edges, cv2.MORPH_OPEN, vertical_kernel)
    
    # Combine lines
    combined_lines = cv2.addWeighted(horizontal_lines, 0.5, vertical_lines, 0.5, 0.0)
    
    # Find contours of line intersections
    contours, _ = cv2.findContours(combined_lines, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = w * h
        
        if area < 50 or area > 20000:
            continue
        
        aspect_ratio = w / h if h > 0 else 0
        
        if 0.7 <= aspect_ratio <= 1.3 and 10 <= w <= 60 and 10 <= h <= 60:
            checkboxes.append({
                'type': 'checkbox',
                'x': x, 'y': y, 'width': w, 'height': h,
                'area': area, 'aspect_ratio': aspect_ratio,
                'method': 'lines'
            })
        elif 2.0 <= aspect_ratio <= 12.0 and 40 <= w <= 500 and 10 <= h <= 50:
            input_boxes.append({
                'type': 'input_box',
                'x': x, 'y': y, 'width': w, 'height': h,
                'area': area, 'aspect_ratio': aspect_ratio,
                'method': 'lines'
            })
    
    return input_boxes, checkboxes


def detect_with_morphology(gray):
    """Detect fields using morphological operations."""
    import cv2
    import numpy as np
    
    input_boxes = []
    checkboxes = []
    
    # Apply binary threshold
    _, binary = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
    
    # Different kernel sizes for different field types
    kernels = [
        cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3)),
        cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5)),
        cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
    ]
    
    for kernel in kernels:
        # Apply morphological operations
        opening = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
        closing = cv2.morphologyEx(opening, cv2.MORPH_CLOSE, kernel)
        
        # Find contours
        contours, _ = cv2.findContours(closing, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            area = w * h
            
            if area < 40 or area > 30000:
                continue
            
            aspect_ratio = w / h if h > 0 else 0
            
            if 0.6 <= aspect_ratio <= 1.4 and 10 <= w <= 70 and 10 <= h <= 70:
                checkboxes.append({
                    'type': 'checkbox',
                    'x': x, 'y': y, 'width': w, 'height': h,
                    'area': area, 'aspect_ratio': aspect_ratio,
                    'method': 'morphology'
                })
            elif 1.8 <= aspect_ratio <= 20.0 and 35 <= w <= 700 and 8 <= h <= 80:
                input_boxes.append({
                    'type': 'input_box',
                    'x': x, 'y': y, 'width': w, 'height': h,
                    'area': area, 'aspect_ratio': aspect_ratio,
                    'method': 'morphology'
                })
    
    return input_boxes, checkboxes


def detect_with_patterns(gray):
    """Detect common form field patterns."""
    import cv2
    import numpy as np
    
    input_boxes = []
    checkboxes = []
    
    # Look for underline patterns (common in forms)
    # Create kernel for horizontal lines
    horizontal_kernel = np.ones((1, 30), np.uint8)
    
    # Apply morphological operations to detect horizontal lines
    horizontal_lines = cv2.morphologyEx(gray, cv2.MORPH_OPEN, horizontal_kernel)
    
    # Threshold to get binary image
    _, binary = cv2.threshold(horizontal_lines, 50, 255, cv2.THRESH_BINARY_INV)
    
    # Find contours
    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        area = w * h
        
        if area < 100 or area > 15000:
            continue
        
        aspect_ratio = w / h if h > 0 else 0
        
        # Look for long horizontal lines (underlines for input fields)
        if aspect_ratio >= 5.0 and w >= 50 and h <= 20:
            # Create an input box above the line
            input_boxes.append({
                'type': 'input_box',
                'x': x, 'y': max(0, y - 25), 'width': w, 'height': 30,
                'area': w * 30, 'aspect_ratio': w / 30,
                'method': 'pattern_underline'
            })
    
    # Look for box patterns (empty rectangles)
    edges = cv2.Canny(gray, 50, 150)
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    for contour in contours:
        # Approximate contour to polygon
        epsilon = 0.02 * cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, epsilon, True)
        
        # Look for rectangular shapes (4 corners)
        if len(approx) == 4:
            x, y, w, h = cv2.boundingRect(contour)
            area = w * h
            
            if area < 50 or area > 10000:
                continue
            
            aspect_ratio = w / h if h > 0 else 0
            
            if 0.8 <= aspect_ratio <= 1.2 and 12 <= w <= 50 and 12 <= h <= 50:
                checkboxes.append({
                    'type': 'checkbox',
                    'x': x, 'y': y, 'width': w, 'height': h,
                    'area': area, 'aspect_ratio': aspect_ratio,
                    'method': 'pattern_rectangle'
                })
            elif 2.0 <= aspect_ratio <= 10.0 and 40 <= w <= 400 and 15 <= h <= 40:
                input_boxes.append({
                    'type': 'input_box',
                    'x': x, 'y': y, 'width': w, 'height': h,
                    'area': area, 'aspect_ratio': aspect_ratio,
                    'method': 'pattern_rectangle'
                })
    
    return input_boxes, checkboxes


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
            if overlap > 0.5:  # 50% overlap threshold
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


def create_debug_images(original_image, cleaned_image, text_elements, input_boxes, checkboxes, page_number, output_dir):
    """Create debug images showing the detection process."""
    import cv2
    import numpy as np
    
    # 1. Original image with text elements highlighted
    text_debug = original_image.copy()
    for element in text_elements:
        if 'coordinates' in element and element['coordinates']:
            coords = element['coordinates']
            if isinstance(coords, dict) and 'points' in coords:
                points = coords['points']
                if len(points) >= 2:
                    x1, y1 = points[0][0], points[0][1]
                    if len(points) > 2:
                        x2, y2 = points[2][0], points[2][1]
                    else:
                        x2, y2 = points[1][0], points[1][1]
                    
                    x, y = min(x1, x2), min(y1, y2)
                    width, height = abs(x2 - x1), abs(y2 - y1)
                    
                    # Scale coordinates
                    scale_factor = 150 / 72
                    x *= scale_factor
                    y *= scale_factor
                    width *= scale_factor
                    height *= scale_factor
                    
                    # Draw rectangle around text
                    cv2.rectangle(text_debug, (int(x), int(y)), (int(x + width), int(y + height)), (0, 255, 0), 2)
    
    # 2. Detected input fields on original image with method labels
    input_debug = original_image.copy()
    
    # Color mapping for different methods
    method_colors = {
        'contour': (255, 0, 0),      # Blue
        'lines': (0, 255, 0),        # Green
        'morphology': (0, 0, 255),   # Red
        'pattern_underline': (255, 255, 0),  # Cyan
        'pattern_rectangle': (255, 0, 255)   # Magenta
    }
    
    # Draw input boxes with different colors for different methods
    for i, box in enumerate(input_boxes):
        method = box.get('method', 'unknown')
        color = method_colors.get(method, (128, 128, 128))
        
        cv2.rectangle(input_debug, (box['x'], box['y']), 
                     (box['x'] + box['width'], box['y'] + box['height']), color, 2)
        
        # Add method label
        label = f"{method[:4]}{i+1}"
        cv2.putText(input_debug, label, (box['x'], box['y'] - 5), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)
    
    # Draw checkboxes
    for i, box in enumerate(checkboxes):
        method = box.get('method', 'unknown')
        color = method_colors.get(method, (128, 128, 128))
        
        cv2.rectangle(input_debug, (box['x'], box['y']), 
                     (box['x'] + box['width'], box['y'] + box['height']), color, 2)
        
        label = f"C{i+1}"
        cv2.putText(input_debug, label, (box['x'], box['y'] - 5), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)
    
    # Save debug images
    cv2.imwrite(str(output_dir / f"page_{page_number:03d}_01_original.png"), original_image)
    cv2.imwrite(str(output_dir / f"page_{page_number:03d}_02_text_elements.png"), text_debug)
    cv2.imwrite(str(output_dir / f"page_{page_number:03d}_03_text_removed.png"), cleaned_image)
    cv2.imwrite(str(output_dir / f"page_{page_number:03d}_04_detected_inputs.png"), input_debug)
    
    print(f"  🎨 Saved debug images for page {page_number}")


def process_page_for_form_fields(page_pdf_path: Path, pdf_image, page_number: int, output_dir: Path):
    """Process a single page to detect form fields using improved approach."""
    import cv2
    import numpy as np
    
    print(f"\n🔍 Processing page {page_number} for improved form field detection...")
    
    # Convert PIL to OpenCV format
    cv_image = cv2.cvtColor(np.array(pdf_image), cv2.COLOR_RGB2BGR)
    
    # Step 1: Extract text elements using Unstructured
    text_elements = extract_text_elements(page_pdf_path, page_number)
    
    # Step 2: Remove text elements from image
    cleaned_image = remove_text_elements_from_image(cv_image, text_elements)
    
    # Step 3: Detect input boxes and checkboxes with improved methods
    input_boxes, checkboxes = detect_input_fields_improved(cleaned_image)
    
    # Step 4: Create debug images
    create_debug_images(cv_image, cleaned_image, text_elements, input_boxes, checkboxes, page_number, output_dir)
    
    return {
        'page_number': page_number,
        'text_elements_count': len(text_elements),
        'input_boxes_count': len(input_boxes),
        'checkboxes_count': len(checkboxes),
        'text_elements': text_elements,
        'input_boxes': input_boxes,
        'checkboxes': checkboxes
    }


def process_pdf_for_form_fields(pdf_path: Path, output_dir: Path = None):
    """Process PDF to detect form fields using improved approach."""
    try:
        from pdf2image import convert_from_path
        
        # Set up output directory
        if output_dir is None:
            output_dir = pdf_path.parent / "improved_field_detection"
        output_dir.mkdir(exist_ok=True)
        
        print("🎯 Improved Form Field Detection (Layout + Enhanced CV)")
        print("=" * 70)
        print(f"📄 Input PDF: {pdf_path.name}")
        print(f"📁 Output directory: {output_dir}")
        
        # Create temporary directory for individual page PDFs
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # Split PDF into individual pages
            page_pdf_paths, total_pages = split_pdf_into_pages(pdf_path, temp_path)
            
            if not page_pdf_paths:
                print("❌ Failed to split PDF into pages")
                return
            
            # Convert original PDF to images
            print(f"\n📸 Converting PDF pages to images...")
            images = convert_from_path(pdf_path, dpi=150)
            
            # Process each page
            all_results = []
            total_text_elements = 0
            total_input_boxes = 0
            total_checkboxes = 0
            
            for page_idx, (page_pdf_path, pdf_image) in enumerate(zip(page_pdf_paths, images)):
                page_number = page_idx + 1
                
                result = process_page_for_form_fields(page_pdf_path, pdf_image, page_number, output_dir)
                all_results.append(result)
                
                total_text_elements += result['text_elements_count']
                total_input_boxes += result['input_boxes_count']
                total_checkboxes += result['checkboxes_count']
                
                print(f"  ✅ Page {page_number}: {result['text_elements_count']} text, {result['input_boxes_count']} inputs, {result['checkboxes_count']} checkboxes")
            
            # Save detailed results
            results_file = output_dir / "improved_detection_results.json"
            summary = {
                'pdf_file': str(pdf_path),
                'total_pages': total_pages,
                'summary': {
                    'total_text_elements': total_text_elements,
                    'total_input_boxes': total_input_boxes,
                    'total_checkboxes': total_checkboxes
                },
                'page_results': all_results
            }
            
            with open(results_file, 'w') as f:
                json.dump(summary, f, indent=2, default=str)
            
            print(f"\n🎉 Improved Form Field Detection Complete!")
            print(f"📊 Summary:")
            print(f"   • {total_pages} pages processed")
            print(f"   • {total_text_elements} text elements found")
            print(f"   • {total_input_boxes} input boxes detected")
            print(f"   • {total_checkboxes} checkboxes detected")
            print(f"   • Debug images saved to: {output_dir}")
            print(f"   • Results saved to: {results_file}")
            
            # Show page-by-page breakdown
            print(f"\n📋 Page-by-Page Results:")
            for result in all_results:
                page_num = result['page_number']
                print(f"   • Page {page_num}: {result['text_elements_count']} text, {result['input_boxes_count']} inputs, {result['checkboxes_count']} checkboxes")
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("💡 Make sure you have pdf2image, opencv-python, PyPDF2, and pillow installed")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


def main():
    """Main function to run the improved form field detection."""
    print("🎯 Improved Form Field Detection Test")
    print("This will use multiple OpenCV methods to detect more input fields")


if __name__ == "__main__":
    main() 
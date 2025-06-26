"""
Modern form field extraction using Unstructured library.
This provides a faster, more accurate alternative to OpenCV-based preprocessing.
"""

import json
from pathlib import Path
from typing import Dict, List, Any, Optional
import time

try:
    from unstructured.partition.auto import partition  # type: ignore
    from unstructured.partition.pdf import partition_pdf  # type: ignore
    unstructured_available = True
except ImportError:
    unstructured_available = False
    partition = None
    partition_pdf = None

# Import for visual field marking
try:
    from pdf2image import convert_from_path  # type: ignore
    import cv2  # type: ignore
    import numpy as np  # type: ignore
    from PIL import Image, ImageDraw, ImageFont  # type: ignore
    visual_marking_available = True
except ImportError:
    visual_marking_available = False


def create_visual_field_map(pdf_path: Path, form_fields: List[Dict], debug_dir: Path) -> Optional[str]:
    """
    Create a visual representation of detected form fields on the PDF.
    
    Args:
        pdf_path: Path to the original PDF
        form_fields: List of detected form fields with coordinates
        debug_dir: Directory to save debug images
        
    Returns:
        Path to the generated visual field map or None if failed
    """
    if not visual_marking_available:
        print("⚠️  Visual marking dependencies not available. Install with: pip install pdf2image opencv-python pillow")
        return None
    
    try:
        # Convert PDF to image
        print("📸 Converting PDF to image for visual field marking...")
        images = convert_from_path(pdf_path, dpi=150, first_page=1, last_page=1)
        
        if not images:
            print("❌ Failed to convert PDF to image")
            return None
        
        # Get the first page
        pdf_image = images[0]
        
        # Convert PIL to OpenCV format
        cv_image = cv2.cvtColor(np.array(pdf_image), cv2.COLOR_RGB2BGR)
        
        # Draw rectangles around detected fields
        field_count = 0
        colors = [
            (0, 255, 0),    # Green
            (255, 0, 0),    # Blue  
            (0, 0, 255),    # Red
            (255, 255, 0),  # Cyan
            (255, 0, 255),  # Magenta
            (0, 255, 255),  # Yellow
        ]
        
        for i, field in enumerate(form_fields):
            if 'coordinates' in field and field['coordinates']:
                coords = field['coordinates']
                
                # Extract coordinates (format may vary)
                x, y, width, height = 0, 0, 0, 0
                
                if isinstance(coords, dict):
                    if 'points' in coords:
                        # Handle points format
                        points = coords['points']
                        if len(points) >= 2:
                            x1, y1 = points[0]['x'], points[0]['y']
                            x2, y2 = points[1]['x'], points[1]['y']
                            x, y = min(x1, x2), min(y1, y2)
                            width, height = abs(x2 - x1), abs(y2 - y1)
                    elif all(k in coords for k in ['x', 'y', 'width', 'height']):
                        x, y, width, height = coords['x'], coords['y'], coords['width'], coords['height']
                
                if width > 0 and height > 0:
                    # Choose color
                    color = colors[field_count % len(colors)]
                    
                    # Draw rectangle
                    cv2.rectangle(cv_image, (int(x), int(y)), (int(x + width), int(y + height)), color, 2)
                    
                    # Add field number label
                    label = f"F{field_count + 1}"
                    cv2.putText(cv_image, label, (int(x), int(y - 5)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 1)
                    
                    field_count += 1
        
        # Save the marked image
        output_path = debug_dir / "detected_fields_visual.png"
        cv2.imwrite(str(output_path), cv_image)
        
        print(f"📸 Visual field map saved: {output_path}")
        print(f"🎯 Marked {field_count} form fields on the image")
        
        return str(output_path)
        
    except Exception as e:
        print(f"❌ Error creating visual field map: {str(e)}")
        return None


def extract_with_unstructured(pdf_path: Path, debug: bool = False, fast_mode: bool = True) -> Dict[str, Any]:
    start_time = time.time()
    
    try:
        from unstructured.partition.pdf import partition_pdf
        
        elements = partition_pdf(
            filename=str(pdf_path),
            strategy="fast" if fast_mode else "hi_res",
            infer_table_structure=False,
            extract_images=False,
            extract_image_block_types=[],
            include_page_breaks=False
        )
        
        form_fields = []
        
        for element in elements:
            element_data = {
                'text': str(element),
                'type': element.category,
                'page': getattr(element.metadata, 'page_number', 1)
            }
            
            coordinates = getattr(element.metadata, 'coordinates', None)
            
            if coordinates and isinstance(coordinates, dict) and 'points' in coordinates:
                points = coordinates['points']
                if points and len(points) >= 2:
                    x_coords = [point[0] for point in points]
                    y_coords = [point[1] for point in points]
                    
                    x_min = min(x_coords)
                    y_min = min(y_coords)
                    x_max = max(x_coords)
                    y_max = max(y_coords)
                    
                    page_width = coordinates.get('layout_width', 612.0)
                    page_height = coordinates.get('layout_height', 792.0)
                    
                    element_data['x'] = x_min / page_width
                    element_data['y'] = y_min / page_height
                    element_data['width'] = (x_max - x_min) / page_width
                    element_data['height'] = (y_max - y_min) / page_height
                else:
                    element_data['x'] = element_data['y'] = element_data['width'] = element_data['height'] = 0
            else:
                element_data['x'] = element_data['y'] = element_data['width'] = element_data['height'] = 0
            
            form_fields.append(element_data)
        
        processing_time = time.time() - start_time
        
        return {
            'success': True,
            'form_fields': form_fields,
            'processing_time': processing_time,
            'total_fields': len(form_fields)
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'form_fields': [],
            'processing_time': time.time() - start_time,
            'total_fields': 0
        }


def extract_with_layoutlm_approach(pdf_path: Path, debug: bool = False) -> Dict[str, Any]:
    """
    Alternative approach using layout-aware processing for forms.
    This is a placeholder for future LayoutLM-based extraction.
    """
    # For now, fall back to unstructured with different settings
    if not unstructured_available or partition_pdf is None:
        return {'success': False, 'error': 'Unstructured not available'}
    
    start_time = time.time()
    
    try:
        # Use different strategy optimized for forms
        elements = partition_pdf(
            filename=str(pdf_path),
            strategy="fast",  # Faster processing
            infer_table_structure=True,
            chunking_strategy="by_title"  # Better for forms
        )
        
        # Focus on form-specific patterns
        form_elements = []
        
        for element in elements:
            text = getattr(element, 'text', '').strip()
            
            # More sophisticated form field detection
            if any([
                '___' in text,  # Underlines for fill-in fields
                '□' in text or '☐' in text or '☑' in text,  # Checkboxes
                text.endswith(':') and len(text.split()) <= 5,  # Labels
                'Date:' in text or 'Name:' in text or 'Address:' in text,  # Common form fields
                len(text) < 50 and any(char.isdigit() for char in text) and ':' in text  # Numbered fields
            ]):
                # Extract metadata safely
                metadata = {}
                if hasattr(element, 'metadata') and element.metadata:
                    try:
                        # Try to access metadata attributes safely without dict conversion
                        if hasattr(element.metadata, 'coordinates'):
                            metadata['coordinates'] = element.metadata.coordinates
                        if hasattr(element.metadata, 'text_as_html'):
                            metadata['text_as_html'] = element.metadata.text_as_html
                    except (AttributeError, TypeError):
                        pass
                
                form_elements.append({
                    'text': text,
                    'type': str(type(element).__name__),
                    'metadata': metadata
                })
        
        return {
            'success': True,
            'processing_time': time.time() - start_time,
            'method': 'layoutlm_approach',
            'form_elements': form_elements,
            'field_count': len(form_elements)
        }
        
    except Exception as e:
        return {
            'success': False,
            'error': str(e),
            'method': 'layoutlm_approach',
            'processing_time': time.time() - start_time
        }


def compare_extraction_methods(pdf_path: Path, debug: bool = False) -> Dict[str, Any]:
    """
    Compare different extraction methods for performance and accuracy.
    """
    results = {}
    
    # Test Unstructured
    print("Testing Unstructured library...")
    results['unstructured'] = extract_with_unstructured(pdf_path, debug)
    
    # Test alternative approach
    print("Testing LayoutLM approach...")
    results['layoutlm'] = extract_with_layoutlm_approach(pdf_path, debug)
    
    # Summary comparison
    fastest_method = 'unstructured'  # default
    if results:
        successful_results = {k: v for k, v in results.items() if v.get('success', False)}
        if successful_results:
            fastest_method = min(successful_results.keys(), 
                               key=lambda k: successful_results[k].get('processing_time', float('inf')))
    
    comparison = {
        'fastest_method': fastest_method,
        'results': results
    }
    
    if debug:
        debug_dir = pdf_path.parent / "debug"
        debug_dir.mkdir(exist_ok=True)
        with open(debug_dir / "method_comparison.json", 'w') as f:
            json.dump(comparison, f, indent=2, default=str)
    
    return comparison 
#!/usr/bin/env python3
"""
Test script to process a PDF page by page and output each page as an image with detected form fields marked in colors.
This approach processes each page individually to ensure proper field distribution.
"""

import sys
import json
import tempfile
from pathlib import Path

# Add the src directory to path
sys.path.insert(0, str(Path(__file__).parent / "src"))


def split_pdf_into_pages(pdf_path: Path, temp_dir: Path):
    """
    Split a multi-page PDF into individual single-page PDFs.
    
    Args:
        pdf_path: Path to the input PDF
        temp_dir: Directory to save individual page PDFs
        
    Returns:
        List of paths to individual page PDFs
    """
    try:
        import PyPDF2
        
        page_paths = []
        
        with open(pdf_path, 'rb') as input_file:
            reader = PyPDF2.PdfReader(input_file)
            total_pages = len(reader.pages)
            
            print(f"📄 Splitting PDF into {total_pages} individual pages...")
            
            for page_num in range(total_pages):
                # Create a new PDF with just this page
                writer = PyPDF2.PdfWriter()
                writer.add_page(reader.pages[page_num])
                
                # Save individual page
                page_filename = f"page_{page_num + 1:03d}.pdf"
                page_path = temp_dir / page_filename
                
                with open(page_path, 'wb') as output_file:
                    writer.write(output_file)
                
                page_paths.append(page_path)
                print(f"  ✅ Created {page_filename}")
        
        return page_paths, total_pages
        
    except ImportError:
        print("❌ PyPDF2 not found. Installing...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "PyPDF2"])
        return split_pdf_into_pages(pdf_path, temp_dir)
    except Exception as e:
        print(f"❌ Error splitting PDF: {e}")
        return [], 0


def process_single_page(page_pdf_path: Path, page_number: int):
    """
    Process a single page PDF and extract form fields.
    
    Args:
        page_pdf_path: Path to the single-page PDF
        page_number: Page number (1-based)
        
    Returns:
        Dictionary with extraction results
    """
    try:
        from form_processor.modern_extractor import extract_with_unstructured
        
        print(f"🔍 Processing page {page_number}...")
        result = extract_with_unstructured(page_pdf_path, debug=False, fast_mode=True)
        
        if result.get('success', False):
            fields = result.get('form_fields', [])
            print(f"  ✅ Found {len(fields)} fields in {result.get('processing_time', 0):.2f}s")
            return {
                'success': True,
                'fields': fields,
                'processing_time': result.get('processing_time', 0),
                'page_number': page_number
            }
        else:
            print(f"  ❌ Failed to process page {page_number}: {result.get('error', 'Unknown error')}")
            return {
                'success': False,
                'fields': [],
                'processing_time': 0,
                'page_number': page_number,
                'error': result.get('error', 'Unknown error')
            }
            
    except Exception as e:
        print(f"  ❌ Error processing page {page_number}: {e}")
        return {
            'success': False,
            'fields': [],
            'processing_time': 0,
            'page_number': page_number,
            'error': str(e)
        }


def create_marked_image(pdf_image, fields, page_number: int, colors: dict, output_dir: Path):
    """
    Create a marked image showing detected form fields.
    
    Args:
        pdf_image: PIL image of the PDF page
        fields: List of form fields detected on this page
        page_number: Page number (1-based)
        colors: Color mapping for field types
        output_dir: Directory to save the marked image
        
    Returns:
        Number of fields marked on the image
    """
    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore
        
        # Convert PIL to OpenCV format
        cv_image = cv2.cvtColor(np.array(pdf_image), cv2.COLOR_RGB2BGR)
        img_height, img_width = cv_image.shape[:2]
        
        fields_marked = 0
        
        # Draw rectangles around detected fields
        for field_idx, field in enumerate(fields):
            if 'coordinates' in field and field['coordinates']:
                coords = field['coordinates']
                
                # Extract coordinates
                x, y, width, height = 0, 0, 0, 0
                
                if isinstance(coords, dict) and 'points' in coords:
                    points = coords['points']
                    if len(points) >= 2:
                        # Extract coordinates from list format [[x1, y1], [x2, y2], ...]
                        x1, y1 = points[0][0], points[0][1]
                        if len(points) > 2:
                            x2, y2 = points[2][0], points[2][1]
                        else:
                            x2, y2 = points[1][0], points[1][1]
                        x, y = min(x1, x2), min(y1, y2)
                        width, height = abs(x2 - x1), abs(y2 - y1)
                
                # Skip fields with invalid coordinates
                if width <= 0 or height <= 0 or y < 0:
                    continue
                
                # Scale coordinates from PDF points to image pixels
                # PDF is typically 72 DPI, we're rendering at 150 DPI
                scale_factor = 150 / 72
                x *= scale_factor
                y *= scale_factor
                width *= scale_factor
                height *= scale_factor
                
                # Make sure coordinates are within image bounds
                if x >= img_width or y >= img_height:
                    continue
                
                # Choose color based on field type
                field_type = field.get('type', 'default')
                category = field.get('category', 'default')
                
                # Use category for color if available, otherwise type
                color_key = category if category in colors else field_type
                color = colors.get(color_key, colors['default'])
                
                # Draw rectangle
                cv2.rectangle(cv_image, (int(x), int(y)), (int(x + width), int(y + height)), color, 2)
                
                # Add field label with type and number
                label = f"{field_type[:4]}{field_idx + 1}"
                label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.4, 1)[0]
                
                # Background for label
                cv2.rectangle(cv_image, (int(x), int(y - 15)), (int(x + label_size[0] + 4), int(y)), color, -1)
                
                # Label text
                cv2.putText(cv_image, label, (int(x + 2), int(y - 3)), 
                          cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
                
                fields_marked += 1
        
        # Save the marked image
        output_filename = f"page_{page_number:03d}_marked.png"
        output_path = output_dir / output_filename
        cv2.imwrite(str(output_path), cv_image)
        
        return fields_marked
        
    except Exception as e:
        print(f"  ❌ Error creating marked image for page {page_number}: {e}")
        return 0


def process_pdf_to_marked_images(pdf_path: Path, output_dir: Path = None):
    """
    Process a PDF page by page and create marked images showing detected form fields.
    
    Args:
        pdf_path: Path to the PDF file
        output_dir: Directory to save output images (default: pdf_path parent / 'marked_pages')
    """
    try:
        from pdf2image import convert_from_path  # type: ignore
        
        # Set up output directory
        if output_dir is None:
            output_dir = pdf_path.parent / "marked_pages"
        output_dir.mkdir(exist_ok=True)
        
        print("🎨 PDF to Marked Images Processor (Page-by-Page)")
        print("=" * 60)
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
            
            # Convert original PDF to images (for visualization)
            print(f"\n📸 Converting PDF pages to images...")
            images = convert_from_path(pdf_path, dpi=150)
            
            if len(images) != total_pages:
                print(f"⚠️  Warning: Image count ({len(images)}) doesn't match page count ({total_pages})")
            
            # Define colors for different field types
            colors = {
                'Header': (0, 255, 0),        # Green
                'Title': (255, 0, 0),         # Blue
                'NarrativeText': (0, 0, 255), # Red
                'Text': (255, 255, 0),        # Cyan
                'UncategorizedText': (255, 0, 255),  # Magenta
                'ListItem': (0, 255, 255),    # Yellow
                'Table': (128, 0, 128),       # Purple
                'Footer': (255, 128, 0),      # Orange
                'default': (128, 128, 128)    # Gray
            }
            
            # Process each page individually
            all_results = []
            total_fields = 0
            total_processing_time = 0
            
            print(f"\n🔍 Processing {total_pages} pages individually...")
            
            for page_idx, (page_pdf_path, pdf_image) in enumerate(zip(page_pdf_paths, images)):
                page_number = page_idx + 1
                
                # Extract form fields from this individual page
                result = process_single_page(page_pdf_path, page_number)
                all_results.append(result)
                
                if result['success']:
                    fields = result['fields']
                    total_fields += len(fields)
                    total_processing_time += result['processing_time']
                    
                    # Create marked image for this page
                    fields_marked = create_marked_image(pdf_image, fields, page_number, colors, output_dir)
                    print(f"  🎨 Page {page_number}: {fields_marked} fields marked → page_{page_number:03d}_marked.png")
                else:
                    print(f"  ❌ Page {page_number}: Processing failed")
            
            # Create a legend image
            print(f"\n🎨 Creating color legend...")
            create_color_legend(colors, output_dir)
            
            # Save detailed results as JSON
            details_file = output_dir / "field_details.json"
            field_summary = {
                'pdf_file': str(pdf_path),
                'total_pages': total_pages,
                'total_fields': total_fields,
                'total_processing_time': total_processing_time,
                'average_time_per_page': total_processing_time / total_pages if total_pages > 0 else 0,
                'fields_by_page': {},
                'fields_by_type': {},
                'color_mapping': colors,
                'page_results': all_results
            }
            
            # Aggregate statistics
            for result in all_results:
                page_num = result['page_number']
                field_count = len(result['fields'])
                field_summary['fields_by_page'][str(page_num)] = field_count
                
                # Count fields by type
                for field in result['fields']:
                    field_type = field.get('type', 'unknown')
                    field_summary['fields_by_type'][field_type] = field_summary['fields_by_type'].get(field_type, 0) + 1
            
            with open(details_file, 'w') as f:
                json.dump(field_summary, f, indent=2)
            
            print(f"\n🎉 Processing Complete!")
            print(f"📊 Summary:")
            print(f"   • {total_pages} pages processed individually")
            print(f"   • {total_fields} form fields detected total")
            print(f"   • {total_processing_time:.2f}s total processing time")
            print(f"   • {total_processing_time/total_pages:.2f}s average per page")
            print(f"   • Images saved to: {output_dir}")
            print(f"   • Field details: {details_file}")
            print(f"   • Color legend: {output_dir / 'color_legend.png'}")
            
            # Show page-by-page breakdown
            print(f"\n📋 Fields by Page:")
            for page_num in range(1, total_pages + 1):
                field_count = field_summary['fields_by_page'].get(str(page_num), 0)
                print(f"   • Page {page_num}: {field_count} fields")
            
            # Show field type breakdown
            field_types = field_summary['fields_by_type']
            if field_types:
                print(f"\n📋 Field Types Found:")
                for field_type, count in sorted(field_types.items(), key=lambda x: x[1], reverse=True):
                    color_info = f"({colors.get(field_type, colors['default'])})"
                    print(f"   • {field_type}: {count} fields {color_info}")
        
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("💡 Make sure you have pdf2image, opencv-python, PyPDF2, and pillow installed")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


def create_color_legend(colors: dict, output_dir: Path):
    """Create a color legend image showing what each color represents."""
    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore
        
        # Create legend image
        legend_height = max(300, len(colors) * 30 + 50)
        legend_width = 400
        legend_img = np.ones((legend_height, legend_width, 3), dtype=np.uint8) * 255
        
        # Title
        cv2.putText(legend_img, "Form Field Color Legend", (10, 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 0), 2)
        
        # Draw color boxes and labels
        y_start = 60
        for i, (field_type, color) in enumerate(colors.items()):
            y = y_start + i * 25
            
            # Color box
            cv2.rectangle(legend_img, (10, y - 10), (30, y + 10), color, -1)
            cv2.rectangle(legend_img, (10, y - 10), (30, y + 10), (0, 0, 0), 1)
            
            # Label
            cv2.putText(legend_img, field_type, (40, y + 5), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
        
        # Save legend
        legend_path = output_dir / "color_legend.png"
        cv2.imwrite(str(legend_path), legend_img)
        
    except Exception as e:
        print(f"⚠️  Could not create color legend: {e}")


def main():
    """Main function to run the PDF to marked images processor."""
    # Default PDF path
    pdf_path = Path("../uploads/i-907_Jaz6iX6.pdf")
    
    # Check if PDF exists
    if not pdf_path.exists():
        print(f"❌ PDF not found: {pdf_path}")
        print("💡 Please ensure the PDF file exists or update the path in the script")
        return
    
    # Process the PDF
    process_pdf_to_marked_images(pdf_path)


if __name__ == "__main__":
    main() 
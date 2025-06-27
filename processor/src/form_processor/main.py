"""
Modern form field extraction using Unstructured library.
Clean, fast, and accurate form field detection.
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Any

from .extractor import extract_with_unstructured


def process_form_fields(pdf_path: str, document_ai_data: Dict[str, Any], debug: bool = True) -> Dict[str, Any]:
    """
    Process PDF with Document AI data to extract form fields using modern Unstructured approach.
    
    Args:
        pdf_path: Path to PDF file
        document_ai_data: Document AI response data
        debug: Whether to generate debug output with visual field marking
        
    Returns:
        Dictionary with extracted form fields and metadata
    """
    try:
        pdf_file = Path(pdf_path)
        if not pdf_file.exists():
            return {
                'success': False,
                'error': f'PDF file not found: {pdf_path}'
            }
        
        # Extract form fields using modern Unstructured approach
        result = extract_with_unstructured(pdf_file, debug=debug, fast_mode=True)
        
        if result.get('success', False):
            print(f"✅ Successfully extracted {result.get('field_count', 0)} form fields")
            if debug:
                print(f"📸 Debug images saved to: {result.get('debug_dir', 'uploads/debug/')}")
        else:
            print(f"❌ Form field extraction failed: {result.get('error', 'Unknown error')}")
        
        return result
        
    except Exception as e:
        error_msg = f"Error processing form fields: {str(e)}"
        print(error_msg)
        return {
            'success': False,
            'error': error_msg
        }


def main():
    """CLI entry point for testing form field extraction."""
    if len(sys.argv) != 2:
        print("Usage: python -m form_processor.main <pdf_path>")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    
    # Mock Document AI data for testing
    mock_docai_data = {
        'document_info': {'pages': []},
        'fields': []
    }
    
    result = process_form_fields(pdf_path, mock_docai_data, debug=True)
    
    if result.get('success', False):
        print(f"\n🎉 Processing completed successfully!")
        print(f"Fields found: {result.get('field_count', 0)}")
        print(f"Processing time: {result.get('processing_time', 0):.2f}s")
    else:
        print(f"\n❌ Processing failed: {result.get('error', 'Unknown error')}")
        sys.exit(1)


if __name__ == "__main__":
    main() 
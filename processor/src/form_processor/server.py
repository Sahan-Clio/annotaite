#!/usr/bin/env python3
"""
Flask server for modern form field extraction using Unstructured library.
Clean, fast, and accurate form processing.
"""

import json
import tempfile
from pathlib import Path
from flask import Flask, request, jsonify  # type: ignore

from .main import process_form_fields

app = Flask(__name__)


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    return jsonify({'status': 'healthy', 'service': 'form-processor'})


@app.route('/process', methods=['POST'])
def process_form():
    """
    Process PDF with Document AI data to extract form fields using modern Unstructured approach.
    """
    try:
        # Validate request
        if 'pdf' not in request.files or 'document_ai_data' not in request.files:
            return jsonify({
                'success': False,
                'error': 'Missing required files: pdf and document_ai_data'
            }), 400
        
        pdf_file = request.files['pdf']
        docai_file = request.files['document_ai_data']
        
        if pdf_file.filename == '' or docai_file.filename == '':
            return jsonify({
                'success': False,
                'error': 'Empty file names'
            }), 400
        
        # Save uploaded files temporarily
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            
            # Save PDF
            pdf_path = temp_path / "input.pdf"
            pdf_file.save(str(pdf_path))
            
            # Save and parse Document AI data
            docai_path = temp_path / "docai.json"
            docai_file.save(str(docai_path))
            
            with open(docai_path, 'r') as f:
                docai_data = json.load(f)
            
            print(f"🔄 Processing PDF: {pdf_file.filename}")
            print(f"📄 Document AI data size: {len(json.dumps(docai_data))} characters")
            
            # Process with modern Unstructured approach
            result = process_form_fields(str(pdf_path), docai_data, debug=True)
            
            # Return the result
            return jsonify(result)
            
    except json.JSONDecodeError as e:
        return jsonify({
            'success': False,
            'error': f'Invalid JSON in document_ai_data: {str(e)}'
        }), 400
        
    except Exception as e:
        print(f"❌ Server error: {str(e)}")
        return jsonify({
            'success': False,
            'error': f'Server error: {str(e)}'
        }), 500


if __name__ == '__main__':
    print("🚀 Starting Form Processor Server (Modern Unstructured)")
    print("📍 Health check: http://localhost:8000/health")
    print("📍 Process endpoint: http://localhost:8000/process")
    app.run(host='0.0.0.0', port=8000, debug=True) 
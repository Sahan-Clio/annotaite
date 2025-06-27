# Form Field Processor

A Python service for extracting form fields from PDF documents using computer vision and text analysis.

## Features

- Extract text labels using Unstructured library
- Detect input boxes and checkboxes using OpenCV
- Normalize coordinates to 0-1 range
- Flask HTTP API for integration

## API Endpoints

- `GET /health` - Health check
- `POST /process_pdf` - Process PDF file and extract form fields

## Usage

```bash
# Start the service
python src/form_processor/server.py

# Test with curl
curl -X POST -F "pdf_file=@document.pdf" http://localhost:8000/process_pdf
```

## Dependencies

- Flask
- Unstructured
- OpenCV
- PyPDF2
- pdf2image 
# Form Processor Service

The Form Processor service is a Python-based component of the Annot[AI]tor system that extracts form field coordinates from PDF documents using computer vision and OCR techniques.

## Overview

This service takes a PDF file and Document AI output as input, then:

1. **Preprocesses** the PDF page (deskewing, binarization, denoising)
2. **Extracts text** using Tesseract OCR
3. **Detects form fields** (text input lines and checkboxes)
4. **Associates labels** with detected fields using spatial relationships
5. **Refines coordinates** and validates the results
6. **Outputs clean JSON** with field names, types, and precise coordinates

## Usage

### Docker Commands (Recommended)

```bash
# Start the processor service
dev up

# Run the form processing pipeline
dev processor.start --pdf /data/uploads/form.pdf --docai /data/uploads/docai.json --output /data/uploads/fields.json

# Open a shell in the processor container
dev processor.shell

# Run tests
dev processor.test

# Build the container
dev processor.install
```

### Direct CLI Usage

From within the processor container:

```bash
python -m form_processor.main --pdf input.pdf --docai docai.json --output fields.json
```

### Options

- `--pdf`: Path to input PDF file
- `--docai`: Path to Document AI JSON output
- `--output`: Path to output refined fields JSON
- `--page`: PDF page number to process (default: 1)
- `--debug`: Save intermediate processing images for debugging

## Input/Output Format

### Input: Document AI JSON
The service expects Document AI output with detected entities:

```json
{
  "pages": [{"pageNumber": 1, "dimension": {"width": 612, "height": 792}}],
  "entities": [
    {
      "type": "name_field",
      "mentionText": "Family Name:",
      "boundingPoly": {
        "vertices": [
          {"x": 50, "y": 100}, {"x": 200, "y": 100},
          {"x": 200, "y": 120}, {"x": 50, "y": 120}
        ]
      }
    }
  ]
}
```

### Output: Clean Fields JSON
The service outputs a clean list of form fields:

```json
[
  {
    "name": "Family Name",
    "type": "text",
    "bbox": [250, 95, 450, 125],
    "confidence": 0.95
  },
  {
    "name": "Premium Processing Requested",
    "type": "checkbox", 
    "bbox": [320, 195, 340, 215],
    "confidence": 0.88
  }
]
```

## Architecture

### Core Modules

- **`main.py`**: CLI orchestrator that coordinates the pipeline
- **`preprocess.py`**: PDF conversion, deskewing, binarization, denoising
- **`ocr.py`**: Tesseract OCR text extraction with coordinates
- **`detect_fields.py`**: Computer vision field detection (lines, checkboxes)
- **`associate.py`**: Spatial label-to-field matching
- **`refine.py`**: Coordinate refinement and validation

### Dependencies

- **OpenCV**: Image processing and computer vision
- **Tesseract**: OCR text extraction
- **pdf2image**: PDF to image conversion
- **boxdetect**: Automated checkbox detection
- **Click**: CLI interface
- **Rich**: Beautiful terminal output

## Development

### Running Tests

```bash
dev processor.test
```

### Debugging

Use the `--debug` flag to save intermediate processing images:

```bash
dev processor.start --pdf form.pdf --docai docai.json --output fields.json --debug
```

This creates a `debug/` directory with:
- `01_original.png`: Original PDF page
- `02_deskewed.png`: After deskewing
- `03_grayscale.png`: Grayscale conversion
- `04_binary.png`: Binarized image
- `05_clean.png`: Final cleaned image

### Integration with Rails

The processor is designed to be called from the Rails backend after Document AI processing:

```ruby
# In Rails controller or service
system("dev processor.start --pdf #{pdf_path} --docai #{docai_path} --output #{fields_path}")
fields = JSON.parse(File.read(fields_path))
```

## Performance

- Typical processing time: 2-5 seconds per page
- Memory usage: ~200MB during processing
- Supports forms up to 300 DPI resolution
- Handles skewed documents (±15 degrees)

## Troubleshooting

### Common Issues

1. **"PDF file not found"**: Ensure the PDF path is correct and accessible within the container
2. **Poor field detection**: Try the `--debug` flag to inspect intermediate images
3. **OCR errors**: Check that the PDF has sufficient resolution (300 DPI recommended)
4. **Missing dependencies**: Run `dev processor.install` to rebuild the container

### Logs

Check Docker logs for detailed error information:

```bash
docker-compose logs processor
``` 
# Document Parsing with Google Document AI

## Overview

This application now supports dynamic PDF file upload and parsing using Google Document AI. The system includes intelligent caching to avoid redundant API calls.

## Features

- **File Upload**: Upload PDF files via the frontend
- **Google Document AI Integration**: Real-time document parsing
- **Intelligent Caching**: Cache responses based on filename and content hash
- **Cache Management**: All cached responses stored in `server/cache/` directory

## Setup

### 1. Google Cloud Document AI Setup

1. Create a Google Cloud Project
2. Enable the Document AI API
3. Create a Document AI Processor
4. Set up authentication (service account key or application default credentials)

### 2. Environment Variables

Create a `.env` file in the server directory with:

```bash
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_LOCATION=us  # or your preferred location
GOOGLE_CLOUD_PROCESSOR_ID=your-processor-id
```

### 3. Cache Directory

The cache directory (`server/cache/`) is automatically created when the first document is processed. Cache files are named using:

```
{filename}_{content_hash}.json
```

For example: `form_i907_pdf_a1b2c3d4e5f6g7h8.json`

## API Usage

### Upload and Parse Document

```bash
POST /api/v1/parse
Content-Type: multipart/form-data

file: [PDF file]
```

**Response:**
```json
{
  "document_info": {
    "total_pages": 3,
    "page_dimensions": [
      {"page": 1, "width": 612, "height": 792},
      {"page": 2, "width": 612, "height": 792},
      {"page": 3, "width": 612, "height": 792}
    ]
  },
  "fields": [
    {
      "id": "field_1",
      "type": "form_field_label",
      "text": "First Name",
      "page": 1,
      "bounding_box": {
        "x_min": 0.1,
        "y_min": 0.1,
        "x_max": 0.3,
        "y_max": 0.15
      }
    }
  ]
}
```

## Field Types

The system classifies form elements into the following types:

- `form_field_label`: Form field labels/questions
- `form_field_input`: Form field input areas
- `section_header`: Section titles and headers
- `instruction_text`: Instructions and guidance text
- `checkbox`: Checkbox fields
- `signature_area`: Signature fields
- `static_text`: Other static text content

## Cache Management

### Viewing Cache

```bash
ls server/cache/
```

### Clearing Cache

```bash
rm -rf server/cache/*
```

### Cache Structure

Each cache file contains:
```json
{
  "document": { /* Full Google Document AI response */ },
  "cached_at": "2024-01-15T10:30:00Z",
  "original_filename": "form.pdf"
}
```

## Testing

Run the test suite:

```bash
cd server
dev test
```

Tests include:
- File upload validation
- PDF content type checking
- Service integration
- Error handling
- Cache functionality

## Development Commands

```bash
# Start the server
cd server && dev start

# Run tests
cd server && dev test

# Open Rails console
cd server && dev console

# Check routes
cd server && dev routes
```

## Error Handling

The API returns appropriate HTTP status codes:

- `200 OK`: Document parsed successfully
- `400 Bad Request`: No file uploaded or invalid file type
- `500 Internal Server Error`: Google Document AI API error or parsing failure

## Performance Notes

- First-time processing of a document requires a Google API call (~2-5 seconds)
- Subsequent processing of the same document uses cached response (~100ms)
- Cache keys include content hash to detect file changes
- Large documents may take longer to process

## Security Considerations

- File uploads are validated for PDF content type
- Temporary files are cleaned up after processing
- Cache files contain only processed data, not original PDFs
- No sensitive data is logged 
# Gemini AI Integration Setup

This document explains how to set up Google Gemini AI integration for enhanced form field analysis.

## Environment Setup

Add the following environment variable to your system or Docker configuration:

```bash
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

### Getting a Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the generated API key
5. Set it as the `GEMINI_API_KEY` environment variable

### Docker Setup

Add the environment variable to your `docker-compose.yml`:

```yaml
services:
  server:
    environment:
      - GEMINI_API_KEY=your_actual_gemini_api_key_here
```

Or create a `.env` file in the server directory:

```bash
# server/.env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```

## How It Works

1. **Document Processing**: The processor service extracts raw form fields from PDFs
2. **AI Enhancement**: Gemini AI analyzes the fields and:
   - Pairs labels with their corresponding input fields
   - Identifies field purposes (name, email, address, etc.)
   - Groups related fields together
   - Adds confidence scores for pairings
3. **Fallback**: If Gemini AI is unavailable, the system returns raw processor output

## Enhanced Response Format

With Gemini AI enabled, you'll receive enhanced field data:

```json
{
  "summary": {
    "total_elements": 15,
    "total_pages": 2,
    "by_type": {
      "labels": 8,
      "inputs": 5,
      "checkboxes": 2
    },
    "paired_fields": 7
  },
  "elements": [
    {
      "type": "label",
      "page": 1,
      "text": "First Name:",
      "x": 100,
      "y": 200,
      "width": 80,
      "height": 20,
      "paired_with": "input_field_123",
      "field_purpose": "name",
      "confidence": 0.95
    }
  ],
  "field_groups": [
    {
      "group_name": "Personal Information",
      "fields": ["label_1", "input_field_123", "label_2", "input_field_124"],
      "group_type": "personal_info"
    }
  ],
  "processing_info": {
    "enhanced_by": "gemini_ai",
    "enhanced_at": "2024-01-15T10:30:00Z",
    "model": "gemini-1.5-flash-latest"
  }
}
```

## Troubleshooting

### Common Issues

1. **Missing API Key**: Set the `GEMINI_API_KEY` environment variable
2. **API Quota Exceeded**: Check your Google Cloud usage limits
3. **Network Issues**: Ensure the server can reach Google's API endpoints

### Fallback Behavior

If Gemini AI fails, the system will:
- Log the error
- Return the raw processor output
- Add error information to the response

This ensures the application continues working even if AI enhancement fails.

## Customizing the Prompt

The AI prompt is stored in `config/prompt.txt`. You can modify it to:
- Change pairing logic
- Add new field types
- Adjust confidence thresholds
- Modify grouping behavior

Restart the server after making prompt changes. 
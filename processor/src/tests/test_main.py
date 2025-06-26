"""
Tests for the main orchestrator module.
"""

import pytest
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock
import json

from form_processor.main import main
from click.testing import CliRunner


@pytest.fixture
def sample_pdf_path(tmp_path):
    """Create a sample PDF file path."""
    pdf_path = tmp_path / "test.pdf"
    pdf_path.write_bytes(b"fake pdf content")
    return pdf_path


@pytest.fixture
def sample_docai_data(tmp_path):
    """Create sample Document AI JSON data."""
    docai_data = {
        "pages": [
            {
                "pageNumber": 1,
                "dimension": {"width": 1000, "height": 1200}
            }
        ],
        "entities": [
            {
                "type": "name_field",
                "mentionText": "Name:",
                "boundingPoly": {
                    "vertices": [
                        {"x": 100, "y": 100},
                        {"x": 200, "y": 100},
                        {"x": 200, "y": 120},
                        {"x": 100, "y": 120}
                    ]
                }
            }
        ]
    }
    
    docai_path = tmp_path / "docai.json"
    with open(docai_path, 'w') as f:
        json.dump(docai_data, f)
    
    return docai_path


@pytest.fixture
def output_path(tmp_path):
    """Create output file path."""
    return tmp_path / "output.json"


def test_main_missing_pdf():
    """Test main function with missing PDF file."""
    runner = CliRunner()
    result = runner.invoke(main, [
        '--pdf', 'nonexistent.pdf',
        '--docai', 'test.json',
        '--output', 'output.json'
    ])
    
    assert result.exit_code == 1
    assert "PDF file not found" in result.output


def test_main_missing_docai():
    """Test main function with missing Document AI file."""
    runner = CliRunner()
    
    with runner.isolated_filesystem():
        # Create a fake PDF file
        Path("test.pdf").write_bytes(b"fake pdf")
        
        result = runner.invoke(main, [
            '--pdf', 'test.pdf',
            '--docai', 'nonexistent.json',
            '--output', 'output.json'
        ])
        
        assert result.exit_code == 1
        assert "Document AI JSON not found" in result.output


@patch('form_processor.main.preprocess_image')
@patch('form_processor.main.run_ocr')
@patch('form_processor.main.detect_text_fields')
@patch('form_processor.main.detect_checkboxes')
@patch('form_processor.main.match_labels_to_fields')
@patch('form_processor.main.refine_boxes')
def test_main_successful_processing(mock_refine, mock_match, mock_detect_cb, 
                                  mock_detect_text, mock_ocr, mock_preprocess,
                                  sample_pdf_path, sample_docai_data, output_path):
    """Test successful processing pipeline."""
    # Mock all the processing steps
    mock_preprocess.return_value = Mock()  # Mock processed image
    mock_ocr.return_value = []  # Mock OCR results
    mock_detect_text.return_value = []  # Mock text fields
    mock_detect_cb.return_value = []  # Mock checkboxes
    mock_match.return_value = []  # Mock matched pairs
    mock_refine.return_value = [
        {
            "name": "Test Field",
            "type": "text",
            "bbox": [100, 100, 300, 120],
            "confidence": 0.95
        }
    ]
    
    runner = CliRunner()
    result = runner.invoke(main, [
        '--pdf', str(sample_pdf_path),
        '--docai', str(sample_docai_data),
        '--output', str(output_path)
    ])
    
    assert result.exit_code == 0
    assert "Successfully extracted 1 fields" in result.output
    
    # Check that output file was created
    assert output_path.exists()
    
    # Check output content
    with open(output_path) as f:
        output_data = json.load(f)
    
    assert len(output_data) == 1
    assert output_data[0]["name"] == "Test Field"
    assert output_data[0]["type"] == "text"


def test_main_with_debug_flag(sample_pdf_path, sample_docai_data, output_path):
    """Test main function with debug flag."""
    with patch('form_processor.main.preprocess_image') as mock_preprocess:
        mock_preprocess.return_value = Mock()
        
        with patch('form_processor.main.run_ocr'), \
             patch('form_processor.main.detect_text_fields'), \
             patch('form_processor.main.detect_checkboxes'), \
             patch('form_processor.main.match_labels_to_fields'), \
             patch('form_processor.main.refine_boxes') as mock_refine:
            
            mock_refine.return_value = []
            
            runner = CliRunner()
            result = runner.invoke(main, [
                '--pdf', str(sample_pdf_path),
                '--docai', str(sample_docai_data),
                '--output', str(output_path),
                '--debug'
            ])
            
            # Check that preprocess was called with debug=True
            mock_preprocess.assert_called_once()
            args, kwargs = mock_preprocess.call_args
            assert kwargs.get('debug') or args[2] == True  # debug parameter 
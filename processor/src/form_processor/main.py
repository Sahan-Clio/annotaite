"""
Main orchestrator for form field extraction pipeline.
Takes PDF + Document AI output and produces clean field extraction JSON.
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Any

import click
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

from .preprocess import preprocess_image
from .ocr import run_ocr
from .detect_fields import detect_text_fields, detect_checkboxes
from .associate import match_labels_to_fields
from .refine import refine_boxes

console = Console()


@click.command()
@click.option('--pdf', required=True, help='Path to input PDF file')
@click.option('--docai', required=True, help='Path to Document AI JSON output')
@click.option('--output', required=True, help='Path to output refined fields JSON')
@click.option('--page', default=1, help='PDF page number to process (1-indexed)')
@click.option('--debug', is_flag=True, help='Save intermediate processing images')
def main(pdf: str, docai: str, output: str, page: int, debug: bool):
    """
    Form field extraction pipeline.
    
    Processes a PDF form using Document AI labels to extract clean field coordinates.
    """
    pdf_path = Path(pdf)
    docai_path = Path(docai)
    output_path = Path(output)
    
    # Validate inputs
    if not pdf_path.exists():
        console.print(f"[red]Error: PDF file not found: {pdf_path}[/red]")
        sys.exit(1)
        
    if not docai_path.exists():
        console.print(f"[red]Error: Document AI JSON not found: {docai_path}[/red]")
        sys.exit(1)
    
    try:
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console
        ) as progress:
            
            # Step 1: Load Document AI labels
            task = progress.add_task("Loading Document AI output...", total=None)
            with open(docai_path) as f:
                docai_data = json.load(f)
            progress.update(task, completed=True)
            
            # Step 2: Preprocess image
            task = progress.add_task("Preprocessing PDF page...", total=None)
            processed_image = preprocess_image(pdf_path, page, debug)
            progress.update(task, completed=True)
            
            # Step 3: Run OCR
            task = progress.add_task("Running OCR text extraction...", total=None)
            ocr_boxes = run_ocr(processed_image)
            progress.update(task, completed=True)
            
            # Step 4: Detect fields
            task = progress.add_task("Detecting form fields...", total=None)
            text_fields = detect_text_fields(processed_image)
            checkboxes = detect_checkboxes(processed_image)
            progress.update(task, completed=True)
            
            # Step 5: Associate labels with fields
            task = progress.add_task("Matching labels to fields...", total=None)
            paired_fields = match_labels_to_fields(
                ocr_boxes, text_fields, checkboxes, docai_data
            )
            progress.update(task, completed=True)
            
            # Step 6: Refine and validate
            task = progress.add_task("Refining field coordinates...", total=None)
            refined_fields = refine_boxes(paired_fields, processed_image, docai_data)
            progress.update(task, completed=True)
        
        # Save output
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w') as f:
            json.dump(refined_fields, f, indent=2)
        
        console.print(f"[green]✓ Successfully extracted {len(refined_fields)} fields[/green]")
        console.print(f"[green]✓ Output saved to: {output_path}[/green]")
        
    except Exception as e:
        console.print(f"[red]Error during processing: {str(e)}[/red]")
        if debug:
            import traceback
            console.print(f"[red]{traceback.format_exc()}[/red]")
        sys.exit(1)


if __name__ == "__main__":
    main() 
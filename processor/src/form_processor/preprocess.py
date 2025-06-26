"""
Image preprocessing pipeline for form field extraction.
Handles PDF conversion, deskewing, binarization, and denoising.
"""

import cv2
import numpy as np
from pathlib import Path
from pdf2image import convert_from_path
from PIL import Image
from typing import Tuple, Optional


def preprocess_image(pdf_path: Path, page_num: int = 1, debug: bool = False) -> np.ndarray:
    """
    Convert PDF page to preprocessed binary image ready for field detection.
    
    Args:
        pdf_path: Path to input PDF file
        page_num: Page number to process (1-indexed)
        debug: Whether to save intermediate images
        
    Returns:
        Preprocessed binary image as numpy array
    """
    # Convert PDF page to image
    images = convert_from_path(pdf_path, first_page=page_num, last_page=page_num, dpi=300)
    if not images:
        raise ValueError(f"Could not convert PDF page {page_num}")
    
    # Convert PIL image to OpenCV format
    pil_image = images[0]
    opencv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
    
    if debug:
        debug_dir = pdf_path.parent / "debug"
        debug_dir.mkdir(exist_ok=True)
        cv2.imwrite(str(debug_dir / "01_original.png"), opencv_image)
    
    # Deskew the image
    deskewed = deskew_image(opencv_image)
    if debug:
        cv2.imwrite(str(debug_dir / "02_deskewed.png"), deskewed)
    
    # Convert to grayscale
    gray = cv2.cvtColor(deskewed, cv2.COLOR_BGR2GRAY)
    if debug:
        cv2.imwrite(str(debug_dir / "03_grayscale.png"), gray)
    
    # Binarize with adaptive threshold
    binary = binarize_image(gray)
    if debug:
        cv2.imwrite(str(debug_dir / "04_binary.png"), binary)
    
    # Denoise
    clean = denoise_image(binary)
    if debug:
        cv2.imwrite(str(debug_dir / "05_clean.png"), clean)
    
    return clean


def deskew_image(image: np.ndarray) -> np.ndarray:
    """
    Detect and correct skew in the image using Hough line detection.
    
    Args:
        image: Input image
        
    Returns:
        Deskewed image
    """
    # Convert to grayscale if needed
    if len(image.shape) == 3:
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    else:
        gray = image.copy()
    
    # Edge detection
    edges = cv2.Canny(gray, 50, 150, apertureSize=3)
    
    # Detect lines using Hough transform
    lines = cv2.HoughLines(edges, 1, np.pi/180, threshold=100)
    
    if lines is None:
        return image  # No lines detected, return original
    
    # Calculate angles of detected lines
    angles = []
    for rho, theta in lines[:, 0]:
        angle = theta * 180 / np.pi
        # Convert to skew angle (-45 to 45 degrees)
        if angle > 90:
            angle = angle - 180
        elif angle > 45:
            angle = angle - 90
        angles.append(angle)
    
    if not angles:
        return image
    
    # Use median angle to avoid outliers
    skew_angle = np.median(angles)
    
    # Only correct if skew is significant (> 0.5 degrees)
    if abs(skew_angle) < 0.5:
        return image
    
    # Rotate image to correct skew
    height, width = image.shape[:2]
    center = (width // 2, height // 2)
    rotation_matrix = cv2.getRotationMatrix2D(center, skew_angle, 1.0)
    
    # Calculate new image dimensions
    cos_theta = abs(rotation_matrix[0, 0])
    sin_theta = abs(rotation_matrix[0, 1])
    new_width = int((height * sin_theta) + (width * cos_theta))
    new_height = int((height * cos_theta) + (width * sin_theta))
    
    # Adjust rotation matrix for new center
    rotation_matrix[0, 2] += (new_width / 2) - center[0]
    rotation_matrix[1, 2] += (new_height / 2) - center[1]
    
    # Apply rotation
    rotated = cv2.warpAffine(image, rotation_matrix, (new_width, new_height), 
                            flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    
    return rotated


def binarize_image(gray: np.ndarray) -> np.ndarray:
    """
    Convert grayscale image to binary using adaptive thresholding.
    
    Args:
        gray: Grayscale input image
        
    Returns:
        Binary image
    """
    # Use Otsu's method combined with Gaussian adaptive threshold
    _, otsu = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # Also try adaptive threshold
    adaptive = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                   cv2.THRESH_BINARY, 11, 2)
    
    # Combine both methods - use the one that produces more black pixels
    # (assuming forms have more text/lines than white space)
    otsu_black_pixels = np.sum(otsu == 0)
    adaptive_black_pixels = np.sum(adaptive == 0)
    
    if otsu_black_pixels > adaptive_black_pixels:
        return otsu
    else:
        return adaptive


def denoise_image(binary: np.ndarray) -> np.ndarray:
    """
    Remove noise from binary image using morphological operations.
    
    Args:
        binary: Binary input image
        
    Returns:
        Denoised binary image
    """
    # Remove small noise with opening (erosion followed by dilation)
    kernel_small = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    opened = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel_small)
    
    # Fill small gaps with closing (dilation followed by erosion)
    kernel_medium = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
    closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel_medium)
    
    return closed 
import React, { useRef, useEffect } from 'react';
import { PdfViewer } from './PdfViewer';

interface PdfCanvasProps {
  pdfUrl: string | null;
  onPdfLoadSuccess: (numPages: number, pageDimensions: { width: number; height: number }) => void;
  onScrollChange: (scrollPosition: { x: number; y: number }) => void;
  children?: React.ReactNode;
}

export const PdfCanvas: React.FC<PdfCanvasProps> = ({
  pdfUrl,
  onPdfLoadSuccess,
  onScrollChange,
  children
}) => {
  const pdfViewerRef = useRef<HTMLDivElement>(null);

  // Handle scroll events to update overlay positions
  useEffect(() => {
    const handleScroll = () => {
      if (pdfViewerRef.current) {
        const { scrollLeft, scrollTop } = pdfViewerRef.current;
        onScrollChange({ x: scrollLeft, y: scrollTop });
      }
    };

    const pdfViewer = pdfViewerRef.current;
    if (pdfViewer) {
      pdfViewer.addEventListener('scroll', handleScroll);
      return () => pdfViewer.removeEventListener('scroll', handleScroll);
    }
  }, [onScrollChange]);

  if (!pdfUrl) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-gray-500 text-lg mb-2">No PDF loaded</div>
          <div className="text-gray-400 text-sm">Upload a PDF to get started</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 relative">
      <div ref={pdfViewerRef} className="h-full overflow-auto bg-gray-100 rounded-lg">
        <PdfViewer
          fileUrl={pdfUrl}
          onLoadSuccess={onPdfLoadSuccess}
        />
        {children}
      </div>
    </div>
  );
}; 
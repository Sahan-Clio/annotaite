import { useState, forwardRef, useMemo, useCallback } from 'react'
import { Document, Page } from 'react-pdf'

// Import the styles for the text layer and annotation layer
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'

interface PdfViewerProps {
  fileUrl: string
  onLoadSuccess?: (numPages: number, pageDimensions: { width: number; height: number }) => void
  scale?: number
}

export const PdfViewer = forwardRef<HTMLDivElement, PdfViewerProps>(
  ({ fileUrl, onLoadSuccess, scale = 1 }, ref) => {
    const [numPages, setNumPages] = useState<number | null>(null)
    const [pageDimensions, setPageDimensions] = useState<{ width: number; height: number } | null>(null)

    // Memoize options to prevent unnecessary re-renders
    const options = useMemo(() => ({
      cMapUrl: '/cmaps/',
      standardFontDataUrl: '/standard_fonts/',
    }), [])

    const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }): void => {
      setNumPages(numPages)
    }, [])

    const onPageLoadSuccess = useCallback((page: any): void => {
      if (!pageDimensions) {
        // Use a timeout to ensure the DOM element is fully rendered
        setTimeout(() => {
          const pageElement = document.querySelector('.react-pdf__Page');
          if (pageElement) {
            const rect = pageElement.getBoundingClientRect();
            const renderedDimensions = { width: rect.width, height: rect.height };
            console.log('Rendered page dimensions:', renderedDimensions);
            console.log('Original page dimensions:', { width: page.width, height: page.height });
            setPageDimensions(renderedDimensions);
            onLoadSuccess?.(numPages || 1, renderedDimensions);
          } else {
            // Fallback to page viewport dimensions
            const { width, height } = page;
            console.log('Fallback page dimensions:', { width, height });
            setPageDimensions({ width, height });
            onLoadSuccess?.(numPages || 1, { width, height });
          }
        }, 100);
      }
    }, [pageDimensions, onLoadSuccess, numPages])

    const onDocumentLoadError = useCallback((error: Error) => {
      console.error('PDF loading error:', error)
      setNumPages(null)
      setPageDimensions(null)
    }, [])

    return (
      <div ref={ref} className="w-full h-full overflow-auto bg-gray-100">
        <div className="flex flex-col items-center py-4 min-h-full">
          <Document
            file={fileUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            options={options}
            loading={
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading PDF...</p>
                </div>
              </div>
            }
            error={
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-destructive mb-2">Failed to load PDF</p>
                  <p className="text-sm text-muted-foreground">
                    Please check the PDF URL or try a different file
                  </p>
                </div>
              </div>
            }
          >
            {numPages && Array.from(new Array(numPages), (el, index) => (
              <div key={`page-container-${index + 1}`} className="mb-4 relative">
                <Page
                  key={`page_${index + 1}`}
                  pageNumber={index + 1}
                  scale={scale}
                  onLoadSuccess={onPageLoadSuccess}
                  onLoadError={(error) => console.warn(`Page ${index + 1} load error:`, error)}
                  className="shadow-lg border border-gray-300 bg-white"
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  data-page-number={index + 1}
                />
              </div>
            ))}
          </Document>
        </div>
      </div>
    )
  }
)

PdfViewer.displayName = 'PdfViewer' 
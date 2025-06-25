import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { parseDocument } from '../api/parseApi';
import type { ParseResponse, FormField, MetadataItem } from '../types/api';
import { PdfViewer } from './PdfViewer';
import OverlayBox from './OverlayBox';

const Parse: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [parseData, setParseData] = useState<ParseResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfDimensions, setPdfDimensions] = useState<{ width: number; height: number } | null>(null);
  const [highlightedItem, setHighlightedItem] = useState<string | null>(null);
  const pdfViewerRef = useRef<any>(null);
  const hasCalledApi = useRef(false);

  // Get file from location state
  const file = location.state?.file as File | undefined;
  const filename = file?.name || 'Unknown file';

  const handlePdfLoadSuccess = useCallback((numPages: number, pageDimensions: { width: number; height: number }) => {
    console.log('PDF loaded successfully:', numPages, 'pages, dimensions:', pageDimensions);
    setPdfDimensions(pageDimensions);
  }, []);

  // Calculate scale factor based on available space
  const calculateScaleFactor = useCallback(() => {
    if (!pdfDimensions) return 1;
    
    const maxWidth = window.innerWidth * 0.6; // 60% of viewport width (accounting for sidebar)
    const maxHeight = window.innerHeight * 0.8; // 80% of viewport height
    
    const scaleX = maxWidth / pdfDimensions.width;
    const scaleY = maxHeight / pdfDimensions.height;
    
    // Use the smaller scale to ensure PDF fits in both dimensions
    return Math.min(scaleX, scaleY, 1); // Don't scale up beyond 100%
  }, [pdfDimensions]);

  const scaleFactor = calculateScaleFactor();
  const scaledWidth = pdfDimensions ? pdfDimensions.width * scaleFactor : 800;
  const scaledHeight = pdfDimensions ? pdfDimensions.height * scaleFactor : 600;

  useEffect(() => {
    if (!file || hasCalledApi.current) return;

    const fetchParseData = async () => {
      try {
        setLoading(true);
        setError(null);
        hasCalledApi.current = true;
        const data = await parseDocument(file);
        setParseData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to parse document');
      } finally {
        setLoading(false);
      }
    };

    fetchParseData();
  }, [file]);

  // Recalculate scale on window resize
  useEffect(() => {
    const handleResize = () => {
      // Force re-render to recalculate scale
      if (pdfDimensions) {
        setPdfDimensions({ ...pdfDimensions });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [pdfDimensions]);

  const handlePositionChange = useCallback((id: string, x: number, y: number) => {
    console.log(`Position changed for ${id}:`, { x, y });
  }, []);

  const handleSizeChange = useCallback((id: string, width: number, height: number) => {
    console.log(`Size changed for ${id}:`, { width, height });
  }, []);

  // Memoize overlay items for the menu
  const overlayItems = useMemo(() => {
    if (!parseData) return [];
    
    const fieldItems = parseData.fields.map(field => ({
      id: `field-${field.name}`,
      label: field.name,
      type: 'field' as const,
      item: field
    }));
    
    const metadataItems = parseData.metadata.map((item, index) => ({
      id: `metadata-${item.content.slice(0, 20)}`,
      label: item.content.length > 30 ? `${item.content.slice(0, 30)}...` : item.content,
      type: 'metadata' as const,
      item: item
    }));
    
    return [...fieldItems, ...metadataItems];
  }, [parseData]);

  if (!file) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No file selected</h1>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            Go back to upload
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        {/* Main content area */}
        <div className="flex-1 flex flex-col">
          {/* Header with filename and back button */}
          <div className="border-b bg-card p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-foreground mb-2">
                  Parsing: {filename}
                </h1>
                <button
                  onClick={() => navigate('/')}
                  className="px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 transition-colors"
                >
                  ← Back to Uploads
                </button>
              </div>
              <div className="text-sm text-muted-foreground">
                {loading && 'Parsing document...'}
                {error && `Error: ${error}`}
                {parseData && `Found ${parseData.fields.length} fields, ${parseData.metadata.length} metadata items`}
              </div>
            </div>
          </div>

          {/* PDF viewer area - centered */}
          <div className="flex-1 flex items-center justify-center p-6 overflow-auto">
            <div 
              className="relative border border-border rounded-lg shadow-lg bg-white"
              style={{
                width: scaledWidth,
                height: scaledHeight,
                maxWidth: '100%',
                maxHeight: '100%',
              }}
            >
              <PdfViewer
                ref={pdfViewerRef}
                fileUrl={`/i-907_Jaz6iX6.pdf`}
                onLoadSuccess={handlePdfLoadSuccess}
                scale={scaleFactor}
              />
              
              {/* Overlay container - only show when both PDF and data are loaded */}
              {parseData && pdfDimensions && (
                <div 
                  className="absolute inset-0"
                  style={{
                    width: scaledWidth,
                    height: scaledHeight,
                    pointerEvents: 'none',
                    zIndex: 5,
                  }}
                >
                  {/* Form fields */}
                  {parseData.fields.map((field) => (
                    <OverlayBox
                      key={`field-${field.name}`}
                      item={field}
                      isField={true}
                      bounds={{
                        width: scaledWidth,
                        height: scaledHeight,
                      }}
                      onPositionChange={handlePositionChange}
                      onSizeChange={handleSizeChange}
                      isHighlighted={highlightedItem === `field-${field.name}`}
                    />
                  ))}
                  
                  {/* Metadata items */}
                  {parseData.metadata.map((item, index) => (
                    <OverlayBox
                      key={`metadata-${item.content.slice(0, 20)}`}
                      item={item}
                      isField={false}
                      bounds={{
                        width: scaledWidth,
                        height: scaledHeight,
                      }}
                      onPositionChange={handlePositionChange}
                      onSizeChange={handleSizeChange}
                      isHighlighted={highlightedItem === `metadata-${item.content.slice(0, 20)}`}
                    />
                  ))}
                </div>
              )}
              
              {/* Loading overlay when PDF dimensions aren't ready */}
              {!pdfDimensions && (
                <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading PDF...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right sidebar with overlay menu */}
        <div className="w-80 border-l bg-card">
          <div className="p-4 border-b">
            <h2 className="text-lg font-semibold text-foreground">Overlays</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Hover to highlight on PDF
            </p>
          </div>
          
          <div className="overflow-y-auto max-h-full">
            {/* Fields section */}
            {overlayItems.filter(item => item.type === 'field').length > 0 && (
              <div className="p-4">
                <h3 className="text-sm font-medium text-foreground mb-3 flex items-center">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  Form Fields ({overlayItems.filter(item => item.type === 'field').length})
                </h3>
                <div className="space-y-2">
                  {overlayItems
                    .filter(item => item.type === 'field')
                    .map((item) => (
                      <div
                        key={item.id}
                        className="p-2 rounded border border-border hover:bg-accent hover:border-blue-500 cursor-pointer transition-all duration-200"
                        onMouseEnter={() => setHighlightedItem(item.id)}
                        onMouseLeave={() => setHighlightedItem(null)}
                      >
                        <div className="text-sm font-medium text-foreground truncate">
                          {item.label}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Field
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Metadata section */}
            {overlayItems.filter(item => item.type === 'metadata').length > 0 && (
              <div className="p-4 border-t">
                <h3 className="text-sm font-medium text-foreground mb-3 flex items-center">
                  <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                  Metadata ({overlayItems.filter(item => item.type === 'metadata').length})
                </h3>
                <div className="space-y-2">
                  {overlayItems
                    .filter(item => item.type === 'metadata')
                    .map((item) => (
                      <div
                        key={item.id}
                        className="p-2 rounded border border-border hover:bg-accent hover:border-red-500 cursor-pointer transition-all duration-200"
                        onMouseEnter={() => setHighlightedItem(item.id)}
                        onMouseLeave={() => setHighlightedItem(null)}
                      >
                        <div className="text-sm font-medium text-foreground truncate">
                          {item.label}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Metadata
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Empty state */}
            {overlayItems.length === 0 && !loading && (
              <div className="p-4 text-center">
                <div className="text-muted-foreground text-sm">
                  {error ? 'Failed to load overlays' : 'No overlays found'}
                </div>
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div className="p-4 text-center">
                <div className="text-muted-foreground text-sm">
                  Loading overlays...
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Parse; 
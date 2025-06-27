import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PdfViewer } from './PdfViewer';
import OverlayBox from './OverlayBox';
import { useParseDocument } from '../api/parseApi';
import type { ParseResponse, Field, FieldType } from '../types/api';

const Parse: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const parseDocumentMutation = useParseDocument();
  
  const [parseData, setParseData] = useState<ParseResponse | null>(null);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [visibleFieldTypes, setVisibleFieldTypes] = useState<Set<FieldType>>(new Set([
    'label',
    'text_input',
    'checkbox'
  ]));
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [overlaysReady, setOverlaysReady] = useState(false);
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });
  const [fieldPositions, setFieldPositions] = useState<Record<string, { x: number; y: number; width: number; height: number }>>({});
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const pdfViewerRef = useRef<HTMLDivElement>(null);
  const [fieldTypesOpen, setFieldTypesOpen] = useState(true);
  const [fieldsOpen, setFieldsOpen] = useState(true);
  const [hiddenFields, setHiddenFields] = useState<Set<string>>(new Set());
  const [hoveredField, setHoveredField] = useState<string | null>(null);

  // Get the uploaded file from navigation state
  const uploadedFile = (location.state as any)?.file as File | undefined;

  const fieldTypeColors = {
    label: { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-800' },
    text_input: { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-800' },
    checkbox: { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-800' }
  };

  useEffect(() => {
    // Redirect if no file was provided
    if (!uploadedFile) {
      navigate('/');
      return;
    }

    // Create object URL for PDF display
    const url = URL.createObjectURL(uploadedFile);
    setPdfUrl(url);

    // Parse the document
    handleParse();

    // Cleanup URL when component unmounts
    return () => {
      if (url) {
        URL.revokeObjectURL(url);
      }
    };
  }, [uploadedFile, navigate]);

  // Handle position changes from draggable/resizable overlays
  const handlePositionChange = useCallback((fieldId: string, newPosition: { x: number; y: number; width: number; height: number }) => {
    setFieldPositions(prev => ({
      ...prev,
      [fieldId]: newPosition
    }));
    
    console.log(`Field ${fieldId} moved to:`, newPosition);
  }, []);

  // Handle scroll events to update overlay positions
  useEffect(() => {
    const handleScroll = () => {
      if (pdfViewerRef.current) {
        const { scrollLeft, scrollTop } = pdfViewerRef.current;
        setScrollPosition({ x: scrollLeft, y: scrollTop });
      }
    };

    const pdfViewer = pdfViewerRef.current;
    if (pdfViewer) {
      pdfViewer.addEventListener('scroll', handleScroll);
      return () => pdfViewer.removeEventListener('scroll', handleScroll);
    }
  }, [pdfLoaded]);

  const handleParse = async () => {
    if (!uploadedFile) return;

    try {
      const result = await parseDocumentMutation.mutateAsync(uploadedFile);
      setParseData(result);
      console.log('Parse data received:', result);
    } catch (error) {
      console.error('Parse error:', error);
    }
  };

  const handlePdfLoadSuccess = (numPages: number, pageDimensions: { width: number; height: number }) => {
    setPdfLoaded(true);
    console.log('PDF loaded:', numPages, 'pages');
    console.log('Rendered page dimensions:', pageDimensions);
    
    // Wait a bit for pages to render, then enable overlays
    setTimeout(() => {
      setOverlaysReady(true);
      console.log('Overlays ready, checking page positions...');
      
      // Debug: log all page positions and sample field data
      for (let i = 1; i <= numPages; i++) {
        const position = getPageElementPosition(i);
        console.log(`Page ${i} position:`, position);
        
        // Log some sample fields for this page
        const pageFields = parseData?.fields.filter(f => f.page === i) || [];
        console.log(`Page ${i} has ${pageFields.length} fields`);
        
        // Show first few fields as examples
        pageFields.slice(0, 3).forEach((field, index) => {
          const width = (field.bounding_box.x_max - field.bounding_box.x_min) * 100;
          const height = (field.bounding_box.y_max - field.bounding_box.y_min) * 100;
          console.log(`  Sample field ${index + 1}:`, {
            text: field.text.substring(0, 50),
            type: field.type,
            size: `${width.toFixed(2)}% x ${height.toFixed(2)}%`,
            position: `${(field.bounding_box.x_min * 100).toFixed(2)}%, ${(field.bounding_box.y_min * 100).toFixed(2)}%`
          });
        });
      }
    }, 500);
  };

  // Function to get the actual position and dimensions of a PDF page element
  const getPageElementPosition = (pageNumber: number) => {
    if (!pdfViewerRef.current) {
      console.log('PDF viewer ref not available');
      return null;
    }
    
    // Look for the page container div first
    const pageContainer = pdfViewerRef.current.querySelector(`[data-page-number="${pageNumber}"]`)?.parentElement;
    if (pageContainer) {
      const rect = pageContainer.getBoundingClientRect();
      const containerRect = pdfViewerRef.current.getBoundingClientRect();
      
      const position = {
        left: rect.left - containerRect.left,
        top: rect.top - containerRect.top,
        width: rect.width,
        height: rect.height
      };
      console.log(`Page ${pageNumber} container position:`, position);
      return position;
    }
    
    // Fallback: try to find by class and index
    const pageElements = pdfViewerRef.current.querySelectorAll('.react-pdf__Page');
    console.log(`Found ${pageElements.length} page elements, looking for page ${pageNumber}`);
    const targetPage = pageElements[pageNumber - 1];
    if (targetPage) {
      const rect = targetPage.getBoundingClientRect();
      const containerRect = pdfViewerRef.current.getBoundingClientRect();
      
      const position = {
        left: rect.left - containerRect.left,
        top: rect.top - containerRect.top,
        width: rect.width,
        height: rect.height
      };
      console.log(`Page ${pageNumber} position:`, position);
      return position;
    }
    
    console.log(`Could not find page element for page ${pageNumber}`);
    return null;
  };

  const toggleFieldType = (fieldType: FieldType) => {
    const newVisibleTypes = new Set(visibleFieldTypes);
    if (newVisibleTypes.has(fieldType)) {
      newVisibleTypes.delete(fieldType);
    } else {
      newVisibleTypes.add(fieldType);
    }
    setVisibleFieldTypes(newVisibleTypes);
  };

  const toggleAllFields = () => {
    const allFieldTypes: FieldType[] = ['label', 'text_input', 'checkbox'];
    const allVisible = allFieldTypes.every(type => visibleFieldTypes.has(type));
    
    if (allVisible) {
      // If all are visible, hide all
      setVisibleFieldTypes(new Set());
    } else {
      // If some are hidden, show all
      setVisibleFieldTypes(new Set(allFieldTypes));
    }
  };

  const getFieldTypeCount = (fieldType: FieldType) => {
    return parseData?.fields.filter(field => field.type === fieldType).length || 0;
  };

  const getVisibleFields = () => {
    if (!parseData) return [];
    
    let filteredFields = parseData.fields.filter(field => 
      visibleFieldTypes.has(field.type) && !hiddenFields.has(field.id)
    );
    
    // Apply search filter if search term exists
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filteredFields = filteredFields.filter(field => 
        field.text.toLowerCase().includes(searchLower) ||
        field.type.toLowerCase().includes(searchLower) ||
        field.id.toLowerCase().includes(searchLower) ||
        field.page.toString().includes(searchLower)
      );
    }
    
    return filteredFields;
  };

  const getFieldsByPage = (pageNumber: number) => {
    return getVisibleFields().filter(field => field.page === pageNumber);
  };

  const getFieldTypeLabel = (fieldType: FieldType) => {
    switch (fieldType) {
      case 'label': return 'Labels';
      case 'text_input': return 'Text Inputs';
      case 'checkbox': return 'Checkboxes';
      default: return fieldType;
    }
  };

  const getPageDimensions = (pageNumber: number) => {
    if (!parseData?.document_info.page_dimensions) return null;
    return parseData.document_info.page_dimensions.find(p => p.page === pageNumber);
  };

  // Scroll to the selected field in the PDF viewer
  const scrollToField = (field: Field) => {
    if (!pdfViewerRef.current) return;
    // Find the page container for the field's page
    const pageContainer = pdfViewerRef.current.querySelector(`[data-page-number="${field.page}"]`);
    if (pageContainer && 'scrollIntoView' in pageContainer) {
      (pageContainer as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Handle field close/hide
  const handleFieldClose = useCallback((fieldId: string) => {
    setHiddenFields(prev => new Set([...prev, fieldId]));
    // If the closed field was selected, clear selection
    if (selectedField?.id === fieldId) {
      setSelectedField(null);
    }
  }, [selectedField]);

  // Collapse field types filter when a field is selected
  useEffect(() => {
    if (selectedField) setFieldTypesOpen(false);
  }, [selectedField]);

  // Show loading state
  if (parseDocumentMutation.isPending) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Parsing document...</p>
          <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (parseDocumentMutation.isError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center p-8 bg-red-50 rounded-lg max-w-md">
          <div className="text-red-600 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-red-800 mb-2">Parsing Failed</h3>
          <p className="text-red-600 mb-4">{parseDocumentMutation.error?.message}</p>
          <div className="space-x-4">
            <button
              onClick={() => handleParse()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show message if no PDF URL available
  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 mb-4">No PDF file available</p>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!parseData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">No data available</p>
      </div>
    );
  }

  const visibleFields = getVisibleFields();

  return (
    <div className="min-h-screen bg-gray-100 relative">
      {/* Fixed Sidebar */}
      <div className="fixed left-0 top-0 w-80 bg-white shadow-lg border-r border-gray-200 flex flex-col h-screen overflow-hidden z-10">
        {/* Fixed Top Section */}
        <div className="shrink-0 bg-white border-b border-gray-300">
          {/* Header (more compact) */}
          <div className="p-2 border-b border-gray-200">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-base font-semibold text-gray-800">Document Analysis</h2>
              <div className="flex space-x-1">
                <button
                  onClick={handleParse}
                  disabled={parseDocumentMutation.isPending}
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {parseDocumentMutation.isPending ? 'Parsing...' : 'Refresh'}
                </button>
                <button
                  onClick={() => navigate('/')} 
                  className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-600">
              <span className="font-medium">{uploadedFile?.name}</span>
            </div>
            <div className="text-xs text-gray-500">
              Total: {parseData?.fields.length || 0} fields • {parseData?.document_info.total_pages || 0} pages
            </div>
          </div>

          {/* Field Type Filters (collapsible) */}
          <div className="border-b border-gray-200">
            <button
              className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-50 hover:bg-gray-100 focus:outline-none"
              onClick={() => setFieldTypesOpen((open) => !open)}
              aria-expanded={fieldTypesOpen}
            >
              <span>Field Types</span>
              <svg className={`w-4 h-4 ml-2 transition-transform ${fieldTypesOpen ? '' : 'rotate-180'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {fieldTypesOpen && (
              <div className="px-4 pb-2 space-y-2">
                {/* Toggle All Button */}
                <button
                  onClick={toggleAllFields}
                  className="w-full py-1 px-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {visibleFieldTypes.size === 0 ? 'Show All Fields' : 
                   visibleFieldTypes.size === 3 ? 'Hide All Fields' : 'Show All Fields'}
                </button>
                
                {/* Individual Field Type Toggles */}
                <div className="space-y-1">
                  {Object.keys(fieldTypeColors).map((fieldType) => {
                    const count = getFieldTypeCount(fieldType as FieldType);
                    const colors = fieldTypeColors[fieldType as FieldType];
                    const isVisible = visibleFieldTypes.has(fieldType as FieldType);
                    return (
                      <label key={fieldType} className="flex items-center space-x-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isVisible}
                          onChange={() => toggleFieldType(fieldType as FieldType)}
                          className="rounded border-gray-300"
                        />
                        <span className={`px-2 py-1 rounded text-xs ${colors.bg} ${colors.text}`}>
                          {getFieldTypeLabel(fieldType as FieldType)} ({count})
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Selected Field Info (more compact) */}
          {selectedField && (
            <div className="p-2 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-700">Selected Field</h3>
                <button
                  onClick={() => handleFieldClose(selectedField.id)}
                  className="w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold transition-colors opacity-70 hover:opacity-100"
                  title="Hide this field"
                  style={{
                    fontSize: '10px',
                    lineHeight: '1',
                  }}
                >
                  ×
                </button>
              </div>
              <div className="space-y-1 text-xs">
                <div>
                  <span className="font-medium text-gray-600">Type:</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${fieldTypeColors[selectedField.type]?.bg} ${fieldTypeColors[selectedField.type]?.text}`}>
                    {getFieldTypeLabel(selectedField.type)}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Text:</span>
                  <p className="mt-1 text-gray-800 break-words">{selectedField.text}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Page:</span>
                  <span className="ml-2 text-gray-800">{selectedField.page}</span>
                </div>
                {selectedField.form_field_info && (
                  <div>
                    <span className="font-medium text-gray-600">Input Type:</span>
                    <span className="ml-2 text-gray-800">{selectedField.form_field_info.field_type}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fixed Search Section */}
          <div className="p-2 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">Fields ({visibleFields.length})</span>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded"
                  title="Clear search"
                >
                  Clear
                </button>
              )}
            </div>
            {/* Search input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search fields..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 pr-8 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Fields List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2 space-y-1">
            {visibleFields.map((field) => {
              const colors = fieldTypeColors[field.type];
              const isSelected = selectedField?.id === field.id;
              
              return (
                <div
                  key={field.id}
                  className={`relative p-2 rounded border transition-all hover:shadow-sm ${
                    isSelected 
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                      : `${colors.border} ${colors.bg} hover:shadow-md`
                  }`}
                  onMouseEnter={() => setHoveredField(field.id)}
                  onMouseLeave={() => setHoveredField(null)}
                >
                  {/* Close button - top right corner */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFieldClose(field.id);
                    }}
                    className="absolute top-1 right-1 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold transition-colors opacity-70 hover:opacity-100 z-10"
                    title="Hide this field"
                    style={{
                      fontSize: '10px',
                      lineHeight: '1',
                    }}
                  >
                    ×
                  </button>

                  <div 
                    className="cursor-pointer pr-6 relative"
                    onClick={() => {
                      setSelectedField(field);
                      scrollToField(field);
                    }}
                  >
                    {/* Show field type for text inputs and checkboxes */}
                    {field.type === 'text_input' && (
                      <div className="mb-1">
                        <span className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                          Text Input
                        </span>
                      </div>
                    )}
                    {field.type === 'checkbox' && (
                      <div className="mb-1">
                        <span className="text-xs px-2 py-0.5 rounded bg-orange-100 text-orange-700 font-medium">
                          Checkbox
                        </span>
                      </div>
                    )}
                    <p className="text-xs text-gray-800 break-words py-2">
                      {field.text}
                    </p>
                    <span className="text-gray-400 bg-white/80 px-1 py-0.5 rounded border border-gray-200" style={{ fontSize: '9px' }}>
                      page {field.page}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="ml-80 min-h-screen relative">
        <div className="relative w-full min-h-full flex-1">
          <PdfViewer 
            ref={pdfViewerRef}
            fileUrl={pdfUrl} 
            onLoadSuccess={handlePdfLoadSuccess}
            scale={1.5}
          />
          
          {/* Debug: Corner markers for coordinate system verification */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              transform: `translate(-${scrollPosition.x}px, -${scrollPosition.y}px)`,
            }}
          >
            {overlaysReady && parseData && Array.from({ length: parseData.document_info.total_pages }, (_, index) => {
              const pageNumber = index + 1;
              const pagePosition = getPageElementPosition(pageNumber);
              
              if (!pagePosition) return null;
              
              return (
                <div key={`debug-markers-${pageNumber}`}>
                  {/* Top-left corner marker */}
                  <div
                    className="absolute w-4 h-4 bg-red-500 border-2 border-white shadow-lg z-50"
                    style={{
                      left: pagePosition.left + scrollPosition.x,
                      top: pagePosition.top + scrollPosition.y,
                    }}
                    title={`Page ${pageNumber} - Top Left`}
                  />
                  {/* Top-right corner marker */}
                  <div
                    className="absolute w-4 h-4 bg-blue-500 border-2 border-white shadow-lg z-50"
                    style={{
                      left: pagePosition.left + pagePosition.width - 16 + scrollPosition.x,
                      top: pagePosition.top + scrollPosition.y,
                    }}
                    title={`Page ${pageNumber} - Top Right`}
                  />
                  {/* Bottom-left corner marker */}
                  <div
                    className="absolute w-4 h-4 bg-green-500 border-2 border-white shadow-lg z-50"
                    style={{
                      left: pagePosition.left + scrollPosition.x,
                      top: pagePosition.top + pagePosition.height - 16 + scrollPosition.y,
                    }}
                    title={`Page ${pageNumber} - Bottom Left`}
                  />
                  {/* Bottom-right corner marker */}
                  <div
                    className="absolute w-4 h-4 bg-yellow-500 border-2 border-white shadow-lg z-50"
                    style={{
                      left: pagePosition.left + pagePosition.width - 16 + scrollPosition.x,
                      top: pagePosition.top + pagePosition.height - 16 + scrollPosition.y,
                    }}
                    title={`Page ${pageNumber} - Bottom Right`}
                  />
                </div>
              );
            })}
          </div>
          
          {/* Overlay container that moves with scroll */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              transform: `translate(-${scrollPosition.x}px, -${scrollPosition.y}px)`,
              zIndex: 1000, // High z-index to be above PDF
            }}
          >
            {/* Page-specific Overlay containers */}
            {overlaysReady && parseData && Array.from({ length: parseData.document_info.total_pages }, (_, index) => {
              const pageNumber = index + 1;
              const pageFields = getFieldsByPage(pageNumber);
              const pageDimensions = getPageDimensions(pageNumber);
              const pagePosition = getPageElementPosition(pageNumber);
              
              if (pageFields.length === 0 || !pageDimensions || !pagePosition) return null;
              
              return (
                <div
                  key={`page-overlay-${pageNumber}`}
                  className="absolute pointer-events-none"
                  style={{
                    // Position the overlay container to match the actual PDF page position
                    left: pagePosition.left + scrollPosition.x,
                    top: pagePosition.top + scrollPosition.y,
                    width: pagePosition.width,
                    height: pagePosition.height,
                    zIndex: 1001, // Above the main overlay container
                  }}
                >
                  {pageFields.map((field) => (
                    <div key={field.id} className="pointer-events-auto">
                      <OverlayBox
                        field={field}
                        pageDimensions={pageDimensions}
                        onClick={() => setSelectedField(field)}
                        isSelected={selectedField?.id === field.id}
                        isHovered={hoveredField === field.id}
                        onPositionChange={handlePositionChange}
                        onClose={handleFieldClose}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Parse; 
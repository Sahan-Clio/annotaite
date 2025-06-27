import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PdfViewer } from './PdfViewer';
import OverlayBox from './OverlayBox';
import { useParseDocument, useAnalyzeWithAI } from '../api/parseApi';
import type { ParseResponse, Field, FieldType, FieldAssociation } from '../types/api';

const Parse: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const parseDocumentMutation = useParseDocument();
  const analyzeWithAIMutation = useAnalyzeWithAI();
  
  const [parseData, setParseData] = useState<ParseResponse | null>(null);
  const [aiAnalysisData, setAiAnalysisData] = useState<ParseResponse | null>(null);
  const [isUsingAIFiltering, setIsUsingAIFiltering] = useState<boolean>(false);
  const [aiAnalysisCompleted, setAiAnalysisCompleted] = useState<boolean>(false);
  const [selectedAssociation, setSelectedAssociation] = useState<FieldAssociation | null>(null);
  const [selectedField, setSelectedField] = useState<Field | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [visibleFieldTypes, setVisibleFieldTypes] = useState<Set<FieldType>>(new Set([
    'label',
    'text_input',
    'checkbox'
  ]));
  const [visibleInputTypes, setVisibleInputTypes] = useState<Set<'text_input' | 'checkbox'>>(new Set([
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
  const [hiddenAssociations, setHiddenAssociations] = useState<Set<string>>(new Set());
  const [hoveredAssociation, setHoveredAssociation] = useState<string | null>(null);
  const [hoveredField, setHoveredField] = useState<string | null>(null);

  // Get the uploaded file from navigation state
  const uploadedFile = (location.state as any)?.file as File | undefined;

  // Get the current data source (AI filtered or original)
  const currentData = isUsingAIFiltering && aiAnalysisData ? aiAnalysisData : parseData;
  const currentAssociations = currentData?.field_associations || [];
  const currentFields = currentData?.fields || [];
  
  // Determine if we're showing associations or individual fields
  const showingAssociations = isUsingAIFiltering && currentAssociations.length > 0;
  const showingIndividualFields = !showingAssociations && currentFields.length > 0;

  const inputTypeColors = {
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

  const handleAIAnalyze = async () => {
    if (!parseData) return;

    try {
      console.log('Starting AI analysis with payload:', parseData);
      const result = await analyzeWithAIMutation.mutateAsync(parseData);
      console.log('AI analysis result:', result);
      
      // Extract the enhanced data from the nested response
      const enhancedData = result.data || result;
      
      // Ensure the enhanced data has the expected structure
      if (!enhancedData || !enhancedData.field_associations || !Array.isArray(enhancedData.field_associations)) {
        console.error('Invalid AI analysis response structure:', enhancedData);
        throw new Error('Invalid AI analysis response structure');
      }
      
      // Store the AI analysis result and switch to using it
      setAiAnalysisData(enhancedData);
      setIsUsingAIFiltering(true);
      setAiAnalysisCompleted(true);
      
      // Clear any selected association since associations might have changed
      setSelectedAssociation(null);
      setHiddenAssociations(new Set());
      
      console.log(`AI filtering enabled: ${enhancedData.field_associations.length} associations (filtered from ${parseData.fields.length} fields)`);
    } catch (error) {
      console.error('AI analysis error:', error);
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
      
      // Debug: log all page positions and sample association data
      for (let i = 1; i <= numPages; i++) {
        const position = getPageElementPosition(i);
        console.log(`Page ${i} position:`, position);
        
        // Log some sample associations for this page
        const pageAssociations = currentAssociations.filter(assoc => assoc.page === i) || [];
        console.log(`Page ${i} has ${pageAssociations.length} associations`);
        
        // Show first few associations as examples
        pageAssociations.slice(0, 3).forEach((assoc, index) => {
          const labelWidth = (assoc.label.bounding_box.x_max - assoc.label.bounding_box.x_min) * 100;
          const labelHeight = (assoc.label.bounding_box.y_max - assoc.label.bounding_box.y_min) * 100;
          const inputWidth = (assoc.input.bounding_box.x_max - assoc.input.bounding_box.x_min) * 100;
          const inputHeight = (assoc.input.bounding_box.y_max - assoc.input.bounding_box.y_min) * 100;
          
          console.log(`  Sample association ${index + 1}:`, {
            label: assoc.label.text.substring(0, 30),
            inputType: assoc.input.type,
            labelSize: `${labelWidth.toFixed(2)}% x ${labelHeight.toFixed(2)}%`,
            inputSize: `${inputWidth.toFixed(2)}% x ${inputHeight.toFixed(2)}%`
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

  const toggleFieldType = (inputType: 'text_input' | 'checkbox') => {
    const newVisibleTypes = new Set(visibleInputTypes);
    if (newVisibleTypes.has(inputType)) {
      newVisibleTypes.delete(inputType);
    } else {
      newVisibleTypes.add(inputType);
    }
    setVisibleInputTypes(newVisibleTypes);
  };

  const toggleIndividualFieldType = (fieldType: FieldType) => {
    const newVisibleTypes = new Set(visibleFieldTypes);
    if (newVisibleTypes.has(fieldType)) {
      newVisibleTypes.delete(fieldType);
    } else {
      newVisibleTypes.add(fieldType);
    }
    setVisibleFieldTypes(newVisibleTypes);
  };

  const toggleAllFields = () => {
    if (showingAssociations) {
      const allInputTypes: ('text_input' | 'checkbox')[] = ['text_input', 'checkbox'];
      const allVisible = allInputTypes.every(type => visibleInputTypes.has(type));
      
      if (allVisible) {
        setVisibleInputTypes(new Set());
      } else {
        setVisibleInputTypes(new Set(allInputTypes));
      }
    } else {
      const allFieldTypes: FieldType[] = ['label', 'text_input', 'checkbox'];
      const allVisible = allFieldTypes.every(type => visibleFieldTypes.has(type));
      
      if (allVisible) {
        setVisibleFieldTypes(new Set());
      } else {
        setVisibleFieldTypes(new Set(allFieldTypes));
      }
    }
  };

  const getFieldTypeCount = (fieldType: FieldType | 'text_input' | 'checkbox') => {
    if (showingAssociations) {
      return currentAssociations.filter(assoc => assoc.input.type === fieldType).length;
    } else {
      return currentFields.filter(field => field.type === fieldType).length;
    }
  };

  const getVisibleFields = () => {
    if (!currentData || !currentData.fields || !Array.isArray(currentData.fields)) return [];
    
    let filteredFields = currentData.fields.filter(field => 
      visibleFieldTypes.has(field.type) && !hiddenAssociations.has(field.id)
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

  const getVisibleAssociations = () => {
    if (!currentData || !currentData.field_associations || !Array.isArray(currentData.field_associations)) return [];
    
    let filteredAssociations = currentData.field_associations.filter(assoc => 
      visibleInputTypes.has(assoc.input.type) && !hiddenAssociations.has(assoc.id)
    );
    
    // Apply search filter if search term exists
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      filteredAssociations = filteredAssociations.filter(assoc => 
        assoc.label.text.toLowerCase().includes(searchLower) ||
        assoc.input.type.toLowerCase().includes(searchLower) ||
        assoc.id.toLowerCase().includes(searchLower) ||
        assoc.page.toString().includes(searchLower)
      );
    }
    
    return filteredAssociations;
  };

  const getFieldsByPage = (pageNumber: number) => {
    return getVisibleFields().filter(field => field.page === pageNumber);
  };

  const getAssociationsByPage = (pageNumber: number) => {
    return getVisibleAssociations().filter(assoc => assoc.page === pageNumber);
  };

  const getInputTypeLabel = (inputType: 'text_input' | 'checkbox') => {
    switch (inputType) {
      case 'text_input': return 'Text Inputs';
      case 'checkbox': return 'Checkboxes';
      default: return inputType;
    }
  };

  const getPageDimensions = (pageNumber: number) => {
    if (!currentData?.document_info?.page_dimensions || !Array.isArray(currentData.document_info.page_dimensions)) return null;
    return currentData.document_info.page_dimensions.find(p => p.page === pageNumber);
  };

  // Scroll to the selected association in the PDF viewer
  const scrollToAssociation = (assoc: FieldAssociation) => {
    if (!pdfViewerRef.current) return;
    // Find the page container for the association's page
    const pageContainer = pdfViewerRef.current.querySelector(`[data-page-number="${assoc.page}"]`);
    if (pageContainer && 'scrollIntoView' in pageContainer) {
      (pageContainer as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
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

  // Handle association close/hide
  const handleAssociationClose = useCallback((assocId: string) => {
    setHiddenAssociations(prev => new Set([...prev, assocId]));
    // If the closed association was selected, clear selection
    if (selectedAssociation?.id === assocId) {
      setSelectedAssociation(null);
    }
  }, [selectedAssociation]);

  // Handle field close/hide
  const handleFieldClose = useCallback((fieldId: string) => {
    setHiddenAssociations(prev => new Set([...prev, fieldId]));
    // If the closed field was selected, clear selection
    if (selectedField?.id === fieldId) {
      setSelectedField(null);
    }
  }, [selectedField]);

  // Collapse field types filter when a association is selected
  useEffect(() => {
    if (selectedAssociation) setFieldTypesOpen(false);
  }, [selectedAssociation]);

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

  if (!currentData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">No data available</p>
      </div>
    );
  }

  const visibleFields = getVisibleFields();
  const visibleAssociations = getVisibleAssociations();

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
              {isUsingAIFiltering && aiAnalysisData ? (
                <>
                  Total: {aiAnalysisData.field_associations?.length || 0} associations • {currentData?.document_info?.total_pages || 0} pages
                  <span className="ml-2 text-green-600 font-medium">
                    (AI matched from {parseData?.fields?.length || 0} fields)
                  </span>
                </>
              ) : (
                <>
                  Total: {currentData?.fields?.length || 0} fields • {currentData?.document_info?.total_pages || 0} pages
                </>
              )}
            </div>
            <div className="mt-2 space-y-1">
              <button
                onClick={() => handleAIAnalyze()}
                disabled={analyzeWithAIMutation.isPending || !parseData || aiAnalysisCompleted}
                className={`w-full px-3 py-1.5 text-xs rounded-md transition-all duration-200 shadow-sm hover:shadow-md ${
                  aiAnalysisCompleted
                    ? 'bg-green-600 text-white cursor-default'
                    : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
                }`}
              >
                {analyzeWithAIMutation.isPending ? (
                  <span className="flex items-center justify-center space-x-1">
                    <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Analyzing...</span>
                  </span>
                ) : aiAnalysisCompleted ? (
                  <span className="flex items-center justify-center space-x-1">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>AI Analysis Complete</span>
                  </span>
                ) : (
                  '✨ AI Analyze'
                )}
              </button>
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
                {/* Toggle All Fields Button */}
                <button
                  onClick={toggleAllFields}
                  className="w-full py-1 px-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded border border-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {showingAssociations ? (
                    visibleInputTypes.size === 0 ? 'Show All Fields' : 
                    visibleInputTypes.size === 2 ? 'Hide All Fields' : 'Show All Fields'
                  ) : (
                    visibleFieldTypes.size === 0 ? 'Show All Fields' : 
                    visibleFieldTypes.size === 3 ? 'Hide All Fields' : 'Show All Fields'
                  )}
                </button>
                
                {/* Individual Field Type Toggles */}
                <div className="space-y-1">
                  {showingAssociations ? (
                    // Show input type toggles for associations
                    Object.keys(inputTypeColors).map((fieldType) => {
                      const count = getFieldTypeCount(fieldType as 'text_input' | 'checkbox');
                      const colors = inputTypeColors[fieldType as 'text_input' | 'checkbox'];
                      const isVisible = visibleInputTypes.has(fieldType as 'text_input' | 'checkbox');
                      return (
                        <label key={fieldType} className="flex items-center space-x-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={() => toggleFieldType(fieldType as 'text_input' | 'checkbox')}
                            className="rounded border-gray-300"
                          />
                          <span className={`px-2 py-1 rounded text-xs ${colors.bg} ${colors.text}`}>
                            {getInputTypeLabel(fieldType as 'text_input' | 'checkbox')} ({count})
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    // Show all field type toggles for individual fields
                    ['label', 'text_input', 'checkbox'].map((fieldType) => {
                      const count = getFieldTypeCount(fieldType as FieldType);
                      const colors = fieldType === 'label' 
                        ? { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-800' }
                        : inputTypeColors[fieldType as 'text_input' | 'checkbox'];
                      const isVisible = visibleFieldTypes.has(fieldType as FieldType);
                      return (
                        <label key={fieldType} className="flex items-center space-x-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={() => toggleIndividualFieldType(fieldType as FieldType)}
                            className="rounded border-gray-300"
                          />
                          <span className={`px-2 py-1 rounded text-xs ${colors.bg} ${colors.text}`}>
                            {fieldType === 'label' ? 'Labels' : getInputTypeLabel(fieldType as 'text_input' | 'checkbox')} ({count})
                          </span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Selected Association/Field Info (more compact) */}
          {selectedAssociation && showingAssociations && (
            <div className="p-2 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-700">Selected Association</h3>
                <button
                  onClick={() => handleAssociationClose(selectedAssociation.id)}
                  className="w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold transition-colors opacity-70 hover:opacity-100"
                  title="Hide this association"
                  style={{
                    fontSize: '10px',
                    lineHeight: '1'
                  }}
                >
                  ×
                </button>
              </div>
              <div className="space-y-1 text-xs">
                <div>
                  <span className="font-medium text-gray-600">Label:</span>
                  <p className="mt-1 text-gray-800 break-words">{selectedAssociation.label.text}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Input Type:</span>
                  <span className="ml-2 text-gray-800">{selectedAssociation.input.type}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Page:</span>
                  <span className="ml-2 text-gray-800">{selectedAssociation.page}</span>
                </div>
              </div>
            </div>
          )}

          {/* Selected Individual Field Info */}
          {selectedField && !showingAssociations && (
            <div className="p-2 border-b border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-gray-700">Selected Field</h3>
                <button
                  onClick={() => handleFieldClose(selectedField.id)}
                  className="w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold transition-colors opacity-70 hover:opacity-100"
                  title="Hide this field"
                  style={{
                    fontSize: '10px',
                    lineHeight: '1'
                  }}
                >
                  ×
                </button>
              </div>
              <div className="space-y-1 text-xs">
                <div>
                  <span className="font-medium text-gray-600">Type:</span>
                  <span className="ml-2 text-gray-800">{selectedField.type}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Text:</span>
                  <p className="mt-1 text-gray-800 break-words">{selectedField.text}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-600">Page:</span>
                  <span className="ml-2 text-gray-800">{selectedField.page}</span>
                </div>
              </div>
            </div>
          )}

          {/* Fixed Search Section */}
          <div className="p-2 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">
                {showingAssociations ? `Associations (${visibleAssociations.length})` : `Fields (${visibleFields.length})`}
              </span>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Clear
                </button>
              )}
            </div>
            <div className="relative">
              <input
                type="text"
                placeholder={showingAssociations ? "Search associations..." : "Search fields..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Scrollable Fields/Associations List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2 space-y-1">
            {showingAssociations ? (
              // Show associations
              visibleAssociations.map((assoc) => {
                const colors = inputTypeColors[assoc.input.type];
                const isSelected = selectedAssociation?.id === assoc.id;
                
                return (
                  <div
                    key={assoc.id}
                    className={`relative p-2 rounded border transition-all hover:shadow-sm ${
                      isSelected 
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' 
                        : `${colors.border} ${colors.bg} hover:shadow-md`
                    }`}
                    onMouseEnter={() => setHoveredAssociation(assoc.id)}
                    onMouseLeave={() => setHoveredAssociation(null)}
                  >
                    {/* Close button - top right corner */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAssociationClose(assoc.id);
                      }}
                      className="absolute top-1 right-1 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-bold transition-colors opacity-70 hover:opacity-100 z-10"
                      title="Hide this association"
                      style={{
                        fontSize: '10px',
                        lineHeight: '1'
                      }}
                    >
                      ×
                    </button>
                    <div
                      className="cursor-pointer pr-6 relative"
                      onClick={() => {
                        setSelectedAssociation(assoc);
                        scrollToAssociation(assoc);
                      }}
                    >
                      <p className="text-xs text-gray-800 break-words py-2">
                        {assoc.label.text}
                      </p>
                      <span className="text-gray-400 bg-white/80 px-1 py-0.5 rounded border border-gray-200" style={{ fontSize: '9px' }}>
                        page {assoc.page}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              // Show individual fields
              visibleFields.map((field) => {
                const colors = field.type === 'label' 
                  ? { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-800' }
                  : inputTypeColors[field.type as 'text_input' | 'checkbox'];
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
                        lineHeight: '1'
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
              })
            )}
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
            {overlaysReady && currentData && currentData.document_info && Array.from({ length: currentData.document_info.total_pages || 0 }, (_, index) => {
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
            {overlaysReady && currentData && currentData.document_info && Array.from({ length: currentData.document_info.total_pages || 0 }, (_, index) => {
              const pageNumber = index + 1;
              const pageAssociations = getAssociationsByPage(pageNumber);
              const pageFields = getFieldsByPage(pageNumber);
              const pageDimensions = getPageDimensions(pageNumber);
              const pagePosition = getPageElementPosition(pageNumber);
              
              // Check if we have content to show on this page
              const hasContent = showingAssociations ? pageAssociations.length > 0 : pageFields.length > 0;
              
              if (!hasContent || !pageDimensions || !pagePosition) return null;
              
              return (
                <div
                  key={pageNumber}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${pagePosition.left}px`,
                    top: `${pagePosition.top}px`,
                    width: `${pagePosition.width}px`,
                    height: `${pagePosition.height}px`,
                    transform: `translate(${-scrollPosition.x}px, ${-scrollPosition.y}px)`,
                  }}
                >
                  {showingAssociations ? (
                    // Render associations
                    pageAssociations.map((assoc) => (
                      <div key={assoc.id} className="pointer-events-auto">
                        {/* Input field overlay - always visible */}
                        <OverlayBox
                          field={{
                            id: assoc.input.id,
                            type: assoc.input.type,
                            text: assoc.label.text, // Show label text on input overlay
                            page: assoc.page,
                            bounding_box: assoc.input.bounding_box
                          }}
                          pageDimensions={pageDimensions}
                          onClick={() => setSelectedAssociation(assoc)}
                          isSelected={selectedAssociation?.id === assoc.id}
                          isHovered={hoveredAssociation === assoc.id}
                          onPositionChange={handlePositionChange}
                          onClose={() => handleAssociationClose(assoc.id)}
                        />
                        
                        {/* Label overlay - only visible when hovered */}
                        {hoveredAssociation === assoc.id && (
                          <OverlayBox
                            field={{
                              id: assoc.label.id,
                              type: 'label',
                              text: assoc.label.text,
                              page: assoc.page,
                              bounding_box: assoc.label.bounding_box
                            }}
                            pageDimensions={pageDimensions}
                            onClick={() => setSelectedAssociation(assoc)}
                            isSelected={false}
                            isHovered={false}
                            onPositionChange={handlePositionChange}
                            onClose={() => handleAssociationClose(assoc.id)}
                          />
                        )}
                      </div>
                    ))
                  ) : (
                    // Render individual fields
                    pageFields.map((field) => (
                      <div key={field.id} className="pointer-events-auto">
                        <OverlayBox
                          field={field}
                          pageDimensions={pageDimensions}
                          onClick={() => setSelectedField(field)}
                          isSelected={selectedField?.id === field.id}
                          isHovered={hoveredField === field.id}
                          onPositionChange={handlePositionChange}
                          onClose={() => handleFieldClose(field.id)}
                        />
                      </div>
                    ))
                  )}
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
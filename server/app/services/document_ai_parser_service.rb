require 'google/cloud/document_ai'

class DocumentAiParserService
  HARDCODED_PDF_PATH = Rails.root.join('data', 'forms', 'i-907_Jaz6iX6.pdf').freeze

  def initialize
    @project_id = ENV.fetch('DOC_AI_PROJECT_ID')
    @location = ENV.fetch('DOC_AI_LOCATION')
    @processor_id = ENV.fetch('DOC_AI_PROCESSOR_ID')
  end

  def call
    document = process_document
    extract_data(document)
  end

  private

  def process_document
    client = Google::Cloud::DocumentAI.document_processor_service do |config|
      config.endpoint = "#{@location}-documentai.googleapis.com"
    end

    # Read the hardcoded PDF file as binary
    file_content = File.open(HARDCODED_PDF_PATH, 'rb') { |f| f.read }

    # Create the request
    request = {
      name: processor_path,
      raw_document: {
        content: file_content,
        mime_type: 'application/pdf'
      }
    }

    Rails.logger.info "Sending request to Google Document AI: \\n\#{request.inspect}"
    # Process the document
    response = client.process_document(request)
    Rails.logger.info "Received response from Google Document AI: \\n\\#{response.inspect}"
    response.document
  end

  def processor_path
    "projects/#{@project_id}/locations/#{@location}/processors/#{@processor_id}"
  end

  def extract_data(document)
    fields = extract_form_fields(document)
    metadata = extract_metadata(document)

    {
      fields: fields,
      metadata: metadata
    }
  end

  def extract_form_fields(document)
    fields = []
    
    document.pages.each do |page|
      page.form_fields.each do |form_field|
        field_name = extract_text_from_anchor(document.text, form_field.field_name&.text_anchor)
        
        # Extract bounding boxes for label and input
        label_bbox = extract_bounding_box(form_field.field_name&.bounding_poly, page)
        input_bbox = extract_bounding_box(form_field.field_value&.bounding_poly, page)

        fields << {
          name: field_name&.strip,
          label_bounding_box: label_bbox,
          input_bounding_box: input_bbox
        }
      end
    end

    fields
  end

  def extract_metadata(document)
    metadata = []
    
    document.pages.each_with_index do |page, page_index|
      # Extract paragraphs that are not part of form fields
      page.paragraphs.each do |paragraph|
        content = extract_text_from_anchor(document.text, paragraph.layout&.text_anchor)
        next if content.blank?

        # Skip if this paragraph is part of a form field
        next if paragraph_is_form_field?(paragraph, page)

        bbox = extract_bounding_box(paragraph.layout&.bounding_poly, page)
        
        metadata << {
          content: content.strip,
          bounding_box: bbox
        }
      end
    end

    metadata
  end

  def paragraph_is_form_field?(paragraph, page)
    # Simple heuristic: check if paragraph overlaps with any form field
    paragraph_bbox = paragraph.layout&.bounding_poly
    return false unless paragraph_bbox

    page.form_fields.any? do |form_field|
      overlaps_with_form_field?(paragraph_bbox, form_field)
    end
  end

  def overlaps_with_form_field?(paragraph_bbox, form_field)
    # Check overlap with field name or field value bounding boxes
    field_name_bbox = form_field.field_name&.bounding_poly
    field_value_bbox = form_field.field_value&.bounding_poly

    bboxes_overlap?(paragraph_bbox, field_name_bbox) ||
      bboxes_overlap?(paragraph_bbox, field_value_bbox)
  end

  def bboxes_overlap?(bbox1, bbox2)
    return false unless bbox1 && bbox2 && bbox1.vertices.any? && bbox2.vertices.any?

    # Simple overlap check using first vertex as approximation
    v1 = bbox1.vertices.first
    v2 = bbox2.vertices.first
    
    # Basic proximity check (can be improved)
    (v1.x - v2.x).abs < 50 && (v1.y - v2.y).abs < 50
  end

  def extract_text_from_anchor(full_text, text_anchor)
    return nil unless text_anchor&.text_segments&.any?

    segment = text_anchor.text_segments.first
    start_index = segment.start_index || 0
    end_index = segment.end_index

    return nil unless end_index

    full_text[start_index...end_index]
  end

  def extract_bounding_box(bounding_poly, page)
    return nil unless bounding_poly&.vertices&.any?

    # Get page dimensions for normalization
    page_width = page.dimension&.width || 1.0
    page_height = page.dimension&.height || 1.0

    vertices = bounding_poly.vertices
    
    # Extract min/max coordinates
    x_coords = vertices.map(&:x).compact
    y_coords = vertices.map(&:y).compact
    
    return nil if x_coords.empty? || y_coords.empty?

    {
      page: page.page_number || 1,
      x_min: (x_coords.min / page_width).round(4),
      y_min: (y_coords.min / page_height).round(4),
      x_max: (x_coords.max / page_width).round(4),
      y_max: (y_coords.max / page_height).round(4)
    }
  end
end 
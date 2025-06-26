require 'google/cloud/document_ai'

require 'ostruct'

class DocumentAiParserService
  def initialize(file_path)
    @file_path = file_path
    @client = Google::Cloud::DocumentAI.document_processor_service
    @project_id = ENV['GOOGLE_CLOUD_PROJECT_ID'] || 'your-project-id'
    @location = ENV['GOOGLE_CLOUD_LOCATION'] || 'us'
    @processor_id = ENV['GOOGLE_CLOUD_PROCESSOR_ID'] || 'your-processor-id'
  end

  def parse
    # Use saved Google API response instead of making live API call
    document = load_saved_google_response
    extract_data(document)
  end

  private

  def load_saved_google_response
    # Load the saved Google API response from the Rails root directory
    response_path = Rails.root.join('google_api_raw_response.json')
    
    unless File.exist?(response_path)
      raise "Google API response file not found at #{response_path}. Please ensure the file exists in the project root."
    end

    raw_data = JSON.parse(File.read(response_path))
    
    # Extract the document part from the Google API response
    # The structure is { "document": { ... } }
    document_data = raw_data['document'] || raw_data[:document]
    
    # Convert the hash to an OpenStruct for easier access
    OpenStruct.new(document_data)
  end

  def process_document
    processor_name = @client.processor_path(
      project: @project_id,
      location: @location,
      processor: @processor_id
    )

    # Read the file in binary mode
    file_content = File.binread(@file_path)

    request = {
      name: processor_name,
      raw_document: {
        content: file_content,
        mime_type: 'application/pdf'
      }
    }

    response = @client.process_document(request)
    response.document
  end

  def save_raw_response(document)
    File.write('google_api_raw_response.json', JSON.pretty_generate(document.to_h))
  end

  def extract_data(document_data)
    fields = []
    field_id_counter = 1

    # Extract document info
    document_info = extract_document_info(document_data)

    # Process each page
    document_data.pages.each do |page|
      page_number = page['page_number'] || page[:page_number]

      # Extract form fields (labels and inputs)
      (page['form_fields'] || page[:form_fields] || []).each do |form_field|
        # Extract field name (label)
        field_name = form_field['field_name'] || form_field[:field_name]
        if field_name && field_name['text_anchor'] && field_name['text_anchor']['text_segments']&.any?
          field_text = extract_text_from_anchor(document_data.text, field_name['text_anchor'])
          bounding_box = extract_bounding_box_with_fallback(
            field_name['bounding_poly'],
            field_text,
            page['paragraphs'] || page[:paragraphs] || [],
            page['dimension'] || page[:dimension],
            page_number
          )

          if bounding_box
            fields << create_field(
              id: "field_#{field_id_counter}",
              type: classify_field_type(field_text, :form_field_name),
              text: field_text.strip,
              page: page_number,
              bounding_box: bounding_box
            )
            field_id_counter += 1
          end
        end

        # Extract field value (input area)
        field_value = form_field['field_value'] || form_field[:field_value]
        if field_value && field_value['text_anchor'] && field_value['text_anchor']['text_segments']&.any?
          field_text = extract_text_from_anchor(document_data.text, field_value['text_anchor'])
          bounding_box = extract_bounding_box_with_fallback(
            field_value['bounding_poly'],
            field_text,
            page['paragraphs'] || page[:paragraphs] || [],
            page['dimension'] || page[:dimension],
            page_number
          )

          if bounding_box
            fields << create_field(
              id: "field_#{field_id_counter}",
              type: classify_field_type(field_text, :form_field_value),
              text: field_text.strip,
              page: page_number,
              bounding_box: bounding_box
            )
            field_id_counter += 1
          end
        end
      end

      # Extract all paragraph text elements
      (page['paragraphs'] || page[:paragraphs] || []).each do |paragraph|
        layout = paragraph['layout'] || paragraph[:layout]
        next unless layout && layout['bounding_poly'] && layout['bounding_poly']['vertices']&.any?

        field_text = extract_text_from_anchor(document_data.text, layout['text_anchor'])
        next if field_text.strip.empty?

        page_dimension = page['dimension'] || page[:dimension]
        bounding_box = extract_bounding_box(layout['bounding_poly'], page_dimension, page_number)

        fields << create_field(
          id: "field_#{field_id_counter}",
          type: classify_field_type(field_text, :paragraph),
          text: field_text.strip,
          page: page_number,
          bounding_box: bounding_box
        )
        field_id_counter += 1
      end
    end

    # Remove duplicate fields (same text and similar position)
    fields = deduplicate_fields(fields)

    {
      document_info: document_info,
      fields: fields
    }
  end

  def extract_document_info(document_data)
    pages = document_data.pages || []
    page_dimensions = pages.map.with_index do |page, index|
      dimension = page['dimension'] || page[:dimension]
      {
        page: page['page_number'] || page[:page_number] || (index + 1),
        width: dimension ? (dimension['width'] || dimension[:width]) : 1758.0,
        height: dimension ? (dimension['height'] || dimension[:height]) : 2275.0
      }
    end

    {
      total_pages: pages.length,
      page_dimensions: page_dimensions
    }
  end

  def classify_field_type(text, context)
    # Clean text for analysis
    clean_text = text.strip.downcase

    # Form field labels (end with colon or contain typical label words)
    if context == :form_field_name || text.end_with?(':') || 
       clean_text.match?(/\b(name|address|number|date|phone|email|city|state|zip)\b/)
      return 'form_field_label'
    end

    # Form field inputs (typically short or empty from form_field_value context)
    if context == :form_field_value
      return 'form_field_input'
    end

    # Section headers (Part X., numbered sections)
    if clean_text.match?(/^part \d+\./) || clean_text.match?(/^section \d+/) ||
       clean_text.match?(/^item \d+/) || clean_text.match?(/^\d+\.\s*[a-z]/)
      return 'section_header'
    end

    # Instructions (contain instruction keywords)
    if clean_text.match?(/\b(type|print|complete|select|check|mark|sign|attach|submit|read|provide)\b/) &&
       clean_text.length > 20
      return 'instruction_text'
    end

    # Checkbox indicators
    if clean_text.match?(/^\s*☐\s*/) || clean_text.match?(/^\s*□\s*/) || 
       clean_text == 'yes' || clean_text == 'no'
      return 'checkbox'
    end

    # Signature areas
    if clean_text.match?(/signature/) || clean_text.match?(/sign here/) ||
       clean_text.match?(/date of signature/)
      return 'signature_area'
    end

    # Default to static text
    'static_text'
  end

  def create_field(id:, type:, text:, page:, bounding_box:)
    field = {
      id: id,
      type: type,
      text: text,
      page: page,
      bounding_box: bounding_box
    }

    # Add form field info for relevant types
    if type == 'form_field_label' || type == 'form_field_input'
      field[:form_field_info] = {
        field_type: infer_field_input_type(text, type)
      }
    end

    field
  end

  def infer_field_input_type(text, field_type)
    return nil unless field_type == 'form_field_label' || field_type == 'form_field_input'

    clean_text = text.strip.downcase

    return 'date' if clean_text.match?(/\b(date|birth|expir)\b/)
    return 'email' if clean_text.match?(/\bemail\b/)
    return 'phone' if clean_text.match?(/\b(phone|telephone|mobile)\b/)
    return 'signature' if clean_text.match?(/\bsignature\b/)
    return 'checkbox' if clean_text.match?(/\b(yes|no|select|check)\b/)
    
    'text'
  end

  def extract_bounding_box_with_fallback(bounding_poly, text, paragraphs, page_dimension, page_number)
    # Try the provided bounding box first
    if bounding_poly && bounding_poly['vertices']&.any?
      return extract_bounding_box(bounding_poly, page_dimension, page_number)
    end

    # Fallback: find matching paragraph by text
    matching_paragraph = paragraphs.find do |paragraph|
      layout = paragraph['layout'] || paragraph[:layout]
      next unless layout

      paragraph_text = extract_text_from_anchor(text, layout['text_anchor'])
      paragraph_text.strip == text.strip
    end

    if matching_paragraph
      layout = matching_paragraph['layout'] || matching_paragraph[:layout]
      if layout && layout['bounding_poly'] && layout['bounding_poly']['vertices']&.any?
        return extract_bounding_box(layout['bounding_poly'], page_dimension, page_number)
      end
    end

    nil
  end

  def extract_bounding_box(bounding_poly, page_dimension, page_number)
    return nil unless bounding_poly && bounding_poly['vertices']&.any?

    vertices = bounding_poly['vertices']
    x_coords = vertices.map { |v| v['x'] || v[:x] }
    y_coords = vertices.map { |v| v['y'] || v[:y] }

    width = page_dimension ? (page_dimension['width'] || page_dimension[:width]) : 1758.0
    height = page_dimension ? (page_dimension['height'] || page_dimension[:height]) : 2275.0

    {
      page: page_number,
      x_min: x_coords.min.to_f / width,
      y_min: y_coords.min.to_f / height,
      x_max: x_coords.max.to_f / width,
      y_max: y_coords.max.to_f / height
    }
  end

  def extract_text_from_anchor(document_text, text_anchor)
    return '' unless text_anchor && text_anchor['text_segments']&.any?

    text_segments = text_anchor['text_segments']
    text_segments.map do |segment|
      start_idx = segment['start_index'] || segment[:start_index] || 0
      end_idx = segment['end_index'] || segment[:end_index] || document_text.length
      document_text[start_idx...end_idx]
    end.join('')
  end

  def deduplicate_fields(fields)
    # Group fields by text and approximate position
    grouped_fields = fields.group_by do |field|
      [
        field[:text],
        field[:page],
        (field[:bounding_box][:x_min] * 100).round,
        (field[:bounding_box][:y_min] * 100).round
      ]
    end

    # Keep only one field per group, preferring form_field types
    grouped_fields.map do |_, group|
      # Prefer form field types over paragraph types
      group.sort_by do |field|
        case field[:type]
        when 'form_field_label', 'form_field_input' then 0
        when 'section_header', 'signature_area' then 1
        else 2
        end
      end.first
    end
  end
end 
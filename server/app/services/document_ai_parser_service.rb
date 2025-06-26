require 'google/cloud/document_ai'
require 'digest'

require 'ostruct'

class DocumentAiParserService
  def initialize(file_path, original_filename = nil)
    @file_path = file_path
    @original_filename = original_filename || File.basename(file_path)
    @client = Google::Cloud::DocumentAI.document_processor_service
    @project_id = ENV['GOOGLE_CLOUD_PROJECT_ID'] || 'your-project-id'
    @location = ENV['GOOGLE_CLOUD_LOCATION'] || 'us'
    @processor_id = ENV['GOOGLE_CLOUD_PROCESSOR_ID'] || 'your-processor-id'
    @cache_dir = Rails.root.join('cache')
  end

  def parse
    # Ensure cache directory exists
    FileUtils.mkdir_p(@cache_dir)
    
    # Generate cache key based on filename and file content hash
    cache_key = generate_cache_key
    cache_file_path = @cache_dir.join("#{cache_key}.json")
    
    # Check if cached response exists
    if File.exist?(cache_file_path)
      Rails.logger.info "Using cached response for #{@original_filename}"
      document = load_cached_response(cache_file_path)
    else
      Rails.logger.info "Making Google Document AI API call for #{@original_filename}"
      document = process_document
      save_to_cache(document, cache_file_path)
    end
    
    extract_data(document)
  end

  private

  def generate_cache_key
    # Create a unique cache key based on filename and file content
    file_content = File.binread(@file_path)
    content_hash = Digest::SHA256.hexdigest(file_content)
    filename_safe = @original_filename.gsub(/[^a-zA-Z0-9._-]/, '_')
    "#{filename_safe}_#{content_hash[0..16]}"
  end

  def load_cached_response(cache_file_path)
    raw_data = JSON.parse(File.read(cache_file_path))
    
    # Handle both direct document data and wrapped responses
    document_data = if raw_data.key?('document')
                      raw_data['document']
                    else
                      raw_data
                    end
    
    # Create a proper document-like object
    create_document_struct(document_data)
  end

  def save_to_cache(document, cache_file_path)
    Rails.logger.info "Saving response to cache: #{cache_file_path}"
    # Save the full document structure for caching
    cache_data = {
      document: document.to_h,
      cached_at: Time.current.iso8601,
      original_filename: @original_filename
    }
    File.write(cache_file_path, JSON.pretty_generate(cache_data))
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

  def create_document_struct(document_data)
    # Create a struct-like object that behaves like the Google API response
    OpenStruct.new(document_data.deep_symbolize_keys)
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
    pages_info = []
    total_pages = 0

    if document_data.pages
      document_data.pages.each do |page|
        page_number = page['page_number'] || page[:page_number] || (total_pages + 1)
        dimension = page['dimension'] || page[:dimension] || {}
        
        pages_info << {
          page: page_number,
          width: dimension['width'] || dimension[:width] || 0,
          height: dimension['height'] || dimension[:height] || 0
        }
        total_pages = [total_pages, page_number].max
      end
    end

    {
      total_pages: total_pages,
      page_dimensions: pages_info
    }
  end

  def classify_field_type(text, context)
    clean_text = text.strip.downcase
    
    # Form field classification
    if context == :form_field_name
      return 'form_field_label'
    elsif context == :form_field_value
      return 'form_field_input'
    end

    # Content-based classification for paragraphs
    return 'section_header' if clean_text.length < 100 && clean_text.match?(/\b(part|section|\d+\.|\w+:)\b/)
    return 'instruction_text' if clean_text.match?(/\b(instructions?|note|warning|important)\b/)
    return 'checkbox' if clean_text.match?(/\b(yes|no|check|select)\b/) && clean_text.length < 50
    return 'signature_area' if clean_text.match?(/\b(signature|sign|date)\b/)
    
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
    return nil unless page_dimension

    vertices = bounding_poly['vertices']
    page_width = page_dimension['width'] || page_dimension[:width] || 1
    page_height = page_dimension['height'] || page_dimension[:height] || 1

    # Extract coordinates from vertices
    x_coords = vertices.map { |v| (v['x'] || v[:x] || 0).to_f }.select { |x| x >= 0 }
    y_coords = vertices.map { |v| (v['y'] || v[:y] || 0).to_f }.select { |y| y >= 0 }

    return nil if x_coords.empty? || y_coords.empty?

    # Calculate normalized bounding box (0.0 to 1.0)
    {
      x_min: x_coords.min / page_width.to_f,
      y_min: y_coords.min / page_height.to_f,
      x_max: x_coords.max / page_width.to_f,
      y_max: y_coords.max / page_height.to_f
    }
  end

  def extract_text_from_anchor(full_text, text_anchor)
    return '' unless text_anchor && text_anchor['text_segments']

    result = ''
    text_anchor['text_segments'].each do |segment|
      start_index = segment['start_index'] || segment[:start_index] || 0
      end_index = segment['end_index'] || segment[:end_index] || full_text.length
      
      # Ensure indices are within bounds
      start_index = [start_index, 0].max
      end_index = [end_index, full_text.length].min
      
      if start_index < end_index && start_index < full_text.length
        result += full_text[start_index...end_index]
      end
    end
    result
  end

  def deduplicate_fields(fields)
    unique_fields = []
    
    fields.each do |field|
      # Check if a similar field already exists
      duplicate = unique_fields.find do |existing|
        text_similar = existing[:text].strip == field[:text].strip
        same_page = existing[:page] == field[:page]
        position_similar = positions_similar?(existing[:bounding_box], field[:bounding_box])
        
        text_similar && same_page && position_similar
      end
      
      unless duplicate
        unique_fields << field
      end
    end
    
    unique_fields
  end

  def positions_similar?(box1, box2, threshold = 0.01)
    return false unless box1 && box2
    
    [:x_min, :y_min, :x_max, :y_max].all? do |coord|
      (box1[coord] - box2[coord]).abs < threshold
    end
  end
end 
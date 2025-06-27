class GeminiAiService
  def initialize
    @gemini_client = GeminiClient.new
  end

  def enhance_form_fields_single_call(processor_output)
    start_time = Time.current
    Rails.logger.info "Starting Gemini AI association enhancement at #{start_time}"
    
    # Validate processor output structure
    unless processor_output.is_a?(Hash) && processor_output['fields'].is_a?(Array)
      Rails.logger.error "Invalid processor output structure: #{processor_output.class}"
      raise 'Invalid processor output: missing or invalid fields array'
    end
    
    # Prepare data for AI analysis
    simplified_fields = AssociationPrompter.simplify_field_data(processor_output['fields'])
    prompt_text = AssociationPrompter.build_prompt_with_data(simplified_fields)
    
    Rails.logger.info "Sending #{simplified_fields.size} fields to Gemini AI for association analysis"
    
    # Save request data for debugging
    save_debug_data(simplified_fields, 'request', start_time)
    
    begin
      # Make the API call
      response = @gemini_client.generate_content(prompt_text)
      
      # Save response data for debugging
      save_debug_data(response[:result], 'response', Time.current, response[:duration_ms])
      
      # Parse the response to get association tuples
      association_tuples = AssociationParser.parse_gemini_association_response(response[:result])
      
      # Create field associations from the tuples
      if association_tuples.is_a?(Array) && association_tuples.all? { |tuple| tuple.is_a?(Array) && tuple.length == 2 }
        field_associations = AssociationParser.create_field_associations(association_tuples, processor_output['fields'])
        
        # Return the processor output with field associations
        enhanced_result = processor_output.dup
        enhanced_result['field_associations'] = field_associations
        enhanced_result['processing_info'] = {
          'gemini_enhancement_attempted' => true,
          'gemini_enhancement_successful' => true,
          'original_field_count' => processor_output['fields'].length,
          'associations_count' => field_associations.length,
          'association_tuples' => association_tuples
        }
      else
        Rails.logger.error "Invalid association response format from Gemini, returning original data"
        enhanced_result = processor_output.dup
        enhanced_result['field_associations'] = []
        enhanced_result['processing_info'] = {
          'gemini_enhancement_attempted' => true,
          'gemini_enhancement_failed' => true,
          'gemini_error' => 'Invalid response format',
          'fallback_to' => 'raw_processor_output'
        }
      end
      
      total_duration = ((Time.current - start_time) * 1000).round(2)
      Rails.logger.info "Total Gemini association enhancement completed in #{total_duration}ms"
      
      enhanced_result
      
    rescue StandardError => e
      Rails.logger.error "Gemini API call failed: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      
      # Save error for debugging
      save_debug_data({ error: e.message, backtrace: e.backtrace }, 'error', Time.current)
      
      # Return original data with error info
      processor_output.merge({
        'field_associations' => [],
        'processing_info' => {
          'gemini_enhancement_attempted' => true,
          'gemini_enhancement_failed' => true,
          'gemini_error' => e.message,
          'fallback_to' => 'raw_processor_output'
        }
      })
    end
  end



  def test_simple_request
    @gemini_client.test_simple_request
  end

  private

  def load_prompt
    prompt_file = Rails.root.join('config', 'prompt.txt')
    if File.exist?(prompt_file)
      File.read(prompt_file).strip
    else
      # Fallback prompt
      "You are a FORM-FIELD MATCHER. Analyze the provided form field data and enhance it with field relationships and purposes. Return the data in the same JSON format with additional metadata."
    end
  end

  def group_fields_by_page(fields)
    fields.group_by { |field| field['page'] || 1 }
  end

  def parse_gemini_response(response)
    Rails.logger.info "Parsing Gemini response structure: #{response.keys}"
    
    # Check if response has candidates
    candidates = response['candidates']
    if candidates.blank?
      Rails.logger.error "No candidates in Gemini response"
      return nil
    end
    
    candidate = candidates.first
    if candidate.blank?
      Rails.logger.error "First candidate is blank"
      return nil
    end
    
    # Check finish reason
    finish_reason = candidate['finishReason']
    if finish_reason == 'MAX_TOKENS'
      Rails.logger.warn "Gemini response was truncated due to max tokens limit"
    end
    
    # Try different paths for text content
    text_content = nil
    
    # Path 1: Standard path with parts array
    if candidate.dig('content', 'parts').is_a?(Array)
      text_content = candidate.dig('content', 'parts', 0, 'text')
    end
    
    # Path 2: Direct text in content
    if text_content.blank? && candidate.dig('content', 'text').present?
      text_content = candidate.dig('content', 'text')
    end
    
    # Path 3: Check if there's any text field at the content level
    if text_content.blank? && candidate['content'].is_a?(Hash)
      Rails.logger.info "Content structure: #{candidate['content'].keys}"
      # Log the actual structure for debugging
    end
    
    if text_content.blank?
      Rails.logger.error "No text content found in Gemini response"
      Rails.logger.error "Candidate structure: #{candidate.to_json}"
      return nil
    end
    
    Rails.logger.info "Found text content, length: #{text_content.length} characters"
    
    # Clean up markdown formatting
    cleaned_text = text_content.gsub(/```json\n?/, '').gsub(/```\n?/, '').strip
    
    begin
      parsed_data = JSON.parse(cleaned_text)
      Rails.logger.info "Successfully parsed JSON response"
      parsed_data
    rescue JSON::ParserError => e
      Rails.logger.error "Failed to parse Gemini response as JSON: #{e.message}"
      Rails.logger.error "Raw response text (first 500 chars): #{cleaned_text[0...500]}"
      nil
    end
  end

  def parse_gemini_association_response(response)
    Rails.logger.info "Parsing Gemini association response structure: #{response.keys}"
    
    # Check if response has candidates
    candidates = response['candidates']
    if candidates.blank?
      Rails.logger.error "No candidates in Gemini association response"
      return []
    end
    
    candidate = candidates.first
    if candidate.blank?
      Rails.logger.error "First candidate is blank in association response"
      return []
    end
    
    # Check finish reason
    finish_reason = candidate['finishReason']
    if finish_reason == 'MAX_TOKENS'
      Rails.logger.warn "Gemini association response was truncated due to max tokens limit"
    end
    
    # Try different paths for text content
    text_content = nil
    
    # Path 1: Standard path with parts array
    if candidate.dig('content', 'parts').is_a?(Array)
      text_content = candidate.dig('content', 'parts', 0, 'text')
    end
    
    # Path 2: Direct text in content
    if text_content.blank? && candidate.dig('content', 'text').present?
      text_content = candidate.dig('content', 'text')
    end
    
    if text_content.blank?
      Rails.logger.error "No text content found in Gemini association response"
      Rails.logger.error "Candidate structure: #{candidate.to_json}"
      return []
    end
    
    Rails.logger.info "Found association text content, length: #{text_content.length} characters"
    Rails.logger.info "Raw association response: #{text_content}"
    
    # Clean up markdown formatting
    cleaned_text = text_content.gsub(/```json\n?/, '').gsub(/```\n?/, '').strip
    
    begin
      parsed_data = JSON.parse(cleaned_text)
      Rails.logger.info "Successfully parsed JSON association response"
      
      # Validate that it's an array of tuples
      if parsed_data.is_a?(Array)
        valid_tuples = parsed_data.select do |item|
          item.is_a?(Array) && item.length == 2 && 
          item[0].is_a?(Integer) && item[1].is_a?(Integer)
        end
        
        Rails.logger.info "Found #{valid_tuples.length} valid association tuples out of #{parsed_data.length} items"
        return valid_tuples
      else
        Rails.logger.error "Association response is not an array: #{parsed_data.class}"
        return []
      end
      
    rescue JSON::ParserError => e
      Rails.logger.error "Failed to parse Gemini association response as JSON: #{e.message}"
      Rails.logger.error "Raw association response text: #{cleaned_text}"
      return []
    end
  end

  def parse_page_response(response, original_fields)
    enhanced_data = parse_gemini_response(response)
    
    if enhanced_data && enhanced_data['fields']
      enhanced_data['fields']
    else
      Rails.logger.warn "Failed to parse page response, returning original fields"
      original_fields
    end
  end

  def save_debug_data(data, type, timestamp, duration = nil)
    return unless Rails.env.development? || Rails.env.test?
    
    debug_dir = Rails.root.join('tmp', 'gemini_debug')
    FileUtils.mkdir_p(debug_dir)
    
    filename = "gemini_#{type}_#{timestamp.strftime('%Y%m%d_%H%M%S')}.json"
    filepath = debug_dir.join(filename)
    
    debug_data = {
      timestamp: timestamp.iso8601,
      type: type,
      duration_ms: duration,
      data: data
    }
    
    File.write(filepath, JSON.pretty_generate(debug_data))
    Rails.logger.info "Debug data saved to #{filepath}"
  rescue StandardError => e
    Rails.logger.warn "Failed to save debug data: #{e.message}"
  end

  def simplify_field_data(fields)
    Rails.logger.info "Simplifying #{fields.length} fields for Gemini"
    
    fields.map.with_index do |field, index|
      # Debug log the field structure
      if index < 3
        Rails.logger.info "Field #{index} structure: #{field.keys}"
        Rails.logger.info "Field #{index} bounding_box: #{field['bounding_box']&.inspect}"
      end
      
      # Determine type based on field characteristics
      type = determine_field_type(field)
      
      # Round coordinates to 4 decimal places
      bbox = field['bounding_box']
      simplified_bbox = if bbox
        {
          left: bbox['x_min']&.round(4),
          top: bbox['y_min']&.round(4),
          right: bbox['x_max']&.round(4),
          bottom: bbox['y_max']&.round(4)
        }
      else
        Rails.logger.warn "Field #{index} has no bounding_box data" if index < 3
        {
          left: nil,
          top: nil,
          right: nil,
          bottom: nil
        }
      end
      
      # Truncate text to max 20 characters
      text = (field['text'] || '').strip
      truncated_text = text.length > 20 ? "#{text[0, 17]}..." : text
      
      {
        id: index + 1,  # Simple integer ID starting from 1
        type: type,     # 0=label, 1=text input, 2=checkbox
        text: truncated_text,  # Truncated text for context
        page: field['page'],
        bbox: simplified_bbox  # Shortened key name and rounded coordinates
      }
    end
  end

  def determine_field_type(field)
    # Logic to determine field type based on existing field data
    field_type = field['type']&.downcase || ''
    
    case field_type
    when 'checkbox', 'check_box'
      2  # checkbox
    when 'text_input', 'text_box', 'text_line', 'input'
      1  # text input
    else
      # If it has substantial text content, it's likely a label
      text_length = (field['text'] || '').strip.length
      if text_length > 2
        0  # label
      else
        1  # assume text input if unclear
      end
    end
  end
end 
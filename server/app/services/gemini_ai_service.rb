require 'gemini-ai'

class GeminiAiService
  def initialize
    @api_key = ENV['GEMINI_API_KEY']
    raise 'GEMINI_API_KEY environment variable is not set' if @api_key.blank?
    
    @client = Gemini.new(
      credentials: {
        service: 'generative-language-api',
        api_key: @api_key
      },
      options: { 
        model: 'gemini-2.5-pro',
        server_sent_events: false,
        timeout: nil,
        open_timeout: nil,
        read_timeout: nil,
        write_timeout: nil
      }
    )
  end

  def enhance_form_fields_single_call(processor_output)
    start_time = Time.current
    Rails.logger.info "Starting Gemini AI association enhancement at #{start_time}"
    
    # Validate processor output structure
    unless processor_output.is_a?(Hash) && processor_output['fields'].is_a?(Array)
      Rails.logger.error "Invalid processor output structure: #{processor_output.class}"
      raise 'Invalid processor output: missing or invalid fields array'
    end
    
    prompt = load_prompt
    
    # Use the proper simplify_field_data method
    simplified_fields = simplify_field_data(processor_output['fields'])
    
    Rails.logger.info "Sending #{simplified_fields.size} fields to Gemini AI for association analysis"
    
    # Save request data for debugging (send only the simplified fields array)
    save_debug_data(simplified_fields, 'request', start_time)
    
    begin
      # Make the API call using the gem
      api_start_time = Time.current
      Rails.logger.info "Making Gemini API association call at #{api_start_time}"
      
      result = @client.generate_content({
        contents: {
          role: 'user',
          parts: {
            text: "#{prompt}\n\nHere is the form field data to analyze for label-input associations:\n\n#{simplified_fields.to_json}"
          }
        },
        generationConfig: {
          temperature: 0.1,
          topK: 1,
          topP: 0.8
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_ONLY_HIGH"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH", 
            threshold: "BLOCK_ONLY_HIGH"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_ONLY_HIGH"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_ONLY_HIGH"
          }
        ]
      })
      
      api_end_time = Time.current
      api_duration = ((api_end_time - api_start_time) * 1000).round(2)
      Rails.logger.info "Gemini API association call completed in #{api_duration}ms"

      # Save response data for debugging
      save_debug_data(result, 'response', api_end_time, api_duration)
      
      # Parse the response to get association tuples
      association_tuples = parse_gemini_association_response(result)
      
      # Create field associations from the tuples
      if association_tuples.is_a?(Array) && association_tuples.all? { |tuple| tuple.is_a?(Array) && tuple.length == 2 }
        original_fields = processor_output['fields']
        field_associations = []
        used_field_ids = Set.new
        
        association_tuples.each_with_index do |tuple, index|
          label_id, input_id = tuple
          
          # Convert back to 0-based index
          label_index = label_id - 1
          input_index = input_id - 1
          
          if label_index >= 0 && label_index < original_fields.length &&
             input_index >= 0 && input_index < original_fields.length
            
            label_field = original_fields[label_index]
            input_field = original_fields[input_index]
            
            # Validate the association using the same type determination logic
            label_type = determine_field_type(label_field)
            input_type = determine_field_type(input_field)
            
            # Debug log for first few associations
            if index < 3
              Rails.logger.info "Association #{index}: label_field[#{label_index}] type='#{label_field['type']}' -> #{label_type}, input_field[#{input_index}] type='#{input_field['type']}' -> #{input_type}"
            end
            
            if label_type == 0 && (input_type == 1 || input_type == 2)
              association = {
                'id' => "assoc_#{index + 1}",
                'label' => {
                  'id' => label_field['id'] || "field_#{label_index + 1}",
                  'text' => label_field['text'] || '',
                  'bounding_box' => label_field['bounding_box']
                },
                'input' => {
                  'id' => input_field['id'] || "field_#{input_index + 1}",
                  'type' => input_type == 1 ? 'text_input' : 'checkbox',
                  'bounding_box' => input_field['bounding_box'],
                  'text' => input_field['text']
                },
                'page' => label_field['page'] || input_field['page'] || 1
              }
              
              field_associations << association
              used_field_ids.add(label_field['id'] || "field_#{label_index + 1}")
              used_field_ids.add(input_field['id'] || "field_#{input_index + 1}")
            end
          end
        end
        
        Rails.logger.info "Created #{field_associations.length} field associations from #{association_tuples.length} tuples"
        
        # Return the processor output with field associations
        enhanced_result = processor_output.dup
        enhanced_result['field_associations'] = field_associations
        enhanced_result['processing_info'] = {
          'gemini_enhancement_attempted' => true,
          'gemini_enhancement_successful' => true,
          'original_field_count' => original_fields.length,
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

  def enhance_form_fields(processor_output)
    start_time = Time.current
    Rails.logger.info "Starting Gemini AI page-by-page enhancement at #{start_time}"
    
    # Validate processor output structure
    unless processor_output.is_a?(Hash) && processor_output['fields'].is_a?(Array)
      Rails.logger.error "Invalid processor output structure: #{processor_output.class}"
      raise 'Invalid processor output: missing or invalid fields array'
    end
    
    # Group fields by page
    fields_by_page = group_fields_by_page(processor_output['fields'])
    Rails.logger.info "Processing #{fields_by_page.keys.size} pages with Gemini AI"
    
    # Process each page separately
    all_enhanced_fields = []
    total_api_time = 0
    
    fields_by_page.each do |page_num, page_fields|
      page_start_time = Time.current
      Rails.logger.info "Processing page #{page_num} with #{page_fields.size} fields"
      
      # Simplify fields for this page
      simplified_fields = page_fields.map do |field|
        {
          id: field['id'],
          type: field['type'],
          text: field['text'],
          page: field['page'],
          bounding_box: field['bounding_box']
        }
      end
      
      page_data = { 'fields' => simplified_fields, 'page' => page_num }
      
      begin
        prompt = load_prompt
        
        # Make API call for this page
        api_start_time = Time.current
        
        result = @client.generate_content({
          contents: {
            role: 'user',
            parts: {
              text: "#{prompt}\n\nHere is the form field data for page #{page_num} to analyze:\n\n#{page_data.to_json}"
            }
          },
          generationConfig: {
            temperature: 0.1,
            topK: 1,
            topP: 0.8
          }
        })
        
        api_end_time = Time.current
        api_duration = ((api_end_time - api_start_time) * 1000).round(2)
        total_api_time += api_duration
        
        Rails.logger.info "Gemini API call for page #{page_num} completed in #{api_duration}ms"
        
        # Parse response for this page
        page_enhanced_fields = parse_page_response(result, page_fields)
        all_enhanced_fields.concat(page_enhanced_fields)
        
        page_duration = ((Time.current - page_start_time) * 1000).round(2)
        Rails.logger.info "Page #{page_num} processed in #{page_duration}ms"
        
      rescue StandardError => e
        Rails.logger.error "Failed to process page #{page_num}: #{e.message}"
        # Add original fields if processing fails
        all_enhanced_fields.concat(page_fields)
      end
    end
    
    # Return enhanced output
    enhanced_output = processor_output.dup
    enhanced_output['fields'] = all_enhanced_fields
    enhanced_output['processing_info'] = {
      'gemini_enhancement_attempted' => true,
      'gemini_enhancement_successful' => true,
      'pages_processed' => fields_by_page.keys.size,
      'total_api_time_ms' => total_api_time,
      'total_processing_time_ms' => ((Time.current - start_time) * 1000).round(2)
    }
    
    Rails.logger.info "All pages processed. Total API time: #{total_api_time}ms"
    enhanced_output
  end

  def test_simple_request
    start_time = Time.current
    Rails.logger.info "Testing simple Gemini request at #{start_time}"
    
    begin
      result = @client.generate_content({
        contents: {
          role: 'user',
          parts: {
            text: "Hi! Please respond with 'Hello, the API is working!' and nothing else."
          }
        },
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 50
        }
      })
      
      end_time = Time.current
      duration_ms = ((end_time - start_time) * 1000).round(2)
      
      Rails.logger.info "Simple Gemini request completed in #{duration_ms}ms"
      Rails.logger.info "Response: #{result.inspect}"
      
      # Try to extract the text response
      if result && result['candidates'] && result['candidates'][0]
        candidate = result['candidates'][0]
        if candidate['content'] && candidate['content']['parts'] && candidate['content']['parts'][0]
          text = candidate['content']['parts'][0]['text']
          Rails.logger.info "Extracted text: #{text}"
          return { success: true, text: text, duration_ms: duration_ms }
        end
      end
      
      Rails.logger.error "Could not extract text from response"
      return { success: false, error: "No text in response", duration_ms: duration_ms }
      
    rescue => e
      end_time = Time.current
      duration_ms = ((end_time - start_time) * 1000).round(2)
      Rails.logger.error "Simple Gemini request failed: #{e.message}"
      return { success: false, error: e.message, duration_ms: duration_ms }
    end
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
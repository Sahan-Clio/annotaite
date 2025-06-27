class AssociationParser
  def self.parse_gemini_association_response(response)
    Rails.logger.info "Parsing Gemini association response structure: #{response.keys}"
    
    # Extract the text content from the response
    text_content = extract_text_from_response(response)
    
    if text_content.blank?
      Rails.logger.error "No text content found in Gemini response"
      return []
    end
    
    Rails.logger.info "Gemini response text (first 500 chars): #{text_content[0..500]}"
    
    # Try to extract JSON from the response
    json_match = text_content.match(/\[.*\]/m)
    if json_match
      json_text = json_match[0]
      Rails.logger.info "Extracted JSON text: #{json_text}"
      
      begin
        association_tuples = JSON.parse(json_text)
        
        if association_tuples.is_a?(Array)
          # Validate that all elements are arrays of length 2
          valid_tuples = association_tuples.select do |tuple|
            tuple.is_a?(Array) && tuple.length == 2 && tuple.all? { |id| id.is_a?(Integer) }
          end
          
          Rails.logger.info "Parsed #{valid_tuples.length} valid association tuples from #{association_tuples.length} total"
          return valid_tuples
        else
          Rails.logger.error "Parsed JSON is not an array: #{association_tuples.class}"
        end
      rescue JSON::ParserError => e
        Rails.logger.error "Failed to parse JSON from Gemini response: #{e.message}"
      end
    else
      Rails.logger.error "No JSON array found in Gemini response"
    end
    
    # Return empty array if parsing failed
    []
  end

  def self.create_field_associations(association_tuples, original_fields)
    return [] unless association_tuples.is_a?(Array) && association_tuples.all? { |tuple| tuple.is_a?(Array) && tuple.length == 2 }
    
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
        label_type = AssociationPrompter.send(:determine_field_type, label_field)
        input_type = AssociationPrompter.send(:determine_field_type, input_field)
        
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
    field_associations
  end

  private

  def self.extract_text_from_response(response)
    return '' unless response.is_a?(Hash)
    
    # Try different response structures
    if response['candidates']&.is_a?(Array) && response['candidates'].first
      candidate = response['candidates'].first
      
      if candidate['content']&.is_a?(Hash) && candidate['content']['parts']&.is_a?(Array)
        parts = candidate['content']['parts']
        if parts.first&.is_a?(Hash) && parts.first['text']
          return parts.first['text']
        end
      end
    end
    
    # Fallback: try to find text in various places
    if response['text']
      return response['text']
    end
    
    if response['content']&.is_a?(String)
      return response['content']
    end
    
    Rails.logger.error "Could not extract text from response structure: #{response.keys}"
    ''
  end
end 
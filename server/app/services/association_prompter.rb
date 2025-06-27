class AssociationPrompter
  def self.load_prompt
    prompt_file = Rails.root.join('config', 'prompt.txt')
    if File.exist?(prompt_file)
      File.read(prompt_file)
    else
      Rails.logger.warn "Prompt file not found at #{prompt_file}, using default prompt"
      default_prompt
    end
  end

  def self.simplify_field_data(fields)
    Rails.logger.info "Simplifying #{fields.length} fields for Gemini"
    
    simplified_fields = fields.map.with_index do |field, index|
      # Determine field type using the same logic as the parser
      field_type = determine_field_type(field)
      
      {
        'id' => index + 1,  # 1-based index for Gemini
        'type' => field_type,
        'text' => field['text'] || '',
        'page' => field['page'] || 1,
        'bounding_box' => {
          'x_min' => field['bounding_box']['x_min'],
          'y_min' => field['bounding_box']['y_min'],
          'x_max' => field['bounding_box']['x_max'],
          'y_max' => field['bounding_box']['y_max']
        }
      }
    end
    
    Rails.logger.info "Simplified fields: #{simplified_fields.count} total"
    
    # Log field type distribution
    type_counts = simplified_fields.group_by { |f| f['type'] }.transform_values(&:count)
    Rails.logger.info "Field type distribution: #{type_counts}"
    
    simplified_fields
  end

  def self.build_prompt_with_data(fields_data)
    prompt = load_prompt
    "#{prompt}\n\nHere is the form field data to analyze for label-input associations:\n\n#{fields_data.to_json}"
  end

  private

  def self.determine_field_type(field)
    # Logic to determine field type based on existing field data
    field_type = field['type']&.downcase || ''
    
    case field_type
    when 'label'
      0  # Label
    when 'text_input'
      1  # Text input
    when 'checkbox'
      2  # Checkbox
    else
      # Fallback logic based on text content and form field info
      if field['form_field_info']
        case field['form_field_info']['field_type']&.downcase
        when 'checkbox'
          2  # Checkbox
        when 'text'
          1  # Text input
        else
          0  # Default to label
        end
      else
        0  # Default to label
      end
    end
  end

  def self.default_prompt
    <<~PROMPT
      You are a form field association expert. Your task is to analyze form fields and identify which labels correspond to which input fields (text inputs or checkboxes).

      Given a list of form fields with their positions and text content, return ONLY a JSON array of tuples representing label-input associations.

      Each tuple should be [label_id, input_id] where:
      - label_id is the ID of a label field (type 0)
      - input_id is the ID of an input field (type 1 for text input, type 2 for checkbox)

      Rules:
      1. Only associate labels (type 0) with inputs (type 1 or 2)
      2. Consider spatial proximity - labels are usually near their corresponding inputs
      3. Consider text content - labels often describe what the input is for
      4. Return ONLY the JSON array, no other text
      5. If no associations can be determined, return an empty array []

      Example output format:
      [[1, 2], [3, 4], [5, 6]]
    PROMPT
  end
end 
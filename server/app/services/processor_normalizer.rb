class ProcessorNormalizer
  # Standard PDF dimensions in points
  PDF_DEFAULT_WIDTH_PT = 612.0   # 8.5 inches * 72 points/inch
  PDF_DEFAULT_HEIGHT_PT = 792.0  # 11 inches * 72 points/inch
  
  # Processor image dimensions at 150 DPI
  IMAGE_WIDTH_150DPI = 1275.0   # Width of PDF image at 150 DPI
  IMAGE_HEIGHT_150DPI = 1650.0  # Height of PDF image at 150 DPI
  
  def self.transform_processor_output(processor_result)
    # Transform processor output to match frontend overlay format
    elements = processor_result['elements'] || []
    
    Rails.logger.info "Normalizing coordinates from image dimensions: #{IMAGE_WIDTH_150DPI}x#{IMAGE_HEIGHT_150DPI}"
    
    # Transform elements to match frontend Field interface
    fields = elements.map.with_index do |element, index|
      # Use normalized coordinates from processor (already in 0-1 range)
      normalized_x = element['x'].to_f
      normalized_y = element['y'].to_f
      normalized_width = element['width'].to_f
      normalized_height = element['height'].to_f
      
      # Calculate bounding box coordinates
      normalized_x_min = normalized_x
      normalized_y_min = normalized_y
      normalized_x_max = normalized_x + normalized_width
      normalized_y_max = normalized_y + normalized_height
      
      # Ensure coordinates are within 0-1 range (safety check)
      normalized_x_min = [[normalized_x_min, 0.0].max, 1.0].min
      normalized_y_min = [[normalized_y_min, 0.0].max, 1.0].min
      normalized_x_max = [[normalized_x_max, 0.0].max, 1.0].min
      normalized_y_max = [[normalized_y_max, 0.0].max, 1.0].min
      
      bounding_box = {
        page: element['page'] || 1,
        x_min: normalized_x_min,
        y_min: normalized_y_min,
        x_max: normalized_x_max,
        y_max: normalized_y_max
      }
      
      
      
      # Map our types to frontend types
      field_type = map_field_type(element['type'])
      
      # Create field object matching frontend expectations
      field = {
        id: "field_#{element['page']}_#{index}",
        type: field_type,
        text: element['text'] || '',
        page: element['page'],
        bounding_box: bounding_box
      }
      
      # Add form field info for inputs and checkboxes
      if element['type'] != 'label'
        field[:form_field_info] = {
          field_type: element['type'] == 'checkbox' ? 'checkbox' : 'text',
          is_required: false
        }
      end
      
      field
    end
    
    # Create document info
    total_pages = elements.map { |e| e['page'] }.max || 1
    page_dimensions = build_page_dimensions(total_pages)
    
    Rails.logger.info "Transformed #{fields.count} fields with normalized coordinates"
    
    # Return structure matching frontend expectations
    {
      success: true,
      fields: fields,
      total_fields: fields.count,
      document_info: {
        total_pages: total_pages,
        page_dimensions: page_dimensions
      }
    }
  end
  
  private
  
  def self.map_field_type(processor_type)
    case processor_type
    when 'label' then 'label'
    when 'input' then 'text_input'
    when 'checkbox' then 'checkbox'
    else 'label'
    end
  end
  
  def self.build_page_dimensions(total_pages)
    (1..total_pages).map do |page_num|
      {
        page: page_num,
        width: PDF_DEFAULT_WIDTH_PT,
        height: PDF_DEFAULT_HEIGHT_PT
      }
    end
  end
end 
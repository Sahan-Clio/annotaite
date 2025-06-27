require 'net/http'
require 'json'
require 'tempfile'
require 'timeout'
require 'httparty'

class FormFieldProcessorService
  include HTTParty
  base_uri 'http://processor:8000'
  
  def initialize
    @timeout = 30
  end
  
  def process_pdf(pdf_file_path)
    Rails.logger.info "Processing PDF with form field processor: #{pdf_file_path}"
    
    begin
      # Check if processor is healthy
      health_response = self.class.get('/health', timeout: 5)
      unless health_response.success?
        raise "Processor service is not healthy: #{health_response.code}"
      end
      
      # Prepare the PDF file for upload
      pdf_file = File.open(pdf_file_path, 'rb')
      
      # Call the processor with just the PDF file
      response = self.class.post('/process_pdf', 
        timeout: @timeout,
        body: {
          pdf_file: pdf_file
        }
      )
      
      pdf_file.close
      
      if response.success?
        result = response.parsed_response
        Rails.logger.info "Processor returned #{result['summary']['total_elements']} elements"
        
        # Transform the processor output to match frontend expectations
        transform_processor_output(result)
      else
        Rails.logger.error "Processor request failed: #{response.code} - #{response.body}"
        raise "Processor request failed with status #{response.code}"
      end
      
    rescue Timeout::Error => e
      Rails.logger.error "Processor request timed out: #{e.message}"
      raise "Processor request timed out after #{@timeout} seconds"
    rescue StandardError => e
      Rails.logger.error "Processor request failed: #{e.message}"
      raise "Failed to process PDF: #{e.message}"
    end
  end
  
  private
  
  def transform_processor_output(processor_result)
    # Transform processor output to match frontend overlay format
    elements = processor_result['elements'] || []
    
    # Get page dimensions from processor result or use defaults
    # The processor should ideally return page dimensions, but for now use standard PDF dimensions
    page_width = 612.0   # Standard PDF width in points (8.5 inches * 72 points/inch)
    page_height = 792.0  # Standard PDF height in points (11 inches * 72 points/inch)
    
    # However, our processor works with images at 150 DPI, so we need to convert
    # At 150 DPI: 8.5" = 1275 pixels, 11" = 1650 pixels
    image_width = 1275.0   # Width of PDF image at 150 DPI
    image_height = 1650.0  # Height of PDF image at 150 DPI
    
    Rails.logger.info "Normalizing coordinates from image dimensions: #{image_width}x#{image_height}"
    
    # Transform elements to match frontend Field interface
    fields = elements.map.with_index do |element, index|
      # The processor now returns normalized coordinates (0-1 range), so use them directly
      
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
      
      Rails.logger.debug "Element #{index}: normalized coords (#{normalized_x.round(3)}, #{normalized_y.round(3)}, #{normalized_width.round(3)}, #{normalized_height.round(3)})"
      
      # Map our types to frontend types
      field_type = case element['type']
                   when 'label' then 'form_field_label'
                   when 'input' then 'form_field_input'
                   when 'checkbox' then 'checkbox'
                   else 'static_text'
                   end
      
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
    page_dimensions = (1..total_pages).map do |page_num|
      {
        page: page_num,
        width: page_width,
        height: page_height
      }
    end
    
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
end 
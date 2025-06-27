require 'httparty'

class ProcessorClient
  include HTTParty
  base_uri 'http://processor:8000'
  
  def initialize(timeout: 30)
    @timeout = timeout
  end
  
  def health_check
    response = self.class.get('/health', timeout: 5)
    response.success?
  rescue StandardError => e
    Rails.logger.error "Processor health check failed: #{e.message}"
    false
  end
  
  def process_pdf(pdf_file_path)
    Rails.logger.info "Processing PDF with form field processor: #{pdf_file_path}"
    
    unless health_check
      raise "Processor service is not healthy"
    end
    
    # Prepare the PDF file for upload
    pdf_file = File.open(pdf_file_path, 'rb')
    
    begin
      # Call the processor with just the PDF file
      response = self.class.post('/process_pdf', 
        timeout: @timeout,
        body: {
          pdf_file: pdf_file
        }
      )
      
      if response.success?
        result = response.parsed_response
        Rails.logger.info "Processor returned #{result['summary']['total_elements']} elements"
        result
      else
        Rails.logger.error "Processor request failed: #{response.code} - #{response.body}"
        raise "Processor request failed with status #{response.code}"
      end
    ensure
      pdf_file.close
    end
    
  rescue Timeout::Error => e
    Rails.logger.error "Processor request timed out: #{e.message}"
    raise "Processor request timed out after #{@timeout} seconds"
  rescue StandardError => e
    Rails.logger.error "Processor request failed: #{e.message}"
    raise "Failed to process PDF: #{e.message}"
  end
end 
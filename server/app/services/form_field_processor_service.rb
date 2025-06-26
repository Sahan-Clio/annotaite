require 'net/http'
require 'json'
require 'tempfile'
require 'timeout'

class FormFieldProcessorService
  def initialize(pdf_path, document_ai_response, original_filename = nil)
    @pdf_path = pdf_path
    @document_ai_response = document_ai_response
    @original_filename = original_filename || File.basename(pdf_path)
    @processor_host = ENV['PROCESSOR_HOST'] || 'processor'
    @processor_port = ENV['PROCESSOR_PORT'] || '8000'
  end

  def process
    Rails.logger.info "Starting form field processing for #{@original_filename}"
    
    begin
      # Create temporary files for the processor
      pdf_temp_file = create_temp_pdf_file
      docai_temp_file = create_temp_docai_file
      
      # Call the processor service
      result = call_processor_service(pdf_temp_file.path, docai_temp_file.path)
      
      Rails.logger.info "Form field processing completed successfully"
      result
      
    ensure
      # Clean up temporary files
      cleanup_temp_files(pdf_temp_file, docai_temp_file)
    end
  end

  private

  def create_temp_pdf_file
    temp_file = Tempfile.new(['processor_input', '.pdf'], binmode: true)
    
    # Copy the PDF content to a new temp file for the processor
    File.open(@pdf_path, 'rb') do |source|
      temp_file.write(source.read)
    end
    temp_file.rewind
    
    Rails.logger.info "Created temp PDF file: #{temp_file.path}"
    temp_file
  end

  def create_temp_docai_file
    temp_file = Tempfile.new(['processor_docai', '.json'])
    
    # Write the Document AI response as JSON
    temp_file.write(JSON.pretty_generate(@document_ai_response))
    temp_file.rewind
    
    Rails.logger.info "Created temp Document AI file: #{temp_file.path}"
    temp_file
  end

  def call_processor_service(pdf_path, docai_path)
    Rails.logger.info "Calling processor service at #{@processor_host}:#{@processor_port}"
    
    # Prepare the multipart form data
    boundary = "----WebKitFormBoundary#{SecureRandom.hex(16)}"
    
    # Build multipart body
    body = build_multipart_body(pdf_path, docai_path, boundary)
    
    # Make HTTP request to processor service
    uri = URI("http://#{@processor_host}:#{@processor_port}/process")
    
    http = Net::HTTP.new(uri.host, uri.port)
    http.read_timeout = 300 # 5 minutes timeout for processing
    
    request = Net::HTTP::Post.new(uri)
    request['Content-Type'] = "multipart/form-data; boundary=#{boundary}"
    request.body = body
    
    Rails.logger.info "Sending request to processor service..."
    response = http.request(request)
    
    case response.code.to_i
    when 200
      Rails.logger.info "Processor service responded successfully"
      JSON.parse(response.body)
    when 400
      error_msg = JSON.parse(response.body)['error'] rescue 'Bad request'
      Rails.logger.error "Processor service bad request: #{error_msg}"
      raise StandardError.new("Form field processing failed: #{error_msg}")
    when 500
      error_msg = JSON.parse(response.body)['error'] rescue 'Internal server error'
      Rails.logger.error "Processor service internal error: #{error_msg}"
      raise StandardError.new("Form field processing failed: #{error_msg}")
    else
      Rails.logger.error "Processor service unexpected response: #{response.code} #{response.message}"
      raise StandardError.new("Form field processing failed: Unexpected response from processor service")
    end
    
  rescue Timeout::Error, Net::ReadTimeout => e
    Rails.logger.error "Processor service timeout: #{e.message}"
    raise StandardError.new("Form field processing timed out. Please try again.")
  rescue Errno::ECONNREFUSED => e
    Rails.logger.error "Cannot connect to processor service: #{e.message}"
    raise StandardError.new("Form field processing service is unavailable. Please try again later.")
  rescue JSON::ParserError => e
    Rails.logger.error "Invalid JSON response from processor service: #{e.message}"
    raise StandardError.new("Form field processing failed: Invalid response format")
  end

  def build_multipart_body(pdf_path, docai_path, boundary)
    body = "".force_encoding('ASCII-8BIT')
    
    # Add PDF file
    body << "--#{boundary}\r\n".force_encoding('ASCII-8BIT')
    body << "Content-Disposition: form-data; name=\"pdf_file\"; filename=\"#{@original_filename}\"\r\n".force_encoding('ASCII-8BIT')
    body << "Content-Type: application/pdf\r\n\r\n".force_encoding('ASCII-8BIT')
    body << File.binread(pdf_path)
    body << "\r\n".force_encoding('ASCII-8BIT')
    
    # Add Document AI JSON file
    body << "--#{boundary}\r\n".force_encoding('ASCII-8BIT')
    body << "Content-Disposition: form-data; name=\"docai_file\"; filename=\"docai_response.json\"\r\n".force_encoding('ASCII-8BIT')
    body << "Content-Type: application/json\r\n\r\n".force_encoding('ASCII-8BIT')
    body << File.read(docai_path, encoding: 'UTF-8').force_encoding('ASCII-8BIT')
    body << "\r\n".force_encoding('ASCII-8BIT')
    
    # Close boundary
    body << "--#{boundary}--\r\n".force_encoding('ASCII-8BIT')
    
    body
  end

  def cleanup_temp_files(*temp_files)
    temp_files.compact.each do |temp_file|
      begin
        if temp_file && !temp_file.closed?
          temp_file.close
          temp_file.unlink
        end
      rescue StandardError => e
        Rails.logger.warn "Error cleaning up temp file: #{e.message}"
      end
    end
  end
end 
class Api::V1::DocumentParserController < ApplicationController
  def parse
    begin
      # Check if file was uploaded
      unless params[:file].present?
        return render json: { 
          error: 'No file uploaded',
          details: 'Please upload a PDF file'
        }, status: :bad_request
      end

      uploaded_file = params[:file]

      # Validate file type
      unless uploaded_file.content_type == 'application/pdf'
        return render json: { 
          error: 'Invalid file type',
          details: 'Only PDF files are supported'
        }, status: :bad_request
      end

      # Create temporary file with explicit binary mode
      temp_file = Tempfile.new(['uploaded', '.pdf'], binmode: true)
      
      begin
        # Read uploaded file in binary mode and write to temp file
        uploaded_content = uploaded_file.read
        temp_file.write(uploaded_content)
        temp_file.rewind
        
        Rails.logger.info "Created temp file: #{temp_file.path}, size: #{uploaded_content.size} bytes"
        Rails.logger.info "Original filename: #{uploaded_file.original_filename}"
        
        # Initialize Document AI service with file path and original filename
        parser_service = DocumentAiParserService.new(temp_file.path, uploaded_file.original_filename)
      
        # Parse the document with Document AI
        docai_result = parser_service.parse
        
        # Process form fields with the processor service
        processor_service = FormFieldProcessorService.new(temp_file.path, docai_result, uploaded_file.original_filename)
        result = processor_service.process
        
      ensure
        # Clean up temporary file
        if temp_file
          temp_file.close
          temp_file.unlink
        end
      end
      
      # Return the enhanced structure
      render json: result, status: :ok
      
    rescue StandardError => e
      Rails.logger.error "Document parsing failed: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      
      render json: { 
        error: 'Document parsing failed',
        details: e.message
      }, status: :internal_server_error
    end
  end
end 
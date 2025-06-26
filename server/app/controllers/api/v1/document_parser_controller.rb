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

      # Create temporary file
      temp_file = Tempfile.new(['uploaded', '.pdf'])
      temp_file.binmode
      temp_file.write(uploaded_file.read)
      temp_file.rewind

      # Initialize service with file path and original filename
      parser_service = DocumentAiParserService.new(temp_file.path, uploaded_file.original_filename)
      
      # Parse the document
      result = parser_service.parse
      
      # Clean up temporary file
      temp_file.close
      temp_file.unlink
      
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
class Api::V1::UploadsController < ApplicationController
  def create
    Rails.logger.info "Document parsing request received"
    
    # Check if file is present
    unless params[:file].present?
      Rails.logger.error "No file provided in request"
      return render json: { error: 'No file provided' }, status: :bad_request
    end

    uploaded_file = params[:file]
    
    # Validate file type
    unless uploaded_file.content_type == 'application/pdf'
      Rails.logger.error "Invalid file type: #{uploaded_file.content_type}"
      return render json: { error: 'Only PDF files are supported' }, status: :bad_request
    end

    begin
      # Save uploaded file temporarily
      temp_file = Tempfile.new(['upload', '.pdf'])
      temp_file.binmode
      temp_file.write(uploaded_file.read)
      temp_file.rewind
      
      Rails.logger.info "Processing PDF: #{uploaded_file.original_filename}"
      
      # Process with our form field processor
      processor_service = FormFieldProcessorService.new
      processor_result = processor_service.process_pdf(temp_file.path)
      
      Rails.logger.info "Document processing completed successfully"
      
      # Return raw processor output without AI enhancement
      render json: processor_result
      
    rescue StandardError => e
      Rails.logger.error "Document processing failed: #{e.message}"
      Rails.logger.error e.backtrace.join("\n")
      
      render json: {
        success: false,
        error: e.message
      }, status: :internal_server_error
      
    ensure
      # Clean up temporary file
      if temp_file
        temp_file.close
        temp_file.unlink rescue nil
      end
    end
  end
end 